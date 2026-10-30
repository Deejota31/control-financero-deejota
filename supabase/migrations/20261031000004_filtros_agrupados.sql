-- Filtros de categoría y subcategoría con varios ids: el selector agrupa por nombre (una sola opción «Alimentación») y al elegirla filtra
-- todas las clasificaciones homónimas. Solo cambia el tipo de p_categoria y p_subcategoria (uuid → uuid[]); el resto de la lógica es idéntica.
-- Cambio reversible: solo funciones, sin tablas ni datos.
-- Reversión: recrear la función de 20261028000001_dashboard_panel.sql.

drop function if exists public.dashboard_panel(date, date, date, date, uuid, uuid, uuid, uuid, text, date);

create function public.dashboard_panel(
  p_desde date, p_hasta date, p_prev_desde date, p_prev_hasta date,
  p_ambito uuid default null, p_categoria uuid[] default null, p_subcategoria uuid[] default null,
  p_medio uuid default null, p_tipo text default null, p_dia date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_periods uuid[];
  v_total_rango numeric;
  v_imputado numeric;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial es posterior a la final.' using errcode = '22023'; end if;
  if p_tipo is not null and p_tipo not in ('fixed', 'variable') then raise exception 'Tipo de gasto no válido.' using errcode = '22023'; end if;

  select coalesce(array_agg(id), '{}') into v_periods
  from public.budget_periods
  where household_id = v_hid and start_date <= p_hasta and end_date >= p_desde;

  select coalesce(sum(amount), 0) into v_total_rango
  from public.expenses where household_id = v_hid and status = 'active' and expense_date between p_desde and p_hasta;
  select coalesce(sum(a.amount), 0) into v_imputado
  from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
  where a.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta;

  return jsonb_build_object(
    -- Con todos los filtros
    'total', coalesce((select sum(e.amount) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
        and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
        and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)), 0),
    'cantidad', (select count(*) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
        and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
        and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)),
    'dias_con_gasto', (select count(distinct e.expense_date) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
        and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
        and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)),
    'mayor', (select to_jsonb(m) from (select e.id, e.description, e.amount, e.expense_date from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
        and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
        and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)
        order by e.amount desc, e.expense_date desc, e.id limit 1) m),
    'recientes', coalesce((select jsonb_agg(to_jsonb(r)) from (select e.id, e.expense_date, e.description, e.amount, e.categoria_id, e.created_at from public.expenses e
        where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
        and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
        and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)
        order by e.expense_date desc, e.created_at desc, e.id limit 6) r), '[]'::jsonb),

    -- Período anterior comparable (mismos filtros salvo el día)
    'total_prev', coalesce((select sum(e.amount) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_prev_desde and p_prev_hasta
        and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
        and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo)), 0),
    'cantidad_prev', (select count(*) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_prev_desde and p_prev_hasta
        and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
        and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo)),

    -- Serie diaria: todos los filtros salvo el día
    'serie', coalesce((select jsonb_agg(jsonb_build_object('fecha', d.expense_date, 'monto', d.m, 'cantidad', d.c) order by d.expense_date)
        from (select e.expense_date, sum(e.amount) as m, count(*) as c from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
          and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
          and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo)
          group by e.expense_date) d), '[]'::jsonb),

    -- Distribución por ámbito: todos salvo ámbito
    'por_ambito', coalesce((select jsonb_agg(jsonb_build_object('id', g.k, 'total', g.t, 'cantidad', g.c) order by g.t desc)
        from (select e.ambito_id as k, sum(e.amount) as t, count(*) as c from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
          and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
          and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)
          group by e.ambito_id) g), '[]'::jsonb),

    -- Top categorías: todos salvo categoría y subcategoría
    'por_categoria', coalesce((select jsonb_agg(jsonb_build_object('id', g.k, 'total', g.t, 'cantidad', g.c) order by g.t desc)
        from (select e.categoria_id as k, sum(e.amount) as t, count(*) as c from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
          and (p_ambito is null or e.ambito_id = p_ambito)
          and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)
          group by e.categoria_id) g), '[]'::jsonb),

    -- Top subcategorías: todos salvo subcategoría
    'por_subcategoria', coalesce((select jsonb_agg(jsonb_build_object('id', g.k, 'total', g.t, 'cantidad', g.c) order by g.t desc)
        from (select e.subcategoria_id as k, sum(e.amount) as t, count(*) as c from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.subcategoria_id is not null and e.expense_date between p_desde and p_hasta
          and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria))
          and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)
          group by e.subcategoria_id) g), '[]'::jsonb),

    -- Presupuesto del rango (no depende de los filtros cruzados)
    'presupuesto', case when cardinality(v_periods) = 0 then null else (
      select coalesce(sum(b.assigned_amount), 0) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id
      where b.period_id = any (v_periods) and f.is_active) end,
    'gasto_rango', v_total_rango,
    'imputado_rango', v_imputado,
    'sin_fondo', greatest(v_total_rango - v_imputado, 0),
    'fondos_periodo', cardinality(v_periods),
    'fondos', coalesce((select jsonb_agg(jsonb_build_object(
        'fund_id', f.id, 'nombre', f.name, 'es_general', f.is_general, 'prioridad', f.priority,
        'asignado', coalesce((select sum(b.assigned_amount) from public.fund_period_budgets b where b.fund_id = f.id and b.period_id = any (v_periods)), 0),
        'consumido', coalesce((select sum(a.amount) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
            where a.fund_id = f.id and e.status = 'active' and e.expense_date between p_desde and p_hasta), 0),
        'consumido_filtrado', coalesce((select sum(a.amount) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
            where a.fund_id = f.id and e.status = 'active' and e.expense_date between p_desde and p_hasta
              and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
              and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)), 0)))
        from public.funds f where f.household_id = v_hid and f.is_active), '[]'::jsonb),
    'excedente', coalesce((select sum(a.amount) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
        where a.household_id = v_hid and e.status = 'active' and a.allocation_kind = 'general' and e.expense_date between p_desde and p_hasta
          and exists (select 1 from public.funds s where s.household_id = v_hid and s.is_active and not s.is_general
            and public.fund_admits(s.id, e.ambito_id, e.categoria_id, e.subcategoria_id, e.payment_method_id))), 0)
  );
end;
$$;
revoke all on function public.dashboard_panel(date, date, date, date, uuid, uuid[], uuid[], uuid, text, date) from public, anon;
grant execute on function public.dashboard_panel(date, date, date, date, uuid, uuid[], uuid[], uuid, text, date) to authenticated;
