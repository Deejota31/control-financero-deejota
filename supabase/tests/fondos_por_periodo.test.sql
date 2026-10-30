begin;
select * from no_plan();

-- Aislamiento mensual de fondos: cada fondo pertenece a un solo mes, copiar es explícito e idempotente y los gastos solo consumen fondos de su mes.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');

create schema th;
grant usage on schema th to authenticated;
create table th.k (name text primary key, id uuid not null);
grant select on th.k to authenticated;
insert into th.k select 'amb:' || a.name, a.id from public.ambitos a where a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'cat:' || a.name || ':' || c.name, c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where c.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'sub:' || a.name || ':' || c.name || ':' || s.name, s.id from public.subcategorias s join public.categorias c on c.id = s.categoria_id join public.ambitos a on a.id = c.ambito_id where s.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'med:' || m.name, m.id from public.medios_pago m where m.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
create table th.p (name text primary key, id uuid not null);
grant select, insert on th.p to authenticated;

create function th.kid(n text) returns uuid language sql stable as $$ select id from th.k where name = n $$;
create function th.pid(n text) returns uuid language sql stable as $$ select id from th.p where name = n $$;
create function th.mes(n int) returns date language sql stable as $$ select (date_trunc('month', current_date) + make_interval(months => n))::date $$;
create function th.exp(p_date date, p_amount numeric, p_desc text, p_amb text, p_cat text, p_sub text, p_med text)
returns jsonb language sql stable as $$
  select jsonb_build_object('expense_date', p_date, 'amount', p_amount, 'description', p_desc,
    'ambito_id', th.kid('amb:' || p_amb), 'categoria_id', th.kid('cat:' || p_amb || ':' || p_cat),
    'subcategoria_id', th.kid('sub:' || p_amb || ':' || p_cat || ':' || p_sub), 'payment_method_id', th.kid('med:' || p_med));
