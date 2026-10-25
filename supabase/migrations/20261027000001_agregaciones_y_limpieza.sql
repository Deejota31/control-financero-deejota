-- 1) Agregaciones del Dashboard calculadas en PostgreSQL (sin límite de filas del API).
-- 2) Tareas de limpieza de comprobantes (storage) reintentables.

create function public.dashboard_resumen(p_desde date, p_hasta date, p_prev_desde date, p_prev_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_periods uuid[];
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial es posterior a la final.' using errcode = '22023'; end if;

  select coalesce(array_agg(id), '{}') into v_periods
  from public.budget_periods
  where household_id = v_hid and start_date <= p_hasta and end_date >= p_desde;

  return jsonb_build_object(
    'total', coalesce((select sum(amount) from public.expenses where household_id = v_hid and status = 'active' and expense_date between p_desde and p_hasta), 0),
    'cantidad', (select count(*) from public.expenses where household_id = v_hid and status = 'active' and expense_date between p_desde and p_hasta),
    'total_prev', coalesce((select sum(amount) from public.expenses where household_id = v_hid and status = 'active' and expense_date between p_prev_desde and p_prev_hasta), 0),
    'cantidad_prev', (select count(*) from public.expenses where household_id = v_hid and status = 'active' and expense_date between p_prev_desde and p_prev_hasta),
    'presupuesto', case when cardinality(v_periods) = 0 then null else (
      select coalesce(sum(b.assigned_amount), 0)
      from public.fund_period_budgets b join public.funds f on f.id = b.fund_id
      where b.period_id = any (v_periods) and f.is_active
    ) end,
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', d.expense_date, 'monto', d.m) order by d.expense_date)
      from (select expense_date, sum(amount) as m from public.expenses
            where household_id = v_hid and status = 'active' and expense_date between p_desde and p_hasta group by expense_date) d
    ), '[]'::jsonb),
    'por_ambito', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.k, 'total', g.t, 'cantidad', g.c) order by g.t desc)
      from (select ambito_id as k, sum(amount) as t, count(*) as c from public.expenses
            where household_id = v_hid and status = 'active' and expense_date between p_desde and p_hasta group by ambito_id) g
    ), '[]'::jsonb),
    'por_categoria', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.k, 'total', g.t, 'cantidad', g.c) order by g.t desc)
      from (select categoria_id as k, sum(amount) as t, count(*) as c from public.expenses
            where household_id = v_hid and status = 'active' and expense_date between p_desde and p_hasta group by categoria_id) g
    ), '[]'::jsonb),
    'por_subcategoria', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.k, 'total', g.t, 'cantidad', g.c) order by g.t desc)
      from (select subcategoria_id as k, sum(amount) as t, count(*) as c from public.expenses
            where household_id = v_hid and status = 'active' and subcategoria_id is not null and expense_date between p_desde and p_hasta group by subcategoria_id) g
    ), '[]'::jsonb),
    'recientes', coalesce((
      select jsonb_agg(to_jsonb(r))
      from (select id, expense_date, description, amount, categoria_id, created_at from public.expenses
            where household_id = v_hid and status = 'active' and expense_date between p_desde and p_hasta
            order by expense_date desc, created_at desc limit 6) r
    ), '[]'::jsonb),
    'fondos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fund_id', f.id, 'nombre', f.name, 'es_general', f.is_general, 'prioridad', f.priority,
        'asignado', coalesce((select sum(b.assigned_amount) from public.fund_period_budgets b where b.fund_id = f.id and b.period_id = any (v_periods)), 0),
        'consumido', coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.fund_id = f.id and a.period_id = any (v_periods)), 0)))
      from public.funds f where f.household_id = v_hid and f.is_active
    ), '[]'::jsonb),
    'excedente', coalesce((
      select sum(a.amount)
      from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
      where a.household_id = v_hid and a.period_id = any (v_periods) and a.allocation_kind = 'general'
        and e.expense_date between p_desde and p_hasta
        and exists (
          select 1 from public.funds s
          where s.household_id = v_hid and s.is_active and not s.is_general
            and public.fund_admits(s.id, e.ambito_id, e.categoria_id, e.subcategoria_id, e.payment_method_id))
    ), 0)
  );
end;
$$;
revoke all on function public.dashboard_resumen(date, date, date, date) from public, anon;
grant execute on function public.dashboard_resumen(date, date, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Limpieza de comprobantes
-- ---------------------------------------------------------------------------
create table public.storage_cleanup_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  bucket text not null default 'comprobantes' check (bucket = 'comprobantes'),
  path text not null check (char_length(path) between 1 and 512),
  reason text not null check (reason in ('intencion', 'compensacion', 'reemplazo')),
  not_before timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique (household_id, path)
);
create index storage_cleanup_tasks_due_idx on public.storage_cleanup_tasks (household_id, not_before);

alter table public.storage_cleanup_tasks enable row level security;
create policy storage_cleanup_tasks_select on public.storage_cleanup_tasks
  for select to authenticated using (public.is_household_member(household_id));
revoke insert, update, delete on public.storage_cleanup_tasks from authenticated, anon;

-- Registra rutas para borrar más tarde. "intencion" espera p_demora_min (por si la carga sigue en curso);
-- las demás razones están disponibles de inmediato y adelantan una intención previa.
create function public.registrar_limpieza(p_paths text[], p_reason text, p_demora_min integer default 0)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_path text;
  v_n integer := 0;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  foreach v_path in array p_paths loop
    if v_path not like v_hid::text || '/%' then
      raise exception 'Ruta de comprobante no válida.' using errcode = 'GD009';
    end if;
    insert into public.storage_cleanup_tasks (household_id, path, reason, not_before)
    values (v_hid, v_path, p_reason, now() + make_interval(mins => greatest(p_demora_min, 0)))
    on conflict (household_id, path) do update
      set not_before = least(public.storage_cleanup_tasks.not_before, excluded.not_before),
          reason = case when excluded.reason <> 'intencion' then excluded.reason else public.storage_cleanup_tasks.reason end;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Devuelve lo que ya se puede borrar. Descarta tareas cuyo archivo quedó asociado a un gasto (nunca se borra un comprobante en uso).
create function public.listar_limpieza()
returns table (id uuid, path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  delete from public.storage_cleanup_tasks t
  where t.household_id = v_hid
    and exists (select 1 from public.expenses e where e.household_id = v_hid and e.receipt_path = t.path);
  return query
    select t.id, t.path from public.storage_cleanup_tasks t
    where t.household_id = v_hid and t.not_before <= now()
    order by t.created_at;
end;
$$;

create function public.completar_limpieza(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.storage_cleanup_tasks where id = any (p_ids) and household_id = public.current_household_id();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create function public.fallo_limpieza(p_ids uuid[], p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.storage_cleanup_tasks
  set attempts = attempts + 1, last_error = left(p_error, 300), not_before = now() + interval '5 minutes'
  where id = any (p_ids) and household_id = public.current_household_id();
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array['registrar_limpieza(text[],text,integer)', 'listar_limpieza()', 'completar_limpieza(uuid[])', 'fallo_limpieza(uuid[],text)'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
