begin;
select * from no_plan();

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');

-- Hogar de partida para estas pruebas: el alta ya no crea catálogo ni fondos (solo lo técnico), así que se crean aquí.
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');
insert into public.funds (household_id, name, description, is_general, default_amount, priority, icon_key, color_token)
select household_id, 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri' from public.profiles where user_id in (select id from auth.users where email like '%@test.local');

-- Ayudantes de prueba (se revierten al final)
create schema th;
grant usage on schema th to authenticated;
create table th.k (name text primary key, id uuid not null);
grant select on th.k to authenticated;
insert into th.k
  select 'amb:' || a.name, a.id from public.ambitos a where a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k
  select 'cat:' || a.name || ':' || c.name, c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where c.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k
  select 'sub:' || a.name || ':' || c.name || ':' || s.name, s.id from public.subcategorias s join public.categorias c on c.id = s.categoria_id join public.ambitos a on a.id = c.ambito_id where s.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k
  select 'med:' || m.name, m.id from public.medios_pago m where m.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

create function th.kid(n text) returns uuid language sql stable as $$ select id from th.k where name = n $$;
create function th.exp(p_date date, p_amount numeric, p_desc text, p_amb text, p_cat text, p_sub text, p_med text)
returns jsonb language sql stable as $$
  select jsonb_build_object('expense_date', p_date, 'amount', p_amount, 'description', p_desc,
    'ambito_id', th.kid('amb:' || p_amb), 'categoria_id', th.kid('cat:' || p_amb || ':' || p_cat),
    'subcategoria_id', case when p_sub is null then null else th.kid('sub:' || p_amb || ':' || p_cat || ':' || p_sub) end,
    'payment_method_id', th.kid('med:' || p_med));
