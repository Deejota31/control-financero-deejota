-- Fondos independientes por mes: cada fondo es una instancia que pertenece a UN período (funds.period_id).
--
-- Hasta ahora `funds` era global y `ensure_period` creaba un presupuesto para TODOS los fondos activos en cada mes nuevo, por eso un fondo de
-- octubre aparecía en todos los demás meses. Ahora un fondo (con su nombre, prioridad, reglas e importe) existe solo en su mes; copiarlo a otro
-- mes es una operación explícita (copy_funds) que crea una instancia independiente. Ningún período nuevo recibe fondos automáticamente.
--
-- Migración de datos reales (segura y reversible):
--   1. Respaldo previo de las tablas afectadas en el esquema `respaldo_fondos` (no expuesto por la API).
--   2. Cada fondo existente se asigna al mes de su fecha de creación (dato verificable, nunca arbitrario). Si ese período no existe, la
--      migración se detiene en vez de inventar uno.
--   3. Los presupuestos de los demás meses (creados automáticamente por ensure_period) se archivan en el respaldo y se quitan de la tabla activa.
--      Los períodos y sus registros no se eliminan.
--   4. Si existiera alguna imputación de gastos en un mes distinto al de su fondo, la migración se detiene: esa historia no puede resolverse sola.
-- Reversión: restaurar desde respaldo_fondos.* (ver docs/decisiones.md) y volver a las definiciones de 20261026000005_motor_asignacion.sql.

-- 1. Respaldo previo ---------------------------------------------------------------------------------------------------------------------------
create schema if not exists respaldo_fondos;
revoke all on schema respaldo_fondos from public, anon, authenticated;

create table respaldo_fondos.funds_20261101 as table public.funds;
create table respaldo_fondos.fund_period_budgets_20261101 as table public.fund_period_budgets;
create table respaldo_fondos.fund_scope_rules_20261101 as table public.fund_scope_rules;
create table respaldo_fondos.fund_payment_rules_20261101 as table public.fund_payment_rules;
create table respaldo_fondos.period_fund_snapshots_20261101 as table public.period_fund_snapshots;
create table respaldo_fondos.expense_fund_allocations_20261101 as table public.expense_fund_allocations;
create table respaldo_fondos.budget_periods_20261101 as table public.budget_periods;
revoke all on all tables in schema respaldo_fondos from public, anon, authenticated;

-- 2. Columnas nuevas ---------------------------------------------------------------------------------------------------------------------------
alter table public.funds add column period_id uuid;
alter table public.funds add column copied_from uuid references public.funds (id) on delete set null;

-- 3. Asignar cada fondo existente a su mes de creación ----------------------------------------------------------------------------------------
do $$
declare
  f record;
  v_period uuid;
  v_n int := 0;
begin
  for f in select id, household_id, name, created_at from public.funds loop
    select id into v_period from public.budget_periods
    where household_id = f.household_id and start_date = date_trunc('month', f.created_at at time zone 'America/Lima')::date;
    if v_period is null then
      raise exception 'Migración detenida: el fondo "%" (creado %) no tiene un período mensual que le corresponda. No se asigna un período arbitrario.',
        f.name, f.created_at using errcode = 'GD015';
    end if;
    update public.funds set period_id = v_period where id = f.id;
    -- La instancia necesita su presupuesto en su propio mes.
    insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
    select f.household_id, f.id, v_period, fu.default_amount from public.funds fu where fu.id = f.id
    on conflict (fund_id, period_id) do nothing;
    v_n := v_n + 1;
  end loop;

  if exists (
    select 1 from public.expense_fund_allocations a join public.funds fu on fu.id = a.fund_id where a.period_id <> fu.period_id
  ) then
    raise exception 'Migración detenida: hay imputaciones de gastos en un período distinto al de su fondo; no se pueden reasignar de forma fiable.' using errcode = 'GD015';
  end if;
  if exists (
    select 1 from public.period_fund_snapshots s join public.funds fu on fu.id = s.fund_id where s.period_id <> fu.period_id
  ) then
    raise exception 'Migración detenida: hay cierres de período con fondos de otro mes; no se pueden reasignar de forma fiable.' using errcode = 'GD015';
  end if;

  -- Presupuestos generados automáticamente para otros meses: ya están en el respaldo.
  delete from public.fund_period_budgets b using public.funds fu where fu.id = b.fund_id and b.period_id <> fu.period_id;
