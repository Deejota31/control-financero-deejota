-- Motor de asignación de gastos a fondos y operaciones atómicas (RPC).
-- PostgreSQL es la única fuente de verdad. Códigos de error propios:
--   GD001 ningún fondo admite la combinación   GD002 período cerrado          GD003 plantilla ya registrada
--   GD004 no encontrado                        GD005 gasto anulado            GD006 regla de fondo inválida
--   GD007 período no cerrable                  GD008 falta importe            GD009 comprobante inválido
--   GD999 uso interno (simulación con reversión)

-- ---------------------------------------------------------------------------
-- Compatibilidad de un fondo con una combinación de clasificación y medio de pago.
--  Clasificación: si el fondo tiene reglas "include", debe coincidir con alguna; luego no puede coincidir con ninguna "exclude".
--  Medio de pago: si hay medios "include", debe estar entre ellos; no puede estar entre los "exclude".
--  Sin reglas de un tipo significa "admite todo" en ese eje.
-- ---------------------------------------------------------------------------
create function public.fund_admits_scope(p_fund uuid, p_ambito uuid, p_cat uuid, p_sub uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
      not exists (select 1 from public.fund_scope_rules r where r.fund_id = p_fund and r.effect = 'include')
      or exists (
        select 1 from public.fund_scope_rules r
        where r.fund_id = p_fund and r.effect = 'include'
          and (r.ambito_id = p_ambito or r.categoria_id = p_cat or r.subcategoria_id = p_sub)
      )
    )
    and not exists (
      select 1 from public.fund_scope_rules r
      where r.fund_id = p_fund and r.effect = 'exclude'
        and (r.ambito_id = p_ambito or r.categoria_id = p_cat or r.subcategoria_id = p_sub)
    );
$$;

create function public.fund_admits_method(p_fund uuid, p_method uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
      not exists (select 1 from public.fund_payment_rules r where r.fund_id = p_fund and r.effect = 'include')
      or exists (select 1 from public.fund_payment_rules r where r.fund_id = p_fund and r.effect = 'include' and r.payment_method_id = p_method)
    )
    and not exists (select 1 from public.fund_payment_rules r where r.fund_id = p_fund and r.effect = 'exclude' and r.payment_method_id = p_method);
$$;

