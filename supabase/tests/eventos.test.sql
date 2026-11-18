begin;
select * from no_plan();
insert into auth.users(instance_id,id,aud,role,email) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','a@eventos.test'),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','b@eventos.test');
select public.bootstrap_catalog(household_id) from public.profiles where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
create schema et;
grant usage on schema et to authenticated;
create table et.ids(k text primary key,id uuid);
grant all on et.ids to authenticated;
create function et.id(k text) returns uuid language sql stable as $$ select id from et.ids i where i.k=$1 $$;
create function et.exp(texto text,importe numeric,mes integer default 0) returns jsonb language sql stable as $$
  select jsonb_build_object('description',texto,'amount',importe,'expense_date',(current_date+make_interval(months=>mes))::date,
    'ambito_id',a.id,'categoria_id',c.id,'subcategoria_id',s.id,'payment_method_id',(select id from public.medios_pago where household_id=public.current_household_id() and name='Efectivo'),'expense_type','variable','is_recurring',false)
  from public.ambitos a join public.categorias c on c.ambito_id=a.id join public.subcategorias s on s.categoria_id=c.id
  where a.household_id=public.current_household_id() and a.name='Personal' and c.name='Alimentación' and s.name='Bebidas';
$$;
grant execute on all functions in schema et to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select public.save_fund(jsonb_build_object('name','General eventos','description','General','is_general',true,'default_amount',10000,'period_id',(public.ensure_period_rpc((current_date+make_interval(months=>n))::date)).id,'period_amount',10000,'scope_rules','[]'::jsonb,'payment_rules','[]'::jsonb)) from generate_series(0,2) n;
with e as (insert into public.events(household_id,user_id,name,target_date,budget) values(public.current_household_id(),auth.uid(),'Cumpleaños',current_date+60,500) returning id) insert into et.ids select 'evento',id from e;
with e as (insert into public.events(household_id,user_id,name,target_date,budget) values(public.current_household_id(),auth.uid(),'Viaje',current_date+90,2000) returning id) insert into et.ids select 'otro',id from e;
select is((select budget from public.event_metrics where id=et.id('evento')),500::numeric,'crea un presupuesto de referencia persistido');
select is((select paid from public.event_metrics where id=et.id('evento')),0::numeric,'evento nuevo no tiene gastos ficticios');
select throws_ok($$insert into public.events(household_id,user_id,name,target_date,budget) values(public.current_household_id(),auth.uid(),'Negativo',current_date,-1)$$,'23514',null,'presupuesto no negativo');
select throws_ok($$insert into public.events(household_id,user_id,name,target_date,currency) values(public.current_household_id(),auth.uid(),'USD',current_date,'USD')$$,'23514',null,'no consolida monedas que la aplicación no soporta');
select throws_ok($$update public.events set is_template=true where id=et.id('evento')$$,'EV001',null,'convertir a plantilla requiere una copia sin movimientos');
insert into et.ids select 'existente',(public.create_expense(et.exp('Existente',100),gen_random_uuid())->>'expense_id')::uuid;
create temp table allocations_snapshot as select * from public.expense_fund_allocations;
select is(public.link_event_expenses(array[et.id('existente')],et.id('evento')),1,'asocia un gasto existente');
select is((select paid from public.event_metrics where id=et.id('evento')),100::numeric,'el evento suma el gasto existente');
select results_eq('select fund_id,amount from public.expense_fund_allocations order by fund_id','select fund_id,amount from allocations_snapshot order by fund_id','asociar no vuelve a descontar fondos');
select is(public.link_event_expenses(array[et.id('existente'),et.id('existente')],et.id('evento')),1,'asociaciones repetidas no duplican movimientos');
select is((select expense_count from public.event_metrics where id=et.id('evento')),1::bigint,'cuenta una vez el gasto');
select throws_ok($$select public.link_event_expenses(array[et.id('existente')],et.id('otro'))$$,'EV003',null,'mover a otro evento exige confirmación explícita');
select is(public.link_event_expenses(array[et.id('existente')],et.id('otro'),null,null,true),1,'permite traslado explícito');
select is((select paid from public.event_metrics where id=et.id('evento')),0::numeric,'el evento anterior deja de contar el gasto');
select public.link_event_expenses(array[et.id('existente')],null);
select is((select count(*)::int from public.expenses where id=et.id('existente')),1,'desvincular conserva el gasto financiero');
select results_eq('select fund_id,amount from public.expense_fund_allocations order by fund_id','select fund_id,amount from allocations_snapshot order by fund_id','desvincular tampoco modifica imputaciones');