end $$;

-- 4. Restricciones por período -----------------------------------------------------------------------------------------------------------------
alter table public.funds alter column period_id set not null;
alter table public.funds add constraint funds_period_fk foreign key (period_id, household_id) references public.budget_periods (id, household_id) on delete restrict;
alter table public.funds add constraint funds_id_period_key unique (id, period_id);

drop index public.funds_name_uq;
create unique index funds_name_uq on public.funds (household_id, period_id, lower(btrim(name)));
drop index public.funds_one_active_general;
-- Como máximo un Fondo General activo por mes.
create unique index funds_one_active_general on public.funds (household_id, period_id) where is_general and is_active;
create index funds_period_idx on public.funds (household_id, period_id);
-- Una copia no puede repetirse en el mismo mes (idempotencia aunque se reintente).
create unique index funds_copy_once on public.funds (period_id, copied_from) where copied_from is not null;

-- El presupuesto y las imputaciones solo pueden apuntar a un fondo de SU período.
alter table public.fund_period_budgets add constraint fund_period_budgets_fund_period_fk
  foreign key (fund_id, period_id) references public.funds (id, period_id) on delete cascade;
alter table public.expense_fund_allocations add constraint expense_fund_allocations_fund_period_fk
  foreign key (fund_id, period_id) references public.funds (id, period_id) on delete cascade;
alter table public.period_fund_snapshots add constraint period_fund_snapshots_fund_period_fk
  foreign key (fund_id, period_id) references public.funds (id, period_id) on delete cascade;

-- 5. Motor de asignación: todo acotado al período ----------------------------------------------------------------------------------------------
-- ensure_period ya no crea fondos ni presupuestos: un mes nuevo empieza sin fondos hasta que el usuario los cree o copie.
create or replace function public.ensure_period(hid uuid, p_date date)
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
  end if;
  return v_id;
end;
$$;

create or replace function public.recalc_period(p_period uuid)
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

  -- Un mes sin fondos no imputa nada: sus gastos quedan «sin fondo» hasta que se configuren fondos en ese mes.
  if not exists (select 1 from public.funds fu where fu.period_id = p_period and fu.is_active) then
    return;
  end if;

  -- Capacidad restante por fondo activo DEL PERÍODO (los fondos sin presupuesto cuentan como 0).
  select coalesce(jsonb_object_agg(fu.id::text, coalesce(b.assigned_amount, 0)), '{}'::jsonb) into v_rem
  from public.funds fu
  left join public.fund_period_budgets b on b.fund_id = fu.id and b.period_id = p_period
  where fu.period_id = p_period and fu.is_active;

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
      where fu.period_id = p_period and fu.is_active
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
        select 1 from public.funds fu where fu.period_id = p_period and fu.is_active
          and public.fund_admits_scope(fu.id, e.ambito_id, e.categoria_id, e.subcategoria_id)
      ) into v_scope_any;
      select exists (
        select 1 from public.funds fu where fu.period_id = p_period and fu.is_active
          and public.fund_admits_method(fu.id, e.payment_method_id)
      ) into v_method_any;
      v_reason := case
        when not v_scope_any then 'classification'
        when not v_method_any then 'payment_method'
        else 'rules'
      end;
      raise exception 'Ningún fondo admite "%" (%).', e.description,
        case v_reason
          when 'classification' then 'la clasificación no está cubierta por ningún fondo de este mes'
          when 'payment_method' then 'el medio de pago no está admitido por ningún fondo de este mes'
          else 'ningún fondo de este mes admite a la vez esa clasificación y ese medio de pago'
        end
        using errcode = 'GD001', detail = v_reason;
    end if;

    if v_left > 0 then
      if v_general is not null then
        -- El Fondo General del mes absorbe el excedente y puede quedar negativo.
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

