begin;
select * from no_plan();

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

-- Hogar de partida para estas pruebas: el alta ya no crea catálogo ni fondos (solo lo técnico), así que se crean aquí.
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
insert into public.funds (household_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select household_id, 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri' from public.profiles where user_id in (select id from auth.users where email like '%@test.local');

-- Catálogo de partida
select is((select count(*)::int from public.ambitos where household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 5, 'hogar nuevo: 5 ámbitos');
select is((select count(*)::int from public.medios_pago where household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 6, 'hogar nuevo: 6 medios de pago');
select results_eq(
  $$select name from public.ambitos where household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') order by sort_order$$,
  $$values ('Personal'), ('Hogar'), ('Bebé'), ('Trabajo'), ('Familia')$$,
  'ámbitos iniciales en orden');
select is((select count(*)::int from public.funds where is_general and household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 1, 'hogar nuevo: un Fondo General');

-- Restricciones de la jerarquía (como superusuario, sin RLS)
select throws_ok(
  $$insert into public.categorias (household_id, ambito_id, name)
    select household_id, id, ' hogar ' from public.ambitos where name = 'Personal' and household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    union all select household_id, id, 'alimentación' from public.ambitos where name = 'Personal' and household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '23505', null, 'no permite categorías duplicadas en el mismo ámbito (sin importar mayúsculas)');

select lives_ok(
  $$insert into public.categorias (household_id, ambito_id, name)
    select household_id, id, 'Alimentación' from public.ambitos where name = 'Bebé' and household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    on conflict do nothing$$,
  'el mismo nombre en otro ámbito sí es válido');

select throws_ok(
  $$insert into public.ambitos (household_id, name, icon_key) select household_id, 'Nuevo', 'icono-inexistente' from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  '23514', null, 'rechaza iconos fuera de la lista segura');
select throws_ok(
  $$insert into public.ambitos (household_id, name, color_token) select household_id, 'Nuevo', 'rojo' from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  '23514', null, 'rechaza tokens de color no admitidos');

-- Una categoría no puede apuntar a un ámbito de otro hogar
select throws_ok(
  $$insert into public.categorias (household_id, ambito_id, name)
    select (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), a.id, 'Intrusa'
    from public.ambitos a where a.household_id = (select household_id from public.profiles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') limit 1$$,
  '23503', null, 'no mezcla ámbito y categoría de hogares distintos');

-- Gastos con jerarquía inconsistente
create temp table ids as
select
  (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as hid,
  (select a.id from public.ambitos a where a.name = 'Hogar' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as amb_hogar,
  (select c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where a.name = 'Personal' and c.name = 'Transporte' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as cat_personal,
  (select c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where a.name = 'Hogar' and c.name = 'Servicios' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as cat_hogar,
  (select s.id from public.subcategorias s join public.categorias c on c.id = s.categoria_id join public.ambitos a on a.id = c.ambito_id where a.name = 'Personal' and s.name = 'Taxi' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as sub_personal,
  (select m.id from public.medios_pago m where m.name = 'Yape' and m.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as med;

select throws_ok(
  $$insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id)
    select hid, current_date, 10, 'x', amb_hogar, cat_personal, med from ids$$,
  '23503', null, 'un gasto no combina un ámbito con una categoría de otro ámbito');
select throws_ok(
  $$insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id, payment_method_id)
    select hid, current_date, 10, 'x', amb_hogar, cat_hogar, sub_personal, med from ids$$,
  '23503', null, 'un gasto no combina una subcategoría de otra categoría');
select throws_ok(
  $$insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id)
    select hid, current_date, 0, 'x', amb_hogar, cat_hogar, med from ids$$,
  '23514', null, 'rechaza importes iguales a cero');
select throws_ok(
  $$insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id)
    select hid, current_date, -5, 'x', amb_hogar, cat_hogar, med from ids$$,
  '23514', null, 'rechaza importes negativos');

-- La suma de imputaciones debe igualar el gasto (se verifica de inmediato en la prueba)
set constraints all immediate;
select throws_ok(
  $$insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id)
    select hid, current_date, 10, 'sin imputar', amb_hogar, cat_hogar, med from ids$$,
  '23514', null, 'un gasto activo sin imputaciones se rechaza');
set constraints all deferred;

-- Aislamiento: A solo ve su catálogo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((select count(*)::int from public.ambitos), 5, 'A ve solo sus 5 ámbitos');
select is((select count(*)::int from public.medios_pago), 6, 'A ve solo sus 6 medios');

update public.ambitos set name = 'Hackeado' where household_id <> (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select is((select count(*)::int from public.ambitos where name = 'Hackeado'), 0, 'A no modifica ámbitos de B');

select lives_ok($$update public.ambitos set name = 'Pareja' where name = 'Familia'$$, 'A edita su propio ámbito');
select lives_ok($$select public.reorder_catalog('ambitos', (select array_agg(id order by name desc) from public.ambitos))$$, 'reordena el catálogo de forma atómica');

-- Color libre (HEX) y herencia
select lives_ok($$update public.ambitos set color_hex = '#5B5BD6' where name = 'Hogar'$$, 'acepta un HEX válido en mayúsculas');
select throws_ok($$update public.ambitos set color_hex = '#5b5bd6' where name = 'Hogar'$$, '23514', null, 'rechaza HEX en minúsculas');
select throws_ok($$update public.ambitos set color_hex = 'rojo' where name = 'Hogar'$$, '23514', null, 'rechaza un valor que no es HEX');
select throws_ok($$update public.medios_pago set color_hex = '#12345' where name = 'Efectivo'$$, '23514', null, 'rechaza HEX incompleto en medios de pago');
select lives_ok($$update public.categorias set color_mode = 'inherit', color_hex = null where name = 'Alimentación'$$, 'una categoría puede heredar el color');
select throws_ok($$update public.categorias set color_mode = 'inherit', color_hex = '#112233' where name = 'Alimentación'$$, '23514', null, 'heredar y tener color propio a la vez se rechaza');
select throws_ok($$update public.categorias set color_mode = 'otro' where name = 'Alimentación'$$, '23514', null, 'modo de color inválido');
select lives_ok($$update public.categorias set color_mode = 'own', color_hex = '#16A34A' where name = 'Alimentación'$$, 'color propio en categoría');

-- Los gastos no se escriben directamente
select throws_ok(
  $$insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id)
    select hid, current_date, 10, 'directo', amb_hogar, cat_hogar, med from ids$$,
  '42501', null, 'el cliente no puede insertar gastos directamente');

-- Anónimo
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.ambitos), 0, 'anon no ve el catálogo');
select is((select count(*)::int from public.funds), 0, 'anon no ve fondos');

select * from finish();
rollback;
