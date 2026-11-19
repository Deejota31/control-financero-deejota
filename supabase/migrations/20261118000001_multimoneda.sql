-- Multimoneda USD/PEN con doble representación.
--   * expenses.amount sigue siendo el importe CONTABLE en PEN: todos los motores (fondos, períodos, dashboard,
--     eventos, proyecciones) lo consumen sin cambios y nunca ven dólares.
--   * original_currency/original_amount conservan lo que se pagó; exchange_rate y su procedencia quedan
--     congelados en el movimiento y no se recalculan jamás con cotizaciones posteriores.
-- Los movimientos históricos son PEN (CHECK currency='PEN'): se les asigna la identidad sin tocar importes,
-- fechas ni imputaciones.

alter table public.expenses
  add column if not exists original_currency text not null default 'PEN' check (original_currency in ('PEN','USD')),
  add column if not exists original_amount numeric(14,2),
  add column if not exists exchange_rate numeric(24,12) not null default 1,
  add column if not exists exchange_rate_source text not null default 'identity',
  add column if not exists exchange_rate_reference_date date,
  add column if not exists conversion_method text not null default 'none',
  add column if not exists exchange_rate_fetched_at timestamptz,
  add column if not exists conversion_snapshot_version integer not null default 1;

-- Solo metadatos: sin tocar updated_at ni la auditoría, y sin dejar eventos de trigger pendientes
-- (impedirían los ALTER TABLE siguientes en la misma transacción).
alter table public.expenses disable trigger expenses_set_updated_at;
alter table public.expenses disable trigger expenses_audit_u;
update public.expenses set original_amount = amount, exchange_rate_reference_date = expense_date where original_amount is null;
set constraints all immediate;
alter table public.expenses enable trigger expenses_audit_u;
alter table public.expenses enable trigger expenses_set_updated_at;

alter table public.expenses alter column original_amount set not null;
alter table public.expenses alter column exchange_rate_reference_date set not null;
alter table public.expenses drop constraint if exists expenses_conversion_valid;
alter table public.expenses add constraint expenses_conversion_valid check (
  original_amount > 0 and exchange_rate > 0 and exchange_rate < 1000000 and conversion_snapshot_version = 1 and
  ((original_currency = 'PEN' and conversion_method = 'none' and exchange_rate = 1 and original_amount = amount)
   or (original_currency = 'USD' and conversion_method in ('automatic','manual','exact') and exchange_rate_source <> ''
       and (conversion_method = 'exact' or amount = round(original_amount * exchange_rate, 2)))));

-- La plantilla guarda moneda e importe de referencia (default_amount está en esa moneda); nunca una tasa.
alter table public.expense_templates
  add column if not exists original_currency text not null default 'PEN' check (original_currency in ('PEN','USD'));

