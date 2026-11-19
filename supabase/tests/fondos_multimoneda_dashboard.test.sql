begin;
select * from no_plan();
-- Fondos multimoneda (etapa 3): Dashboard valorizado con la última cotización del período, desglose por moneda, remanente no cubierto y eventos.
insert into auth.users(instance_id,id,aud,role,email) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','a@fondosdash.test');
select public.bootstrap_catalog(household_id) from public.profiles where user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
create schema fd;
grant usage on schema fd to authenticated;
create table fd.ids(k text primary key,id uuid);
grant all on fd.ids to authenticated;
create table fd.js(k text primary key,j jsonb);
grant all on fd.js to authenticated;
create function fd.id(k text) returns uuid language sql stable as $$ select id from fd.ids i where i.k=$1 $$;
create function fd.hid() returns uuid language sql stable as $$ select household_id from public.profiles where user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$;
create function fd.ini(n int) returns date language sql stable as $$ select (date_trunc('month',current_date)+make_interval(months=>n))::date $$;
create function fd.fin(n int) returns date language sql stable as $$ select (date_trunc('month',current_date)+make_interval(months=>n+1))::date-1 $$;
create function fd.f(n int, nombre text, moneda text, importe numeric, prio int, gen boolean default false, cruz boolean default false) returns uuid language plpgsql as $$
declare per uuid:=public.ensure_period(fd.hid(),fd.ini(n)); fid uuid;
begin
  insert into public.funds(household_id,period_id,name,description,is_general,default_amount,priority,icon_key,color_token,currency,allow_cross_currency)
    values(fd.hid(),per,nombre,'',gen,importe,prio,'wallet','pri',moneda,cruz) returning id into fid;
  if not exists(select 1 from public.fund_period_budgets where fund_id=fid) then insert into public.fund_period_budgets(household_id,fund_id,period_id,assigned_amount) values(fd.hid(),fid,per,importe); end if;
  if not gen then insert into public.fund_scope_rules(household_id,fund_id,ambito_id,effect) select fd.hid(),fid,a.id,'include' from public.ambitos a where a.household_id=fd.hid() and a.name='Personal'; end if;
  insert into fd.ids values(nombre||':'||n,fid);
  return fid;
end $$;
create function fd.g(n int,texto text,importe numeric,moneda text default 'PEN',tasa numeric default 3.4,dia int default 10) returns jsonb language sql stable as $$
  select jsonb_build_object('description',texto,'expense_date',fd.ini(n)+dia,'ambito_id',a.id,'categoria_id',c.id,'subcategoria_id',s.id,
    'payment_method_id',(select id from public.medios_pago where household_id=public.current_household_id() and name='Efectivo'),'expense_type','variable','is_recurring',false)
    ||case when moneda='USD' then jsonb_build_object('original_currency','USD','original_amount',importe,'conversion_method','manual','exchange_rate',tasa,'exchange_rate_source','Usuario','exchange_rate_reference_date',fd.ini(n)+dia,'amount',0)
      else jsonb_build_object('amount',importe) end
  from public.ambitos a join public.categorias c on c.ambito_id=a.id join public.subcategorias s on s.categoria_id=c.id
  where a.household_id=public.current_household_id() and a.name='Personal' and c.name='Alimentación' and s.name='Bebidas'
$$;
create function fd.panel(n int) returns jsonb language sql as $$ select public.dashboard_panel(fd.ini(n),fd.fin(n),fd.ini(n-1),fd.fin(n-1)) $$;
grant execute on all functions in schema fd to authenticated;

-- Mes actual: General PEN 1000 (con cobertura cruzada) y fondo USD de US$ 50. Mes pasado: otro fondo USD (para la regla de períodos históricos).
select fd.f(0,'Gen','PEN',1000,1000,true,true), fd.f(0,'USD','USD',50,10);
select fd.f(-1,'GenP','PEN',500,1000,true,false), fd.f(-1,'USDP','USD',30,10);
-- Cotizaciones verificadas: una dentro del mes actual (hoy) y una POSTERIOR al cierre del mes pasado (no debe usarse para él).
insert into public.exchange_rate_quotes(date_requested,rate,reference_date,source,fetched_at) values
  (current_date,3.5000,current_date-1,'BCRP:PD04640PD',now())
  on conflict (date_requested) do update set rate=excluded.rate,reference_date=excluded.reference_date,source=excluded.source;
delete from public.exchange_rate_quotes where date_requested between fd.ini(-1)-14 and fd.fin(-1) and date_requested<>current_date;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
insert into fd.ids select 'u20',(public.create_expense(fd.g(0,'usd20',20,'USD',3.4),gen_random_uuid())->>'expense_id')::uuid;
insert into fd.ids select 'p100',(public.create_expense(fd.g(0,'pen100',100),gen_random_uuid())->>'expense_id')::uuid;
insert into fd.js select 'mes0',fd.panel(0);