-- La suma de imputaciones debe igualar al gasto, salvo en un mes sin fondos (el gasto queda «sin fondo»).
create or replace function public.check_allocation_sum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  eid uuid;
  v_amount numeric;
  v_status text;
  v_date date;
  v_hid uuid;
  v_sum numeric;
begin
  if tg_table_name = 'expenses' then
    eid := new.id;
  elsif tg_op = 'DELETE' then
    eid := old.expense_id;
  else
    eid := new.expense_id;
  end if;
  select amount, status, expense_date, household_id into v_amount, v_status, v_date, v_hid from public.expenses where id = eid;
  if not found then
    return null; -- el gasto ya no existe (borrado en cascada)
  end if;
  select coalesce(sum(amount), 0) into v_sum from public.expense_fund_allocations where expense_id = eid;
  if v_status = 'active' and v_sum <> v_amount then
    if v_sum = 0 and not exists (
      select 1 from public.funds fu join public.budget_periods bp on bp.id = fu.period_id
      where bp.household_id = v_hid and fu.is_active and v_date between bp.start_date and bp.end_date
    ) then
      return null; -- el mes del gasto no tiene fondos
    end if;
    raise exception 'La suma de imputaciones (%) no coincide con el gasto (%).', v_sum, v_amount using errcode = '23514';
  end if;
  if v_status = 'annulled' and v_sum <> 0 then
    raise exception 'Un gasto anulado no puede tener imputaciones.' using errcode = '23514';
  end if;
  return null;
end;
$$;

create or replace function public.close_period(p_period uuid)
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
  where f.household_id = v_hid and f.period_id = p_period;
  update public.budget_periods set status = 'closed', closed_at = now() where id = p_period;
end;
$$;

create or replace function public.fund_period_detail(hid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'period_id', bp.id, 'start', bp.start_date, 'fund_id', f.id, 'fund_name', f.name,
      'assigned', coalesce(b.assigned_amount, 0), 'consumed', coalesce(c.total, 0)
    ) order by bp.start_date, f.priority, f.created_at), '[]'::jsonb)
  from public.budget_periods bp
  join public.funds f on f.period_id = bp.id and f.household_id = bp.household_id
  left join public.fund_period_budgets b on b.fund_id = f.id and b.period_id = bp.id
  left join (
    select a.fund_id, a.period_id, sum(a.amount) as total
    from public.expense_fund_allocations a
    where a.household_id = hid
    group by a.fund_id, a.period_id
  ) c on c.fund_id = f.id and c.period_id = bp.id
  where bp.household_id = hid and bp.status = 'open';
$$;