-- Valida y completa una instantánea de conversión. Entrada: expense_date, amount (PEN contable o cargo exacto),
-- original_currency, original_amount, exchange_rate, método y procedencia. Nunca asume 1:1 para USD.
create or replace function public.normalize_conversion(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  c text := coalesce(nullif(p ->> 'original_currency', ''), 'PEN');
  m text := coalesce(nullif(p ->> 'conversion_method', ''), 'none');
  a numeric; r numeric; pen numeric; d date;
begin
  if c not in ('PEN','USD') then raise exception 'Moneda no admitida.' using errcode = 'GD010'; end if;
  if c = 'PEN' then
    return p || jsonb_build_object('original_currency', 'PEN', 'original_amount', p -> 'amount', 'exchange_rate', 1,
      'conversion_method', 'none', 'exchange_rate_source', 'identity', 'exchange_rate_reference_date', p ->> 'expense_date',
      'exchange_rate_fetched_at', null, 'conversion_snapshot_version', 1);
  end if;
  a := (p ->> 'original_amount')::numeric;
  if a is null or a <= 0 or a <> round(a, 2) then raise exception 'El importe en dólares no es válido.' using errcode = 'GD010'; end if;
  if m not in ('automatic','manual','exact') then raise exception 'El método de conversión no es válido.' using errcode = 'GD010'; end if;
  if m = 'exact' then
    pen := (p ->> 'amount')::numeric;
    if pen is null or pen <= 0 or pen <> round(pen, 2) then raise exception 'El cargo exacto en soles no es válido.' using errcode = 'GD010'; end if;
    r := round(pen / a, 12);
  else
    r := (p ->> 'exchange_rate')::numeric;
    if r is null or r <= 0 then raise exception 'Falta un tipo de cambio válido.' using errcode = 'GD010'; end if;
    pen := round(a * r, 2);
  end if;
  if r <= 0 or r >= 1000000 or pen <= 0 then raise exception 'La conversión resultante no es válida.' using errcode = 'GD010'; end if;
  d := (p ->> 'exchange_rate_reference_date')::date;
  if d is null or nullif(p ->> 'exchange_rate_source', '') is null then
    raise exception 'Falta la fuente o la fecha de la cotización.' using errcode = 'GD010';
  end if;
  if m = 'automatic' and p ->> 'exchange_rate_fetched_at' is null then
    raise exception 'Falta la fecha de consulta de la cotización automática.' using errcode = 'GD010';
  end if;
  return p || jsonb_build_object('original_currency', 'USD', 'original_amount', a, 'amount', pen, 'exchange_rate', r,
    'conversion_method', m, 'conversion_snapshot_version', 1);
end $$;
revoke all on function public.normalize_conversion(jsonb) from public, anon, authenticated;

-- Caché pública de cotizaciones oficiales (BCRP). Solo la escribe la función de borde (rol de servicio, por los privilegios por defecto del esquema);
-- las cotizaciones automáticas que se guardan deben coincidir con una fila verificada.
create table if not exists public.exchange_rate_quotes (
  date_requested date primary key,
  rate numeric(24,12) not null check (rate > 0 and rate < 1000000),
  reference_date date not null,
  source text not null check (source <> ''),
  fetched_at timestamptz not null default now(),
  check (reference_date <= date_requested and reference_date >= date_requested - 14)
);
alter table public.exchange_rate_quotes enable row level security;
drop policy if exists quotes_read on public.exchange_rate_quotes;
create policy quotes_read on public.exchange_rate_quotes for select to authenticated using (true);
revoke all on public.exchange_rate_quotes from anon, authenticated;
grant select on public.exchange_rate_quotes to authenticated;

-- Una cotización automática nueva debe coincidir con la caché verificada de esa fecha y no ser posterior al gasto.
create or replace function public.validate_conversion_reference(p jsonb) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p ->> 'original_currency' = 'USD' and p ->> 'conversion_method' = 'automatic' then
    if (p ->> 'exchange_rate_reference_date')::date > (p ->> 'expense_date')::date or not exists (
      select 1 from public.exchange_rate_quotes q
      where q.date_requested = (p ->> 'expense_date')::date and q.rate = (p ->> 'exchange_rate')::numeric
        and q.reference_date = (p ->> 'exchange_rate_reference_date')::date and q.source = p ->> 'exchange_rate_source') then
      raise exception 'La cotización automática no coincide con una referencia verificada.' using errcode = 'GD010';
    end if;
  end if;
end $$;
revoke all on function public.validate_conversion_reference(jsonb) from public, anon, authenticated;

-- Escrituras antiguas (PEN) adquieren la identidad sin que el motor lo sepa; un cliente no puede forzar PEN con tasa distinta.
create or replace function public.expense_conversion_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.original_currency = 'PEN' then
    new.original_amount := new.amount; new.exchange_rate := 1; new.conversion_method := 'none';
    new.exchange_rate_source := 'identity'; new.exchange_rate_reference_date := new.expense_date; new.exchange_rate_fetched_at := null;
  end if;
  return new;
end $$;
drop trigger if exists expenses_conversion_defaults on public.expenses;
create trigger expenses_conversion_defaults before insert or update on public.expenses
  for each row execute function public.expense_conversion_defaults();

-- Registro de un gasto: misma lógica que antes (idempotencia, período cerrado, comprobante, motor de fondos),
-- más la instantánea de conversión validada en el servidor.
create or replace function public.create_expense(p jsonb, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hid uuid := public.current_household_id();
  v_id uuid; v_period uuid; v_status text; v_prev jsonb; v_res jsonb;
  v_receipt text := nullif(p ->> 'receipt_path', '');
  v_c jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_key is null then raise exception 'Falta la clave de idempotencia.'; end if;

  select response into v_prev from public.idempotency_requests
  where household_id = v_hid and key = p_key and operation = 'create_expense';
  if found then return v_prev || '{"replayed": true}'::jsonb; end if;

  if v_receipt is not null and v_receipt not like v_hid::text || '/%' then
    raise exception 'Ruta de comprobante no válida.' using errcode = 'GD009';
  end if;

  v_period := public.ensure_period(v_hid, (p ->> 'expense_date')::date);
  select status into v_status from public.budget_periods where id = v_period;
  if v_status = 'closed' then raise exception 'El período de esa fecha está cerrado.' using errcode = 'GD002'; end if;

  v_c := public.normalize_conversion(p);
  perform public.validate_conversion_reference(v_c);

  insert into public.expenses (
    id, household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id,
    payment_method_id, expense_type, is_recurring, notes, receipt_path, template_id, created_by,
    original_currency, original_amount, exchange_rate, exchange_rate_source, exchange_rate_reference_date,
    conversion_method, exchange_rate_fetched_at, conversion_snapshot_version
  ) values (
    coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid()), v_hid, (p ->> 'expense_date')::date,
    (v_c ->> 'amount')::numeric, p ->> 'description', (p ->> 'ambito_id')::uuid, (p ->> 'categoria_id')::uuid,
    nullif(p ->> 'subcategoria_id', '')::uuid, (p ->> 'payment_method_id')::uuid,
    coalesce(p ->> 'expense_type', 'variable'), coalesce((p ->> 'is_recurring')::boolean, false),
    nullif(p ->> 'notes', ''), v_receipt, nullif(p ->> 'template_id', '')::uuid, (select auth.uid()),
    v_c ->> 'original_currency', (v_c ->> 'original_amount')::numeric, (v_c ->> 'exchange_rate')::numeric,
    v_c ->> 'exchange_rate_source', (v_c ->> 'exchange_rate_reference_date')::date,
    v_c ->> 'conversion_method', (v_c ->> 'exchange_rate_fetched_at')::timestamptz, 1
  ) returning id into v_id;

  perform public.recalc_period(v_period);

  v_res := public.expense_report(v_id) || jsonb_build_object('replayed', false, 'period_id', v_period);
  insert into public.idempotency_requests (household_id, key, operation, response)
  values (v_hid, p_key, 'create_expense', v_res);
  return v_res;
end;
$$;

-- Edición: la conversión congelada se conserva salvo que el cliente envíe una instantánea distinta.
-- Cambiar la fecha o el importe PEN nunca consulta ni sustituye una tasa por sí solo.
create or replace function public.update_expense(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hid uuid := public.current_household_id();
  e public.expenses%rowtype;
  v_old uuid; v_new uuid; v_status text; v_date date; v_receipt text; v_c jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  select * into e from public.expenses where id = p_id and household_id = v_hid for update;
  if not found then raise exception 'Gasto no encontrado.' using errcode = 'GD004'; end if;
  if e.status = 'annulled' then raise exception 'Restaura el gasto antes de editarlo.' using errcode = 'GD005'; end if;

  v_receipt := case when p ? 'receipt_path' then nullif(p ->> 'receipt_path', '') else e.receipt_path end;
  if v_receipt is not null and v_receipt not like v_hid::text || '/%' then
    raise exception 'Ruta de comprobante no válida.' using errcode = 'GD009';
  end if;

  v_date := coalesce((p ->> 'expense_date')::date, e.expense_date);
  v_old := public.ensure_period(v_hid, e.expense_date);
  v_new := public.ensure_period(v_hid, v_date);
  select status into v_status from public.budget_periods where id = v_old;
  if v_status = 'closed' then raise exception 'El período del gasto está cerrado.' using errcode = 'GD002'; end if;
  select status into v_status from public.budget_periods where id = v_new;
  if v_status = 'closed' then raise exception 'El período de la nueva fecha está cerrado.' using errcode = 'GD002'; end if;

  v_c := public.normalize_conversion(jsonb_build_object(
    'expense_date', v_date,
    'amount', coalesce(p -> 'amount', to_jsonb(e.amount)),
    'original_currency', coalesce(p ->> 'original_currency', e.original_currency),
    'original_amount', coalesce(p -> 'original_amount', to_jsonb(e.original_amount)),
    'exchange_rate', coalesce(p -> 'exchange_rate', to_jsonb(e.exchange_rate)),
    'exchange_rate_source', coalesce(p ->> 'exchange_rate_source', e.exchange_rate_source),
    'exchange_rate_reference_date', coalesce(p ->> 'exchange_rate_reference_date', e.exchange_rate_reference_date::text),
    'conversion_method', coalesce(p ->> 'conversion_method', e.conversion_method),
    'exchange_rate_fetched_at', coalesce(p ->> 'exchange_rate_fetched_at', e.exchange_rate_fetched_at::text)));
  -- Solo una cotización automática distinta de la ya guardada se contrasta con la caché verificada.
  if v_c ->> 'original_currency' = 'USD' and v_c ->> 'conversion_method' = 'automatic' and (
      e.original_currency <> 'USD' or e.conversion_method <> 'automatic'
      or (v_c ->> 'exchange_rate')::numeric is distinct from e.exchange_rate
      or (v_c ->> 'exchange_rate_reference_date')::date is distinct from e.exchange_rate_reference_date
      or v_c ->> 'exchange_rate_source' is distinct from e.exchange_rate_source) then
    perform public.validate_conversion_reference(v_c);
  end if;

  update public.expenses set
    expense_date = v_date,
    amount = (v_c ->> 'amount')::numeric,
    original_currency = v_c ->> 'original_currency',
    original_amount = (v_c ->> 'original_amount')::numeric,
    exchange_rate = (v_c ->> 'exchange_rate')::numeric,
    exchange_rate_source = v_c ->> 'exchange_rate_source',
    exchange_rate_reference_date = (v_c ->> 'exchange_rate_reference_date')::date,
    conversion_method = v_c ->> 'conversion_method',
    exchange_rate_fetched_at = (v_c ->> 'exchange_rate_fetched_at')::timestamptz,
    description = coalesce(p ->> 'description', description),
    ambito_id = coalesce((p ->> 'ambito_id')::uuid, ambito_id),
    categoria_id = coalesce((p ->> 'categoria_id')::uuid, categoria_id),
    subcategoria_id = case when p ? 'subcategoria_id' then nullif(p ->> 'subcategoria_id', '')::uuid else subcategoria_id end,
    payment_method_id = coalesce((p ->> 'payment_method_id')::uuid, payment_method_id),
    expense_type = coalesce(p ->> 'expense_type', expense_type),
    is_recurring = coalesce((p ->> 'is_recurring')::boolean, is_recurring),
    notes = case when p ? 'notes' then nullif(p ->> 'notes', '') else notes end,
    receipt_path = v_receipt
  where id = p_id;

  perform public.recalc_period(v_old);
  if v_new <> v_old then perform public.recalc_period(v_new); end if;
  return public.expense_report(p_id) || jsonb_build_object('replayed', false, 'period_id', v_new);
end;
$$;

-- Lote de plantillas: una plantilla USD exige una conversión por elemento (importe original, tasa y procedencia);
-- sin ella el lote falla en lugar de asumir 1:1. Los totales usan siempre el importe contable PEN.
create or replace function public.apply_template_batch(p_period_date date, p_items jsonb, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hid uuid := public.current_household_id();
  v_period uuid; v_p public.budget_periods%rowtype; v_prev jsonb;
  v_batch uuid := gen_random_uuid();
  v_item jsonb; t public.expense_templates%rowtype; v_c jsonb;
  v_amount numeric; v_date date; v_method uuid; v_exp uuid;
  v_count integer := 0; v_total numeric := 0; v_res jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_key is null then raise exception 'Falta la clave de idempotencia.'; end if;

  select response into v_prev from public.idempotency_requests
  where household_id = v_hid and key = p_key and operation = 'apply_template_batch';
  if found then return v_prev || '{"replayed": true}'::jsonb; end if;

  v_period := public.ensure_period(v_hid, p_period_date);
  select * into v_p from public.budget_periods where id = v_period;
  if v_p.status = 'closed' then raise exception 'El período está cerrado.' using errcode = 'GD002'; end if;

  insert into public.template_batches (id, household_id, period_id, executed_by, idempotency_key)
  values (v_batch, v_hid, v_period, (select auth.uid()), p_key);

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into t from public.expense_templates where id = (v_item ->> 'template_id')::uuid and household_id = v_hid;
    if not found then raise exception 'Plantilla no encontrada.' using errcode = 'GD004'; end if;

    if v_item ->> 'outcome' = 'include' then
      v_amount := case when t.original_currency = 'USD'
        then coalesce((v_item ->> 'original_amount')::numeric, t.default_amount)
        else coalesce((v_item ->> 'amount')::numeric, t.default_amount) end;
      if v_amount is null or v_amount <= 0 then
        raise exception 'Falta el importe de "%".', t.name using errcode = 'GD008';
      end if;
      v_date := coalesce(
        nullif(v_item ->> 'expense_date', '')::date,
        least(v_p.start_date + (coalesce(t.day_of_month, 1) - 1), v_p.end_date)
      );
      if v_date not between v_p.start_date and v_p.end_date then
        raise exception 'La fecha de "%" no está dentro del período.', t.name;
      end if;
      v_method := coalesce(nullif(v_item ->> 'payment_method_id', '')::uuid, t.payment_method_id);
      if v_method is null then raise exception 'Falta el medio de pago de "%".', t.name; end if;
      if exists (
        select 1 from public.expenses x
        where x.household_id = v_hid and x.template_id = t.id and x.status = 'active'
          and x.expense_date between v_p.start_date and v_p.end_date
      ) then
        raise exception '"%" ya está registrada en este período.', t.name using errcode = 'GD003';
      end if;

      -- La moneda la fija la plantilla (el cliente no puede declarar PEN para un importe en dólares).
      v_c := public.normalize_conversion(v_item || jsonb_build_object(
        'expense_date', v_date, 'original_currency', t.original_currency, 'original_amount', v_amount,
        'amount', case when t.original_currency = 'USD' then v_item -> 'amount' else to_jsonb(v_amount) end));
      perform public.validate_conversion_reference(v_c);
      v_amount := (v_c ->> 'amount')::numeric;

      insert into public.expenses (
        household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id,
        payment_method_id, expense_type, is_recurring, template_id, created_by,
        original_currency, original_amount, exchange_rate, exchange_rate_source, exchange_rate_reference_date,
        conversion_method, exchange_rate_fetched_at, conversion_snapshot_version
      ) values (
        v_hid, v_date, v_amount, coalesce(nullif(v_item ->> 'description', ''), t.description), t.ambito_id, t.categoria_id,
        t.subcategoria_id, v_method, t.expense_type, true, t.id, (select auth.uid()),
        v_c ->> 'original_currency', (v_c ->> 'original_amount')::numeric, (v_c ->> 'exchange_rate')::numeric,
        v_c ->> 'exchange_rate_source', (v_c ->> 'exchange_rate_reference_date')::date,
        v_c ->> 'conversion_method', (v_c ->> 'exchange_rate_fetched_at')::timestamptz, 1
      ) returning id into v_exp;

      insert into public.template_batch_items (household_id, batch_id, template_id, outcome, expense_id, amount)
      values (v_hid, v_batch, t.id, 'included', v_exp, v_amount);
      v_count := v_count + 1;
      v_total := v_total + v_amount;
    else
      insert into public.template_batch_items (household_id, batch_id, template_id, outcome)
      values (v_hid, v_batch, t.id, case when v_item ->> 'outcome' = 'not_applicable' then 'not_applicable' else 'excluded' end);
    end if;
  end loop;

  perform public.recalc_period(v_period);
  update public.template_batches set expense_count = v_count, total_amount = v_total where id = v_batch;

  v_res := jsonb_build_object('batch_id', v_batch, 'period_id', v_period, 'count', v_count, 'total', v_total, 'replayed', false);
  insert into public.idempotency_requests (household_id, key, operation, response)
  values (v_hid, p_key, 'apply_template_batch', v_res);
  return v_res;
end;
$$;

-- Eventos: conceptos y compromisos futuros conservan la moneda original; su importe contable PEN
-- (planned_amount / contracted_amount) es lo que consumen las vistas y los indicadores.
alter table public.event_items
  add column if not exists original_currency text not null default 'PEN' check (original_currency in ('PEN','USD')),
  add column if not exists original_amount numeric(14,2),
  add column if not exists exchange_rate numeric(24,12) not null default 1,
  add column if not exists exchange_rate_source text not null default 'identity',
  add column if not exists exchange_rate_reference_date date,
  add column if not exists conversion_method text not null default 'none',
  add column if not exists exchange_rate_fetched_at timestamptz,
  add column if not exists conversion_snapshot_version integer not null default 1;
alter table public.event_commitments
  add column if not exists original_currency text not null default 'PEN' check (original_currency in ('PEN','USD')),
  add column if not exists original_amount numeric(14,2),
  add column if not exists exchange_rate numeric(24,12) not null default 1,
  add column if not exists exchange_rate_source text not null default 'identity',
  add column if not exists exchange_rate_reference_date date,
  add column if not exists conversion_method text not null default 'none',
  add column if not exists exchange_rate_fetched_at timestamptz,
  add column if not exists conversion_snapshot_version integer not null default 1;
update public.event_items set original_amount = planned_amount where original_amount is null;
update public.event_commitments set original_amount = contracted_amount where original_amount is null;
set constraints all immediate;
alter table public.event_items alter column original_amount set not null;
alter table public.event_commitments alter column original_amount set not null;

-- SECURITY DEFINER: el trigger valida con normalize_conversion, que no es invocable por los roles de la API.
create or replace function public.event_conversion_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare payload jsonb := to_jsonb(new); converted jsonb; accounting numeric;
begin
  accounting := case when tg_table_name = 'event_items' then (payload ->> 'planned_amount')::numeric else (payload ->> 'contracted_amount')::numeric end;
  if new.original_currency = 'PEN' then
    new.original_amount := accounting; new.exchange_rate := 1; new.conversion_method := 'none';
    new.exchange_rate_source := 'identity'; new.exchange_rate_fetched_at := null; new.conversion_snapshot_version := 1;
  else
    converted := public.normalize_conversion(payload || jsonb_build_object('amount', accounting, 'expense_date', new.exchange_rate_reference_date));
    new.original_amount := (converted ->> 'original_amount')::numeric;
    new.exchange_rate := (converted ->> 'exchange_rate')::numeric;
    new.conversion_method := converted ->> 'conversion_method';
    accounting := (converted ->> 'amount')::numeric;
    if tg_table_name = 'event_items' then new.planned_amount := accounting; else new.contracted_amount := accounting; end if;
  end if;
  return new;
end $$;
revoke all on function public.event_conversion_snapshot(), public.expense_conversion_defaults() from public, anon, authenticated;
drop trigger if exists event_items_conversion on public.event_items;
drop trigger if exists event_commitments_conversion on public.event_commitments;
create trigger event_items_conversion before insert or update on public.event_items for each row execute function public.event_conversion_snapshot();
create trigger event_commitments_conversion before insert or update on public.event_commitments for each row execute function public.event_conversion_snapshot();

-- Las vistas se definieron con select c.* / i.*: se recrean para exponer también las columnas nuevas.
drop view if exists public.event_metrics, public.event_item_metrics, public.event_commitment_metrics;
create view public.event_commitment_metrics with (security_invoker = true) as
select c.*, coalesce(p.paid, 0)::numeric(14,2) as paid,
  (case when c.cancelled_at is not null then 0 else greatest(0, c.contracted_amount - coalesce(p.paid, 0)) end)::numeric(14,2) as pending,
  greatest(0, coalesce(p.paid, 0) - c.contracted_amount)::numeric(14,2) as overpaid,
  case when c.cancelled_at is not null then 'cancelled' when coalesce(p.paid, 0) >= c.contracted_amount then 'paid' when coalesce(p.paid, 0) > 0 then 'partial' else 'pending' end as payment_status
from public.event_commitments c left join (
  select event_commitment_id, sum(amount) as paid from public.expenses where status = 'active' and event_commitment_id is not null group by event_commitment_id
) p on p.event_commitment_id = c.id;
create view public.event_item_metrics with (security_invoker = true) as
select i.*, coalesce(p.paid, 0)::numeric(14,2) as paid, coalesce(c.pending, 0)::numeric(14,2) as pending
from public.event_items i left join (
  select event_item_id, sum(amount) as paid from public.expenses where status = 'active' and event_item_id is not null group by event_item_id
) p on p.event_item_id = i.id left join (
  select event_item_id, sum(pending) as pending from public.event_commitment_metrics where event_item_id is not null group by event_item_id
) c on c.event_item_id = i.id;

create view public.event_metrics with (security_invoker = true) as
select e.*, coalesce(p.paid, 0)::numeric(14,2) as paid, coalesce(p.expense_count, 0) as expense_count,
  coalesce(c.pending, 0)::numeric(14,2) as pending,
  (coalesce(p.paid, 0) + coalesce(c.pending, 0))::numeric(14,2) as projected,
  (e.budget - coalesce(p.paid, 0))::numeric(14,2) as available,
  (e.budget - coalesce(p.paid, 0) - coalesce(c.pending, 0))::numeric(14,2) as projected_available,
  case when e.budget > 0 then round(coalesce(p.paid, 0) / e.budget * 100, 2) end as paid_percent,
  case when e.budget > 0 then round((coalesce(p.paid, 0) + coalesce(c.pending, 0)) / e.budget * 100, 2) end as projected_percent,
  coalesce(i.planned_total, 0)::numeric(14,2) as planned_total,
  (e.budget - coalesce(i.planned_total, 0))::numeric(14,2) as unplanned
from public.events e left join (
  select event_id, sum(amount) as paid, count(*) as expense_count from public.expenses where status = 'active' and event_id is not null group by event_id
) p on p.event_id = e.id left join (
  select event_id, sum(pending) as pending from public.event_commitment_metrics group by event_id
) c on c.event_id = e.id left join (
  select event_id, sum(planned_amount) as planned_total from public.event_items group by event_id
) i on i.event_id = e.id;

-- Clonar un evento copia la configuración (no los movimientos); la moneda original de cada concepto y compromiso se conserva.
create or replace function public.clone_event(p_source uuid, p_values jsonb, p_key uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare src public.events%rowtype; dest uuid; item record; nuevo uuid; mapa jsonb := '{}'; prev uuid;
begin
  select * into src from public.events where id = p_source;
  if not found then raise exception 'Evento no disponible.' using errcode = 'EV001'; end if;
  if p_key is null then raise exception 'Falta la clave de la operación.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  select id into prev from public.events where id = p_key;
  if found then return prev; end if;
  insert into public.events(id, household_id, user_id, name, description, event_type, target_date, start_date, budget, currency, icon_key, color_token, is_template, status)
    values(p_key, src.household_id, auth.uid(), coalesce(p_values ->> 'name', src.name || ' (copia)'), coalesce(p_values ->> 'description', src.description), coalesce(p_values ->> 'event_type', src.event_type),
      nullif(p_values ->> 'target_date', '')::date, nullif(p_values ->> 'start_date', '')::date, coalesce((p_values ->> 'budget')::numeric, src.budget), src.currency, coalesce(p_values ->> 'icon_key', src.icon_key), coalesce(p_values ->> 'color_token', src.color_token), coalesce((p_values ->> 'is_template')::boolean, false), coalesce(p_values ->> 'status', 'planned')) returning id into dest;
  for item in select * from public.event_items where event_id = src.id order by sort_order, id loop
    insert into public.event_items(event_id, household_id, name, planned_amount, sort_order, original_currency, original_amount, exchange_rate, exchange_rate_source, exchange_rate_reference_date, conversion_method, exchange_rate_fetched_at, conversion_snapshot_version)
      values(dest, src.household_id, item.name, item.planned_amount, item.sort_order, item.original_currency, item.original_amount, item.exchange_rate, item.exchange_rate_source, item.exchange_rate_reference_date, item.conversion_method, item.exchange_rate_fetched_at, item.conversion_snapshot_version) returning id into nuevo;
    mapa := mapa || jsonb_build_object(item.id::text, nuevo);
  end loop;
  insert into public.event_commitments(event_id, household_id, event_item_id, name, contracted_amount, currency, notes, original_currency, original_amount, exchange_rate, exchange_rate_source, exchange_rate_reference_date, conversion_method, exchange_rate_fetched_at, conversion_snapshot_version)
    select dest, src.household_id, (mapa ->> c.event_item_id::text)::uuid, c.name, c.contracted_amount, c.currency, c.notes, c.original_currency, c.original_amount, c.exchange_rate, c.exchange_rate_source, c.exchange_rate_reference_date, c.conversion_method, c.exchange_rate_fetched_at, c.conversion_snapshot_version
    from public.event_commitments c where c.event_id = src.id and c.cancelled_at is null;
  return dest;
end;
$$;

-- Las vistas recreadas conservan sus grants; las funciones redefinidas, también. Se reafirma el principio de mínimo privilegio.
revoke all on function public.create_expense(jsonb, uuid), public.update_expense(uuid, jsonb), public.apply_template_batch(date, jsonb, uuid), public.clone_event(uuid, jsonb, uuid) from public, anon;
grant execute on function public.create_expense(jsonb, uuid), public.update_expense(uuid, jsonb), public.apply_template_batch(date, jsonb, uuid), public.clone_event(uuid, jsonb, uuid) to authenticated;
revoke all on public.event_metrics, public.event_item_metrics, public.event_commitment_metrics from public, anon, authenticated;
grant select on public.event_metrics, public.event_item_metrics, public.event_commitment_metrics to authenticated;
notify pgrst, 'reload schema';
