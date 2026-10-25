begin;
select plan(7);

-- Dos usuarios de prueba (el trigger crea perfil y hogar para cada uno)
insert into auth.users (instance_id, id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

select is((select count(*)::int from public.households where created_by in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')), 2, 'cada usuario recibe su hogar');

-- Usuario A autenticado
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'A solo ve su perfil');
select is((select count(*)::int from public.households), 1, 'A solo ve su hogar');
select is((select count(*)::int from public.profiles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'A no ve el perfil de B');

update public.profiles set nombre = 'Hackeado' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is((select count(*)::int from public.profiles where nombre = 'Hackeado'), 0, 'A no puede modificar el perfil de B');

-- Anónimo
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.profiles), 0, 'anon no ve perfiles');
select is((select count(*)::int from public.households), 0, 'anon no ve hogares');

select * from finish();
rollback;
