begin;
select * from no_plan();

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

-- Hogar de partida para estas pruebas: el alta ya no crea catálogo ni fondos (solo lo técnico), así que se crean aquí.
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
-- Cada fondo pertenece a un mes: el Fondo General de partida es el del mes actual (con su presupuesto en 0).
insert into public.funds (household_id, period_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select p.household_id, public.ensure_period(p.household_id, current_date), 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri' from public.profiles p where p.user_id in (select id from auth.users where email like '%@test.local');
insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
select fu.household_id, fu.id, fu.period_id, 0 from public.funds fu where fu.is_general and not exists (select 1 from public.fund_period_budgets b where b.fund_id = fu.id);

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
  select jsonb_build_object('name', p_name, 'period_id', (select id from public.budget_periods where start_date = date_trunc('month', current_date)::date), 'is_general', false, 'default_amount', p_amount, 'priority', p_prio,
    'scope_rules', jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:' || p_amb), 'effect', 'include')));
$$;
grant execute on all functions in schema th to authenticated;

-- ===================== Usuario A =====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok($$select public.save_fund(th.fund('Hogar 1', 'Hogar', 100, 10))$$, 'crea Hogar 1');
select lives_ok($$select public.save_fund(th.fund('Personal 1', 'Personal', 50, 20))$$, 'crea Personal 1');
select lives_ok($$select public.save_fund(th.fund('Vacío', 'Trabajo', 30, 30))$$, 'crea un fondo que nunca se usará');
select lives_ok($$select public.create_expense(th.exp(date_trunc('month', current_date)::date + 0, 120, 'E1', 'Hogar', 'Servicios', 'Luz', 'Transferencia'), gen_random_uuid())$$, 'crea un gasto cubierto por Hogar 1');

-- Fondo nunca usado: se elimina sin destino
select is((public.delete_fund((select id from public.funds where name = 'Vacío'), null, true) ->> 'open_allocations')::int, 0, 'el fondo vacío no tiene imputaciones');
select is((public.delete_fund((select id from public.funds where name = 'Vacío'), null, true) ->> 'blocked')::boolean, false, 'se puede eliminar');
select lives_ok($$select public.delete_fund((select id from public.funds where name = 'Vacío'))$$, 'elimina el fondo vacío');
select is((select count(*)::int from public.funds where name = 'Vacío'), 0, 'el fondo vacío ya no existe');
select is((select count(*)::int from public.fund_scope_rules r where not exists (select 1 from public.funds f where f.id = r.fund_id)), 0, 'sus reglas se eliminan con él');

-- Fondo con imputaciones: exige destino compatible
select is((public.delete_fund((select id from public.funds where name = 'Hogar 1'), null, true) ->> 'open_allocations')::int, 1, 'Hogar 1 tiene 1 imputación en un período abierto');
select ok((public.delete_fund((select id from public.funds where name = 'Hogar 1'), null, true) -> 'destinations') @> jsonb_build_array(jsonb_build_object('id', (select id from public.funds where is_general), 'name', 'Fondo General', 'is_general', true)), 'el Fondo General es un destino compatible');
select ok(not ((public.delete_fund((select id from public.funds where name = 'Hogar 1'), null, true) -> 'destinations') @> jsonb_build_array(jsonb_build_object('id', (select id from public.funds where name = 'Personal 1'), 'name', 'Personal 1', 'is_general', false))), 'un fondo que no admite esos gastos no es destino');
select throws_ok($$select public.delete_fund((select id from public.funds where name = 'Hogar 1'))$$, 'GD012', null, 'sin destino no se elimina');
select throws_ok($$select public.delete_fund((select id from public.funds where name = 'Hogar 1'), (select id from public.funds where name = 'Personal 1'))$$, 'GD013', null, 'un destino incompatible se rechaza');
select is((select count(*)::int from public.funds where name = 'Hogar 1'), 1, 'tras los rechazos el fondo sigue existiendo');

-- La simulación no deja rastro
select lives_ok($$select public.delete_fund((select id from public.funds where name = 'Hogar 1'), (select id from public.funds where is_general), true)$$, 'simula la eliminación con destino');
select is((select count(*)::int from public.funds where name = 'Hogar 1'), 1, 'la simulación no elimina nada');
select is((select count(*)::int from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.name = 'Hogar 1'), 1, 'la simulación conserva las imputaciones');

-- Eliminación real: el gasto y su importe se conservan y se reimputa
select lives_ok($$select public.delete_fund((select id from public.funds where name = 'Hogar 1'), (select id from public.funds where is_general))$$, 'elimina con destino compatible');
select is((select count(*)::int from public.funds where name = 'Hogar 1'), 0, 'el fondo ya no existe');
select is((select count(*)::int from public.expenses where description = 'E1' and amount = 120 and status = 'active'), 1, 'el gasto sigue activo con el mismo importe');
select is((select sum(a.amount) from public.expense_fund_allocations a where a.expense_id = (select id from public.expenses where description = 'E1')), 120.00, 'el gasto queda imputado por completo');
select is((select f.name::text from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = (select id from public.expenses where description = 'E1')), 'Fondo General', 'ahora lo cubre el Fondo General');

-- El Fondo General no se elimina
select throws_ok($$select public.delete_fund((select id from public.funds where is_general))$$, 'GD010', null, 'el Fondo General no se elimina');

-- Historial en períodos cerrados: no se elimina
select lives_ok($$select public.save_fund(th.fund('Antiguo', 'Hogar', 200, 10) || jsonb_build_object('period_id', (public.ensure_period_rpc((date_trunc('month', current_date) - interval '1 month')::date)).id))$$, 'crea un fondo para el mes anterior');
select lives_ok($$select public.create_expense(th.exp((date_trunc('month', current_date) - interval '1 month')::date + 3, 80, 'Viejo', 'Hogar', 'Servicios', 'Luz', 'Transferencia'), gen_random_uuid())$$, 'crea un gasto del mes anterior');
select lives_ok($$select public.close_period((select id from public.budget_periods where start_date = (date_trunc('month', current_date) - interval '1 month')::date))$$, 'cierra el mes anterior');
select throws_ok($$select public.delete_fund((select id from public.funds where name = 'Antiguo'), (select id from public.funds where is_general))$$, 'GD011', null, 'con historial cerrado no se elimina');
select is((select count(*)::int from public.period_fund_snapshots s join public.funds f on f.id = s.fund_id where f.name = 'Antiguo'), 1, 'el cierre del fondo se conserva');
select is((public.delete_fund((select id from public.funds where name = 'Antiguo'), null, true) ->> 'blocked')::boolean, true, 'la consulta indica que está bloqueado');

select set_config('th.fid', (select id::text from public.funds where name = 'Antiguo'), true);
-- ===================== Usuario B =====================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($$select public.delete_fund(current_setting('th.fid')::uuid)$$, 'GD004', null, 'B no puede eliminar fondos de A');

-- Anónimo
set local role anon;
select throws_ok($$select public.delete_fund(gen_random_uuid())$$, '42501', null, 'anon no ejecuta delete_fund');

select * from finish();
rollback;
