-- Fondos multimoneda (etapa 1: motor de imputación).
--   * Cada fondo tiene una moneda (PEN/USD): su presupuesto, consumo y saldo se llevan en esa moneda («nominal»).
--   * expense_fund_allocations.amount sigue siendo el importe CONTABLE en PEN (todo lo que ya lo consume no cambia);
--     fund_amount es lo que se descuenta del fondo en SU moneda. Para fondos PEN ambos coinciden.
--   * allow_cross_currency (por defecto false): un fondo solo cubre gastos de otra moneda si el usuario lo autoriza.
--   * Un gasto puede quedar parcialmente sin cubrir por restricción de moneda: expense_uncovered lo registra explícitamente y la
--     regla de conciliación pasa a ser  cubierto + no cubierto = importe del gasto.
-- Los períodos históricos NO se recalculan: sus imputaciones PEN reciben metadatos de identidad (fund_amount = amount).

alter table public.funds
  add column if not exists currency text not null default 'PEN' check (currency in ('PEN','USD')),
  add column if not exists allow_cross_currency boolean not null default false;
alter table public.fund_templates
  add column if not exists currency text not null default 'PEN' check (currency in ('PEN','USD')),
  add column if not exists allow_cross_currency boolean not null default false;

alter table public.expense_fund_allocations
  add column if not exists fund_currency text not null default 'PEN' check (fund_currency in ('PEN','USD')),
  add column if not exists fund_amount numeric(14,2),
  add column if not exists exchange_rate numeric(24,12) not null default 1 check (exchange_rate > 0),
  add column if not exists rate_source text,
  add column if not exists rate_reference_date date;
update public.expense_fund_allocations set fund_amount = amount where fund_amount is null;
set constraints all immediate;
alter table public.expense_fund_allocations alter column fund_amount set not null;
alter table public.expense_fund_allocations drop constraint if exists allocations_fund_amount_valid;
alter table public.expense_fund_allocations add constraint allocations_fund_amount_valid
  check (fund_amount > 0 and (fund_currency <> 'PEN' or fund_amount = amount));

-- Escritores antiguos (sin fund_amount) siguen funcionando: por defecto se descuenta el importe contable, como siempre.
create or replace function public.allocation_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.fund_amount is null then new.fund_amount := new.amount; end if;
  return new;
end $$;
drop trigger if exists allocations_defaults on public.expense_fund_allocations;
create trigger allocations_defaults before insert on public.expense_fund_allocations for each row execute function public.allocation_defaults();

-- Remanente que ningún fondo elegible pudo cubrir por restricción de moneda (se conserva el gasto completo).
create table if not exists public.expense_uncovered (
  expense_id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  period_id uuid not null,
  uncovered_amount numeric(14,2) not null check (uncovered_amount > 0),       -- equivalente contable en PEN
  uncovered_original numeric(14,2) not null check (uncovered_original > 0),   -- en la moneda original del gasto
  original_currency text not null check (original_currency in ('PEN','USD')),
  reason text not null default 'currency' check (reason in ('currency')),
  created_at timestamptz not null default now(),
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete cascade,
  foreign key (period_id, household_id) references public.budget_periods(id, household_id)
);
create index if not exists expense_uncovered_period_idx on public.expense_uncovered(period_id);
alter table public.expense_uncovered enable row level security;
drop policy if exists expense_uncovered_own on public.expense_uncovered;
create policy expense_uncovered_own on public.expense_uncovered for select to authenticated using (household_id = public.current_household_id());
revoke all on public.expense_uncovered from anon, authenticated;
grant select on public.expense_uncovered to authenticated;

-- Un fondo con imputaciones no puede cambiar de moneda: reinterpretaría su historial (PEN 100 ≠ US$ 100).
create or replace function public.funds_currency_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.currency is distinct from old.currency and exists (select 1 from public.expense_fund_allocations a where a.fund_id = old.id) then
    raise exception 'Un fondo con gastos imputados no puede cambiar de moneda. Crea un fondo nuevo en la otra moneda.' using errcode = 'GD012';
  end if;
  return new;
