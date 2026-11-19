begin;
select * from no_plan();
-- Multimoneda USD/PEN: doble representación (original + contable PEN congelado) con el motor de fondos intacto.
insert into auth.users(instance_id,id,aud,role,email) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','a@multimoneda.test'),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','b@multimoneda.test');
select public.bootstrap_catalog(household_id) from public.profiles where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
create schema mm;
grant usage on schema mm to authenticated;
create table mm.ids(k text primary key,id uuid);
grant all on mm.ids to authenticated;
create function mm.id(k text) returns uuid language sql stable as $$ select id from mm.ids i where i.k=$1 $$;
-- Gasto base en PEN; `extra` sobrescribe campos (moneda, tasa, método, importe…).
create function mm.exp(texto text,importe numeric,extra jsonb default '{}') returns jsonb language sql stable as $$
  select jsonb_build_object('description',texto,'amount',importe,'expense_date',current_date,
    'ambito_id',a.id,'categoria_id',c.id,'subcategoria_id',s.id,'payment_method_id',(select id from public.medios_pago where household_id=public.current_household_id() and name='Efectivo'),'expense_type','variable','is_recurring',false)||extra
  from public.ambitos a join public.categorias c on c.ambito_id=a.id join public.subcategorias s on s.categoria_id=c.id
  where a.household_id=public.current_household_id() and a.name='Personal' and c.name='Alimentación' and s.name='Bebidas';
$$;
grant execute on all functions in schema mm to authenticated;
-- Cotización verificada que la función de borde habría guardado (tasa de hace dos días: fin de semana o feriado).
insert into public.exchange_rate_quotes(date_requested,rate,reference_date,source,fetched_at) values (current_date,3.4500,current_date-2,'BCRP:PD04640PD',now())
  on conflict (date_requested) do update set rate=excluded.rate, reference_date=excluded.reference_date, source=excluded.source, fetched_at=excluded.fetched_at;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select public.save_fund(jsonb_build_object('name','General','description','General','is_general',true,'default_amount',500,'period_id',(public.ensure_period_rpc(current_date)).id,'period_amount',500,'scope_rules','[]'::jsonb,'payment_rules','[]'::jsonb));
-- Los fondos PEN no cubren gastos en dólares salvo que se autorice: aquí el General lo permite para probar el descuento en soles.
reset role;
update public.funds set allow_cross_currency = true where is_general and household_id = (select household_id from public.profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);

-- 1. PEN conserva el comportamiento anterior: identidad sin conversión.
insert into mm.ids select 'pen',(public.create_expense(mm.exp('Pan',100),gen_random_uuid())->>'expense_id')::uuid;
select results_eq($$select original_currency,original_amount,amount,exchange_rate,conversion_method,exchange_rate_source from public.expenses where id=mm.id('pen')$$,
  $$ values ('PEN'::text,100.00::numeric,100.00::numeric,1::numeric,'none'::text,'identity'::text)$$,'gasto PEN: importe original = contable, tasa 1, sin conversión');
select is((select exchange_rate_reference_date from public.expenses where id=mm.id('pen')),current_date,'PEN: la fecha de referencia es la del gasto');

-- 2. Caso B: tasa personalizada. US$ 20.00 × 3.52 = S/ 70.40
insert into mm.ids select 'manual',(public.create_expense(mm.exp('Suscripción',0,jsonb_build_object('original_currency','USD','original_amount',20.00,'conversion_method','manual','exchange_rate',3.52,'exchange_rate_source','Usuario','exchange_rate_reference_date',current_date)),gen_random_uuid())->>'expense_id')::uuid;
select results_eq($$select original_currency,original_amount,amount,exchange_rate,conversion_method from public.expenses where id=mm.id('manual')$$,
  $$ values ('USD'::text,20.00::numeric,70.40::numeric,3.52::numeric,'manual'::text)$$,'tasa personalizada: US$ 20 × 3.52 = S/ 70.40');

