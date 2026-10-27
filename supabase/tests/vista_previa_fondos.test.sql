begin;
select * from no_plan();

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
insert into public.funds (household_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select household_id, 'Fondo General', 'Cobertura general', true, 0, 1000, 'wallet', 'pri' from public.profiles where user_id in (select id from auth.users where email like '%@test.local');

create schema th;
grant usage on schema th to authenticated;
create table th.k (name text primary key, id uuid not null);
grant select on th.k to authenticated;
insert into th.k select 'amb:' || a.name, a.id from public.ambitos a where a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'cat:' || a.name || ':' || c.name, c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where c.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'sub:' || a.name || ':' || c.name || ':' || s.name, s.id from public.subcategorias s join public.categorias c on c.id = s.categoria_id join public.ambitos a on a.id = c.ambito_id where s.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'med:' || m.name, m.id from public.medios_pago m where m.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
create function th.kid(n text) returns uuid language sql stable as $$ select id from th.k where name = n $$;
create function th.exp(p_date date, p_amount numeric, p_desc text, p_amb text, p_cat text, p_sub text, p_med text)
returns jsonb language sql stable as $$
  select jsonb_build_object('expense_date', p_date, 'amount', p_amount, 'description', p_desc,
    'ambito_id', th.kid('amb:' || p_amb), 'categoria_id', th.kid('cat:' || p_amb || ':' || p_cat),
    'subcategoria_id', case when p_sub is null then null else th.kid('sub:' || p_amb || ':' || p_cat || ':' || p_sub) end,
    'payment_method_id', th.kid('med:' || p_med));
$$;
create function th.fund(p_name text, p_amb text, p_amount numeric, p_prio int)
returns jsonb language sql stable as $$
  select jsonb_build_object('name', p_name, 'is_general', false, 'default_amount', p_amount, 'priority', p_prio,
    'scope_rules', jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:' || p_amb), 'effect', 'include')));
$$;
grant execute on all functions in schema th to authenticated;

-- ===================== Usuario A =====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok($$select public.save_fund(th.fund('Hogar 1', 'Hogar', 100, 10))$$, 'crea Hogar 1');
select lives_ok($$select public.create_expense(th.exp(date_trunc('month', current_date)::date + 0, 120, 'E1', 'Hogar', 'Servicios', 'Luz', 'Transferencia'), gen_random_uuid())$$, 'gasto de 120 sobre un fondo de 100');

-- El período abierto actual: asignado 100, consumo 100 (el excedente de 20 va al General)
select is(
  (select (e ->> 'consumed')::numeric from jsonb_array_elements(public.preview_fund_change('set_fund_period_budget',
     jsonb_build_object('fund', (select id from public.funds where name = 'Hogar 1'), 'period', (select id from public.budget_periods order by start_date limit 1), 'amount', 500)) -> 'before') e
   where e ->> 'fund_name' = 'Hogar 1' limit 1), 100::numeric, 'antes: consume 100');
select is(
  (select (e ->> 'consumed')::numeric from jsonb_array_elements(public.preview_fund_change('set_fund_period_budget',
     jsonb_build_object('fund', (select id from public.funds where name = 'Hogar 1'), 'period', (select id from public.budget_periods order by start_date limit 1), 'amount', 500)) -> 'after') e
   where e ->> 'fund_name' = 'Hogar 1' limit 1), 120::numeric, 'después: con presupuesto 500 cubre los 120');
select is(
  (select (e ->> 'assigned')::numeric from jsonb_array_elements(public.preview_fund_change('set_fund_period_budget',
     jsonb_build_object('fund', (select id from public.funds where name = 'Hogar 1'), 'period', (select id from public.budget_periods order by start_date limit 1), 'amount', 500)) -> 'after') e
   where e ->> 'fund_name' = 'Hogar 1' limit 1), 500::numeric, 'después: asignado 500');

-- La vista previa no modifica nada
select is((select assigned_amount from public.fund_period_budgets where fund_id = (select id from public.funds where name = 'Hogar 1') limit 1), 100::numeric, 'el presupuesto real sigue en 100');
select is((select sum(amount) from public.expense_fund_allocations where fund_id = (select id from public.funds where name = 'Hogar 1')), 100::numeric, 'el consumo real sigue en 100');

-- Operación no admitida y bloqueos
select throws_ok($$select public.preview_fund_change('drop_everything', '{}'::jsonb)$$, '22023', null, 'rechaza operaciones fuera de la lista');
select is((public.preview_fund_change('save_fund', th.fund('Sin reglas', 'Hogar', 10, 99) - 'scope_rules' || jsonb_build_object('scope_rules', '[]'::jsonb)) ->> 'blocked') is not null, true, 'un fondo específico sin inclusión se informa como bloqueado, no como error');

-- ===================== Usuario B: no ve ni toca el hogar de A =====================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from jsonb_array_elements(public.preview_fund_change('reorder_funds', '{"ids":[]}'::jsonb) -> 'before') e where e ->> 'fund_name' = 'Hogar 1'), 0, 'B no ve los fondos de A');
select is(
  (public.preview_fund_change('set_fund_period_budget', jsonb_build_object('fund', (select id from public.funds where household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') and name = 'Hogar 1'), 'period', (select id from public.budget_periods order by start_date limit 1), 'amount', 1)) ->> 'blocked') is not null,
  true, 'B no puede simular cambios sobre fondos de A (se informa como bloqueado)');

reset role;
select * from finish();
rollback;