end $$;
drop trigger if exists funds_currency_guard on public.funds;
create trigger funds_currency_guard before update on public.funds for each row execute function public.funds_currency_guard();

-- Cotización USD/PEN verificada para una fecha (la del día o la última anterior, máx. 7 días); sin dato no hay cobertura cruzada hacia fondos USD.
create or replace function public.quote_rate_on(p_date date) returns table(rate numeric, reference_date date, source text)
language sql stable set search_path = '' as $$
  select q.rate, q.reference_date, q.source from public.exchange_rate_quotes q
  where q.date_requested <= p_date and q.date_requested >= p_date - 7 and q.reference_date <= p_date
  order by q.date_requested desc limit 1
$$;
revoke all on function public.quote_rate_on(date) from public, anon, authenticated;

-- Aritmética de una imputación (todo a 2 decimales, sin coma flotante):
--   fund_amount = lo que se descuenta del fondo en su moneda · pen_part = su equivalente contable · orig_used = parte del gasto cubierta
--   en su moneda original. La última pieza absorbe el residuo de redondeo, de modo que las piezas suman exactamente el gasto.
--   p_rate = PEN por US$ (la del gasto si es USD; la cotización de su fecha si es PEN y el fondo es USD).
create or replace function public.allocation_piece(p_fund_cur text, p_exp_cur text, p_cap numeric, p_left_pen numeric, p_left_orig numeric, p_rate numeric, p_unbounded boolean)
returns table(fund_amount numeric, pen_part numeric, orig_used numeric)
language plpgsql immutable set search_path = '' as $$
declare pen numeric; fa numeric;
begin
  if p_fund_cur = p_exp_cur then
    if p_unbounded or p_cap >= p_left_orig then return query select p_left_orig, p_left_pen, p_left_orig; return; end if;
    pen := case when p_exp_cur = 'PEN' then p_cap else least(p_left_pen, round(p_cap * p_rate, 2)) end;
    return query select p_cap, pen, p_cap;
  elsif p_exp_cur = 'USD' then            -- gasto USD, fondo PEN (cobertura cruzada)
    if p_unbounded or p_cap >= p_left_pen then return query select p_left_pen, p_left_pen, p_left_orig; return; end if;
    return query select p_cap, p_cap, least(p_left_orig, round(p_cap / p_rate, 2));
  else                                    -- gasto PEN, fondo USD (cobertura cruzada)
    if p_rate is null or p_rate <= 0 then return; end if;
    if p_unbounded or p_cap * p_rate >= p_left_pen then
      fa := round(p_left_pen / p_rate, 2);
      if not p_unbounded then fa := least(fa, p_cap); end if;
      return query select fa, p_left_pen, p_left_pen;
      return;
    end if;
    pen := round(p_cap * p_rate, 2);
    return query select p_cap, pen, pen;
  end if;
end $$;
revoke all on function public.allocation_piece(text, text, numeric, numeric, numeric, numeric, boolean) from public, anon, authenticated;

-- Conciliación: cubierto (imputaciones) + no cubierto = importe del gasto. Sin fondos en el mes del gasto no se exige nada (como antes).
create or replace function public.check_allocation_sum() returns trigger
language plpgsql security definer set search_path = '' as $$
declare eid uuid; v_amount numeric; v_status text; v_date date; v_hid uuid; v_sum numeric; v_unc numeric;
begin
  if tg_table_name = 'expenses' then eid := new.id;
  elsif tg_op = 'DELETE' then eid := old.expense_id;
  else eid := new.expense_id; end if;
  select amount, status, expense_date, household_id into v_amount, v_status, v_date, v_hid from public.expenses where id = eid;
  if not found then return null; end if; -- el gasto ya no existe (borrado en cascada)
  select coalesce(sum(amount), 0) into v_sum from public.expense_fund_allocations where expense_id = eid;
  select coalesce(sum(uncovered_amount), 0) into v_unc from public.expense_uncovered where expense_id = eid;
  if v_status = 'active' and v_sum + v_unc <> v_amount then
    if v_sum + v_unc = 0 and not exists (
      select 1 from public.funds fu join public.budget_periods bp on bp.id = fu.period_id
      where bp.household_id = v_hid and fu.is_active and v_date between bp.start_date and bp.end_date
    ) then return null; end if; -- el mes del gasto no tiene fondos
    raise exception 'La suma de imputaciones (%) más el remanente no cubierto (%) no coincide con el gasto (%).', v_sum, v_unc, v_amount using errcode = '23514';
  end if;
  return null;