-- Crear o editar la instancia mensual de un fondo. Al crear, `period_id` indica el mes (obligatorio); `period_amount` es su importe.
create or replace function public.save_fund(p jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_period uuid;
  v_amount numeric;
  v_before jsonb;
  v_after jsonb;
  v_cons_before jsonb;
  v_cons_after jsonb;
  v_blocked text;
  v_rule jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);

  begin
    if v_id is null then
      v_period := nullif(p ->> 'period_id', '')::uuid;
      if v_period is null then raise exception 'Indica el mes al que pertenece el fondo.' using errcode = 'GD004'; end if;
      if not exists (select 1 from public.budget_periods where id = v_period and household_id = v_hid) then
        raise exception 'Período no encontrado.' using errcode = 'GD004';
      end if;
      if exists (select 1 from public.budget_periods where id = v_period and status = 'closed') then
        raise exception 'El período está cerrado.' using errcode = 'GD002';
      end if;
      v_amount := coalesce((p ->> 'period_amount')::numeric, (p ->> 'default_amount')::numeric, 0);
      insert into public.funds (household_id, period_id, name, description, icon_key, color_token, is_general, default_amount, priority, is_active)
      values (
        v_hid, v_period, p ->> 'name', nullif(p ->> 'description', ''), nullif(p ->> 'icon_key', ''), nullif(p ->> 'color_token', ''),
        coalesce((p ->> 'is_general')::boolean, false), v_amount,
        coalesce((p ->> 'priority')::int, 100), coalesce((p ->> 'is_active')::boolean, true)
      ) returning id into v_id;
      insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount) values (v_hid, v_id, v_period, v_amount);
    else
      select period_id into v_period from public.funds where id = v_id and household_id = v_hid;
      if v_period is null then raise exception 'Fondo no encontrado.' using errcode = 'GD004'; end if;
      if exists (select 1 from public.budget_periods where id = v_period and status = 'closed') then
        raise exception 'El período está cerrado: su histórico no se modifica.' using errcode = 'GD002';
      end if;
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
      if nullif(p ->> 'period_amount', '') is not null then
        insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
        values (v_hid, v_id, v_period, (p ->> 'period_amount')::numeric)
        on conflict (fund_id, period_id) do update set assigned_amount = excluded.assigned_amount;
      end if;
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

    -- Solo se recalcula el mes del fondo: los demás meses no se tocan.
    perform public.recalc_period(v_period);

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
    'period_id', v_period,
    'dry_run', p_dry_run,
    'blocked', v_blocked,
    'changed_expenses', case when v_blocked is null then public.count_changed(v_before, v_after) else null end,
    'consumption_before', v_cons_before,
    'consumption_after', case when v_blocked is null then v_cons_after else null end
  );
end;
$$;

create or replace function public.set_fund_period_budget(p_fund uuid, p_period uuid, p_amount numeric, p_dry_run boolean default false)
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
  if not exists (select 1 from public.funds where id = p_fund and household_id = v_hid and period_id = p_period) then
    raise exception 'Ese fondo no pertenece a este mes.' using errcode = 'GD004';
  end if;
  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);
  begin
    update public.fund_period_budgets set assigned_amount = p_amount where fund_id = p_fund and period_id = p_period;
    if not found then
      insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount) values (v_hid, p_fund, p_period, p_amount);
    end if;
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

-- La prioridad se ordena dentro de un mes: todos los fondos de la lista deben ser del mismo período.
create or replace function public.reorder_funds(p_ids uuid[], p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_period uuid;
  v_n int;
  v_before jsonb;
  v_after jsonb;
  v_cons_before jsonb;
  v_cons_after jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  select count(distinct period_id), min(period_id::text)::uuid into v_n, v_period from public.funds where id = any (p_ids) and household_id = v_hid;
  if v_n > 1 then raise exception 'Los fondos a ordenar deben pertenecer al mismo mes.' using errcode = 'GD004'; end if;
  if v_n = 0 then raise exception 'Fondos no encontrados.' using errcode = 'GD004'; end if;
  if exists (select 1 from public.budget_periods where id = v_period and status = 'closed') then
    raise exception 'El período está cerrado: su histórico no se modifica.' using errcode = 'GD002';
  end if;
  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);
  begin
    update public.funds f set priority = o.ord::int * 10
    from unnest(p_ids) with ordinality as o(id, ord)
    where f.id = o.id and f.household_id = v_hid;
    perform public.recalc_period(v_period);
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

