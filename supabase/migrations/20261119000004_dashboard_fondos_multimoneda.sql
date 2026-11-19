-- Fondos multimoneda (etapa 3): Dashboard.
--   * 'presupuesto' sigue siendo el de los fondos PEN (en soles); los fondos USD se informan aparte (nominal en dólares) y se valoran en soles con
--     la ÚLTIMA cotización del período (la del último día del mes, o la última disponible hasta hoy si el mes está en curso; nunca una posterior a su cierre).
--     Es una valoración referencial: no modifica saldos nominales ni imputaciones. Sin cotización no se inventa ninguna tasa.
--   * El consumo y el presupuesto de cada fondo van en la moneda del fondo; los gastos conservan su importe contable en PEN.

-- Última cotización verificada del período: la del último día con dato hasta min(fin del período, hoy) (fin de semana/feriado = último día publicado).
create or replace function public.period_valuation_rate(p_start date, p_end date) returns table(rate numeric, reference_date date, source text, date_requested date)
language sql stable set search_path = '' as $$
  select q.rate, q.reference_date, q.source, q.date_requested from public.exchange_rate_quotes q
  where q.date_requested <= least(p_end, current_date) and q.date_requested >= p_start - 14
  order by q.date_requested desc limit 1
$$;
revoke all on function public.period_valuation_rate(date, date) from public, anon, authenticated;