create function public.fund_admits(p_fund uuid, p_ambito uuid, p_cat uuid, p_sub uuid, p_method uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fund_admits_scope(p_fund, p_ambito, p_cat, p_sub) and public.fund_admits_method(p_fund, p_method);
$$;

-- ---------------------------------------------------------------------------
-- Períodos mensuales
-- ---------------------------------------------------------------------------
create function public.ensure_period(hid uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date := date_trunc('month', p_date)::date;
  v_id uuid;
begin
  select id into v_id from public.budget_periods where household_id = hid and start_date = v_start;
  if v_id is null then
    insert into public.budget_periods (household_id, start_date, end_date)
    values (hid, v_start, (v_start + interval '1 month - 1 day')::date)
    on conflict (household_id, start_date) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.budget_periods where household_id = hid and start_date = v_start;
    end if;
    insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
    select hid, f.id, v_id, f.default_amount from public.funds f where f.household_id = hid and f.is_active
    on conflict (fund_id, period_id) do nothing;
  end if;
  return v_id;
end;
$$;

create function public.ensure_period_rpc(p_date date)
returns public.budget_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_id uuid;
  v_row public.budget_periods;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  v_id := public.ensure_period(v_hid, p_date);
  select * into v_row from public.budget_periods where id = v_id;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Motor: recalcula las imputaciones de un período abierto, en orden cronológico.
-- ---------------------------------------------------------------------------
create function public.recalc_period(p_period uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.budget_periods%rowtype;
  v_rem jsonb;
  e record;
  f record;
  v_left numeric;
  v_take numeric;
  v_cur numeric;
  v_general uuid;
  v_first uuid;
  v_reason text;
  v_scope_any boolean;
  v_method_any boolean;
begin
  select * into v_p from public.budget_periods where id = p_period;
  if not found then
    raise exception 'Período no encontrado.' using errcode = 'GD004';
  end if;
  if v_p.status = 'closed' then
    raise exception 'El período ya está cerrado y no se puede recalcular.' using errcode = 'GD002';
  end if;

  delete from public.expense_fund_allocations where period_id = p_period;

  -- Capacidad restante por fondo activo (los fondos sin presupuesto del período cuentan como 0).
  select coalesce(jsonb_object_agg(fu.id::text, coalesce(b.assigned_amount, 0)), '{}'::jsonb) into v_rem
  from public.funds fu
  left join public.fund_period_budgets b on b.fund_id = fu.id and b.period_id = p_period
  where fu.household_id = v_p.household_id and fu.is_active;

  for e in
    select x.* from public.expenses x
    where x.household_id = v_p.household_id and x.status = 'active'
      and x.expense_date between v_p.start_date and v_p.end_date
    order by x.expense_date, x.created_at, x.id
  loop
    v_left := e.amount;
    v_general := null;
    v_first := null;

    for f in
      select fu.id, fu.is_general
      from public.funds fu
      where fu.household_id = v_p.household_id and fu.is_active
        and public.fund_admits(fu.id, e.ambito_id, e.categoria_id, e.subcategoria_id, e.payment_method_id)
      order by fu.is_general, fu.priority, fu.name, fu.id
    loop
      if f.is_general then
        v_general := f.id;
        continue;
      end if;
      v_first := coalesce(v_first, f.id);
      v_cur := coalesce((v_rem ->> f.id::text)::numeric, 0);
      v_take := least(v_left, greatest(v_cur, 0));
      if v_take > 0 then
        insert into public.expense_fund_allocations (household_id, expense_id, fund_id, period_id, amount, allocation_kind)
        values (v_p.household_id, e.id, f.id, p_period, v_take, 'specific');
        v_rem := jsonb_set(v_rem, array[f.id::text], to_jsonb(v_cur - v_take));
        v_left := v_left - v_take;
      end if;
    end loop;

    if v_general is null and v_first is null then
      select exists (
        select 1 from public.funds fu where fu.household_id = v_p.household_id and fu.is_active
          and public.fund_admits_scope(fu.id, e.ambito_id, e.categoria_id, e.subcategoria_id)
      ) into v_scope_any;
      select exists (
        select 1 from public.funds fu where fu.household_id = v_p.household_id and fu.is_active
          and public.fund_admits_method(fu.id, e.payment_method_id)
      ) into v_method_any;
      v_reason := case
        when not v_scope_any then 'classification'
        when not v_method_any then 'payment_method'
        else 'rules'
      end;
      raise exception 'Ningún fondo admite "%" (%).', e.description,
        case v_reason
          when 'classification' then 'la clasificación no está cubierta por ningún fondo'
          when 'payment_method' then 'el medio de pago no está admitido por ningún fondo'
          else 'ningún fondo admite a la vez esa clasificación y ese medio de pago'
        end
        using errcode = 'GD001', detail = v_reason;
    end if;

    if v_left > 0 then
      if v_general is not null then
        -- El Fondo General absorbe el excedente y puede quedar negativo.
        v_cur := coalesce((v_rem ->> v_general::text)::numeric, 0);
        insert into public.expense_fund_allocations (household_id, expense_id, fund_id, period_id, amount, allocation_kind)
        values (v_p.household_id, e.id, v_general, p_period, v_left, 'general');
        v_rem := jsonb_set(v_rem, array[v_general::text], to_jsonb(v_cur - v_left));
      else
        -- Solo hay fondos específicos: el excedente va completo al de mayor prioridad (sobregasto advertido).
        v_cur := coalesce((v_rem ->> v_first::text)::numeric, 0);
        insert into public.expense_fund_allocations (household_id, expense_id, fund_id, period_id, amount, allocation_kind)
        values (v_p.household_id, e.id, v_first, p_period, v_left, 'specific');
        v_rem := jsonb_set(v_rem, array[v_first::text], to_jsonb(v_cur - v_left));
      end if;
    end if;
  end loop;
end;
$$;

create function public.alloc_signature(hid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(q.expense_id::text, q.sig), '{}'::jsonb)
  from (
    select a.expense_id, string_agg(a.fund_id::text || ':' || a.amount::text, ',' order by a.fund_id) as sig
    from public.expense_fund_allocations a
    join public.budget_periods bp on bp.id = a.period_id
    where a.household_id = hid and bp.status = 'open'
    group by a.expense_id
  ) q;
$$;

create function public.open_consumption(hid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(q.fund_id::text, q.total), '{}'::jsonb)
  from (
    select a.fund_id, sum(a.amount) as total
    from public.expense_fund_allocations a
    join public.budget_periods bp on bp.id = a.period_id
    where a.household_id = hid and bp.status = 'open'
    group by a.fund_id
  ) q;
$$;

create function public.count_changed(p_before jsonb, p_after jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::int from (
    select key from jsonb_each_text(p_before) union select key from jsonb_each_text(p_after)
  ) k
  where p_before ->> k.key is distinct from p_after ->> k.key;
$$;

create function public.expense_report(p_expense uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with al as (
    select a.fund_id, f.name, f.is_general, a.allocation_kind, a.amount,
      coalesce(b.assigned_amount, 0) - (
        select coalesce(sum(x.amount), 0) from public.expense_fund_allocations x
        where x.period_id = a.period_id and x.fund_id = a.fund_id
      ) as remaining_after
    from public.expense_fund_allocations a
    join public.funds f on f.id = a.fund_id
    left join public.fund_period_budgets b on b.fund_id = a.fund_id and b.period_id = a.period_id
    where a.expense_id = p_expense
  )
  select jsonb_build_object(
    'expense_id', p_expense,
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object('fund_id', fund_id, 'fund_name', name, 'is_general', is_general,
        'kind', allocation_kind, 'amount', amount, 'remaining_after', remaining_after) order by is_general, name)
      from al), '[]'::jsonb),
    'warnings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', case when is_general then 'general_negative' else 'specific_overspend' end,
        'fund_id', fund_id, 'fund_name', name, 'remaining_after', remaining_after))
      from al where remaining_after < 0), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------------