-- Dashboard del mes actual.
select is((select (j->>'presupuesto')::numeric from fd.js where k='mes0'),1000.00::numeric,'el presupuesto en soles es solo el de los fondos PEN');
select is((select (j->'usd'->>'presupuesto_usd')::numeric from fd.js where k='mes0'),50.00::numeric,'los fondos USD se informan aparte, en dólares');
select is((select (j->'usd'->>'saldo_usd')::numeric from fd.js where k='mes0'),30.00::numeric,'saldo nominal USD = 50 − 20');
select is((select (j->'usd'->>'presupuesto_valorizado')::numeric from fd.js where k='mes0'),175.00::numeric,'presupuesto USD valorizado con la última cotización del mes (50 × 3.50)');
select is((select (j->'usd'->>'saldo_valorizado')::numeric from fd.js where k='mes0'),105.00::numeric,'saldo valorizado 30 × 3.50');
select is((select (j->'usd'->'tasas'->0->>'tasa')::numeric from fd.js where k='mes0'),3.5::numeric,'se informa la tasa usada');
select is((select j->'usd'->'tasas'->0->>'fuente' from fd.js where k='mes0'),'BCRP:PD04640PD','y su fuente');
select is((select (j->>'imputado_rango')::numeric from fd.js where k='mes0'),168.00::numeric,'el consumo contable sigue en soles: 20 × 3.40 + 100');
select is((select (j->'usd'->>'consumido_pen_fondos')::numeric from fd.js where k='mes0'),100.00::numeric,'y el consumo de los fondos PEN se separa (S/ 100)');
select is((select (j->>'gasto_rango')::numeric from fd.js where k='mes0'),168.00::numeric,'el gasto total cuenta cada gasto una sola vez, en soles');
select results_eq($$select f->>'moneda', (f->>'asignado')::numeric, (f->>'consumido')::numeric from fd.js, jsonb_array_elements(j->'fondos') f where k='mes0' and f->>'nombre'='USD'$$,$$ values ('USD'::text,50.00::numeric,20.00::numeric) $$,'el fondo USD muestra su presupuesto y consumo en dólares');
select is((select count(*)::int from fd.js, jsonb_array_elements(j->'fondos') f where k='mes0'),2,'un fondo por moneda: no se fusionan fondos de distinta moneda');
select is((select (j->'no_cubierto'->>'cantidad')::int from fd.js where k='mes0'),0,'nada sin cubrir mientras los fondos alcanzan');

-- Mes pasado: la cotización posterior a su cierre NO se usa; sin dato propio no se inventa una tasa.
insert into fd.js select 'mes-1',fd.panel(-1);
select is((select (j->'usd'->>'sin_cotizacion')::boolean from fd.js where k='mes-1'),true,'un mes cerrado no usa cotizaciones posteriores a su cierre');
select is((select j->'usd'->>'presupuesto_valorizado' from fd.js where k='mes-1'),null,'sin cotización no hay valoración (no se inventa una tasa)');
select is((select (j->'usd'->>'presupuesto_usd')::numeric from fd.js where k='mes-1'),30.00::numeric,'pero el presupuesto nominal USD sigue visible');
-- Con una cotización propia del mes pasado, se usa la última de ese período (fin de semana/feriado = último día publicado, con su fecha real).
reset role;
insert into public.exchange_rate_quotes(date_requested,rate,reference_date,source,fetched_at) values (fd.fin(-1)-3,3.3000,fd.fin(-1)-5,'BCRP:PD04640PD',now()),(fd.ini(-1)+5,3.1000,fd.ini(-1)+5,'BCRP:PD04640PD',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select is((select (public.dashboard_panel(fd.ini(-1),fd.fin(-1),fd.ini(-2),fd.fin(-2))->'usd'->>'presupuesto_valorizado')::numeric),99.00::numeric,'mes pasado: 30 × la última tasa de su período (3.30)');
select is((select (public.dashboard_panel(fd.ini(-1),fd.fin(-1),fd.ini(-2),fd.fin(-2))->'usd'->'tasas'->0->>'fecha_referencia')::date),fd.fin(-1)-5,'y se informa la fecha real de esa cotización');

-- Remanente no cubierto: el General deja de absorber en dólares; el gasto sigue contando completo.
reset role;
update public.funds set allow_cross_currency=false where id=fd.id('Gen:0');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
insert into fd.ids select 'u40',(public.create_expense(fd.g(0,'usd40',40,'USD',3.4,11),gen_random_uuid())->>'expense_id')::uuid;
insert into fd.js select 'mes0b',fd.panel(0);
select is((select (j->'no_cubierto'->>'cantidad')::int from fd.js where k='mes0b'),1,'un gasto parcialmente sin cubrir se cuenta en el indicador');
select is((select (j->'no_cubierto'->>'monto')::numeric from fd.js where k='mes0b'),34.00::numeric,'US$ 10 sin cubrir = S/ 34.00 contables (40 − saldo 30)');
select is((select (j->>'gasto_rango')::numeric from fd.js where k='mes0b'),304.00::numeric,'el gasto total mantiene el 100 % (168 + 40 × 3.40)');
select is((select (j->>'sin_fondo')::numeric from fd.js where k='mes0b'),34.00::numeric,'«sin fondo asignable» refleja ese remanente');

-- Eventos: un gasto USD con imputaciones mixtas cuenta una sola vez, en soles contables.
reset role;
update public.funds set allow_cross_currency=true where id=fd.id('Gen:0');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
with e as (insert into public.events(household_id,user_id,name,target_date,budget) values(fd.hid(),auth.uid(),'Fiesta',current_date+30,1000) returning id) insert into fd.ids select 'evento',id from e;
insert into fd.ids select 'mixto',(public.save_expense_event(fd.g(0,'mixto',60,'USD',3.4,12)||jsonb_build_object('event_id',fd.id('evento')),gen_random_uuid())->>'expense_id')::uuid;
select is((select sum(amount) from public.expense_fund_allocations where expense_id=fd.id('mixto')),204.00::numeric,'el gasto del evento queda imputado completo a fondos (sin duplicar)');
select is((select paid from public.event_metrics where id=fd.id('evento')),204.00::numeric,'el evento cuenta una sola vez el importe contable (60 × 3.40)');
select is((select expense_count from public.event_metrics where id=fd.id('evento')),1::bigint,'una sola transacción, no una por imputación');
select * from finish();
rollback;