create or replace function public.dashboard_usd(p_hid uuid, p_periods uuid[], p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r record; q record;
  v_has boolean := false; v_sin boolean := false;
  v_budget_usd numeric := 0; v_cons_usd numeric := 0; v_budget_val numeric := 0; v_cons_val numeric := 0;
  v_a numeric; v_c numeric; v_pen_cons numeric; v_tasas jsonb := '[]'::jsonb;
begin
  for r in select bp.id, bp.start_date, bp.end_date from public.budget_periods bp where bp.id = any (p_periods) order by bp.start_date loop
    if not exists (select 1 from public.funds f where f.period_id = r.id and f.is_active and f.currency = 'USD') then continue; end if;
    v_has := true;
    select coalesce(sum(b.assigned_amount), 0) into v_a from public.fund_period_budgets b join public.funds f on f.id = b.fund_id
      where b.period_id = r.id and f.is_active and f.currency = 'USD';
    select coalesce(sum(a.fund_amount), 0) into v_c from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id join public.expenses e on e.id = a.expense_id
      where a.period_id = r.id and f.currency = 'USD' and f.is_active and e.status = 'active' and e.expense_date between p_desde and p_hasta;
    v_budget_usd := v_budget_usd + v_a; v_cons_usd := v_cons_usd + v_c;
    select * into q from public.period_valuation_rate(r.start_date, r.end_date);
    if q.rate is null then v_sin := true;
    else
      v_budget_val := v_budget_val + round(v_a * q.rate, 2); v_cons_val := v_cons_val + round(v_c * q.rate, 2);
      v_tasas := v_tasas || jsonb_build_object('periodo', r.start_date, 'tasa', q.rate, 'fecha_referencia', q.reference_date, 'fuente', q.source, 'consultada_para', q.date_requested);
    end if;
  end loop;
  if not v_has then return null; end if;
  select coalesce(sum(a.fund_amount), 0) into v_pen_cons from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id join public.expenses e on e.id = a.expense_id
    where a.household_id = p_hid and f.currency = 'PEN' and f.is_active and f.period_id = any (p_periods) and e.status = 'active' and e.expense_date between p_desde and p_hasta;
  return jsonb_build_object('presupuesto_usd', v_budget_usd, 'consumido_usd', v_cons_usd, 'saldo_usd', v_budget_usd - v_cons_usd,
    'sin_cotizacion', v_sin, 'consumido_pen_fondos', v_pen_cons,
    'presupuesto_valorizado', case when v_sin then null else v_budget_val end,
    'consumido_valorizado', case when v_sin then null else v_cons_val end,
    'saldo_valorizado', case when v_sin then null else v_budget_val - v_cons_val end,
    'tasas', v_tasas);
end $$;
revoke all on function public.dashboard_usd(uuid, uuid[], date, date) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dashboard_panel(p_desde date, p_hasta date, p_prev_desde date, p_prev_hasta date, p_ambito uuid DEFAULT NULL::uuid, p_categoria uuid[] DEFAULT NULL::uuid[], p_subcategoria uuid[] DEFAULT NULL::uuid[], p_medio uuid DEFAULT NULL::uuid, p_tipo text DEFAULT NULL::text, p_dia date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
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
      where b.period_id = any (v_periods) and f.is_active and f.currency = 'PEN') end,
    'gasto_rango', v_total_rango,
    'imputado_rango', v_imputado,
    'sin_fondo', greatest(v_total_rango - v_imputado, 0),
    'fondos_periodo', cardinality(v_periods),
    'fondos', coalesce((select jsonb_agg(jsonb_build_object(
        'fund_id', g.fund_id, 'nombre', g.nombre, 'es_general', g.es_general, 'prioridad', g.prioridad, 'moneda', g.moneda,
        'asignado', g.asignado, 'consumido', g.consumido, 'consumido_filtrado', g.consumido_filtrado
      ) order by g.es_general, g.prioridad, g.nombre)
      from (
        -- Cada fondo es una instancia de un mes. En un rango de varios meses se suman las instancias del mismo nombre para mostrarlas una vez.
        select (array_agg(i.id order by i.priority, i.id))[1] as fund_id, (array_agg(i.name order by i.start_date desc))[1] as nombre,
               i.is_general as es_general, i.currency as moneda, min(i.priority) as prioridad,
               sum(i.asignado) as asignado, sum(i.consumido) as consumido, sum(i.consumido_filtrado) as consumido_filtrado
        from (
          select f.id, f.name, f.is_general, f.priority, f.currency, bp.start_date,
            coalesce((select sum(b.assigned_amount) from public.fund_period_budgets b where b.fund_id = f.id), 0) as asignado,
            coalesce((select sum(a.fund_amount) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
                where a.fund_id = f.id and e.status = 'active' and e.expense_date between p_desde and p_hasta), 0) as consumido,
            coalesce((select sum(a.fund_amount) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
                where a.fund_id = f.id and e.status = 'active' and e.expense_date between p_desde and p_hasta
                  and (p_ambito is null or e.ambito_id = p_ambito) and (p_categoria is null or e.categoria_id = any(p_categoria)) and (p_subcategoria is null or e.subcategoria_id = any(p_subcategoria))
                  and (p_medio is null or e.payment_method_id = p_medio) and (p_tipo is null or e.expense_type = p_tipo) and (p_dia is null or e.expense_date = p_dia)), 0) as consumido_filtrado
          from public.funds f join public.budget_periods bp on bp.id = f.period_id
          where f.household_id = v_hid and f.is_active and f.period_id = any (v_periods)
        ) i
        group by lower(btrim(i.name)), i.is_general, i.currency
      ) g), '[]'::jsonb),
    'excedente', coalesce((select sum(a.amount) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id
        where a.household_id = v_hid and e.status = 'active' and a.allocation_kind = 'general' and e.expense_date between p_desde and p_hasta
          and exists (select 1 from public.funds s where s.household_id = v_hid and s.period_id = a.period_id and s.is_active and not s.is_general
            and public.fund_admits(s.id, e.ambito_id, e.categoria_id, e.subcategoria_id, e.payment_method_id))), 0),
    -- Fondos en dólares: valoración referencial y desglose por moneda (null si no hay ninguno en el rango).
    'usd', public.dashboard_usd(v_hid, v_periods, p_desde, p_hasta),
    -- Gastos (parciales) que ningún fondo elegible pudo cubrir por moneda: siguen contando completos en todos los totales.
    'no_cubierto', jsonb_build_object(
      'cantidad', (select count(*) from public.expense_uncovered u join public.expenses e on e.id = u.expense_id where u.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta),
      'monto', coalesce((select sum(u.uncovered_amount) from public.expense_uncovered u join public.expenses e on e.id = u.expense_id where u.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta), 0))
  );
end;
$$;
notify pgrst, 'reload schema';
