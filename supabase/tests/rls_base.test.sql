begin;
select plan(7);

-- Dos usuarios de prueba (el trigger crea perfil y hogar para cada uno)
insert into auth.users (instance_id, id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

-- Hogar de partida para estas pruebas: el alta ya no crea catálogo ni fondos (solo lo técnico), así que se crean aquí.
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
-- Cada fondo pertenece a un mes: el Fondo General de partida es el del mes actual (con su presupuesto en 0).
insert into public.funds (household_id, period_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select p.household_id, public.ensure_period(p.household_id, current_date), 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri' from public.profiles p where p.user_id in (select id from auth.users where email like '%@test.local');
insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
select fu.household_id, fu.id, fu.period_id, 0 from public.funds fu where fu.is_general and not exists (select 1 from public.fund_period_budgets b where b.fund_id = fu.id);

select is((select count(*)::int from public.households where created_by in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')), 2, 'cada usuario recibe su hogar');

-- Usuario A autenticado
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'A solo ve su perfil');
select is((select count(*)::int from public.households), 1, 'A solo ve su hogar');
select is((select count(*)::int from public.profiles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'A no ve el perfil de B');

update public.profiles set display_name = 'Hackeado' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is((select count(*)::int from public.profiles where display_name = 'Hackeado'), 0, 'A no puede modificar el perfil de B');

-- Anónimo
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.profiles), 0, 'anon no ve perfiles');
select is((select count(*)::int from public.households), 0, 'anon no ve hogares');

select * from finish();
rollback;
