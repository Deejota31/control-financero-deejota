-- Vista previa por período de los cambios en fondos.
--
-- Las simulaciones existentes (save_fund / reorder_funds / set_fund_period_budget / delete_fund con p_dry_run) devuelven el consumo
-- TOTAL por fondo sumando todos los períodos abiertos, lo que confunde cuando hay más de uno. Esta función ejecuta la operación real
-- dentro de un bloque que siempre se revierte (misma técnica GD999) y devuelve, por período abierto y fondo, el presupuesto asignado y
-- el consumo antes y después. No modifica nada.
--
-- Reversión: drop function public.preview_fund_change(text, jsonb); drop function public.fund_period_detail(uuid);

create function public.fund_period_detail(hid uuid)
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
  join public.funds f on f.household_id = bp.household_id
  left join public.fund_period_budgets b on b.fund_id = f.id and b.period_id = bp.id
  left join (
    select a.fund_id, a.period_id, sum(a.amount) as total
    from public.expense_fund_allocations a
    where a.household_id = hid
    group by a.fund_id, a.period_id
  ) c on c.fund_id = f.id and c.period_id = bp.id
  where bp.household_id = hid and bp.status = 'open';
$$;

create function public.preview_fund_change(p_kind text, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_before jsonb;
  v_after jsonb;
  v_blocked text;
begin
  if v_hid is null then raise exception 'Sin hogar' using errcode = '42501'; end if;
  v_before := public.fund_period_detail(v_hid);
  begin
    case p_kind
      when 'save_fund' then
        perform public.save_fund(p_args, false);
      when 'reorder_funds' then
        perform public.reorder_funds(array(select jsonb_array_elements_text(p_args -> 'ids'))::uuid[], false);
      when 'set_fund_period_budget' then
        perform public.set_fund_period_budget((p_args ->> 'fund')::uuid, (p_args ->> 'period')::uuid, (p_args ->> 'amount')::numeric, false);
      when 'delete_fund' then
        perform public.delete_fund((p_args ->> 'fund')::uuid, nullif(p_args ->> 'destino', '')::uuid, false);
      else
        raise exception 'Operación no admitida: %', p_kind using errcode = '22023';
    end case;
    v_after := public.fund_period_detail(v_hid);
    raise exception 'simulacion' using errcode = 'GD999';
  exception when others then
    if sqlstate = 'GD999' then
      null; -- éxito: se revierte todo lo hecho dentro del bloque
    elsif sqlstate like 'GD%' then
      v_blocked := sqlerrm; -- regla de negocio que impide el cambio (GD001…GD013): se informa, no es un fallo
    else
      raise;
    end if;
  end;
  return jsonb_build_object('blocked', v_blocked, 'before', v_before, 'after', case when v_blocked is null then v_after else null end);
end;
$$;

revoke all on function public.fund_period_detail(uuid) from public, anon, authenticated;
revoke all on function public.preview_fund_change(text, jsonb) from public, anon;
grant execute on function public.preview_fund_change(text, jsonb) to authenticated;
