-- Datos de los gráficos de análisis del Dashboard (ranking con tendencia y perfil de gasto).
--
-- Devuelve filas agregadas por día y clasificación; el cliente aplica los mismos filtros cruzados que el resto del panel (así cada gráfico puede
-- excluir su propia dimensión y las selecciones se combinan sin perderse). Solo lectura, sin tablas nuevas.
--   actual    : gasto activo del rango [p_desde, p_hasta] por día y clasificación.
--   historico : gasto activo de los 6 meses naturales que terminan en el mes de p_hasta, por mes y clasificación.
-- Reversión: drop function public.dashboard_analisis(date, date);

create function public.dashboard_analisis(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_ini date := (date_trunc('month', p_hasta) - interval '5 months')::date;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial es posterior a la final.' using errcode = '22023'; end if;

  return jsonb_build_object(
    'actual', coalesce((
      select jsonb_agg(to_jsonb(r)) from (
        select e.expense_date as fecha, e.ambito_id, e.categoria_id, e.subcategoria_id, e.payment_method_id as medio_id, e.expense_type as tipo,
               sum(e.amount) as monto, count(*) as cantidad
        from public.expenses e
        where e.household_id = v_hid and e.status = 'active' and e.expense_date between p_desde and p_hasta
        group by 1, 2, 3, 4, 5, 6
      ) r), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(to_jsonb(r)) from (
        select date_trunc('month', e.expense_date)::date as mes, e.ambito_id, e.categoria_id, e.subcategoria_id, e.payment_method_id as medio_id, e.expense_type as tipo,
               sum(e.amount) as monto, count(*) as cantidad
        from public.expenses e
        where e.household_id = v_hid and e.status = 'active' and e.expense_date between v_ini and p_hasta
        group by 1, 2, 3, 4, 5, 6
      ) r), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.dashboard_analisis(date, date) from public, anon;
grant execute on function public.dashboard_analisis(date, date) to authenticated;