-- 6. Eliminar un fondo: solo afecta a su mes y los destinos son fondos de ese mismo mes ---------------------------------------------------------
create or replace function public.delete_fund(p_fund uuid, p_destino uuid default null, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_f public.funds%rowtype;
  v_open_alloc int;
  v_open_exp int;
  v_closed_alloc int;
  v_snapshots int;
  v_budgets int;
  v_templates int;
  v_destinos jsonb;
  v_before jsonb;
  v_after jsonb;
  v_cons_before jsonb;
  v_cons_after jsonb;
  v_deps jsonb;
  v_motivo text;
  v_cerrado boolean;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  select * into v_f from public.funds where id = p_fund and household_id = v_hid;
  if not found then raise exception 'No se encontró el fondo. Puede que ya no exista.' using errcode = 'GD004'; end if;
  select status = 'closed' into v_cerrado from public.budget_periods where id = v_f.period_id;

  select count(*), count(distinct a.expense_id) into v_open_alloc, v_open_exp
  from public.expense_fund_allocations a join public.budget_periods bp on bp.id = a.period_id
  where a.fund_id = p_fund and bp.status = 'open';
  select count(*) into v_closed_alloc
  from public.expense_fund_allocations a join public.budget_periods bp on bp.id = a.period_id
  where a.fund_id = p_fund and bp.status = 'closed';
  select count(*) into v_snapshots from public.period_fund_snapshots where fund_id = p_fund;
  select count(*) into v_budgets from public.fund_period_budgets where fund_id = p_fund;
  select count(*) into v_templates from public.expense_templates where default_fund_id = p_fund;

  -- Fondos activos DEL MISMO MES que admiten todos los gastos hoy imputados a este.
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'is_general', d.is_general) order by d.is_general desc, d.priority, d.name), '[]'::jsonb)
  into v_destinos
  from public.funds d
  where d.household_id = v_hid and d.period_id = v_f.period_id and d.is_active and d.id <> p_fund
    and not exists (
      select 1 from public.expense_fund_allocations a
      join public.budget_periods bp on bp.id = a.period_id and bp.status = 'open'
      join public.expenses x on x.id = a.expense_id
      where a.fund_id = p_fund
        and not public.fund_admits(d.id, x.ambito_id, x.categoria_id, x.subcategoria_id, x.payment_method_id)
    );

  v_deps := jsonb_build_object(
    'fund_name', v_f.name, 'is_general', v_f.is_general, 'period_id', v_f.period_id,
    'open_expenses', v_open_exp, 'open_allocations', v_open_alloc,
    'closed_allocations', v_closed_alloc, 'closed_snapshots', v_snapshots,
    'budgets', v_budgets, 'templates', v_templates, 'destinations', v_destinos
  );

  v_motivo := case
    when v_f.is_general then 'GD010'
    when v_closed_alloc > 0 or v_snapshots > 0 or v_cerrado then 'GD011'
    when v_open_alloc > 0 and p_destino is null then 'GD012'
    when v_open_alloc > 0 and not exists (select 1 from jsonb_array_elements(v_destinos) d where (d ->> 'id')::uuid = p_destino) then 'GD013'
  end;

  if p_dry_run and p_destino is null then
    return v_deps || jsonb_build_object('dry_run', true, 'blocked', coalesce(v_motivo in ('GD010', 'GD011'), false), 'code', v_motivo);
  end if;

  if v_motivo is not null then
    raise exception '%', case v_motivo
      when 'GD010' then 'El Fondo General no se puede eliminar: absorbe el excedente de los demás fondos. Puedes desactivarlo.'
      when 'GD011' then 'El fondo tiene historial en períodos cerrados, que no se modifica. Puedes desactivarlo.'
      when 'GD012' then 'Elige un fondo de destino para los gastos que cubre este fondo.'
      else 'El fondo de destino no admite todos los gastos de este fondo.'
    end using errcode = v_motivo;
  end if;

  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);
  begin
    delete from public.expense_fund_allocations where fund_id = p_fund;
    delete from public.funds where id = p_fund and household_id = v_hid;
    perform public.recalc_period(v_f.period_id);
    v_after := public.alloc_signature(v_hid);
    v_cons_after := public.open_consumption(v_hid);
    if p_dry_run then raise exception 'simulacion' using errcode = 'GD999'; end if;
  exception when others then
    if sqlstate <> 'GD999' then raise; end if;
  end;
  return v_deps || jsonb_build_object(
    'dry_run', p_dry_run, 'blocked', false,
    'changed_expenses', public.count_changed(v_before, v_after),
    'consumption_before', v_cons_before, 'consumption_after', v_cons_after
  );
end;
$$;

