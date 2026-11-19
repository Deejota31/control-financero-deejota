-- Fondos multimoneda (etapa 2): el consumo de un FONDO se mide en su propia moneda (fund_amount), nunca sumando importes PEN contables
-- a un presupuesto en dólares. Para fondos PEN fund_amount = amount: los resultados históricos no cambian.

alter table public.period_fund_snapshots add column if not exists currency text not null default 'PEN' check (currency in ('PEN','USD'));

create or replace function public.close_period(p_period uuid) returns void
language plpgsql security definer set search_path = '' as $$
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
  insert into public.period_fund_snapshots (household_id, period_id, fund_id, fund_name, is_general, assigned_amount, consumed_amount, currency)
  select v_hid, p_period, f.id, f.name, f.is_general, coalesce(b.assigned_amount, 0),
    coalesce((select sum(a.fund_amount) from public.expense_fund_allocations a where a.period_id = p_period and a.fund_id = f.id), 0), f.currency
  from public.funds f
  left join public.fund_period_budgets b on b.fund_id = f.id and b.period_id = p_period
  where f.household_id = v_hid and f.period_id = p_period;
  update public.budget_periods set status = 'closed', closed_at = now() where id = p_period;
end;
$$;

create or replace function public.fund_period_detail(hid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'period_id', bp.id, 'start', bp.start_date, 'fund_id', f.id, 'fund_name', f.name, 'currency', f.currency,
      'assigned', coalesce(b.assigned_amount, 0), 'consumed', coalesce(c.total, 0)
    ) order by bp.start_date, f.priority, f.created_at), '[]'::jsonb)
  from public.budget_periods bp
  join public.funds f on f.period_id = bp.id and f.household_id = bp.household_id
  left join public.fund_period_budgets b on b.fund_id = f.id and b.period_id = bp.id
  left join (
    select a.fund_id, a.period_id, sum(a.fund_amount) as total
    from public.expense_fund_allocations a
    where a.household_id = hid
    group by a.fund_id, a.period_id
  ) c on c.fund_id = f.id and c.period_id = bp.id
  where bp.household_id = hid and bp.status = 'open';
$$;

create or replace function public.open_consumption(hid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(q.fund_id::text, q.total), '{}'::jsonb)
  from (
    select a.fund_id, sum(a.fund_amount) as total
    from public.expense_fund_allocations a
    join public.budget_periods bp on bp.id = a.period_id
    where a.household_id = hid and bp.status = 'open'
    group by a.fund_id
  ) q;
$$;

-- Resumen de planificación: presupuestos por moneda (nunca una suma mezclada) y gastos que quedaron sin fondo por moneda.
-- budget_total conserva su significado anterior para quien lo lea: es la suma de los fondos PEN activos.
create or replace function public.planning_summary(p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
        where b.period_id = v_period and f.is_active and f.currency = 'PEN'), 0),
    'budget_usd', coalesce((select sum(b.assigned_amount) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id
        where b.period_id = v_period and f.is_active and f.currency = 'USD'), 0),
    'funds_usd_count', (select count(*) from public.funds f where f.period_id = v_period and f.is_active and f.currency = 'USD'),
    'expenses_total', coalesce((select sum(e.amount) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between v_start and v_end), 0),
    'expenses_count', (select count(*) from public.expenses e where e.household_id = v_hid and e.status = 'active' and e.expense_date between v_start and v_end),
    'uncovered_total', coalesce((select sum(u.uncovered_amount) from public.expense_uncovered u where u.period_id = v_period), 0),
    'uncovered_count', (select count(*) from public.expense_uncovered u where u.period_id = v_period),
    'overspent_funds', (select count(*) from public.funds f
        where f.period_id = v_period and f.is_active
          and coalesce((select sum(a.fund_amount) from public.expense_fund_allocations a where a.fund_id = f.id), 0)
              > coalesce((select b.assigned_amount from public.fund_period_budgets b where b.fund_id = f.id and b.period_id = v_period), 0)),
    'plan', (select to_jsonb(pp) from public.period_plans pp where pp.period_id = v_period)
  );
end;
$$;
notify pgrst, 'reload schema';
