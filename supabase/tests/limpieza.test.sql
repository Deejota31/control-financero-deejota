begin;
select * from no_plan();

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

-- Hogar de partida para estas pruebas: el alta ya no crea catálogo ni fondos (solo lo técnico), así que se crean aquí.
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
insert into public.funds (household_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select household_id, 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri' from public.profiles where user_id in (select id from auth.users where email like '%@test.local');

create temp table ids as
select
  (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as hid_a,
  (select household_id from public.profiles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') as hid_b;
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is(public.registrar_limpieza(array[(select hid_a::text from ids) || '/g1/a.pdf'], 'compensacion'), 1, 'registra una tarea de compensación');
select is(public.registrar_limpieza(array[(select hid_a::text from ids) || '/g2/b.pdf'], 'intencion', 10), 1, 'registra una intención con demora');
select throws_ok($$select public.registrar_limpieza(array[(select hid_b::text from ids) || '/x/c.pdf'], 'compensacion')$$, 'GD009', null, 'no acepta rutas de otro hogar');
select throws_ok($$select public.registrar_limpieza(array['sin-prefijo.pdf'], 'compensacion')$$, 'GD009', null, 'no acepta rutas sin el prefijo del hogar');
select throws_ok($$select public.registrar_limpieza(array[(select hid_a::text from ids) || '/g1/a.pdf'], 'otra')$$, '23514', null, 'valida la razón');

select results_eq($$select path from public.listar_limpieza()$$, $$select (select hid_a::text from ids) || '/g1/a.pdf'$$, 'solo lista lo ya vencido (la intención espera)');

-- Una compensación posterior adelanta la intención
select lives_ok($$select public.registrar_limpieza(array[(select hid_a::text from ids) || '/g2/b.pdf'], 'compensacion')$$, 'una compensación adelanta la intención');
select is((select count(*)::int from public.listar_limpieza()), 2, 'ahora ambas están disponibles');

-- Nunca se borra un comprobante en uso: se descarta la tarea
reset role;
insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id, receipt_path)
select i.hid_a, current_date, 10, 'con comprobante',
       (select id from public.ambitos where household_id = i.hid_a and name = 'Hogar'),
       (select c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where a.household_id = i.hid_a and a.name = 'Hogar' and c.name = 'Servicios'),
       (select id from public.medios_pago where household_id = i.hid_a and name = 'Yape'),
       i.hid_a::text || '/g1/a.pdf'
from ids i;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select results_eq($$select path from public.listar_limpieza()$$, $$select (select hid_a::text from ids) || '/g2/b.pdf'$$, 'el archivo asociado a un gasto sale de la lista y su tarea se descarta');
select is((select count(*)::int from public.storage_cleanup_tasks), 1, 'solo queda la tarea del archivo huérfano');

select lives_ok($$select public.fallo_limpieza(array[(select id from public.storage_cleanup_tasks limit 1)], 'sin red')$$, 'registra un fallo de borrado');
select is((select attempts from public.storage_cleanup_tasks limit 1), 1, 'cuenta el intento');
select is((select count(*)::int from public.listar_limpieza()), 0, 'tras un fallo se reintenta más tarde');

-- B no ve ni completa tareas de A
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.storage_cleanup_tasks), 0, 'B no ve tareas de A');
select is(public.completar_limpieza(array[(select id from (select 'a'::text) s, lateral (select gen_random_uuid() as id) x)]), 0, 'B no puede completar tareas ajenas');
select throws_ok($$insert into public.storage_cleanup_tasks (household_id, path, reason) values ((select hid_b from ids), 'x', 'compensacion')$$, '42501', null, 'el cliente no inserta tareas directamente');

-- A completa la tarea
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is(public.completar_limpieza(array[(select id from public.storage_cleanup_tasks limit 1)]), 1, 'A completa su tarea');

select * from finish();
rollback;