create function public.create_expense(p jsonb, p_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_id uuid;
  v_period uuid;
  v_status text;
  v_prev jsonb;
  v_res jsonb;
  v_receipt text := nullif(p ->> 'receipt_path', '');
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_key is null then raise exception 'Falta la clave de idempotencia.'; end if;

  select response into v_prev from public.idempotency_requests
  where household_id = v_hid and key = p_key and operation = 'create_expense';
  if found then
    return v_prev || '{"replayed": true}'::jsonb;
  end if;

  if v_receipt is not null and v_receipt not like v_hid::text || '/%' then
    raise exception 'Ruta de comprobante no válida.' using errcode = 'GD009';
  end if;

  v_period := public.ensure_period(v_hid, (p ->> 'expense_date')::date);
  select status into v_status from public.budget_periods where id = v_period;
  if v_status = 'closed' then
    raise exception 'El período de esa fecha está cerrado.' using errcode = 'GD002';
  end if;

  insert into public.expenses (
    id, household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id,
    payment_method_id, expense_type, is_recurring, notes, receipt_path, template_id, created_by
  ) values (
    coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid()), v_hid, (p ->> 'expense_date')::date,
    (p ->> 'amount')::numeric, p ->> 'description', (p ->> 'ambito_id')::uuid, (p ->> 'categoria_id')::uuid,
    nullif(p ->> 'subcategoria_id', '')::uuid, (p ->> 'payment_method_id')::uuid,
    coalesce(p ->> 'expense_type', 'variable'), coalesce((p ->> 'is_recurring')::boolean, false),
    nullif(p ->> 'notes', ''), v_receipt, nullif(p ->> 'template_id', '')::uuid, (select auth.uid())
  ) returning id into v_id;

  perform public.recalc_period(v_period);

  v_res := public.expense_report(v_id) || jsonb_build_object('replayed', false, 'period_id', v_period);
  insert into public.idempotency_requests (household_id, key, operation, response)
  values (v_hid, p_key, 'create_expense', v_res);
  return v_res;
end;
$$;

