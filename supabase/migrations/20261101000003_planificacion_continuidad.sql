-- Continuidad de la planificación mensual.
--  1. Editar una etapa de un plan ya finalizado (p. ej. crear un fondo nuevo) lo reabre: pasa a «en progreso» en vez de fallar o quedar completado con una etapa pendiente.
--  2. El resumen distingue fondos configurados (todos) y activos.
-- Cambio reversible: solo funciones. Reversión: recrear las funciones de 20261101000001_fondos_por_periodo.sql.

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
  -- Tocar una etapa de un plan finalizado lo reabre; solo se vuelve a finalizar con una orden explícita.
  if v_status = 'completed' and not (p_patch ? 'status') and (p_patch ? 'funds_stage' or p_patch ? 'expenses_stage') then
    v_status := 'in_progress';
  end if;
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
    'funds_total', (select count(*) from public.funds f where f.period_id = v_period),
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
