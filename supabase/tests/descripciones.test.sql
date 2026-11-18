begin;
select * from no_plan();
insert into auth.users(instance_id,id,aud,role,email) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','a@descripciones.test'),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','b@descripciones.test');

-- Fixtures aisladas y transaccionales: al finalizar no queda ningún dato de prueba.
insert into public.ambitos(household_id,name) select household_id,n from public.profiles cross join unnest(array['Personal','Familia']) n where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into public.categorias(household_id,ambito_id,name) select household_id,id,n from public.ambitos cross join unnest(array['Alimentación','Auto']) n where household_id in (select household_id from public.profiles where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
insert into public.subcategorias(household_id,categoria_id,name) select household_id,id,case name when 'Alimentación' then 'Bebidas' else 'Gas' end from public.categorias where household_id in (select household_id from public.profiles where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
insert into public.medios_pago(household_id,name) select household_id,n from public.profiles cross join unnest(array['Efectivo','Yape']) n where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
create schema sd;
grant usage, create on schema sd to authenticated;
create function sd.ctx(amb text default 'Personal',cat text default 'Alimentación',sub text default 'Bebidas') returns jsonb language sql stable as $$
  select jsonb_build_object('ambito_id',a.id,'categoria_id',c.id,'subcategoria_id',s.id)
  from public.ambitos a join public.categorias c on c.ambito_id=a.id left join public.subcategorias s on s.categoria_id=c.id and s.name=sub
  where a.household_id=public.current_household_id() and a.name=amb and c.name=cat;
$$;
create function sd.exp(texto text,amb text default 'Personal',cat text default 'Alimentación',sub text default 'Bebidas') returns jsonb language sql stable as $$
  select sd.ctx(amb,cat,sub)||jsonb_build_object('description',texto,'expense_date',current_date,'amount',1,'payment_method_id',(select id from public.medios_pago where household_id=public.current_household_id() and name='Efectivo'),'expense_type','variable','is_recurring',false);
$$;
create function sd.fctx(general boolean default true) returns jsonb language sql as $$ select jsonb_build_object('is_general',general,'scope_rules','[]'::jsonb,'payment_rules','[]'::jsonb) $$;
create function sd.sugs(busqueda text default '') returns table(description text,frequency bigint,last_used timestamptz) language sql as $$ select * from public.sugerencias_descripciones('expense',sd.ctx(),busqueda) $$;
grant execute on all functions in schema sd to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select is(public.normalizar_descripcion(E' \t ÁGUA   mineral \n'),'agua mineral','normalización de espacios y acentos');
select is(public.normalizar_descripcion(U&'Cafe\0301'),'cafe','normalización Unicode combinada');
select isnt(public.normalizar_descripcion('Año'),public.normalizar_descripcion('Ano'),'conserva ñ como letra distinta');
select is((select count(*)::int from sd.sugs()),0,'sin historial no hay sugerencias');
select is((select count(*)::int from public.description_shared_contexts),2,'solo se leen asociaciones del hogar propio');
select throws_ok($$insert into public.description_shared_contexts values(public.current_household_id(),gen_random_uuid(),'arbitrario')$$,'42501',null,'el cliente no puede cambiar grupos compartidos');
select public.save_fund(sd.fctx()||jsonb_build_object('name','General prueba','description','Presupuesto general','period_id',(public.ensure_period_rpc(current_date)).id,'default_amount',1000,'period_amount',1000));
select public.create_expense(sd.exp('Gaseosa'),'10000000-0000-0000-0000-000000000001');
select public.create_expense(sd.exp('  GASEOSA  ','Familia'),'10000000-0000-0000-0000-000000000002');
select public.create_expense(sd.exp('Gaseosa'),'10000000-0000-0000-0000-000000000001');
select is((select frequency from sd.sugs() where public.normalizar_descripcion(description)='gaseosa'),2::bigint,'comparte entre ámbitos, agrupa mayúsculas y no duplica reintentos');
select is((select frequency from public.sugerencias_descripciones('expense',sd.ctx('Familia'))),2::bigint,'el contexto compartido ve el mismo total');
select is((select count(*)::int from public.sugerencias_descripciones('expense',sd.ctx('Personal','Auto','Gas'))),0,'no mezcla clasificaciones distintas');
select public.create_expense(sd.exp('Gasolina','Personal','Auto','Gas'),gen_random_uuid());
select is((select count(*)::int from public.sugerencias_descripciones('expense',sd.ctx('Familia','Auto','Gas'))),0,'Auto Gas permanece aislado por ámbito');
select public.update_expense((select id from public.expenses where description='Gaseosa' limit 1),sd.exp('Agua mineral'));
select is((select frequency from sd.sugs() where public.normalizar_descripcion(description)='gaseosa'),1::bigint,'editar resta la descripción anterior');
select is((select frequency from sd.sugs() where description='Agua mineral'),1::bigint,'editar incorpora la nueva sin duplicar');
select public.annul_expenses(array[(select id from public.expenses where description='Agua mineral')]);
select is((select count(*)::int from sd.sugs('agua')),0,'anular excluye del historial');
select public.restore_expenses(array[(select id from public.expenses where description='Agua mineral')]);
select is((select frequency from sd.sugs('AGÚA')),1::bigint,'restaurar y buscar ignora acentos y mayúsculas');
select throws_ok($$select public.create_expense(sd.exp('No debe contar')||'{"amount":-1}'::jsonb,gen_random_uuid())$$,'23514',null,'un guardado inválido falla');
select is((select count(*)::int from sd.sugs('No debe contar')),0,'un guardado fallido no cuenta');
insert into public.expense_templates(household_id,name,description,ambito_id,categoria_id,subcategoria_id,expense_type,default_amount)
  select public.current_household_id(),'Plantilla prueba','Solo plantilla',(sd.ctx()->>'ambito_id')::uuid,(sd.ctx()->>'categoria_id')::uuid,(sd.ctx()->>'subcategoria_id')::uuid,'variable',1;
select is((select count(*)::int from sd.sugs('Solo plantilla')),0,'guardar una plantilla no cuenta como gasto');
select public.create_expense(sd.exp('Água mineral'),gen_random_uuid());
select is((select frequency from sd.sugs('agua')),2::bigint,'clonar o crear realmente otro movimiento aumenta el conteo');
select is((select public.normalizar_descripcion(description) from sd.sugs() limit 1),'agua mineral','ordena primero por frecuencia');
select public.create_expense(sd.exp('Opción '||n),gen_random_uuid()) from generate_series(1,12) n;
select is((select count(*)::int from sd.sugs()),10,'la respuesta está limitada a diez');
select is((select count(*)::int from sd.sugs('Opción 12')),1,'la búsqueda encuentra opciones fuera del top inicial');
select is((select count(*)::int from public.sugerencias_descripciones('expense',sd.ctx()||jsonb_build_object('ambito_id',gen_random_uuid()))),0,'rechaza jerarquía inconsistente');
select is((select count(*)::int from public.sugerencias_descripciones('expense',sd.ctx('Personal','Alimentación',null))),0,'sin subcategoría solo usa registros sin subcategoría');

-- Coberturas semánticamente equivalentes, con reglas redundantes y distinto orden.
create function sd.scope() returns jsonb language sql as $$ select jsonb_build_array(jsonb_build_object('kind','ambito','ref',sd.ctx()->>'ambito_id','effect','include')) $$;
create function sd.redundant() returns jsonb language sql as $$ select sd.scope()||jsonb_build_array(jsonb_build_object('kind','categoria','ref',sd.ctx()->>'categoria_id','effect','include')) $$;
create function sd.fc(s jsonb,p jsonb default '[]') returns jsonb language sql as $$ select jsonb_build_object('is_general',false,'scope_rules',s,'payment_rules',p) $$;
select is(public.firma_cobertura_descripcion(false,sd.scope(),'[]'),public.firma_cobertura_descripcion(false,sd.redundant(),'[]'),'reglas redundantes conservan cobertura efectiva');
select isnt(public.firma_cobertura_descripcion(false,sd.scope(),'[]'),public.firma_cobertura_descripcion(true,'[]','[]'),'coberturas distintas no son equivalentes');
select is(public.firma_cobertura_descripcion(false,'[]','[]'),null::jsonb,'cobertura específica incompleta no tiene firma');
select is(public.firma_cobertura_descripcion(true,null,'[]'),null::jsonb,'no acepta reglas desconocidas');
select is(public.firma_cobertura_descripcion(false,'[{"kind":"desconocido","effect":"include","ref":"x"}]','[]'),null::jsonb,'rechaza tipos de regla desconocidos');
select public.save_fund(sd.fc(sd.scope())||jsonb_build_object('name','Personal uno','description','Gastos básicos','period_id',(public.ensure_period_rpc(current_date)).id,'default_amount',50,'period_amount',50));
select public.save_fund(sd.fc(sd.redundant())||jsonb_build_object('name','Personal dos','description','GASTOS BÁSICOS','period_id',(public.ensure_period_rpc(current_date)).id,'default_amount',50,'period_amount',50));
select is((select frequency from public.sugerencias_descripciones('fund',sd.fc(sd.scope()))),2::bigint,'fondos equivalentes agrupan su historial propio');
select is((select count(*)::int from public.sugerencias_descripciones('fund',sd.fc(sd.scope()),'Gaseosa')),0,'fondos no usan descripciones de gastos');
select is((select count(*)::int from public.sugerencias_descripciones('fund',sd.fc(sd.scope(),jsonb_build_array(jsonb_build_object('method',(select id from public.medios_pago where name='Yape'),'effect','include'))))),0,'distintos medios no mezclan fondos');
select public.save_fund_template(sd.fc(sd.scope())||'{"name":"Plantilla fondo","description":"No es fondo real","suggested_amount":10}'::jsonb);
select is((select count(*)::int from public.sugerencias_descripciones('fund',sd.fc(sd.scope()),'No es fondo real')),0,'guardar plantilla de fondo no incrementa historial');
select is((select count(*)::int from public.sugerencias_descripciones('fund',sd.fc('[]'))),0,'formulario de fondo incompleto no muestra chips');
select public.save_fund(sd.fc(sd.scope())||jsonb_build_object('id',(select id from public.funds where name='Personal uno'),
  'name','Personal uno','description','Fondo editado','default_amount',50));
select is((select frequency from public.sugerencias_descripciones('fund',sd.fc(sd.scope()),'Gastos básicos')),1::bigint,'editar fondo resta la descripción anterior');
select is((select frequency from public.sugerencias_descripciones('fund',sd.fc(sd.scope()),'Fondo editado')),1::bigint,'editar fondo incorpora la descripción nueva');
select public.delete_fund((select id from public.funds where name='Personal dos'),(select id from public.funds where name='General prueba'),false);
select is((select count(*)::int from public.sugerencias_descripciones('fund',sd.fc(sd.scope()),'Gastos básicos')),0,'eliminar un fondo resta su uso');
select public.save_fund(sd.fc(sd.scope())||jsonb_build_object('id',(select id from public.funds where name='Personal uno'),
  'name','Personal uno','description','Fondo editado','default_amount',50,'is_active',false));
select is((select count(*)::int from public.sugerencias_descripciones('fund',sd.fc(sd.scope()),'Fondo editado')),0,'fondos inactivos no aportan sugerencias');
select ok(not has_function_privilege('authenticated','public.sincronizar_contexto_descripcion()','EXECUTE'),'el trigger interno no es ejecutable por el cliente');
select ok(not has_function_privilege('authenticated','public.grupo_descripcion_inicial(text,text)','EXECUTE'),'la configuración inicial no es una RPC pública');

-- Aislamiento: mismo catálogo, pero ningún movimiento del otro usuario.
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}',true);
select is((select count(*)::int from sd.sugs()),0,'B no ve las descripciones de A');
select is((select count(*)::int from public.sugerencias_descripciones('fund',sd.fctx())),0,'B no ve fondos de A');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select is((select count(*)::int from sd.sugs()),0,'sin identidad no devuelve historial');
reset role;
select ok(not has_function_privilege('anon','public.sugerencias_descripciones(text,jsonb,text)','EXECUTE'),'anon no puede ejecutar sugerencias');
select * from finish();
rollback;