create function public.update_expense(p_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  e public.expenses%rowtype;
  v_old uuid;
  v_new uuid;
  v_status text;
  v_date date;
  v_receipt text;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  select * into e from public.expenses where id = p_id and household_id = v_hid for update;
  if not found then raise exception 'Gasto no encontrado.' using errcode = 'GD004'; end if;
  if e.status = 'annulled' then
    raise exception 'Restaura el gasto antes de editarlo.' using errcode = 'GD005';
  end if;

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

  update public.expenses set
    expense_date = v_date,
    amount = coalesce((p ->> 'amount')::numeric, amount),
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

create function public.set_expenses_status(p_ids uuid[], p_annul boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_n integer;
  v_period record;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;

  if exists (
    select 1 from public.budget_periods bp
    join public.expenses x on x.household_id = bp.household_id and x.expense_date between bp.start_date and bp.end_date
    where x.id = any (p_ids) and x.household_id = v_hid and bp.status = 'closed'
  ) then
    raise exception 'Alguno de los gastos pertenece a un período cerrado.' using errcode = 'GD002';
  end if;

  if p_annul then
    update public.expenses set status = 'annulled', annulled_at = now(), annulled_by = (select auth.uid())
    where id = any (p_ids) and household_id = v_hid and status = 'active';
  else
    update public.expenses set status = 'active', annulled_at = null, annulled_by = null
    where id = any (p_ids) and household_id = v_hid and status = 'annulled';
  end if;
  get diagnostics v_n = row_count;

  for v_period in
    select distinct bp.id from public.budget_periods bp
    join public.expenses x on x.household_id = bp.household_id and x.expense_date between bp.start_date and bp.end_date
    where x.id = any (p_ids) and x.household_id = v_hid
  loop
    perform public.recalc_period(v_period.id);
  end loop;
  return jsonb_build_object('count', v_n);
end;
$$;

create function public.annul_expenses(p_ids uuid[])
returns jsonb
language sql
security definer
set search_path = ''
as $$ select public.set_expenses_status(p_ids, true); $$;

create function public.restore_expenses(p_ids uuid[])
returns jsonb
language sql
security definer
set search_path = ''
as $$ select public.set_expenses_status(p_ids, false); $$;

-- Simulación exacta: ejecuta la operación real y revierte. No deja rastro.
-- p.editing_id (opcional) indica que se simula la edición de un gasto existente.
create function public.preview_expense(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
  v_detail text;
begin
  begin
    if nullif(p ->> 'editing_id', '') is not null then
      v_res := public.update_expense((p ->> 'editing_id')::uuid, p);
    else
      v_res := public.create_expense(p - 'id', gen_random_uuid());
    end if;
    raise exception 'simulacion' using errcode = 'GD999';
  exception when others then
    if sqlstate = 'GD999' then
      null;
    elsif sqlstate in ('GD001', 'GD002', 'GD005') then
      get stacked diagnostics v_detail = pg_exception_detail;
      v_res := jsonb_build_object('blocked', true, 'code', sqlstate, 'reason', v_detail, 'message', sqlerrm);
    else
      raise;
    end if;
  end;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fondos
-- ---------------------------------------------------------------------------
create function public.save_fund(p jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_before jsonb;
  v_after jsonb;
  v_cons_before jsonb;
  v_cons_after jsonb;
  v_blocked text;
  v_rule jsonb;
  v_open record;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);

  begin
    if v_id is null then
      insert into public.funds (household_id, name, description, icon_key, color_token, is_general, default_amount, priority, is_active)
      values (
        v_hid, p ->> 'name', nullif(p ->> 'description', ''), nullif(p ->> 'icon_key', ''), nullif(p ->> 'color_token', ''),
        coalesce((p ->> 'is_general')::boolean, false), coalesce((p ->> 'default_amount')::numeric, 0),
        coalesce((p ->> 'priority')::int, 100), coalesce((p ->> 'is_active')::boolean, true)
      ) returning id into v_id;
    else
      update public.funds set
        name = coalesce(p ->> 'name', name),
        description = case when p ? 'description' then nullif(p ->> 'description', '') else description end,
        icon_key = case when p ? 'icon_key' then nullif(p ->> 'icon_key', '') else icon_key end,
        color_token = case when p ? 'color_token' then nullif(p ->> 'color_token', '') else color_token end,
        is_general = coalesce((p ->> 'is_general')::boolean, is_general),
        default_amount = coalesce((p ->> 'default_amount')::numeric, default_amount),
        priority = coalesce((p ->> 'priority')::int, priority),
        is_active = coalesce((p ->> 'is_active')::boolean, is_active)
      where id = v_id and household_id = v_hid;
      if not found then raise exception 'Fondo no encontrado.' using errcode = 'GD004'; end if;
    end if;

    if p ? 'scope_rules' then
      delete from public.fund_scope_rules where fund_id = v_id;
      for v_rule in select * from jsonb_array_elements(p -> 'scope_rules') loop
        insert into public.fund_scope_rules (household_id, fund_id, ambito_id, categoria_id, subcategoria_id, effect)
        values (
          v_hid, v_id,
          case when v_rule ->> 'kind' = 'ambito' then (v_rule ->> 'ref')::uuid end,
          case when v_rule ->> 'kind' = 'categoria' then (v_rule ->> 'ref')::uuid end,
          case when v_rule ->> 'kind' = 'subcategoria' then (v_rule ->> 'ref')::uuid end,
          v_rule ->> 'effect'
        );
      end loop;
    end if;
    if p ? 'payment_rules' then
      delete from public.fund_payment_rules where fund_id = v_id;
      for v_rule in select * from jsonb_array_elements(p -> 'payment_rules') loop
        insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
        values (v_hid, v_id, (v_rule ->> 'method')::uuid, v_rule ->> 'effect');
      end loop;
    end if;

    if not exists (select 1 from public.funds where id = v_id and is_general)
       and not exists (select 1 from public.fund_scope_rules where fund_id = v_id and effect = 'include') then
      raise exception 'Un fondo específico necesita al menos un ámbito, categoría o subcategoría incluido.' using errcode = 'GD006';
    end if;

    insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
    select v_hid, f.id, bp.id, f.default_amount
    from public.budget_periods bp join public.funds f on f.id = v_id
    where bp.household_id = v_hid and bp.status = 'open' and f.is_active
    on conflict (fund_id, period_id) do nothing;

    if nullif(p ->> 'period_id', '') is not null then
      if exists (select 1 from public.budget_periods where id = (p ->> 'period_id')::uuid and household_id = v_hid and status = 'closed') then
        raise exception 'El período está cerrado.' using errcode = 'GD002';
      end if;
      update public.fund_period_budgets set assigned_amount = (p ->> 'period_amount')::numeric
      where fund_id = v_id and period_id = (p ->> 'period_id')::uuid;
    end if;

    for v_open in select id from public.budget_periods where household_id = v_hid and status = 'open' loop
      perform public.recalc_period(v_open.id);
    end loop;

    v_after := public.alloc_signature(v_hid);
    v_cons_after := public.open_consumption(v_hid);
    if p_dry_run then
      raise exception 'simulacion' using errcode = 'GD999';
    end if;
  exception when others then
    if sqlstate = 'GD999' then
      null;
    elsif p_dry_run and sqlstate = 'GD001' then
      v_blocked := sqlerrm;
    else
      raise;
    end if;
  end;

  return jsonb_build_object(
    'fund_id', v_id,
    'dry_run', p_dry_run,
    'blocked', v_blocked,
    'changed_expenses', case when v_blocked is null then public.count_changed(v_before, v_after) else null end,
    'consumption_before', v_cons_before,
    'consumption_after', case when v_blocked is null then v_cons_after else null end
  );
end;
$$;

create function public.reorder_funds(p_ids uuid[], p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_open record;
  v_before jsonb;
  v_after jsonb;
  v_cons_before jsonb;
  v_cons_after jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);
  begin
    update public.funds f set priority = o.ord::int * 10
    from unnest(p_ids) with ordinality as o(id, ord)
    where f.id = o.id and f.household_id = v_hid;
    for v_open in select id from public.budget_periods where household_id = v_hid and status = 'open' loop
      perform public.recalc_period(v_open.id);
    end loop;
    v_after := public.alloc_signature(v_hid);
    v_cons_after := public.open_consumption(v_hid);
    if p_dry_run then raise exception 'simulacion' using errcode = 'GD999'; end if;
  exception when others then
    if sqlstate <> 'GD999' then raise; end if;
  end;
  return jsonb_build_object(
    'dry_run', p_dry_run,
    'changed_expenses', public.count_changed(v_before, v_after),
    'consumption_before', v_cons_before,
    'consumption_after', v_cons_after
  );
end;
$$;

create function public.set_fund_period_budget(p_fund uuid, p_period uuid, p_amount numeric, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_before jsonb;
  v_after jsonb;
  v_cons_before jsonb;
  v_cons_after jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if not exists (select 1 from public.budget_periods where id = p_period and household_id = v_hid) then
    raise exception 'Período no encontrado.' using errcode = 'GD004';
  end if;
  if exists (select 1 from public.budget_periods where id = p_period and status = 'closed') then
    raise exception 'El período está cerrado: su histórico no se modifica.' using errcode = 'GD002';
  end if;
  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);
  begin
    insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
    values (v_hid, p_fund, p_period, p_amount)
    on conflict (fund_id, period_id) do update set assigned_amount = excluded.assigned_amount;
    perform public.recalc_period(p_period);
    v_after := public.alloc_signature(v_hid);
    v_cons_after := public.open_consumption(v_hid);
    if p_dry_run then raise exception 'simulacion' using errcode = 'GD999'; end if;
  exception when others then
    if sqlstate <> 'GD999' then raise; end if;
  end;
  return jsonb_build_object(
    'dry_run', p_dry_run,
    'changed_expenses', public.count_changed(v_before, v_after),
    'consumption_before', v_cons_before,
    'consumption_after', v_cons_after
  );
end;
$$;

create function public.close_period(p_period uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_p public.budget_periods%rowtype;
  v_tz text;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  select * into v_p from public.budget_periods where id = p_period and household_id = v_hid for update;
  if not found then raise exception 'Período no encontrado.' using errcode = 'GD004'; end if;
  if v_p.status = 'closed' then return; end if;
  select coalesce(timezone, 'America/Lima') into v_tz from public.profiles where user_id = (select auth.uid());
  if v_p.end_date >= (now() at time zone coalesce(v_tz, 'America/Lima'))::date then
    raise exception 'No se puede cerrar un período que aún no terminó.' using errcode = 'GD007';
  end if;

  perform public.recalc_period(p_period);
  insert into public.period_fund_snapshots (household_id, period_id, fund_id, fund_name, is_general, assigned_amount, consumed_amount)
  select v_hid, p_period, f.id, f.name, f.is_general, coalesce(b.assigned_amount, 0),
    coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.period_id = p_period and a.fund_id = f.id), 0)
  from public.funds f
  left join public.fund_period_budgets b on b.fund_id = f.id and b.period_id = p_period
  where f.household_id = v_hid
    and (b.id is not null or exists (select 1 from public.expense_fund_allocations a where a.period_id = p_period and a.fund_id = f.id));
  update public.budget_periods set status = 'closed', closed_at = now() where id = p_period;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registro mensual por lote desde plantillas
-- ---------------------------------------------------------------------------
create function public.apply_template_batch(p_period_date date, p_items jsonb, p_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_period uuid;
  v_p public.budget_periods%rowtype;
  v_prev jsonb;
  v_batch uuid := gen_random_uuid();
  v_item jsonb;
  t public.expense_templates%rowtype;
  v_amount numeric;
  v_date date;
  v_method uuid;
  v_exp uuid;
  v_count integer := 0;
  v_total numeric := 0;
  v_res jsonb;
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
      v_amount := coalesce((v_item ->> 'amount')::numeric, t.default_amount);
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
      if v_method is null then
        raise exception 'Falta el medio de pago de "%".', t.name;
      end if;
      if exists (
        select 1 from public.expenses x
        where x.household_id = v_hid and x.template_id = t.id and x.status = 'active'
          and x.expense_date between v_p.start_date and v_p.end_date
      ) then
        raise exception '"%" ya está registrada en este período.', t.name using errcode = 'GD003';
      end if;

      insert into public.expenses (
        household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id,
        payment_method_id, expense_type, is_recurring, template_id, created_by
      ) values (
        v_hid, v_date, v_amount, coalesce(nullif(v_item ->> 'description', ''), t.description), t.ambito_id, t.categoria_id,
        t.subcategoria_id, v_method, t.expense_type, true, t.id, (select auth.uid())
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

-- ---------------------------------------------------------------------------
-- Permisos: las funciones internas no se exponen; las RPC solo a usuarios autenticados.
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'fund_admits_scope(uuid,uuid,uuid,uuid)', 'fund_admits_method(uuid,uuid)', 'fund_admits(uuid,uuid,uuid,uuid,uuid)',
    'ensure_period(uuid,date)', 'recalc_period(uuid)', 'alloc_signature(uuid)', 'open_consumption(uuid)',
    'count_changed(jsonb,jsonb)', 'expense_report(uuid)', 'set_expenses_status(uuid[],boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'ensure_period_rpc(date)', 'create_expense(jsonb,uuid)', 'update_expense(uuid,jsonb)', 'annul_expenses(uuid[])',
    'restore_expenses(uuid[])', 'preview_expense(jsonb)', 'save_fund(jsonb,boolean)', 'reorder_funds(uuid[],boolean)',
    'set_fund_period_budget(uuid,uuid,numeric,boolean)', 'close_period(uuid)', 'apply_template_batch(date,jsonb,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