-- 3. Caso C: cargo exacto. US$ 10.00 con cargo S/ 35.80 → tasa efectiva 3.58 y el importe contable es el cargo.
insert into mm.ids select 'exacto',(public.create_expense(mm.exp('Hosting',35.80,jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','exact','exchange_rate_source','Usuario','exchange_rate_reference_date',current_date)),gen_random_uuid())->>'expense_id')::uuid;
select results_eq($$select original_amount,amount,exchange_rate,conversion_method from public.expenses where id=mm.id('exacto')$$,
  $$ values (10.00::numeric,35.80::numeric,3.580000000000::numeric,'exact'::text)$$,'cargo exacto: S/ 35.80 y tasa efectiva 3.58');

-- 4. Automático: solo con una cotización verificada de esa fecha (caso A: US$ 10 × 3.45 = S/ 34.50).
select is((public.create_expense(mm.exp('IA',0,jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','automatic','exchange_rate',3.45,'exchange_rate_source','BCRP:PD04640PD','exchange_rate_reference_date',current_date-2,'exchange_rate_fetched_at',now())),'20000000-0000-0000-0000-000000000001')->>'replayed')::boolean,false,'cotización automática verificada se acepta');
select is((select amount from public.expenses where description='IA'),34.50::numeric,'caso A: US$ 10 × 3.45 = S/ 34.50');
select is((select exchange_rate_reference_date from public.expenses where description='IA'),current_date-2,'conserva la fecha real de la cotización usada');
select throws_ok($$select public.create_expense(mm.exp('Falsa',0,jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','automatic','exchange_rate',2.00,'exchange_rate_source','BCRP:PD04640PD','exchange_rate_reference_date',current_date-2,'exchange_rate_fetched_at',now())),gen_random_uuid())$$,'GD010',null,'una tasa «automática» inventada por el cliente se rechaza');
select throws_ok($$select public.create_expense(mm.exp('Futura',0,jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','automatic','exchange_rate',3.45,'exchange_rate_source','BCRP:PD04640PD','exchange_rate_reference_date',current_date+1,'exchange_rate_fetched_at',now())),gen_random_uuid())$$,'GD010',null,'una cotización posterior al gasto no es válida');
select is((public.create_expense(mm.exp('IA',0,jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','automatic','exchange_rate',3.45,'exchange_rate_source','BCRP:PD04640PD','exchange_rate_reference_date',current_date-2,'exchange_rate_fetched_at',now())),'20000000-0000-0000-0000-000000000001')->>'replayed')::boolean,true,'repetir la solicitud es idempotente');
select is((select count(*)::int from public.expenses where description='IA'),1,'no duplica el movimiento al reintentar');

-- 5. Nunca se asume 1:1 ni se admiten monedas o importes inválidos.
select throws_ok($$select public.create_expense(mm.exp('Sin tasa',10,jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','manual','exchange_rate_source','Usuario','exchange_rate_reference_date',current_date)),gen_random_uuid())$$,'GD010',null,'USD sin tipo de cambio no se guarda como 1:1');
select throws_ok($$select public.create_expense(mm.exp('Euro',10,jsonb_build_object('original_currency','EUR','original_amount',10.00)),gen_random_uuid())$$,'GD010',null,'moneda no soportada');
select throws_ok($$select public.create_expense(mm.exp('Cero',0,jsonb_build_object('original_currency','USD','original_amount',0,'conversion_method','manual','exchange_rate',3.5,'exchange_rate_source','Usuario','exchange_rate_reference_date',current_date)),gen_random_uuid())$$,'GD010',null,'importe USD cero');
select throws_ok($$select public.create_expense(mm.exp('Tasa cero',0,jsonb_build_object('original_currency','USD','original_amount',5,'conversion_method','manual','exchange_rate',0,'exchange_rate_source','Usuario','exchange_rate_reference_date',current_date)),gen_random_uuid())$$,'GD010',null,'tasa cero');
select throws_ok($$select public.create_expense(mm.exp('Sin fuente',0,jsonb_build_object('original_currency','USD','original_amount',5,'conversion_method','manual','exchange_rate',3.5,'exchange_rate_reference_date',current_date)),gen_random_uuid())$$,'GD010',null,'una conversión sin fuente no es trazable');
select throws_ok($$select public.create_expense(mm.exp('Decimales',0,jsonb_build_object('original_currency','USD','original_amount',5.005,'conversion_method','manual','exchange_rate',3.5,'exchange_rate_source','Usuario','exchange_rate_reference_date',current_date)),gen_random_uuid())$$,'GD010',null,'importe USD con más de dos decimales');
select is((select count(*)::int from public.expenses where description in ('Sin tasa','Euro','Cero','Tasa cero','Sin fuente','Decimales','Falsa','Futura')),0,'ninguna conversión inválida deja rastro');
-- Un cliente PEN no puede declarar una tasa distinta de 1.
insert into mm.ids select 'pen-tasa',(public.create_expense(mm.exp('PEN con tasa',50,jsonb_build_object('exchange_rate',9.99,'original_amount',1,'conversion_method','manual')),gen_random_uuid())->>'expense_id')::uuid;
select results_eq($$select original_amount,amount,exchange_rate,conversion_method from public.expenses where id=mm.id('pen-tasa')$$,$$ values (50.00::numeric,50.00::numeric,1::numeric,'none'::text)$$,'un gasto PEN ignora tasas y métodos enviados por el cliente');

-- 6. Fondos: se descuenta el equivalente en PEN, una sola vez (caso E). 100 + 70.40 + 35.80 + 34.50 + 50 = 290.70 sobre S/ 500.
select is((select coalesce(sum(a.amount),0) from public.expense_fund_allocations a join public.expenses e on e.id=a.expense_id where e.id=mm.id('manual')),70.40::numeric,'el fondo descuenta S/ 70.40 y no US$ 20');
select is((select coalesce(sum(a.amount),0) from public.expense_fund_allocations a),290.70::numeric,'las imputaciones suman los importes contables en PEN');
select is((select sum(e.amount) from public.expenses e where e.status='active'),290.70::numeric,'el total de gastos es el mismo en PEN');

-- 7. Edición: la conversión congelada se conserva.
select public.update_expense(mm.id('manual'),jsonb_build_object('description','Suscripción IA'));
select results_eq($$select description,original_amount,amount,exchange_rate,conversion_method from public.expenses where id=mm.id('manual')$$,$$ values ('Suscripción IA'::text,20.00::numeric,70.40::numeric,3.52::numeric,'manual'::text)$$,'editar la descripción no toca la conversión');
select public.update_expense(mm.id('manual'),jsonb_build_object('expense_date',current_date-3));
select results_eq($$select amount,exchange_rate,exchange_rate_reference_date from public.expenses where id=mm.id('manual')$$,$$ values (70.40::numeric,3.52::numeric,current_date)$$,'cambiar la fecha no sustituye silenciosamente la tasa');
select public.update_expense(mm.id('manual'),jsonb_build_object('original_amount',30.00));
select is((select amount from public.expenses where id=mm.id('manual')),105.60::numeric,'cambiar el importe USD recalcula con la tasa congelada (30 × 3.52)');
select public.update_expense(mm.id('manual'),jsonb_build_object('original_currency','USD','original_amount',30.00,'conversion_method','manual','exchange_rate',3.60,'exchange_rate_source','Usuario','exchange_rate_reference_date',current_date));
select is((select amount from public.expenses where id=mm.id('manual')),108.00::numeric,'una tasa nueva solo se aplica si el cliente la envía explícitamente');
-- De USD a PEN y de PEN a USD.
select public.update_expense(mm.id('manual'),jsonb_build_object('original_currency','PEN','amount',90));
select results_eq($$select original_currency,original_amount,amount,exchange_rate,conversion_method from public.expenses where id=mm.id('manual')$$,$$ values ('PEN'::text,90.00::numeric,90.00::numeric,1::numeric,'none'::text)$$,'USD → PEN deja identidad');
select public.update_expense(mm.id('pen'),jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','manual','exchange_rate',3.5,'exchange_rate_source','Usuario','exchange_rate_reference_date',current_date));
select results_eq($$select original_currency,original_amount,amount from public.expenses where id=mm.id('pen')$$,$$ values ('USD'::text,10.00::numeric,35.00::numeric)$$,'PEN → USD con conversión explícita (caso E: descuento S/ 35)');
select throws_ok($$select public.update_expense(mm.id('exacto'),jsonb_build_object('original_currency','USD','original_amount',10.00,'conversion_method','automatic','exchange_rate',9.00,'exchange_rate_source','BCRP:PD04640PD','exchange_rate_reference_date',current_date,'exchange_rate_fetched_at',now()))$$,'GD010',null,'editar tampoco admite una cotización automática no verificada');

-- 8. Anular conserva la semántica existente: el gasto sale de los totales y sus imputaciones.
select public.annul_expenses(array[mm.id('exacto')]);
select is((select sum(e.amount) from public.expenses e where e.status='active'),(select sum(a.amount) from public.expense_fund_allocations a join public.expenses e on e.id=a.expense_id where e.status='active'),'un gasto USD anulado deja de contar en gastos y en fondos por igual');
select public.restore_expenses(array[mm.id('exacto')]);
select is((select amount from public.expenses where id=mm.id('exacto')),35.80::numeric,'restaurar conserva el importe contable congelado');

-- 9. Plantillas en USD: la moneda la fija la plantilla y exigen conversión por elemento.
with t as (insert into public.expense_templates(household_id,name,description,ambito_id,categoria_id,subcategoria_id,payment_method_id,default_amount,expense_type,day_of_month,original_currency)
  select public.current_household_id(),'Suscripción IA','Suscripción IA',a.id,c.id,s.id,(select id from public.medios_pago where household_id=public.current_household_id() and name='Efectivo'),20,'fixed',1,'USD'
  from public.ambitos a join public.categorias c on c.ambito_id=a.id join public.subcategorias s on s.categoria_id=c.id
  where a.household_id=public.current_household_id() and a.name='Personal' and c.name='Alimentación' and s.name='Bebidas' returning id) insert into mm.ids select 'plantilla',id from t;
select throws_ok($$select public.apply_template_batch(date_trunc('month',current_date)::date,jsonb_build_array(jsonb_build_object('template_id',mm.id('plantilla'),'outcome','include')),gen_random_uuid())$$,'GD010',null,'una plantilla USD sin conversión no se registra (nunca 1:1)');
select throws_ok($$select public.apply_template_batch(date_trunc('month',current_date)::date,jsonb_build_array(jsonb_build_object('template_id',mm.id('plantilla'),'outcome','include','amount',20,'original_currency','PEN')),gen_random_uuid())$$,'GD010',null,'el cliente no puede declarar PEN para una plantilla USD');
select is((select count(*)::int from public.expenses where template_id=mm.id('plantilla')),0,'el lote es atómico: no deja gastos parciales');
select is((public.apply_template_batch(date_trunc('month',current_date)::date,jsonb_build_array(jsonb_build_object('template_id',mm.id('plantilla'),'outcome','include','expense_date',date_trunc('month',current_date)::date,'original_amount',20.00,'conversion_method','manual','exchange_rate',3.42,'exchange_rate_source','Usuario','exchange_rate_reference_date',date_trunc('month',current_date)::date)),gen_random_uuid())->>'total')::numeric,68.40::numeric,'caso F: el lote totaliza en PEN (20 × 3.42)');
select results_eq($$select original_currency,original_amount,amount,exchange_rate from public.expenses where template_id=mm.id('plantilla')$$,$$ values ('USD'::text,20.00::numeric,68.40::numeric,3.42::numeric)$$,'el gasto de la plantilla guarda USD original, PEN contable y la tasa del mes');
select is((select default_amount from public.expense_templates where id=mm.id('plantilla')),20::numeric,'la plantilla no cambia al registrar (sin tasa fija)');

-- 10. Eventos: un compromiso USD es una estimación en PEN; el pago real usa su propia conversión (caso H).
with ev as (insert into public.events(household_id,user_id,name,target_date,budget) values(public.current_household_id(),auth.uid(),'Cumpleaños',current_date+60,500) returning id) insert into mm.ids select 'evento',id from ev;
with c as (insert into public.event_commitments(event_id,household_id,name,contracted_amount,original_currency,original_amount,exchange_rate,exchange_rate_source,exchange_rate_reference_date,conversion_method)
  values(mm.id('evento'),public.current_household_id(),'Torta importada',0,'USD',50.00,3.50,'Usuario',current_date,'manual') returning id) insert into mm.ids select 'contrato',id from c;
select is((select contracted_amount from public.event_commitments where id=mm.id('contrato')),175.00::numeric,'el compromiso USD se estima en PEN (50 × 3.50)');
select is((select pending from public.event_metrics where id=mm.id('evento')),175.00::numeric,'el pendiente del evento está en PEN');
insert into mm.ids select 'pago',(public.save_expense_event(mm.exp('Adelanto torta',0,jsonb_build_object('original_currency','USD','original_amount',20.00,'conversion_method','manual','exchange_rate',3.60,'exchange_rate_source','Usuario','exchange_rate_reference_date',current_date,'event_id',mm.id('evento'),'event_commitment_id',mm.id('contrato'))),'30000000-0000-0000-0000-000000000001')->>'expense_id')::uuid;
select is((select paid from public.event_metrics where id=mm.id('evento')),72.00::numeric,'el pago USD cuenta una sola vez, en PEN (20 × 3.60)');
select is((select pending from public.event_metrics where id=mm.id('evento')),103.00::numeric,'175 estimado − 72 pagado = 103 pendientes (no se suman unidades distintas)');
select is((select count(*)::int from public.expenses where event_id=mm.id('evento')),1,'una sola transacción financiera por el pago asociado');
select is((select sum(a.amount) from public.expense_fund_allocations a where a.expense_id=mm.id('pago')),72.00::numeric,'una sola imputación a fondos, en PEN');
select throws_ok($$insert into public.event_commitments(event_id,household_id,name,contracted_amount,original_currency,original_amount,exchange_rate,exchange_rate_source,exchange_rate_reference_date,conversion_method) values(mm.id('evento'),public.current_household_id(),'Sin tasa',0,'USD',50.00,0,'Usuario',current_date,'manual')$$,'GD010',null,'un compromiso USD sin tasa válida no se guarda');
select is((select planned_total from public.event_metrics where id=mm.id('evento')),0::numeric,'sin conceptos no hay planificación');
with i as (insert into public.event_items(event_id,household_id,name,planned_amount,original_currency,original_amount,exchange_rate,exchange_rate_source,exchange_rate_reference_date,conversion_method) values(mm.id('evento'),public.current_household_id(),'Regalo',0,'USD',100.00,3.40,'Usuario',current_date,'manual') returning id) insert into mm.ids select 'concepto',id from i;
select is((select planned_amount from public.event_items where id=mm.id('concepto')),340.00::numeric,'un concepto USD se planifica en PEN');
select is((public.clone_event(mm.id('evento'),jsonb_build_object('target_date',(current_date+90)::text),'40000000-0000-0000-0000-000000000001') is not null),true,'clonar un evento funciona con conceptos y compromisos USD');
select results_eq($$select original_currency,original_amount,planned_amount from public.event_items where event_id=(select id from public.events where id='40000000-0000-0000-0000-000000000001')$$,$$ values ('USD'::text,100.00::numeric,340.00::numeric)$$,'la copia conserva la moneda original del concepto');

-- 11. Aislamiento entre cuentas y datos públicos de cotización.
select ok((select count(*) from public.exchange_rate_quotes where date_requested=current_date)=1,'las cotizaciones públicas son legibles con sesión');
select throws_ok($$insert into public.exchange_rate_quotes(date_requested,rate,reference_date,source) values(current_date-1,3.4,current_date-1,'falsa')$$,'42501',null,'un cliente no puede escribir cotizaciones (solo el servicio)');
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}',true);
select is((select count(*)::int from public.expenses),0,'otra cuenta no ve gastos en USD ajenos');
select throws_ok($$select public.update_expense(mm.id('pen'),jsonb_build_object('description','intruso'))$$,'GD004',null,'otra cuenta no puede editar la conversión');

-- 12. Integridad en la base, incluso con acceso directo: no se puede dejar una conversión incoherente.
reset role;
select throws_ok($$update public.expenses set original_amount=11 where id=mm.id('pen')$$,'23514',null,'el importe original y el contable no pueden divergir');
select throws_ok($$update public.expenses set exchange_rate=-1 where id=mm.id('pen')$$,'23514',null,'la tasa debe ser positiva');
select throws_ok($$update public.expenses set conversion_method='none' where id=mm.id('pen')$$,'23514',null,'una conversión USD no puede declararse sin conversión');
select throws_ok($$update public.expenses set original_currency='EUR' where id=mm.id('pen')$$,'23514',null,'solo PEN y USD');
select * from finish();
rollback;