end $$;
drop trigger if exists uncovered_allocation_sum on public.expense_uncovered;
create constraint trigger uncovered_allocation_sum after insert or update or delete on public.expense_uncovered
  deferrable initially deferred for each row execute function public.check_allocation_sum();

-- Motor de imputación. Para períodos con fondos solo PEN reproduce exactamente el comportamiento anterior.
-- Orden: fondos específicos de la MISMA moneda del gasto → específicos de otra moneda con cobertura cruzada autorizada → Fondo General
-- (si su moneda es la del gasto o tiene cobertura cruzada). Dentro de cada grupo rigen las prioridades de siempre.
-- Un fondo específico nunca se excede por esta vía; el excedente va al General (que puede quedar negativo). Si hay General pero no puede
-- absorber por moneda, el remanente queda registrado como no cubierto (no se consume ningún otro fondo). Sin General, el excedente va al
-- primer fondo específico utilizable con sobregasto advertido (como antes). Sin ningún fondo utilizable, el gasto queda sin cubrir.
create or replace function public.recalc_period(p_period uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.budget_periods%rowtype;
  v_rem jsonb;
  e record; f record; pc record;
  v_left_pen numeric; v_left_orig numeric; v_cur numeric;
  v_general uuid; v_general_cur text; v_general_exists boolean; v_first uuid; v_first_cur text;
  v_admitted boolean; v_reason text; v_scope_any boolean; v_method_any boolean;
  v_has_usd_cross boolean; v_ec text;
  v_rate numeric; v_src text; v_ref date; v_qr numeric; v_qsrc text; v_qref date;
  v_usable boolean;
begin
  -- Serializa los recálculos del mismo período: dos gastos simultáneos no pueden consumir el mismo saldo.
  select * into v_p from public.budget_periods where id = p_period for update;
  if not found then raise exception 'Período no encontrado.' using errcode = 'GD004'; end if;
  if v_p.status = 'closed' then raise exception 'El período ya está cerrado y no se puede recalcular.' using errcode = 'GD002'; end if;

  delete from public.expense_fund_allocations where period_id = p_period;
  delete from public.expense_uncovered where period_id = p_period;

  if not exists (select 1 from public.funds fu where fu.period_id = p_period and fu.is_active) then return; end if;

  -- Capacidad restante por fondo activo del período, en la moneda del propio fondo.
  select coalesce(jsonb_object_agg(fu.id::text, coalesce(b.assigned_amount, 0)), '{}'::jsonb) into v_rem
  from public.funds fu left join public.fund_period_budgets b on b.fund_id = fu.id and b.period_id = p_period
  where fu.period_id = p_period and fu.is_active;
  select exists (select 1 from public.funds fu where fu.period_id = p_period and fu.is_active and fu.currency = 'USD' and fu.allow_cross_currency) into v_has_usd_cross;

  for e in
    select x.* from public.expenses x
    where x.household_id = v_p.household_id and x.status = 'active' and x.expense_date between v_p.start_date and v_p.end_date
    order by x.expense_date, x.created_at, x.id
  loop
    v_ec := e.original_currency; v_left_pen := e.amount; v_left_orig := e.original_amount;
    v_general := null; v_general_cur := null; v_general_exists := false; v_first := null; v_first_cur := null; v_admitted := false;
    v_qr := null;
    if v_ec = 'PEN' and v_has_usd_cross then select q.rate, q.reference_date, q.source into v_qr, v_qref, v_qsrc from public.quote_rate_on(e.expense_date) q; end if;

    for f in
      select fu.id, fu.is_general, fu.currency, fu.allow_cross_currency
      from public.funds fu
      where fu.period_id = p_period and fu.is_active
        and public.fund_admits(fu.id, e.ambito_id, e.categoria_id, e.subcategoria_id, e.payment_method_id)
      order by fu.is_general, (fu.currency <> v_ec), fu.priority, fu.name, fu.id
    loop
      v_admitted := true;
      if f.is_general then v_general_exists := true; end if;
      -- Tasa aplicable a esta pareja gasto/fondo y si el fondo puede usarse.
      v_usable := (f.currency = v_ec) or f.allow_cross_currency;
      v_rate := null; v_src := null; v_ref := null;
      if v_usable then
        if v_ec = 'USD' then v_rate := e.exchange_rate; v_src := e.exchange_rate_source; v_ref := e.exchange_rate_reference_date;
        elsif f.currency = 'USD' then
          v_rate := v_qr; v_src := v_qsrc; v_ref := v_qref;
          if v_rate is null then v_usable := false; end if; -- sin cotización verificada no se cubre en cruzado
        end if;
      end if;
      if not v_usable then continue; end if;
      if f.is_general then v_general := f.id; v_general_cur := f.currency; continue; end if;
      if v_first is null then v_first := f.id; v_first_cur := f.currency; end if;
      if v_left_pen <= 0 then continue; end if;
      v_cur := coalesce((v_rem ->> f.id::text)::numeric, 0);
      if v_cur <= 0 then continue; end if;
      select * into pc from public.allocation_piece(f.currency, v_ec, v_cur, v_left_pen, v_left_orig, v_rate, false);
      if pc.fund_amount is not null and pc.fund_amount > 0 and pc.pen_part > 0 then
        insert into public.expense_fund_allocations (household_id, expense_id, fund_id, period_id, amount, allocation_kind, fund_currency, fund_amount, exchange_rate, rate_source, rate_reference_date)
        values (v_p.household_id, e.id, f.id, p_period, pc.pen_part, 'specific', f.currency, pc.fund_amount, case when f.currency = 'PEN' and v_ec = 'PEN' then 1 else coalesce(v_rate, 1) end, v_src, v_ref);
        v_rem := jsonb_set(v_rem, array[f.id::text], to_jsonb(v_cur - pc.fund_amount));
        v_left_pen := v_left_pen - pc.pen_part; v_left_orig := v_left_orig - pc.orig_used;
        if v_left_pen <= 0 then v_left_orig := 0; end if;
      end if;
    end loop;

    if not v_admitted then
      select exists (select 1 from public.funds fu where fu.period_id = p_period and fu.is_active and public.fund_admits_scope(fu.id, e.ambito_id, e.categoria_id, e.subcategoria_id)) into v_scope_any;
      select exists (select 1 from public.funds fu where fu.period_id = p_period and fu.is_active and public.fund_admits_method(fu.id, e.payment_method_id)) into v_method_any;
      v_reason := case when not v_scope_any then 'classification' when not v_method_any then 'payment_method' else 'rules' end;
      raise exception 'Ningún fondo admite "%" (%).', e.description,
        case v_reason
          when 'classification' then 'la clasificación no está cubierta por ningún fondo de este mes'
          when 'payment_method' then 'el medio de pago no está admitido por ningún fondo de este mes'
          else 'ningún fondo de este mes admite a la vez esa clasificación y ese medio de pago'
        end using errcode = 'GD001', detail = v_reason;
    end if;

    if v_left_pen > 0 then
      -- Quién absorbe el remanente: el General si existe y es utilizable; sin General, el primer específico utilizable (sobregasto advertido).
      if v_general is not null then
        v_cur := coalesce((v_rem ->> v_general::text)::numeric, 0);
        v_rate := case when v_ec = 'USD' then e.exchange_rate when v_general_cur = 'USD' then v_qr else null end;
        v_src := case when v_ec = 'USD' then e.exchange_rate_source when v_general_cur = 'USD' then v_qsrc end;
        v_ref := case when v_ec = 'USD' then e.exchange_rate_reference_date when v_general_cur = 'USD' then v_qref end;
        select * into pc from public.allocation_piece(v_general_cur, v_ec, 0, v_left_pen, v_left_orig, v_rate, true);
        insert into public.expense_fund_allocations (household_id, expense_id, fund_id, period_id, amount, allocation_kind, fund_currency, fund_amount, exchange_rate, rate_source, rate_reference_date)
        values (v_p.household_id, e.id, v_general, p_period, pc.pen_part, 'general', v_general_cur, pc.fund_amount, case when v_general_cur = 'PEN' and v_ec = 'PEN' then 1 else coalesce(v_rate, 1) end, v_src, v_ref);
        v_rem := jsonb_set(v_rem, array[v_general::text], to_jsonb(v_cur - pc.fund_amount));
        v_left_pen := 0; v_left_orig := 0;
      elsif not v_general_exists and v_first is not null then
        v_cur := coalesce((v_rem ->> v_first::text)::numeric, 0);
        v_rate := case when v_ec = 'USD' then e.exchange_rate when v_first_cur = 'USD' then v_qr else null end;
        v_src := case when v_ec = 'USD' then e.exchange_rate_source when v_first_cur = 'USD' then v_qsrc end;
        v_ref := case when v_ec = 'USD' then e.exchange_rate_reference_date when v_first_cur = 'USD' then v_qref end;
        select * into pc from public.allocation_piece(v_first_cur, v_ec, 0, v_left_pen, v_left_orig, v_rate, true);
        insert into public.expense_fund_allocations (household_id, expense_id, fund_id, period_id, amount, allocation_kind, fund_currency, fund_amount, exchange_rate, rate_source, rate_reference_date)
        values (v_p.household_id, e.id, v_first, p_period, pc.pen_part, 'specific', v_first_cur, pc.fund_amount, case when v_first_cur = 'PEN' and v_ec = 'PEN' then 1 else coalesce(v_rate, 1) end, v_src, v_ref);
        v_rem := jsonb_set(v_rem, array[v_first::text], to_jsonb(v_cur - pc.fund_amount));
        v_left_pen := 0; v_left_orig := 0;
      end if;
    end if;

    if v_left_pen > 0 then
      insert into public.expense_uncovered (expense_id, household_id, period_id, uncovered_amount, uncovered_original, original_currency, reason)
      values (e.id, v_p.household_id, p_period, v_left_pen, greatest(v_left_orig, 0.01), v_ec, 'currency');
    end if;
  end loop;
end $$;

-- El informe del gasto (vista previa y confirmación) distingue lo nominal del fondo, lo contable y el remanente no cubierto.
create or replace function public.expense_report(p_expense uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with al as (
    select a.fund_id, f.name, f.is_general, f.currency, a.allocation_kind, a.amount, a.fund_amount, a.exchange_rate,
      coalesce(b.assigned_amount, 0) - (
        select coalesce(sum(x.fund_amount), 0) from public.expense_fund_allocations x where x.period_id = a.period_id and x.fund_id = a.fund_id
      ) as remaining_after
    from public.expense_fund_allocations a
    join public.funds f on f.id = a.fund_id
    left join public.fund_period_budgets b on b.fund_id = a.fund_id and b.period_id = a.period_id
    where a.expense_id = p_expense
  )
  select jsonb_build_object(
    'expense_id', p_expense,
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object('fund_id', fund_id, 'fund_name', name, 'is_general', is_general, 'kind', allocation_kind, 'amount', amount,
        'fund_currency', currency, 'fund_amount', fund_amount, 'exchange_rate', exchange_rate, 'remaining_after', remaining_after) order by is_general, name)
      from al), '[]'::jsonb),
    'warnings', coalesce((
      select jsonb_agg(jsonb_build_object('code', case when is_general then 'general_negative' else 'specific_overspend' end,
        'fund_id', fund_id, 'fund_name', name, 'remaining_after', remaining_after, 'fund_currency', currency))
      from al where remaining_after < 0), '[]'::jsonb),
    'uncovered', (select jsonb_build_object('amount', u.uncovered_amount, 'original_amount', u.uncovered_original, 'currency', u.original_currency, 'reason', u.reason)
      from public.expense_uncovered u where u.expense_id = p_expense)
  );
$$;

notify pgrst, 'reload schema';
