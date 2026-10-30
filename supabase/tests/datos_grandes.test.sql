begin;
select * from no_plan();

-- Conjunto de datos que supera el antiguo límite (5,000) y el máximo de filas del API (1,000).
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local');

-- Hogar de partida para estas pruebas: el alta ya no crea catálogo ni fondos (solo lo técnico), así que se crean aquí.
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
-- Cada fondo pertenece a un mes: el Fondo General de partida es el del mes actual (con su presupuesto en 0).
insert into public.funds (household_id, period_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select p.household_id, public.ensure_period(p.household_id, current_date), 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri' from public.profiles p where p.user_id in (select id from auth.users where email like '%@test.local');
insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
select fu.household_id, fu.id, fu.period_id, 0 from public.funds fu where fu.is_general and not exists (select 1 from public.fund_period_budgets b where b.fund_id = fu.id);

create temp table ids as
select
  (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as hid,
  (select a.id from public.ambitos a where a.name = 'Hogar' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as amb1,
  (select a.id from public.ambitos a where a.name = 'Personal' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as amb2,
  (select c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where a.name = 'Hogar' and c.name = 'Servicios' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as cat1,
  (select c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where a.name = 'Personal' and c.name = 'Ocio' and a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as cat2,
  (select m.id from public.medios_pago m where m.name = 'Yape' and m.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) as med;

-- 6,000 gastos activos en el mes actual (alternando ámbito) + 40 anulados que no deben contar
insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id, status, annulled_at)
select i.hid,
       date_trunc('month', current_date)::date + (g % 28),
       ((g % 97) + 1) + 0.25,
       'masivo ' || g,
       case when g % 2 = 0 then i.amb1 else i.amb2 end,
       case when g % 2 = 0 then i.cat1 else i.cat2 end,
       i.med,
       case when g > 6000 then 'annulled' else 'active' end,
       case when g > 6000 then now() end
from ids i, generate_series(1, 6040) g;

select is((select count(*)::int from public.expenses where status = 'active' and household_id = (select hid from ids)), 6000, 'hay 6,000 gastos activos');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

create temp table r on commit drop as
select public.dashboard_panel(
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  (date_trunc('month', current_date) - interval '1 month')::date,
  (date_trunc('month', current_date) - interval '1 day')::date
) as j;

select is((select (j ->> 'cantidad')::int from r), 6000, 'el resumen cuenta los 6,000 gastos (sin anulados)');
select is((select (j ->> 'total')::numeric from r), (select sum(amount) from public.expenses where status = 'active'), 'el total del resumen es el total real');
select is((select sum((e ->> 'monto')::numeric) from r, jsonb_array_elements(j -> 'serie') e), (select sum(amount) from public.expenses where status = 'active'), 'la serie diaria suma el total real');
select is((select count(*)::int from r, jsonb_array_elements(j -> 'serie') x), 28, 'la serie tiene un punto por día con gasto');
select is((select sum((e ->> 'total')::numeric) from r, jsonb_array_elements(j -> 'por_ambito') e), (select sum(amount) from public.expenses where status = 'active'), 'la distribución por ámbito suma el total real');
select is((select sum((e ->> 'cantidad')::int)::int from r, jsonb_array_elements(j -> 'por_categoria') e), 6000, 'la distribución por categoría cuenta todos los gastos');
select is((select jsonb_array_length(j -> 'recientes') from r), 6, 'los recientes se limitan a 6 por diseño (lista, no métrica)');
select is((select (j ->> 'total_prev')::numeric from r), 0::numeric, 'sin gasto previo el total anterior es 0');
select is((select (j ->> 'presupuesto')::numeric from r), 0::numeric, 'el mes con un solo fondo sin importe asignado tiene presupuesto 0');
select is((public.dashboard_panel('2020-01-01', '2020-01-31', '2019-12-01', '2019-12-31') -> 'presupuesto') = 'null'::jsonb, true, 'un rango sin períodos no tiene presupuesto (null, no 0 inventado)');

-- Un rango invertido se rechaza
select throws_ok($$select public.dashboard_panel(current_date, current_date - 1, current_date, current_date)$$, '22023', null, 'rechaza rangos invertidos');

-- Anónimo
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.dashboard_panel(current_date, current_date, current_date, current_date)$$, '42501', null, 'anon no puede pedir el resumen');

select * from finish();
rollback;
