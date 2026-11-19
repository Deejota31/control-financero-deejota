begin;
select * from no_plan();
-- Fondos multimoneda (etapa 2): la moneda y la cobertura cruzada viajan por save_fund, plantillas y copia de meses.
insert into auth.users(instance_id,id,aud,role,email) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','a@fondosrpc.test'),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','b@fondosrpc.test');
select public.bootstrap_catalog(household_id) from public.profiles where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
create schema fr;
grant usage on schema fr to authenticated;
create table fr.ids(k text primary key,id uuid);
grant all on fr.ids to authenticated;
create function fr.id(k text) returns uuid language sql stable as $$ select id from fr.ids i where i.k=$1 $$;
create function fr.per(n int) returns uuid language sql as $$ select (public.ensure_period_rpc((date_trunc('month',current_date)+make_interval(months=>n))::date)).id $$;
create function fr.reglas() returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('kind','ambito','ref',a.id,'effect','include')) from public.ambitos a where a.household_id=public.current_household_id() and a.name='Personal' $$;
grant execute on all functions in schema fr to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);

-- Crear fondos: por defecto PEN y sin cobertura cruzada; USD solo si se pide.
insert into fr.ids select 'pen',(public.save_fund(jsonb_build_object('name','Casa PEN','period_id',fr.per(0),'default_amount',100,'period_amount',100,'scope_rules',fr.reglas()))->>'fund_id')::uuid;
insert into fr.ids select 'usd',(public.save_fund(jsonb_build_object('name','Suscripciones USD','period_id',fr.per(0),'currency','USD','default_amount',50,'period_amount',50,'allow_cross_currency',false,'scope_rules',fr.reglas()))->>'fund_id')::uuid;
select results_eq($$select currency,allow_cross_currency from public.funds where id=fr.id('pen')$$,$$ values ('PEN'::text,false) $$,'un fondo nuevo es PEN y sin cobertura cruzada');
select results_eq($$select f.currency,f.allow_cross_currency,b.assigned_amount from public.funds f join public.fund_period_budgets b on b.fund_id=f.id where f.id=fr.id('usd')$$,$$ values ('USD'::text,false,50.00::numeric) $$,'el fondo USD conserva su presupuesto nominal en dólares (sin convertir)');
select throws_ok($$select public.save_fund(jsonb_build_object('name','Euro','period_id',fr.per(0),'currency','EUR','default_amount',10,'scope_rules',fr.reglas()))$$,'23514',null,'solo PEN y USD');

-- Editar: la cobertura cruzada es configuración; la moneda solo cambia sin gastos imputados.
select public.save_fund(jsonb_build_object('id',fr.id('usd'),'allow_cross_currency',true));
select is((select allow_cross_currency from public.funds where id=fr.id('usd')),true,'se puede habilitar la cobertura cruzada');
select is((select currency from public.funds where id=fr.id('usd')),'USD','editar sin enviar moneda no la cambia');
select lives_ok($$select public.save_fund(jsonb_build_object('id',fr.id('pen'),'currency','USD','period_amount',20))$$,'sin gastos imputados el fondo puede cambiar de moneda');
select results_eq($$select f.currency,b.assigned_amount from public.funds f join public.fund_period_budgets b on b.fund_id=f.id where f.id=fr.id('pen')$$,$$ values ('USD'::text,20.00::numeric) $$,'la moneda y el importe nominal quedan definidos juntos');
select public.save_fund(jsonb_build_object('id',fr.id('pen'),'currency','PEN','period_amount',100));
-- Con gastos imputados la moneda queda bloqueada.
insert into fr.ids select 'g',(public.create_expense(jsonb_build_object('description','Luz','amount',30,'expense_date',date_trunc('month',current_date)::date+14,
  'ambito_id',(select id from public.ambitos where household_id=public.current_household_id() and name='Personal'),'categoria_id',(select c.id from public.categorias c join public.ambitos a on a.id=c.ambito_id where a.household_id=public.current_household_id() and a.name='Personal' limit 1),
  'payment_method_id',(select id from public.medios_pago where household_id=public.current_household_id() and name='Efectivo'),'expense_type','variable','is_recurring',false),gen_random_uuid())->>'expense_id')::uuid;
select ok((select count(*) from public.expense_fund_allocations where fund_id=fr.id('pen'))>0,'el fondo PEN recibió imputaciones');
select throws_ok($$select public.save_fund(jsonb_build_object('id',fr.id('pen'),'currency','USD'))$$,'GD012',null,'con gastos imputados no se puede cambiar la moneda (hay que crear un fondo nuevo)');

-- Plantillas de fondo: moneda y cobertura cruzada se conservan y no se convierten.
insert into fr.ids select 'tpl',public.save_fund_template(jsonb_build_object('name','Suscripciones','currency','USD','suggested_amount',50,'allow_cross_currency',true,'scope_rules',fr.reglas()));
select results_eq($$select currency,suggested_amount,allow_cross_currency from public.fund_templates where id=fr.id('tpl')$$,$$ values ('USD'::text,50.00::numeric,true) $$,'la plantilla guarda moneda, importe nominal y cobertura cruzada');
select is((public.apply_fund_templates(fr.per(1),jsonb_build_array(jsonb_build_object('template_id',fr.id('tpl'))))->'created'->0->>'currency'),'USD','aplicar la plantilla crea un fondo USD');
select results_eq($$select f.currency,f.allow_cross_currency,b.assigned_amount from public.funds f join public.fund_period_budgets b on b.fund_id=f.id where f.period_id=fr.per(1) and f.template_id=fr.id('tpl')$$,$$ values ('USD'::text,true,50.00::numeric) $$,'el fondo creado conserva US$ 50 sin convertir y la cobertura de la plantilla');
select public.save_fund_template(jsonb_build_object('id',fr.id('tpl'),'suggested_amount',60));
select is((select default_amount from public.funds where period_id=fr.per(1) and template_id=fr.id('tpl')),50.00::numeric,'cambiar la plantilla después no modifica fondos ya creados');

-- Copiar fondos de otro mes: conserva la moneda.
select is((public.copy_funds(fr.per(0),fr.per(2),jsonb_build_array(jsonb_build_object('fund_id',fr.id('usd'))))->'created'->0->>'currency'),'USD','copiar un fondo USD a otro mes lo mantiene en USD');
select results_eq($$select currency,allow_cross_currency from public.funds where period_id=fr.per(2) and copied_from=fr.id('usd')$$,$$ values ('USD'::text,true) $$,'y conserva su política de cobertura cruzada');

-- Aislamiento: otra cuenta no ve ni toca estos fondos.
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}',true);
select is((select count(*)::int from public.funds),0,'otra cuenta no ve fondos ajenos');
select throws_ok($$select public.save_fund(jsonb_build_object('id',fr.id('usd'),'currency','PEN'))$$,'GD004',null,'otra cuenta no puede modificar un fondo ajeno');
select * from finish();
rollback;
