begin;
select * from no_plan();

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

-- Hogar de partida para estas pruebas: el alta ya no crea catálogo ni fondos (solo lo técnico), así que se crean aquí.
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
insert into public.funds (household_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select household_id, 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri' from public.profiles where user_id in (select id from auth.users where email like '%@test.local');

create schema th;
grant usage on schema th to authenticated;
create table th.k (n text primary key, id uuid);
grant select on th.k to authenticated;
insert into th.k select 'amb:' || a.name, a.id from public.ambitos a where a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'cat:' || a.name || ':' || c.name, c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where c.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'med:' || m.name, m.id from public.medios_pago m where m.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
create function th.i(x text) returns uuid language sql stable as $$ select id from th.k where n = x $$;
grant execute on function th.i(text) to authenticated;

-- Datos conocidos (mes actual): Hogar/Servicios Yape fijo 100 (d1), Hogar/Servicios Plin variable 50 (d1),
-- Personal/Ocio Yape variable 30 (d2), Personal/Ocio Yape variable 20 (d3), anulado Personal 999
insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id, expense_type, status, annulled_at)
select (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), date_trunc('month', current_date)::date + d, m, t, th.i('amb:' || a), th.i('cat:' || a || ':' || c), th.i('med:' || md), tp, st, case when st = 'annulled' then now() end
from (values (0, 100, 'g1', 'Hogar', 'Servicios', 'Yape', 'fixed', 'active'),
             (0, 50, 'g2', 'Hogar', 'Servicios', 'Plin', 'variable', 'active'),
             (1, 30, 'g3', 'Personal', 'Ocio', 'Yape', 'variable', 'active'),
             (2, 20, 'g4', 'Personal', 'Ocio', 'Yape', 'variable', 'active'),
             (2, 999, 'g5', 'Personal', 'Ocio', 'Yape', 'variable', 'annulled')) v(d, m, t, a, c, md, tp, st);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

create temp table p on commit drop as select
  date_trunc('month', current_date)::date as d1, (date_trunc('month', current_date) + interval '1 month - 1 day')::date as d2,
  (date_trunc('month', current_date) - interval '1 month')::date as p1, (date_trunc('month', current_date) - interval '1 day')::date as p2;

-- Sin filtros
create temp table r0 on commit drop as select public.dashboard_panel((select d1 from p), (select d2 from p), (select p1 from p), (select p2 from p)) as j;
select is((select (j ->> 'total')::numeric from r0), 200::numeric, 'sin filtros: total 200 (excluye anulados)');
select is((select (j ->> 'cantidad')::int from r0), 4, 'sin filtros: 4 movimientos');
select is((select (j ->> 'dias_con_gasto')::int from r0), 3, 'sin filtros: 3 días con gasto');
select is((select (j -> 'mayor' ->> 'amount')::numeric from r0), 100::numeric, 'el mayor gasto es 100');
select is((select jsonb_array_length(j -> 'por_ambito') from r0), 2, 'dos ámbitos con gasto');

-- Filtro ámbito = Hogar: KPIs y serie se filtran; la distribución por ámbito NO (muestra todos para poder cambiar la selección)
create temp table r1 on commit drop as select public.dashboard_panel((select d1 from p), (select d2 from p), (select p1 from p), (select p2 from p), th.i('amb:Hogar')) as j;
select is((select (j ->> 'total')::numeric from r1), 150::numeric, 'ámbito Hogar: total 150');
select is((select sum((e ->> 'monto')::numeric) from r1, jsonb_array_elements(j -> 'serie') e), 150::numeric, 'ámbito Hogar: la serie suma 150');
select is((select sum((e ->> 'total')::numeric) from r1, jsonb_array_elements(j -> 'por_ambito') e), 200::numeric, 'ámbito Hogar: la dona conserva todos los ámbitos (200)');
select is((select sum((e ->> 'total')::numeric) from r1, jsonb_array_elements(j -> 'por_categoria') e), 150::numeric, 'ámbito Hogar: el Top de categorías se limita al ámbito');
select is((select (j ->> 'gasto_rango')::numeric from r1), 200::numeric, 'ámbito Hogar: el gasto del período no depende del filtro');

-- Filtro categoría: el Top de categorías mantiene todas (para poder alternar la selección)
create temp table r2 on commit drop as select public.dashboard_panel((select d1 from p), (select d2 from p), (select p1 from p), (select p2 from p), null, array[th.i('cat:Personal:Ocio')]) as j;
select is((select (j ->> 'total')::numeric from r2), 50::numeric, 'categoría Ocio: total 50');
select is((select sum((e ->> 'total')::numeric) from r2, jsonb_array_elements(j -> 'por_categoria') e), 200::numeric, 'categoría Ocio: el Top conserva todas las categorías');

-- Medio + tipo combinados (Y lógico)
create temp table r3 on commit drop as select public.dashboard_panel((select d1 from p), (select d2 from p), (select p1 from p), (select p2 from p), null, null, null, th.i('med:Yape'), 'variable') as j;
select is((select (j ->> 'total')::numeric from r3), 50::numeric, 'Yape + variable: 30 + 20');
select is((select (j ->> 'cantidad')::int from r3), 2, 'Yape + variable: 2 movimientos');

-- Día: filtra KPIs y recientes, pero la serie conserva todos los días
create temp table r4 on commit drop as select public.dashboard_panel((select d1 from p), (select d2 from p), (select p1 from p), (select p2 from p), null, null, null, null, null, (select d1 from p)) as j;
select is((select (j ->> 'total')::numeric from r4), 150::numeric, 'día 1: total 150');
select is((select count(*)::int from r4, jsonb_array_elements(j -> 'serie') e), 3, 'día 1: la serie mantiene los 3 días con gasto');
select is((select jsonb_array_length(j -> 'recientes') from r4), 2, 'día 1: dos movimientos recientes');

-- Combinación sin resultados
create temp table r5 on commit drop as select public.dashboard_panel((select d1 from p), (select d2 from p), (select p1 from p), (select p2 from p), th.i('amb:Hogar'), array[th.i('cat:Personal:Ocio')]) as j;
select is((select (j ->> 'total')::numeric from r5), 0::numeric, 'ámbito Hogar + categoría de Personal: sin resultados');
select is((select j -> 'mayor' from r5), 'null'::jsonb, 'sin resultados: no hay mayor gasto');

-- Validaciones
select throws_ok($$select public.dashboard_panel(current_date, current_date - 1, current_date, current_date)$$, '22023', null, 'rechaza rangos invertidos');
select throws_ok($$select public.dashboard_panel(current_date, current_date, current_date, current_date, null, null, null, null, 'raro')$$, '22023', null, 'rechaza un tipo inválido');

-- Aislamiento: B no ve nada de A aunque pase los ids de A
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((public.dashboard_panel((select d1 from p), (select d2 from p), (select p1 from p), (select p2 from p), th.i('amb:Hogar')) ->> 'total')::numeric, 0::numeric, 'B no ve gastos de A ni filtrando por un ámbito de A');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.dashboard_panel(current_date, current_date, current_date, current_date)$$, '42501', null, 'anon no puede pedir el panel');

select * from finish();
rollback;