with i as (insert into public.event_items(event_id,household_id,name,planned_amount) values(et.id('evento'),public.current_household_id(),'Fotografía',900) returning id) insert into et.ids select 'concepto',id from i;
with c as (insert into public.event_commitments(event_id,household_id,event_item_id,name,contracted_amount) values(et.id('evento'),public.current_household_id(),et.id('concepto'),'Contrato fotos',900) returning id) insert into et.ids select 'contrato',id from c;
select is((select pending from public.event_metrics where id=et.id('evento')),900::numeric,'compromiso sin pagar solo genera pendiente');
select results_eq('select fund_id,amount from public.expense_fund_allocations order by fund_id','select fund_id,amount from allocations_snapshot order by fund_id','crear compromiso no consume fondos');
insert into et.ids select 'pago1',(public.save_expense_event(et.exp('Adelanto',300)||jsonb_build_object('event_id',et.id('evento'),'event_commitment_id',et.id('contrato')), '10000000-0000-0000-0000-000000000001')->>'expense_id')::uuid;
select is((select paid from public.event_metrics where id=et.id('evento')),300::numeric,'adelanto pagado cuenta como gasto real');
select is((select pending from public.event_metrics where id=et.id('evento')),600::numeric,'900 contratado menos 300 pagado son 600 pendientes');
select is((select projected from public.event_metrics where id=et.id('evento')),900::numeric,'no suma contrato completo más adelanto');
select is((select event_item_id from public.expenses where id=et.id('pago1')),et.id('concepto'),'el pago hereda el concepto del compromiso');
select public.link_event_expenses(array[et.id('pago1')],et.id('evento'));
select is((select event_commitment_id from public.expenses where id=et.id('pago1')),et.id('contrato'),'repetir asociación a un evento conserva el compromiso del pago');
with c as (insert into public.event_commitments(event_id,household_id,name,contracted_amount) values(et.id('evento'),public.current_household_id(),'Contrato alternativo',0) returning id) insert into et.ids select 'alterno',id from c;
select throws_ok($$select public.link_event_expenses(array[et.id('pago1')],et.id('evento'),null,et.id('alterno'))$$,'EV003',null,'trasladar un pago a otro contrato exige confirmación explícita');
select is(public.link_event_expenses(array[et.id('pago1')],et.id('evento'),null,et.id('alterno'),true),1,'permite traslado explícito de un pago');
select is((select pending from public.event_commitment_metrics where id=et.id('contrato')),900::numeric,'el contrato anterior recupera su pendiente al trasladar el pago');
select public.link_event_expenses(array[et.id('pago1')],et.id('evento'),et.id('concepto'),et.id('contrato'),true);
update public.event_commitments set cancelled_at=now() where id=et.id('alterno');
select public.save_expense_event(et.exp('Reintento',999)||jsonb_build_object('event_id',et.id('otro')),'10000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.expenses where event_id=et.id('evento')),1,'reintento de creación no duplica ni mueve el pago');
select is((select paid from public.event_metrics where id=et.id('evento')),300::numeric,'reintento no cambia importes');
insert into et.ids select 'pago2',(public.save_expense_event(et.exp('Segundo adelanto',200)||jsonb_build_object('event_id',et.id('evento'),'event_commitment_id',et.id('contrato')),gen_random_uuid())->>'expense_id')::uuid;
select is((select paid from public.event_metrics where id=et.id('evento')),500::numeric,'dos pagos suman 500');
select is((select pending from public.event_metrics where id=et.id('evento')),400::numeric,'pendiente tras dos pagos es 400');
select is((select payment_status from public.event_commitment_metrics where id=et.id('contrato')),'partial','estado parcialmente pagado derivado');
select public.save_expense_event(et.exp('Adelanto editado',350)||jsonb_build_object('event_id',et.id('evento'),'event_commitment_id',et.id('contrato')),null,et.id('pago1'));
select is((select paid from public.event_metrics where id=et.id('evento')),550::numeric,'editar importe suma solo la diferencia');
select public.annul_expenses(array[et.id('pago2')]);
select is((select paid from public.event_metrics where id=et.id('evento')),350::numeric,'anular excluye del pagado');
select is((select pending from public.event_commitment_metrics where id=et.id('contrato')),550::numeric,'anular reabre el saldo pendiente del compromiso');
select public.restore_expenses(array[et.id('pago2')]);
select is((select paid from public.event_metrics where id=et.id('evento')),550::numeric,'restaurar recupera el total');
select throws_ok($$select public.save_expense_event(et.exp('Asociación inválida',50)||jsonb_build_object('event_id',gen_random_uuid()),gen_random_uuid())$$,'EV001',null,'asociación inválida aborta el guardado');
select is((select count(*)::int from public.expenses where description='Asociación inválida'),0,'no quedan gastos ni cargos parciales cuando falla la asociación');
update public.event_commitments set contracted_amount=500 where id=et.id('contrato');
select is((select overpaid from public.event_commitment_metrics where id=et.id('contrato')),50::numeric,'muestra excedente de pagos sin esconderlo');
select is((select pending from public.event_commitment_metrics where id=et.id('contrato')),0::numeric,'el pendiente nunca es negativo');
select is((select paid_percent from public.event_metrics where id=et.id('evento')),110::numeric,'el porcentaje no se trunca al 100');
select is((select projected_available from public.event_metrics where id=et.id('evento')),-50::numeric,'disponible negativo sobre presupuesto');
update public.events set budget=0 where id=et.id('evento');
select is((select paid_percent from public.event_metrics where id=et.id('evento')),null::numeric,'presupuesto cero no divide ni fabrica porcentajes');
update public.events set budget=500 where id=et.id('evento');
with i as (insert into public.event_items(event_id,household_id,name,planned_amount) values(et.id('evento'),public.current_household_id(),'Servicios',100) returning id) insert into et.ids select 'concepto2',id from i;
update public.event_commitments set event_item_id=et.id('concepto2') where id=et.id('contrato');
select is((select event_item_id from public.expenses where id=et.id('pago1')),et.id('concepto2'),'cambiar concepto del contrato reagrupa sus pagos sin duplicarlos');
delete from public.event_items where id=et.id('concepto2');
select is((select event_item_id from public.expenses where id=et.id('pago1')),null::uuid,'eliminar concepto conserva pagos sin concepto');
select is((select paid from public.event_metrics where id=et.id('evento')),550::numeric,'eliminar concepto no elimina gastos');
update public.event_commitments set cancelled_at=now() where id=et.id('contrato');
select is((select pending from public.event_commitment_metrics where id=et.id('contrato')),0::numeric,'cancelar contrato no deja pendiente artificial');
select is((select paid from public.event_metrics where id=et.id('evento')),550::numeric,'cancelar contrato conserva pagos');
update public.event_commitments set cancelled_at=null where id=et.id('contrato');

-- Multimes: cada gasto mantiene su fecha y los fondos del período correspondiente.
select public.save_expense_event(et.exp('Mes siguiente',25,1)||jsonb_build_object('event_id',et.id('evento')),gen_random_uuid());
select public.save_expense_event(et.exp('Dos meses después',25,2)||jsonb_build_object('event_id',et.id('evento')),gen_random_uuid());
select is((select paid from public.event_metrics where id=et.id('evento')),600::numeric,'agrega pagos de varios meses');
select is((select count(distinct date_trunc('month',expense_date))::int from public.expenses where event_id=et.id('evento')),3,'mantiene tres períodos originales');
select is((select sum(amount) from public.event_analytics(et.id('evento')) where dimension='mes'),600::numeric,'análisis mensual usa todos los gastos');
select is((select sum(amount) from public.event_analytics(et.id('evento')) where dimension='categoria'),600::numeric,'análisis por clasificación no duplica gastos');

-- Plantillas y copias: solo configuración, estimaciones y contratos sin pagos.
insert into et.ids select 'plantilla',public.clone_event(et.id('evento'),'{"name":"Plantilla cumpleaños","is_template":true}', '20000000-0000-0000-0000-000000000001');
select is((select paid from public.event_metrics where id=et.id('plantilla')),0::numeric,'plantilla no copia gastos reales');
select is((select count(*)::int from public.event_items where event_id=et.id('plantilla')),1,'plantilla copia conceptos');
select is((select paid from public.event_commitment_metrics where event_id=et.id('plantilla')),0::numeric,'plantilla copia compromisos sin pagos');
insert into et.ids select 'desdeplantilla',public.clone_event(et.id('plantilla'),jsonb_build_object('name','Nuevo cumpleaños','is_template',false,'target_date',current_date+100,'budget',1200),'20000000-0000-0000-0000-000000000002');
select is((select budget from public.event_metrics where id=et.id('desdeplantilla')),1200::numeric,'crear desde plantilla permite adaptar presupuesto');
select is((select paid from public.event_metrics where id=et.id('desdeplantilla')),0::numeric,'crear desde plantilla no crea movimientos');
select is(public.clone_event(et.id('plantilla'),jsonb_build_object('name','No duplicar','target_date',current_date+100),'20000000-0000-0000-0000-000000000002'),et.id('desdeplantilla'),'copiar es idempotente con la misma clave');
select throws_ok($$select public.link_event_expenses(array[et.id('existente')],et.id('plantilla'))$$,'EV001',null,'las plantillas no reciben gastos reales');

-- Una plantilla de gasto puede sugerir un evento; el alta por lote hereda solo uno vigente.
with t as (insert into public.expense_templates(household_id,name,description,ambito_id,categoria_id,subcategoria_id,payment_method_id,default_amount,expense_type,event_id)
 select public.current_household_id(),'Plantilla mensual evento','Gasto plantilla evento',(et.exp('',1)->>'ambito_id')::uuid,(et.exp('',1)->>'categoria_id')::uuid,(et.exp('',1)->>'subcategoria_id')::uuid,(et.exp('',1)->>'payment_method_id')::uuid,10,'fixed',et.id('otro') returning id) insert into et.ids select 'plantillagasto',id from t;
select public.apply_template_batch(current_date,jsonb_build_array(jsonb_build_object('template_id',et.id('plantillagasto'),'outcome','include')),gen_random_uuid());
select is((select event_id from public.expenses where template_id=et.id('plantillagasto')),et.id('otro'),'lote mensual hereda el evento vigente de la plantilla');
update public.events set status='cancelled' where id=et.id('otro');
select public.create_expense(et.exp('Desde plantilla cancelada',10)||jsonb_build_object('template_id',et.id('plantillagasto')),gen_random_uuid());
select is((select event_id from public.expenses where description='Desde plantilla cancelada'),null::uuid,'un evento cancelado se omite al usar plantillas antiguas');
select is((select count(*)::int from public.expenses where event_id=et.id('otro')),1,'cancelar evento conserva gastos previos');
select throws_ok($$select public.link_event_expenses(array[et.id('existente')],et.id('otro'))$$,'EV002',null,'evento cancelado no recibe gastos nuevos');
update public.events set status='completed' where id=et.id('evento');
select throws_ok($$select public.link_event_expenses(array[et.id('existente')],et.id('evento'))$$,'EV002',null,'evento finalizado no recibe asociaciones nuevas');
select is((select paid from public.event_metrics where id=et.id('evento')),600::numeric,'finalizar conserva métricas históricas');
update public.events set archived_at=now() where id=et.id('evento');
select is((select count(*)::int from public.expenses where event_id=et.id('evento')),4,'archivar conserva los gastos');
select throws_ok($$delete from public.events where id=et.id('evento')$$,'42501',null,'API no permite borrar permanentemente eventos e historial');
update public.events set archived_at=null,status='planned' where id=et.id('evento');
select public.save_fund(jsonb_build_object('name','General histórico','is_general',true,'default_amount',1000,'period_id',(public.ensure_period_rpc((current_date-interval '1 month')::date)).id,'period_amount',1000,'scope_rules','[]'::jsonb,'payment_rules','[]'::jsonb));
insert into et.ids select 'historico',(public.save_expense_event(et.exp('Mes anterior cerrado',25,-1)||jsonb_build_object('event_id',et.id('evento')),gen_random_uuid())->>'expense_id')::uuid;
select public.close_period((public.ensure_period_rpc((current_date-interval '1 month')::date)).id);
select is((select paid from public.event_metrics where id=et.id('evento')),625::numeric,'muestra gastos de períodos cerrados');
select lives_ok($$select public.link_event_expenses(array[et.id('historico')],null)$$,'desvinculación analítica permitida sin reabrir el período');
select throws_ok($$select public.save_expense_event(et.exp('No se puede editar',999),null,et.id('historico'))$$,'GD002',null,'editar importes sigue prohibido en períodos cerrados');

-- Seguridad entre cuentas, tanto en lecturas como asociaciones y pagos.
reset role;
select throws_ok($$update public.expenses set currency='USD' where id=et.id('existente')$$,'23514',null,'el modelo vigente rechaza USD antes de poder consolidarlo con eventos PEN');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}',true);
select is((select count(*)::int from public.events),0,'B no ve los eventos de A');
select is((select count(*)::int from public.event_metrics),0,'B no ve métricas de A');
select is((select count(*)::int from public.event_commitment_metrics),0,'B no ve contratos de A');
select is((select count(*)::int from public.event_analytics(et.id('evento'))),0,'B no ve análisis de A');
select throws_ok($$select public.link_event_expenses(array[et.id('pago2')],null)$$,'EV001',null,'B no puede desvincular gastos de A');
select throws_ok($$select public.clone_event(et.id('evento'),'{"is_template":true}',gen_random_uuid())$$,'EV001',null,'B no puede clonar eventos de A');
select throws_ok($$insert into public.event_items(event_id,household_id,name) values(et.id('evento'),public.current_household_id(),'Intruso')$$,'42501',null,'RLS rechaza conceptos sobre eventos ajenos');
reset role;
select ok(not has_function_privilege('anon','public.save_expense_event(jsonb,uuid,uuid)','execute'),'anon no guarda gastos con eventos');
select ok(not has_function_privilege('anon','public.link_event_expenses(uuid[],uuid,uuid,uuid,boolean)','execute'),'anon no vincula gastos');
select ok(not has_function_privilege('authenticated','public.validate_expense_event()','execute'),'trigger de validación no expuesto al cliente');
select ok(not has_function_privilege('authenticated','public.sync_commitment_item()','execute'),'trigger de sincronización no expuesto al cliente');
select lives_ok($$delete from auth.users where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,'conserva el comportamiento administrativo de baja de cuenta y limpieza de pruebas');
select is((select count(*)::int from public.events where user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),0,'la baja de cuenta no deja eventos huérfanos');
select * from finish();
rollback;
