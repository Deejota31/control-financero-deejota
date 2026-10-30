begin;
select * from no_plan();

-- Plantillas de fondos: biblioteca global del hogar, independiente de los fondos de cada mes. Aplicarlas crea instancias mensuales, sin duplicar.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@test.local');
select public.bootstrap_catalog(household_id) from public.profiles where user_id in (select id from auth.users where email like '%@test.local');

create schema th;
grant usage on schema th to authenticated;
create table th.k (name text primary key, id uuid not null);
grant select on th.k to authenticated;
insert into th.k select 'amb:' || a.name, a.id from public.ambitos a where a.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into th.k select 'med:' || m.name, m.id from public.medios_pago m where m.household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
create table th.p (name text primary key, id uuid not null);
grant select, insert on th.p to authenticated;
create table th.t (name text primary key, id uuid not null);
grant select, insert on th.t to authenticated;

create function th.kid(n text) returns uuid language sql stable as $$ select id from th.k where name = n $$;
create function th.pid(n text) returns uuid language sql stable as $$ select id from th.p where name = n $$;
create function th.tid(n text) returns uuid language sql stable as $$ select id from th.t where name = n $$;
create function th.mes(n int) returns date language sql stable as $$ select (date_trunc('month', current_date) + make_interval(months => n))::date $$;
create function th.plantilla(p_name text, p_amb text, p_amount numeric, p_general boolean, p_prio int)
returns jsonb language sql stable as $$
  select jsonb_build_object('name', p_name, 'suggested_amount', p_amount, 'is_general', p_general, 'priority', p_prio, 'icon_key', 'wallet', 'color_token', 'c1',
    'scope_rules', case when p_amb is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('kind', 'ambito', 'ref', th.kid('amb:' || p_amb), 'effect', 'include')) end,
    'payment_rules', jsonb_build_array(jsonb_build_object('method', th.kid('med:Sodexo'), 'effect', 'include')));
$$;
create function th.items(variadic p_names text[]) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('template_id', th.tid(n))), '[]'::jsonb) from unnest(p_names) n $$;
create function th.fid_m2() returns uuid language sql stable as $$ select id from public.funds where name = 'Sodexo' and period_id = th.pid('m2') $$;
grant execute on all functions in schema th to authenticated;

-- ===================== Usuario A =====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

insert into th.p select 'm0', (public.ensure_period_rpc(th.mes(0))).id;
insert into th.p select 'm1', (public.ensure_period_rpc(th.mes(1))).id;
insert into th.p select 'm2', (public.ensure_period_rpc(th.mes(2))).id;

-- 1. Crear plantillas: no afectan a ningún mes ni a sus indicadores
insert into th.t select 'Sodexo', public.save_fund_template(th.plantilla('Sodexo', 'Trabajo', 280, false, 10));
insert into th.t select 'Pareja', public.save_fund_template(th.plantilla('Pareja', 'Familia', 200, false, 10));
insert into th.t select 'General', public.save_fund_template(th.plantilla('General', null, 3000, true, 100));
insert into th.t select 'General B', public.save_fund_template(th.plantilla('General B', null, 500, true, 100));
select is((select count(*)::int from public.fund_templates), 4, 'se crean 4 plantillas');
select is((select count(*)::int from public.funds), 0, 'guardar plantillas no crea fondos en ningún mes');
select is((select count(*)::int from public.fund_period_budgets), 0, 'guardar plantillas no asigna presupuesto');
select is((select count(*)::int from public.fund_template_scope_rules where template_id = th.tid('Sodexo')), 1, 'la plantilla conserva su cobertura');
select is((select count(*)::int from public.fund_template_payment_rules where template_id = th.tid('Sodexo')), 1, 'la plantilla conserva sus medios de pago');

-- 2. Validaciones
select throws_ok($$select public.save_fund_template(th.plantilla('sodexo ', 'Trabajo', 1, false, 1))$$, 'GD010', null, 'el nombre de plantilla no se repite (ignora mayúsculas y espacios)');
select throws_ok($$select public.save_fund_template(th.plantilla('Sin reglas', null, 1, false, 1))$$, 'GD006', null, 'un fondo específico necesita al menos una inclusión');
select throws_ok($$select public.save_fund_template('{"name":"Negativa","suggested_amount":-5,"is_general":true}'::jsonb)$$, '23514', null, 'el importe sugerido no puede ser negativo');

