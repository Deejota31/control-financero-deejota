-- Fondos multimoneda (etapa 3): los destinos posibles al eliminar un fondo informan su moneda, para mostrar sus importes sin mezclar monedas.

CREATE OR REPLACE FUNCTION public.delete_fund(p_fund uuid, p_destino uuid DEFAULT NULL::uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'is_general', d.is_general, 'currency', d.currency) order by d.is_general desc, d.priority, d.name), '[]'::jsonb)
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

notify pgrst, 'reload schema';