$$;
create function th.fund(p_name text, p_period text, p_amb text, p_amount numeric, p_prio int)
returns jsonb language sql stable as $$
  select jsonb_build_object('name', p_name, 'period_id', th.pid(p_period), 'is_general', false, 'period_amount', p_amount, 'priority', p_prio,
    'scope_rules', jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:' || p_amb), 'effect', 'include')));
$$;
create function th.general(p_period text, p_amount numeric)
returns jsonb language sql stable as $$
  select jsonb_build_object('name', 'General', 'period_id', th.pid(p_period), 'is_general', true, 'period_amount', p_amount, 'priority', 100);
$$;
create function th.fid(p_name text, p_period text) returns uuid language sql stable as $$
  select id from public.funds where name = p_name and period_id = th.pid(p_period) $$;
grant execute on all functions in schema th to authenticated;

-- ===================== Usuario A =====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

insert into th.p select 'm0', (public.ensure_period_rpc(th.mes(0))).id;
insert into th.p select 'm1', (public.ensure_period_rpc(th.mes(1))).id;
insert into th.p select 'm2', (public.ensure_period_rpc(th.mes(2))).id;
insert into th.p select 'm3', (public.ensure_period_rpc(th.mes(3))).id;

select is((select count(*)::int from public.funds), 0, 'un mes nuevo no recibe fondos automáticamente');

-- A. Mes actual con 5 fondos, el siguiente sin ninguno
select lives_ok($$select public.save_fund(th.general('m0', 3000))$$, 'crea General en el mes 0');
select lives_ok($$select public.save_fund(th.fund('Sodexo', 'm0', 'Hogar', 280, 10))$$, 'crea Sodexo en el mes 0');
select lives_ok($$select public.save_fund(th.fund('Pareja', 'm0', 'Personal', 200, 20))$$, 'crea Pareja en el mes 0');
select lives_ok($$select public.save_fund(th.fund('Tesis', 'm0', 'Trabajo', 1900, 30))$$, 'crea Tesis en el mes 0');
select lives_ok($$select public.save_fund(th.fund('Viaje', 'm0', 'Familia', 1000, 40))$$, 'crea Viaje en el mes 0');
select is((select count(*)::int from public.funds where period_id = th.pid('m0')), 5, 'el mes 0 tiene 5 fondos');
select is((select count(*)::int from public.funds where period_id = th.pid('m1')), 0, 'el mes 1 no tiene fondos: no se heredan');
select is((select count(*)::int from public.fund_period_budgets where period_id = th.pid('m1')), 0, 'el mes 1 tampoco tiene presupuestos');
select is((select sum(assigned_amount) from public.fund_period_budgets where period_id = th.pid('m0')), 6380.00, 'presupuesto del mes 0 = suma de sus fondos');

-- B. Copia parcial con importe editado
select is((public.copy_funds(th.pid('m0'), th.pid('m1'), jsonb_build_array(
  jsonb_build_object('fund_id', th.fid('General', 'm0')),
  jsonb_build_object('fund_id', th.fid('Sodexo', 'm0')),
  jsonb_build_object('fund_id', th.fid('Pareja', 'm0'), 'amount', 250))) -> 'created') -> 0 ->> 'name', 'General', 'copia 3 de 5 fondos al mes 1');
select is((select count(*)::int from public.funds where period_id = th.pid('m1')), 3, 'el mes 1 tiene exactamente 3 fondos');
select is((select count(*)::int from public.funds where period_id = th.pid('m0')), 5, 'el mes 0 conserva sus 5 fondos');
select is((select assigned_amount from public.fund_period_budgets where fund_id = th.fid('Pareja', 'm1')), 250.00, 'el importe editado se aplica solo a la copia');
select is((select assigned_amount from public.fund_period_budgets where fund_id = th.fid('Pareja', 'm0')), 200.00, 'el origen conserva su importe');
select is((select count(*)::int from public.fund_scope_rules where fund_id = th.fid('Sodexo', 'm1')), 1, 'la copia lleva sus reglas de cobertura');
select isnt(th.fid('Sodexo', 'm1'), th.fid('Sodexo', 'm0'), 'la copia es una instancia distinta (otro ID)');
select is((select copied_from from public.funds where id = th.fid('Sodexo', 'm1')), th.fid('Sodexo', 'm0'), 'la copia recuerda su origen');

-- H. Idempotencia: repetir la copia no duplica nada
select is((public.copy_funds(th.pid('m0'), th.pid('m1'), jsonb_build_array(jsonb_build_object('fund_id', th.fid('Sodexo', 'm0')))) -> 'skipped') -> 0 ->> 'reason', 'already_copied', 'repetir la copia se omite');
select is((select count(*)::int from public.funds where period_id = th.pid('m1')), 3, 'tras repetir la copia siguen siendo 3 fondos');
select is((public.copy_funds(th.pid('m0'), th.pid('m1'), jsonb_build_array(jsonb_build_object('fund_id', th.fid('Tesis', 'm0')))) -> 'created') -> 0 ->> 'name', 'Tesis', 'copiar un fondo nuevo sí se crea');
select is((select count(*)::int from public.funds where period_id = th.pid('m1')), 4, 'ahora el mes 1 tiene 4 fondos');

-- C. Edición independiente
select lives_ok($$select public.save_fund(jsonb_build_object('id', th.fid('General', 'm1'), 'period_amount', 3500))$$, 'edita General del mes 1');
select is((select assigned_amount from public.fund_period_budgets where fund_id = th.fid('General', 'm1')), 3500.00, 'General del mes 1 = 3500');
select is((select assigned_amount from public.fund_period_budgets where fund_id = th.fid('General', 'm0')), 3000.00, 'General del mes 0 no cambia');
select lives_ok($$select public.save_fund(jsonb_build_object('id', th.fid('Sodexo', 'm1'), 'name', 'Sodexo nov', 'priority', 5))$$, 'renombra y reprioriza una copia');
select is((select name::text || priority::text from public.funds where id = th.fid('Sodexo', 'm0')), 'Sodexo10', 'nombre y prioridad del origen no cambian');

-- D. Cantidades distintas por mes
select lives_ok($$select public.save_fund(th.general('m2', 100))$$, 'crea General en el mes 2');
select lives_ok($$select public.save_fund(th.fund('A', 'm2', 'Hogar', 10, 10))$$, 'fondo A del mes 2');
select lives_ok($$select public.save_fund(th.fund('B', 'm2', 'Hogar', 10, 20))$$, 'fondo B del mes 2');
select lives_ok($$select public.save_fund(th.fund('C', 'm2', 'Hogar', 10, 30))$$, 'fondo C del mes 2');
select results_eq(
  $$select bp.start_date, count(*)::int from public.funds f join public.budget_periods bp on bp.id = f.period_id group by 1 order by 1$$,
  $$select th.mes(0), 5 union all select th.mes(1), 4 union all select th.mes(2), 4$$,
  'cada mes muestra su propia cantidad de fondos (5, 4, 4) sin mezclar');
select throws_ok($$select public.save_fund(th.general('m2', 5))$$, '23505', null, 'solo un Fondo General activo por mes');
select lives_ok($$select public.save_fund(jsonb_build_object('name', 'Sodexo', 'period_id', th.pid('m2'), 'is_general', false, 'period_amount', 5,
  'scope_rules', jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:Hogar'), 'effect', 'include'))))$$, 'el mismo nombre puede existir en meses distintos');
select throws_ok($$select public.save_fund(th.fund('sodexo', 'm2', 'Hogar', 5, 10))$$, '23505', null, 'pero no repetirse dentro del mismo mes');
select throws_ok($$select public.save_fund(jsonb_build_object('name', 'Sin mes', 'is_general', true))$$, 'GD004', null, 'un fondo nuevo exige su mes');

-- F. Un gasto solo consume fondos de su mes
select lives_ok($$select public.create_expense(th.exp(th.mes(1) + 2, 100, 'Gasto mes 1', 'Hogar', 'Servicios', 'Luz', 'Transferencia'), gen_random_uuid())$$, 'registra un gasto en el mes 1');
select is((select count(*)::int from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id
           where a.expense_id = (select id from public.expenses where description = 'Gasto mes 1') and f.period_id <> th.pid('m1')), 0, 'ninguna imputación apunta a fondos de otro mes');
select is((select sum(amount) from public.expense_fund_allocations where expense_id = (select id from public.expenses where description = 'Gasto mes 1')), 100.00, 'el gasto queda imputado por completo en su mes');
select is((select coalesce(sum(a.amount), 0) from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.period_id = th.pid('m0')), 0.00, 'el mes 0 no consume nada del gasto del mes 1');
select is((select count(*)::int from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.period_id = th.pid('m2')), 0, 'el mes 2 tampoco');

-- Un mes sin fondos: el gasto se guarda y queda «sin fondo» (no se inventan imputaciones)
select lives_ok($$select public.create_expense(th.exp(th.mes(3) + 1, 40, 'Sin fondo', 'Hogar', 'Servicios', 'Luz', 'Transferencia'), gen_random_uuid())$$, 'se puede registrar un gasto en un mes sin fondos');
select is((select count(*)::int from public.expense_fund_allocations where expense_id = (select id from public.expenses where description = 'Sin fondo')), 0, 'ese gasto queda sin fondo');
select lives_ok($$select public.copy_funds(th.pid('m0'), th.pid('m3'), jsonb_build_array(jsonb_build_object('fund_id', th.fid('General', 'm0'))))$$, 'al crear fondos en ese mes se imputa su gasto');
select is((select sum(amount) from public.expense_fund_allocations where expense_id = (select id from public.expenses where description = 'Sin fondo')), 40.00, 'el gasto sin fondo se imputa al nuevo fondo del mes');

-- Eliminar o desactivar un fondo solo afecta a su mes
select lives_ok($$select public.delete_fund(th.fid('Tesis', 'm1'))$$, 'elimina un fondo del mes 1');
select is((select count(*)::int from public.funds where name = 'Tesis' and period_id = th.pid('m0')), 1, 'el mismo fondo del mes 0 sigue existiendo');
select throws_ok($$select public.reorder_funds(array[th.fid('Sodexo', 'm0'), th.fid('General', 'm1')])$$, 'GD004', null, 'no se ordenan juntos fondos de meses distintos');
select throws_ok($$select public.set_fund_period_budget(th.fid('Sodexo', 'm0'), th.pid('m1'), 5)$$, 'GD004', null, 'el presupuesto de un fondo solo se fija en su propio mes');

-- E. Meses cerrados conservan su histórico
insert into th.p select 'old', (public.ensure_period_rpc(th.mes(-2))).id;
select lives_ok($$select public.save_fund(th.general('old', 200))$$, 'crea General del mes antiguo');
select lives_ok($$select public.create_expense(th.exp(th.mes(-2) + 3, 25, 'Antiguo', 'Hogar', 'Servicios', 'Luz', 'Transferencia'), gen_random_uuid())$$, 'gasto del mes antiguo');
select lives_ok($$select public.close_period(th.pid('old'))$$, 'cierra el mes antiguo');
select lives_ok($$select public.save_fund(jsonb_build_object('id', th.fid('General', 'm0'), 'period_amount', 9999))$$, 'editar el mes 0 no toca el cerrado');
select is((select assigned_amount from public.period_fund_snapshots where period_id = th.pid('old')), 200.00, 'el cierre conserva su presupuesto');
select is((select consumed_amount from public.period_fund_snapshots where period_id = th.pid('old')), 25.00, 'el cierre conserva su consumo');
select is((select count(*)::int from public.period_fund_snapshots where period_id = th.pid('old')), 1, 'el cierre solo incluye los fondos de ese mes');
select throws_ok($$select public.save_fund(jsonb_build_object('id', th.fid('General', 'old'), 'name', 'x'))$$, 'GD002', null, 'un fondo de un mes cerrado no se edita');
select throws_ok($$select public.copy_funds(th.pid('m0'), th.pid('old'), jsonb_build_array(jsonb_build_object('fund_id', th.fid('Sodexo', 'm0'))))$$, 'GD002', null, 'no se copian fondos a un mes cerrado');

-- Planificación mensual
select is((public.save_period_plan(th.mes(1), '{"funds_stage": "done"}') ->> 'status'), 'in_progress', 'confirmar una etapa deja la planificación en progreso');
select throws_ok($$select public.save_period_plan(th.mes(1), '{"status": "completed"}')$$, 'GD014', null, 'no se finaliza con una etapa pendiente');
select is((public.save_period_plan(th.mes(1), '{"expenses_stage": "skipped", "status": "completed"}') ->> 'status'), 'completed', 'finaliza con la etapa de gastos omitida');
select isnt((select completed_at from public.period_plans where period_id = th.pid('m1')), null, 'se registra la fecha de finalización');
select is((select expenses_stage::text from public.period_plans where period_id = th.pid('m1')), 'skipped', 'la etapa omitida queda identificada');
select is((public.planning_summary(th.mes(1)) ->> 'funds_count')::int, 3, 'el resumen cuenta solo los fondos activos del mes');
select is((public.planning_summary(th.mes(1)) -> 'plan' ->> 'status'), 'completed', 'el resumen incluye el estado del plan');
select is((public.planning_summary(th.mes(0)) -> 'plan') = 'null'::jsonb, true, 'un mes sin plan no tiene estado de plan');
select is((select count(*)::int from public.period_plans), 1, 'consultar meses no crea planes vacíos');

-- Las imputaciones no pueden apuntar a un fondo de otro mes (restricción de la base)
reset role;
select throws_ok(
  $$insert into public.expense_fund_allocations (household_id, expense_id, fund_id, period_id, amount, allocation_kind)
    select e.household_id, e.id, th.fid('General', 'm0'), th.pid('m1'), 1, 'general' from public.expenses e where e.description = 'Gasto mes 1'$$,
  '23503', null, 'una imputación no puede mezclar el fondo de un mes con el período de otro');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

-- ===================== Usuario B: aislamiento =====================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.funds), 0, 'B no ve fondos de A');
select throws_ok($$select public.copy_funds(th.pid('m0'), th.pid('m1'), '[]'::jsonb)$$, 'GD004', null, 'B no copia fondos de A');
select is((public.planning_summary(th.mes(1)) ->> 'funds_count')::int, 0, 'B no cuenta fondos de A en su resumen');
select is((select count(*)::int from public.period_plans), 0, 'B no ve planes de A');
select throws_ok($$select public.save_fund(jsonb_build_object('name', 'Intruso', 'period_id', th.pid('m0'), 'is_general', true))$$, 'GD004', null, 'B no crea fondos en un mes de A');

select * from finish();
rollback;