-- 3. Editar la plantilla
select lives_ok($$select public.save_fund_template(th.plantilla('Sodexo', 'Trabajo', 290, false, 10) || jsonb_build_object('id', th.tid('Sodexo')))$$, 'edita la plantilla');
select is((select suggested_amount from public.fund_templates where id = th.tid('Sodexo')), 290.00::numeric, 'el importe sugerido se actualiza');

-- 4. Aplicar varias plantillas a un mes: instancias independientes, con reglas y prioridades
select is((public.apply_fund_templates(th.pid('m1'), th.items('Sodexo', 'Pareja', 'General'))) #>> '{created,0,name}', 'Sodexo', 'aplica la primera plantilla');
select is((select count(*)::int from public.funds where period_id = th.pid('m1')), 3, 'el mes 1 tiene los 3 fondos aplicados');
select is((select count(*)::int from public.funds where period_id = th.pid('m1') and template_id is not null), 3, 'cada fondo queda vinculado a su plantilla');
select is((select count(*)::int from public.fund_scope_rules r join public.funds f on f.id = r.fund_id where f.period_id = th.pid('m1') and f.name = 'Sodexo'), 1, 'el fondo recibe las reglas de clasificación');
select is((select count(*)::int from public.fund_payment_rules r join public.funds f on f.id = r.fund_id where f.period_id = th.pid('m1') and f.name = 'Sodexo'), 1, 'el fondo recibe las reglas de medio de pago');
select is((select assigned_amount from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where f.period_id = th.pid('m1') and f.name = 'General'), 3000.00::numeric, 'el presupuesto del mes toma el importe sugerido');
select isnt((select priority from public.funds where period_id = th.pid('m1') and name = 'Pareja'), (select priority from public.funds where period_id = th.pid('m1') and name = 'Sodexo'), 'dos plantillas con la misma prioridad sugerida no empatan en el mes');

-- 5. Idempotencia y conflictos
select is((public.apply_fund_templates(th.pid('m1'), th.items('Sodexo'))) #>> '{skipped,0,reason}', 'already_applied', 'reaplicar la misma plantilla no duplica');
select is((select count(*)::int from public.funds where period_id = th.pid('m1')), 3, 'sigue habiendo 3 fondos');
select is((public.apply_fund_templates(th.pid('m1'), th.items('General B'))) #>> '{skipped,0,reason}', 'general_exists', 'no permite un segundo Fondo General activo en el mes');
select is((select count(*)::int from public.funds where period_id = th.pid('m1') and is_general and is_active), 1, 'el mes conserva un único Fondo General');

-- 6. Importe editado al aplicar: la plantilla no cambia
select is((public.apply_fund_templates(th.pid('m2'), jsonb_build_array(jsonb_build_object('template_id', th.tid('Sodexo'), 'amount', 300)))) #>> '{created,0,amount}', '300', 'aplica con el importe ajustado');
select is((select suggested_amount from public.fund_templates where id = th.tid('Sodexo')), 290.00::numeric, 'la plantilla conserva su importe sugerido');
select is((select assigned_amount from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where f.period_id = th.pid('m1') and f.name = 'Sodexo'), 290.00::numeric, 'otro mes no se ve afectado');

-- 7. Independencia: cambiar la plantilla no altera fondos ya creados; cambiar un fondo no altera la plantilla
select lives_ok($$select public.save_fund_template(th.plantilla('Sodexo', 'Trabajo', 999, false, 10) || jsonb_build_object('id', th.tid('Sodexo')))$$, 'cambia otra vez la plantilla');
select is((select assigned_amount from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where f.period_id = th.pid('m2') and f.name = 'Sodexo'), 300.00::numeric, 'el fondo del mes conserva su importe');
select lives_ok($$select public.set_fund_period_budget(th.fid_m2(), th.pid('m2'), 123)$$, 'cambia el presupuesto del fondo del mes');
select is((select suggested_amount from public.fund_templates where id = th.tid('Sodexo')), 999.00::numeric, 'la plantilla no cambia por editar el fondo');

-- 8. Plantilla inactiva y desvinculación al eliminar
select lives_ok($$update public.fund_templates set is_active = false where id = th.tid('Pareja')$$, 'desactiva una plantilla');
select is((public.apply_fund_templates(th.pid('m2'), th.items('Pareja'))) #>> '{skipped,0,reason}', 'inactive', 'una plantilla inactiva no se aplica');
select lives_ok($$delete from public.fund_templates where id = th.tid('Sodexo')$$, 'elimina una plantilla');
select is((select count(*)::int from public.funds where name = 'Sodexo'), 2, 'los fondos creados con ella se conservan');
select is((select count(*)::int from public.funds where name = 'Sodexo' and template_id is not null), 0, 'y quedan desvinculados');

-- 9. Un mes cerrado no admite fondos nuevos y no se modifica
reset role;
update public.budget_periods set status = 'closed', closed_at = now() where id = th.pid('m0');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok($$select public.apply_fund_templates(th.pid('m0'), th.items('General'))$$, 'GD002', null, 'un período cerrado no recibe fondos desde plantillas');
select is((select count(*)::int from public.funds where period_id = th.pid('m0')), 0, 'el período cerrado sigue sin cambios');

-- 10. Una plantilla que perdió su clasificación no se aplica en silencio
-- Las reglas solo se escriben por la función validada: aquí se simula que una eliminación del catálogo las dejó vacías.
reset role;
delete from public.fund_template_scope_rules where template_id = th.tid('Pareja');
update public.fund_templates set is_active = true where id = th.tid('Pareja');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((public.apply_fund_templates(th.pid('m2'), th.items('Pareja'))) #>> '{skipped,0,reason}', 'invalid_rules', 'sin clasificación incluida se informa y no se crea');

-- 11. Gestor: orden manual (solo presentación), grupo propio y prioridad propuesta confirmada
select lives_ok($$select public.reorder_templates('fund', array[th.tid('General B'), th.tid('General'), th.tid('Pareja')])$$, 'guarda el orden manual de las plantillas de fondos');
select is((select sort_order from public.fund_templates where id = th.tid('General B')), 1, 'la primera de la lista queda en la posición 1');
select is((select priority from public.fund_templates where id = th.tid('Pareja')), 10, 'reordenar no cambia la prioridad financiera');
select throws_ok($$select public.reorder_templates('otro', array[]::uuid[])$$, 'GD010', null, 'rechaza un tipo de plantilla desconocido');
select lives_ok($$update public.fund_templates set group_name = 'Familia y pareja' where id = th.tid('Pareja')$$, 'asigna un grupo propio a una plantilla');
select is((select group_name from public.fund_templates where id = th.tid('Pareja')), 'Familia y pareja', 'el grupo se guarda');
select throws_ok($$update public.fund_templates set group_name = '' where id = th.tid('Pareja')$$, '23514', null, 'un grupo vacío no es válido');
select lives_ok($$update public.fund_templates set is_active = true where id = th.tid('Pareja')$$, 'reactiva la plantilla');
reset role;
insert into public.fund_template_scope_rules (household_id, template_id, ambito_id, effect) select household_id, th.tid('Pareja'), th.kid('amb:Familia'), 'include' from public.fund_templates where id = th.tid('Pareja');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((public.apply_fund_templates(th.pid('m2'), jsonb_build_array(jsonb_build_object('template_id', th.tid('Pareja'), 'amount', 210, 'priority', 3)))) #>> '{created,0,name}', 'Pareja', 'aplica con una prioridad propuesta confirmada');
select is((select priority from public.funds where period_id = th.pid('m2') and name = 'Pareja'), 3, 'el fondo del mes usa la prioridad confirmada');
select is((select priority from public.fund_templates where id = th.tid('Pareja')), 10, 'la plantilla conserva su prioridad');

-- ===================== Usuario B =====================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.fund_templates), 0, 'otro hogar no ve las plantillas');
select is((select count(*)::int from public.fund_template_scope_rules), 0, 'otro hogar no ve las reglas');
select throws_ok($$select public.apply_fund_templates(th.pid('m1'), th.items('General B'))$$, 'GD004', null, 'otro hogar no puede aplicar en un período ajeno');
select throws_ok($$select public.save_fund_template(th.plantilla('Con medio ajeno', null, 10, true, 1))$$, '23503', null, 'no se pueden referenciar medios de pago de otro hogar');
select is((select count(*)::int from (select public.save_fund_template('{"name":"B propia","is_general":true,"suggested_amount":10}'::jsonb)) x), 1, 'otro hogar crea las suyas');
select throws_ok($$select public.save_fund_template(jsonb_build_object('name', 'Robada', 'id', th.tid('General')))$$, 'GD004', null, 'otro hogar no puede editar plantillas ajenas');
select lives_ok($$delete from public.fund_templates where id = th.tid('General')$$, 'otro hogar intenta eliminar una plantilla ajena (no afecta a ninguna fila)');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((select count(*)::int from public.fund_templates where id = th.tid('General')), 1, 'la plantilla ajena sigue existiendo');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($$insert into public.fund_templates (household_id, name) values ((select household_id from public.profiles limit 1), 'directa')$$, '42501', null, 'las altas directas están cerradas: solo por la función validada');

select * from finish();
rollback;