$$;
create function th.fund(p_name text, p_amb text, p_amount numeric, p_prio int, p_pay jsonb default null)
returns jsonb language sql stable as $$
  select jsonb_build_object('name', p_name, 'is_general', false, 'default_amount', p_amount, 'priority', p_prio,
    'scope_rules', jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:' || p_amb), 'effect', 'include')))
    || case when p_pay is null then '{}'::jsonb else jsonb_build_object('payment_rules', p_pay) end;
$$;
create table th.saved (name text, id uuid);
grant select, insert on th.saved to authenticated;
grant execute on all functions in schema th to authenticated;

-- ===================== Usuario A =====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok($$select public.save_fund(th.fund('Hogar 1', 'Hogar', 100, 10))$$, 'crea el fondo específico Hogar 1');
select lives_ok($$select public.save_fund(th.fund('Hogar 2', 'Hogar', 50, 20))$$, 'crea el fondo específico Hogar 2');
select lives_ok($$select public.save_fund(jsonb_build_object('id', (select id from public.funds where is_general), 'default_amount', 200))$$, 'asigna presupuesto al Fondo General');

select throws_ok($$select public.save_fund(jsonb_build_object('name', 'Sin alcance', 'is_general', false))$$, 'GD006', null, 'un fondo específico exige al menos una regla de inclusión');
select throws_ok($$select public.save_fund(jsonb_build_object('name', 'Otro general', 'is_general', true, 'default_amount', 10))$$, '23505', null, 'solo un Fondo General activo por hogar');

-- E1: 120 → 100 en Hogar 1 + 20 en Hogar 2 (por prioridad)
select lives_ok($$select public.create_expense(th.exp(date_trunc('month', current_date)::date + 0, 120, 'E1', 'Hogar', 'Servicios', 'Luz', 'Transferencia'), gen_random_uuid())$$, 'crea E1');
select results_eq(
  $$select f.name::text, a.amount::numeric, a.allocation_kind::text from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = (select id from public.expenses where description = 'E1') order by f.name$$,
  $$values ('Hogar 1', 100.00, 'specific'), ('Hogar 2', 20.00, 'specific')$$,
  'E1 se reparte entre fondos específicos según prioridad');

-- E2: 100 → Hogar 2 aporta 30 y el General absorbe 70
select lives_ok($$select public.create_expense(th.exp(date_trunc('month', current_date)::date + 1, 100, 'E2', 'Hogar', 'Servicios', 'Internet', 'Transferencia'), gen_random_uuid())$$, 'crea E2');
select results_eq(
  $$select f.name::text, a.amount::numeric, a.allocation_kind::text from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = (select id from public.expenses where description = 'E2') order by f.is_general, f.name$$,
  $$values ('Hogar 2', 30.00, 'specific'), ('Fondo General', 70.00, 'general')$$,
  'el excedente de un específico agotado va al Fondo General');

-- E3: 400 con todo agotado → el General queda negativo y no bloquea
select lives_ok($$select public.create_expense(th.exp(date_trunc('month', current_date)::date + 2, 400, 'E3', 'Hogar', 'Alimentación', 'Despensa', 'Plin'), gen_random_uuid())$$, 'un sobregasto no bloquea el guardado');
select is((select sum(a.amount) from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.is_general), 470.00, 'el Fondo General consumió 470 (queda en negativo)');
select is((select count(*)::int from public.expenses e where e.status = 'active' and e.amount <> (select sum(a.amount) from public.expense_fund_allocations a where a.expense_id = e.id)), 0, 'la suma de imputaciones iguala a cada gasto');

-- Previsualización exacta y sin rastro
select is(public.preview_expense(th.exp(date_trunc('month', current_date)::date + 3, 400, 'Simulado', 'Hogar', 'Servicios', 'Agua', 'Plin')) -> 'warnings' -> 0 ->> 'code', 'general_negative', 'la previsualización advierte de saldo negativo del General');
select is((select count(*)::int from public.expenses where description = 'Simulado'), 0, 'la previsualización no guarda nada');

-- Anular y restaurar recalculan
select lives_ok($$select public.annul_expenses(array[(select id from public.expenses where description = 'E3')])$$, 'anula E3');
select is((select sum(a.amount) from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.is_general), 70.00, 'al anular, el General recupera lo consumido');
select lives_ok($$select public.restore_expenses(array[(select id from public.expenses where description = 'E3')])$$, 'restaura E3');
select is((select sum(a.amount) from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.is_general), 470.00, 'al restaurar vuelve a imputarse');

-- Editar E1 reordena la imputación cronológica
select lives_ok($$select public.update_expense((select id from public.expenses where description = 'E1'), '{"amount": 60}'::jsonb)$$, 'edita E1');
select results_eq(
  $$select f.name::text, a.amount::numeric, a.allocation_kind::text from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = (select id from public.expenses where description = 'E2') order by f.name$$,
  $$values ('Fondo General', 10.00, 'general'), ('Hogar 1', 40.00, 'specific'), ('Hogar 2', 50.00, 'specific')$$,
  'al editar E1 se recalcula E2 con varios fondos específicos');

-- Idempotencia
select lives_ok($$select public.create_expense(th.exp(date_trunc('month', current_date)::date + 4, 10, 'Idem', 'Personal', 'Ocio', 'Salidas', 'Yape'), '00000000-0000-0000-0000-0000000000a1')$$, 'primer envío');
select is((public.create_expense(th.exp(date_trunc('month', current_date)::date + 4, 10, 'Idem', 'Personal', 'Ocio', 'Salidas', 'Yape'), '00000000-0000-0000-0000-0000000000a1') ->> 'replayed')::boolean, true, 'el reintento con la misma clave se reconoce');
select is((select count(*)::int from public.expenses where description = 'Idem'), 1, 'el reintento no duplica el gasto');

-- Prioridad: la simulación informa el efecto y no persiste
select is((public.reorder_funds(array[(select id from public.funds where name = 'Hogar 2'), (select id from public.funds where name = 'Hogar 1')], true) ->> 'changed_expenses')::int > 0, true, 'invertir la prioridad cambia la imputación de gastos');
select is((select priority from public.funds where name = 'Hogar 1'), 10, 'la simulación de prioridad no se persiste');
select lives_ok($$select public.reorder_funds(array[(select id from public.funds where name = 'Hogar 2'), (select id from public.funds where name = 'Hogar 1')])$$, 'aplica el nuevo orden');
select is((select priority from public.funds where name = 'Hogar 2'), 10, 'Hogar 2 pasa a prioridad 10');
select lives_ok($$select public.reorder_funds(array[(select id from public.funds where name = 'Hogar 1'), (select id from public.funds where name = 'Hogar 2')])$$, 'restaura el orden original');

-- Cambiar reglas: simulación y efecto
select is((public.save_fund(jsonb_build_object('id', (select id from public.funds where is_general), 'scope_rules', jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:Personal'), 'effect', 'include'))), true) ->> 'changed_expenses')::int > 0, true, 'la simulación informa cuántos gastos cambian');
select is((select count(*)::int from public.fund_scope_rules where fund_id = (select id from public.funds where is_general)), 0, 'la simulación no modifica las reglas');
select lives_ok($$select public.save_fund(jsonb_build_object('id', (select id from public.funds where is_general), 'scope_rules', jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:Personal'), 'effect', 'include'))))$$, 'restringe el General a Personal');
select results_eq(
  $$select f.name::text, a.amount::numeric, a.allocation_kind::text from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = (select id from public.expenses where description = 'E3')$$,
  $$values ('Hogar 1', 400.00, 'specific')$$,
  'sin Fondo General compatible, el sobregasto va completo al específico de mayor prioridad');
select is(public.preview_expense(th.exp(date_trunc('month', current_date)::date + 5, 30, 'Bebé x', 'Bebé', 'Cuidado', 'Pañales', 'Yape')) ->> 'reason', 'classification', 'se bloquea si ningún fondo cubre la clasificación');
select throws_ok($$select public.create_expense(th.exp(date_trunc('month', current_date)::date + 5, 30, 'Bebé x', 'Bebé', 'Cuidado', 'Pañales', 'Yape'), gen_random_uuid())$$, 'GD001', null, 'crear un gasto incompatible falla con GD001');
select is((select count(*)::int from public.expenses where description = 'Bebé x'), 0, 'el gasto bloqueado no queda guardado');

select lives_ok($$select public.save_fund(jsonb_build_object('id', (select id from public.funds where is_general), 'payment_rules', jsonb_build_array(jsonb_build_object('method', th.kid('med:Efectivo'), 'effect', 'exclude'))))$$, 'el General excluye Efectivo');
select is(public.preview_expense(th.exp(date_trunc('month', current_date)::date + 5, 30, 'Efec', 'Personal', 'Ocio', 'Salidas', 'Efectivo')) ->> 'reason', 'rules', 'ningún fondo admite a la vez clasificación y medio');
select lives_ok($$select public.save_fund(jsonb_build_object('id', (select id from public.funds where name = 'Hogar 1'), 'payment_rules', jsonb_build_array(jsonb_build_object('method', th.kid('med:Efectivo'), 'effect', 'exclude'))))$$, 'Hogar 1 excluye Efectivo');
select lives_ok($$select public.save_fund(jsonb_build_object('id', (select id from public.funds where name = 'Hogar 2'), 'payment_rules', jsonb_build_array(jsonb_build_object('method', th.kid('med:Efectivo'), 'effect', 'exclude'))))$$, 'Hogar 2 excluye Efectivo');
select is(public.preview_expense(th.exp(date_trunc('month', current_date)::date + 5, 30, 'Efec', 'Personal', 'Ocio', 'Salidas', 'Efectivo')) ->> 'reason', 'payment_method', 'se bloquea si ningún fondo admite el medio de pago');

-- Períodos cerrados conservan su histórico
select lives_ok($$select public.create_expense(th.exp((date_trunc('month', current_date) - interval '2 months')::date + 3, 25, 'Pasado', 'Personal', 'Alimentación', 'Comidas fuera', 'Yape'), gen_random_uuid())$$, 'gasto de hace dos meses');
select throws_ok($$select public.close_period((select id from public.budget_periods where start_date = date_trunc('month', current_date)::date))$$, 'GD007', null, 'no se cierra un período que no terminó');
select lives_ok($$select public.close_period((select id from public.budget_periods where start_date = (date_trunc('month', current_date) - interval '2 months')::date))$$, 'cierra el período antiguo');
select lives_ok($$select public.save_fund(jsonb_build_object('id', (select id from public.funds where is_general), 'default_amount', 999))$$, 'edita el fondo del mes actual');
select is((select assigned_amount from public.period_fund_snapshots s join public.budget_periods p on p.id = s.period_id where s.is_general and p.start_date = (date_trunc('month', current_date) - interval '2 months')::date), 200.00, 'el snapshot histórico conserva el presupuesto original');
select is((select consumed_amount from public.period_fund_snapshots s join public.budget_periods p on p.id = s.period_id where s.is_general and p.start_date = (date_trunc('month', current_date) - interval '2 months')::date), 25.00, 'el snapshot histórico conserva el consumo');
select throws_ok($$select public.create_expense(th.exp((date_trunc('month', current_date) - interval '2 months')::date + 4, 5, 'Tarde', 'Personal', 'Ocio', 'Salidas', 'Yape'), gen_random_uuid())$$, 'GD002', null, 'no se registran gastos en un período cerrado');
select throws_ok($$select public.annul_expenses(array[(select id from public.expenses where description = 'Pasado')])$$, 'GD002', null, 'no se anulan gastos de un período cerrado');
select throws_ok($$select public.set_fund_period_budget((select id from public.funds where is_general), (select id from public.budget_periods where start_date = (date_trunc('month', current_date) - interval '2 months')::date), 1)$$, 'GD002', null, 'no se cambia el presupuesto de un período cerrado');

-- Plantillas y lote
insert into public.expense_templates (household_id, name, description, default_amount, ambito_id, categoria_id, subcategoria_id, payment_method_id)
values ((select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'Streaming', 'Suscripción', 45,
        th.kid('amb:Personal'), th.kid('cat:Personal:Ocio'), th.kid('sub:Personal:Ocio:Suscripciones'), th.kid('med:Transferencia'));

select is((public.apply_template_batch(current_date, jsonb_build_array(jsonb_build_object('template_id', (select id from public.expense_templates where name = 'Streaming'), 'outcome', 'include')), '00000000-0000-0000-0000-0000000000b1') ->> 'count')::int, 1, 'el lote registra la plantilla');
select is((public.apply_template_batch(current_date, jsonb_build_array(jsonb_build_object('template_id', (select id from public.expense_templates where name = 'Streaming'), 'outcome', 'include')), '00000000-0000-0000-0000-0000000000b1') ->> 'replayed')::boolean, true, 'reintentar el lote con la misma clave no lo repite');
select is((select count(*)::int from public.expenses where template_id is not null), 1, 'el lote no duplicó gastos');
select throws_ok($$select public.apply_template_batch(current_date, jsonb_build_array(jsonb_build_object('template_id', (select id from public.expense_templates where name = 'Streaming'), 'outcome', 'include')), gen_random_uuid())$$, 'GD003', null, 'no se registra dos veces la misma plantilla en el período');
select is((select count(*)::int from public.template_batch_items where outcome = 'included'), 1, 'el detalle del lote conserva la plantilla incluida');

-- Auditoría
select cmp_ok((select count(*)::int from public.audit_logs), '>', 5, 'el propietario ve la auditoría');
select throws_ok($$insert into public.audit_logs (household_id, entity, action) values ((select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'x', 'y')$$, '42501', null, 'la auditoría no es editable desde el cliente');
select is((select count(*)::int from public.audit_logs where action = 'annul'), 1, 'la anulación quedó auditada');

insert into th.saved select 'e1', id from public.expenses where description = 'E1';
insert into th.saved select 'fund', id from public.funds where name = 'Hogar 1';
insert into th.saved select 'period', id from public.budget_periods where start_date = date_trunc('month', current_date)::date;

-- ===================== Usuario B: aislamiento =====================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.expenses), 0, 'B no ve gastos de A');
select is((select count(*)::int from public.funds), 1, 'B solo ve su Fondo General');
select is((select count(*)::int from public.expense_fund_allocations), 0, 'B no ve imputaciones de A');
select is((select count(*)::int from public.audit_logs where action = 'annul'), 0, 'B no ve la auditoría de A');
select is((select count(*)::int from public.budget_periods), 0, 'B no ve períodos de A');
select is((select count(*)::int from public.expense_templates), 0, 'B no ve plantillas de A');
select throws_ok($$select public.update_expense((select id from th.saved where name = 'e1'), '{"amount": 1}'::jsonb)$$, 'GD004', null, 'B no edita gastos de A');
select throws_ok($$select public.save_fund(jsonb_build_object('id', (select id from th.saved where name = 'fund'), 'name', 'x'))$$, 'GD004', null, 'B no edita fondos de A');
select throws_ok($$select public.set_fund_period_budget((select id from th.saved where name = 'fund'), (select id from th.saved where name = 'period'), 5)$$, 'GD004', null, 'B no cambia presupuestos de A');
select is((public.annul_expenses(array[(select id from th.saved where name = 'e1')]) ->> 'count')::int, 0, 'B no anula gastos de A');
select throws_ok($$insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id) select household_id, current_date, 1, 'x', th.kid('amb:Hogar'), th.kid('cat:Hogar:Servicios'), th.kid('med:Yape') from public.profiles limit 1$$, '42501', null, 'B no inserta gastos directamente');

select * from finish();
rollback;