-- 7. Copiar fondos de otro mes (explícito, independiente e idempotente) -----------------------------------------------------------------------
-- p_items: [{ "fund_id": uuid, "amount": number?, "name": text? }]. Copia nombre, icono, color, prioridad, descripción, estado, reglas de
-- cobertura y de medios de pago, y un importe propuesto. No copia gastos, consumo, imputaciones ni sobregasto. Nunca sobrescribe: si el mes
-- destino ya tiene el fondo (misma copia o mismo nombre) se omite y se informa.
create or replace function public.copy_funds(p_source uuid, p_target uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_item jsonb;
  v_src public.funds%rowtype;
  v_new uuid;
  v_name text;
  v_amount numeric;
  v_created jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_source = p_target then raise exception 'El mes de origen y el de destino deben ser distintos.' using errcode = 'GD004'; end if;
  if not exists (select 1 from public.budget_periods where id = p_source and household_id = v_hid)
     or not exists (select 1 from public.budget_periods where id = p_target and household_id = v_hid) then
    raise exception 'Período no encontrado.' using errcode = 'GD004';
  end if;
  if exists (select 1 from public.budget_periods where id = p_target and status = 'closed') then
    raise exception 'El período de destino está cerrado: su histórico no se modifica.' using errcode = 'GD002';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_src from public.funds where id = (v_item ->> 'fund_id')::uuid and household_id = v_hid and period_id = p_source;
    if not found then
      v_skipped := v_skipped || jsonb_build_object('source_id', v_item ->> 'fund_id', 'name', null, 'reason', 'not_in_source');
      continue;
    end if;
    v_name := coalesce(nullif(btrim(v_item ->> 'name'), ''), v_src.name);
    v_amount := coalesce((v_item ->> 'amount')::numeric, (select assigned_amount from public.fund_period_budgets where fund_id = v_src.id and period_id = p_source), v_src.default_amount, 0);

    if exists (select 1 from public.funds where period_id = p_target and copied_from = v_src.id) then
      v_skipped := v_skipped || jsonb_build_object('source_id', v_src.id, 'name', v_src.name, 'reason', 'already_copied');
    elsif exists (select 1 from public.funds where period_id = p_target and household_id = v_hid and lower(btrim(name)) = lower(btrim(v_name))) then
      v_skipped := v_skipped || jsonb_build_object('source_id', v_src.id, 'name', v_src.name, 'reason', 'name_exists');
    elsif v_src.is_general and v_src.is_active and exists (select 1 from public.funds where period_id = p_target and household_id = v_hid and is_general and is_active) then
      v_skipped := v_skipped || jsonb_build_object('source_id', v_src.id, 'name', v_src.name, 'reason', 'general_exists');
    else
      insert into public.funds (household_id, period_id, name, description, icon_key, color_token, is_general, default_amount, priority, is_active, copied_from)
      values (v_hid, p_target, v_name, v_src.description, v_src.icon_key, v_src.color_token, v_src.is_general, v_amount, v_src.priority, v_src.is_active, v_src.id)
      returning id into v_new;
      insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount) values (v_hid, v_new, p_target, v_amount);
      insert into public.fund_scope_rules (household_id, fund_id, ambito_id, categoria_id, subcategoria_id, effect)
        select v_hid, v_new, ambito_id, categoria_id, subcategoria_id, effect from public.fund_scope_rules where fund_id = v_src.id;
      insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
        select v_hid, v_new, payment_method_id, effect from public.fund_payment_rules where fund_id = v_src.id;
      v_created := v_created || jsonb_build_object('source_id', v_src.id, 'id', v_new, 'name', v_name, 'amount', v_amount);
    end if;
  end loop;

  if jsonb_array_length(v_created) > 0 then
    perform public.recalc_period(p_target);
  end if;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;
revoke all on function public.copy_funds(uuid, uuid, jsonb) from public, anon;
grant execute on function public.copy_funds(uuid, uuid, jsonb) to authenticated;

-- 8. Planificación mensual -----------------------------------------------------------------------------------------------------------------------
create table public.period_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  period_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  funds_stage text not null default 'pending' check (funds_stage in ('pending', 'done', 'skipped')),
  expenses_stage text not null default 'pending' check (expenses_stage in ('pending', 'done', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  remind_after date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id),
  foreign key (period_id, household_id) references public.budget_periods (id, household_id) on delete cascade,
  check ((status = 'completed') = (completed_at is not null))
);
create trigger period_plans_set_updated_at before update on public.period_plans
  for each row execute function public.set_updated_at();
alter table public.period_plans enable row level security;
create policy period_plans_select on public.period_plans for select to authenticated using (public.is_household_member(household_id));
revoke insert, update, delete on public.period_plans from authenticated, anon;

alter table public.profiles add column planning_reminders boolean not null default true;

-- Guarda el avance de la planificación de un mes (crea el período si hace falta, para poder preparar meses futuros).
-- p_patch admite: funds_stage, expenses_stage ('pending'|'done'|'skipped'), status ('in_progress'|'completed'|'pending'), remind_after (fecha o null).
create or replace function public.save_period_plan(p_month date, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_period uuid;
  v_plan public.period_plans%rowtype;
  v_status text;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  v_period := public.ensure_period(v_hid, p_month);
  insert into public.period_plans (household_id, period_id) values (v_hid, v_period) on conflict (period_id) do nothing;
  select * into v_plan from public.period_plans where period_id = v_period for update;

  if p_patch ? 'funds_stage' then v_plan.funds_stage := p_patch ->> 'funds_stage'; end if;
  if p_patch ? 'expenses_stage' then v_plan.expenses_stage := p_patch ->> 'expenses_stage'; end if;
  if p_patch ? 'remind_after' then v_plan.remind_after := nullif(p_patch ->> 'remind_after', '')::date; end if;

  v_status := coalesce(p_patch ->> 'status', v_plan.status);
  if v_status = 'completed' then
    if v_plan.funds_stage = 'pending' or v_plan.expenses_stage = 'pending' then
      raise exception 'Completa u omite cada etapa antes de finalizar la planificación.' using errcode = 'GD014';
    end if;
    if v_plan.completed_at is null then v_plan.completed_at := now(); end if;
  else
    v_plan.completed_at := null;
    if v_status = 'pending' and (v_plan.funds_stage <> 'pending' or v_plan.expenses_stage <> 'pending') then v_status := 'in_progress'; end if;
  end if;
  if v_status <> 'pending' and v_plan.started_at is null then v_plan.started_at := now(); end if;

  update public.period_plans set
    funds_stage = v_plan.funds_stage, expenses_stage = v_plan.expenses_stage, status = v_status,
    remind_after = v_plan.remind_after, started_at = v_plan.started_at, completed_at = v_plan.completed_at
  where id = v_plan.id
  returning * into v_plan;
  return to_jsonb(v_plan);
end;
$$;
revoke all on function public.save_period_plan(date, jsonb) from public, anon;
grant execute on function public.save_period_plan(date, jsonb) to authenticated;

-- Cifras reales del mes para la ventana de planificación y el resumen (solo datos de ese período).
create or replace function public.planning_summary(p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_period uuid;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  select id into v_period from public.budget_periods where household_id = v_hid and start_date = v_start;
  return jsonb_build_object(
    'period_id', v_period,
    'funds_count', (select count(*) from public.funds f where f.period_id = v_period and f.is_active),
    'budget_total', coalesce((select sum(b.assigned_amount) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id
        where b.period_id = v_period and f.is_active), 0),
    'expenses_total', coalesce((select sum(e.amount) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between v_start and v_end), 0),
    'expenses_count', (select count(*) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between v_start and v_end),
    'overspent_funds', (select count(*) from public.funds f
        where f.period_id = v_period and f.is_active
          and coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.fund_id = f.id), 0)
              > coalesce((select b.assigned_amount from public.fund_period_budgets b where b.fund_id = f.id and b.period_id = v_period), 0)),
    'plan', (select to_jsonb(pp) from public.period_plans pp where pp.period_id = v_period)
  );
end;
$$;
revoke all on function public.planning_summary(date) from public, anon;
grant execute on function public.planning_summary(date) to authenticated;
