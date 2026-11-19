begin;
select * from no_plan();
-- Fondos multimoneda (etapa 1: motor). Cada caso usa su propio mes, con sus propios fondos, para que no se influyan.
insert into auth.users(instance_id,id,aud,role,email) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','a@fondosmm.test'),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','b@fondosmm.test');
select public.bootstrap_catalog(household_id) from public.profiles where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
create schema fm;
grant usage on schema fm to authenticated;
create table fm.ids(k text primary key,id uuid);
grant all on fm.ids to authenticated;
create table fm.rep(k text primary key,r jsonb);
grant all on fm.rep to authenticated;
create function fm.id(k text) returns uuid language sql stable as $$ select id from fm.ids i where i.k=$1 $$;
create function fm.hid() returns uuid language sql stable as $$ select household_id from public.profiles where user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$;
create function fm.mes(n int) returns date language sql stable as $$ select (date_trunc('month',current_date)+make_interval(months=>n))::date $$;
-- Fondo del mes n: moneda, importe nominal, prioridad; el General admite todo y los específicos incluyen el ámbito Personal.
create function fm.f(n int, nombre text, moneda text, importe numeric, prio int, gen boolean default false, cruz boolean default false) returns uuid language plpgsql as $$
declare per uuid:=public.ensure_period(fm.hid(),fm.mes(n)); fid uuid;
begin
  insert into public.funds(household_id,period_id,name,description,is_general,default_amount,priority,icon_key,color_token,currency,allow_cross_currency)
    values(fm.hid(),per,nombre,'',gen,importe,prio,'wallet','pri',moneda,cruz) returning id into fid;
  if not exists(select 1 from public.fund_period_budgets where fund_id=fid) then
    insert into public.fund_period_budgets(household_id,fund_id,period_id,assigned_amount) values(fm.hid(),fid,per,importe);
  end if;
  if not gen then insert into public.fund_scope_rules(household_id,fund_id,ambito_id,effect) select fm.hid(),fid,a.id,'include' from public.ambitos a where a.household_id=fm.hid() and a.name='Personal'; end if;
  insert into fm.ids values(nombre||':'||n,fid);
  return fid;
end $$;
-- Gasto del mes n (día 15) en PEN o USD con tasa manual.
create function fm.g(n int,texto text,importe numeric,moneda text default 'PEN',tasa numeric default 3.5) returns jsonb language sql stable as $$
  select jsonb_build_object('description',texto,'expense_date',fm.mes(n)+14,'ambito_id',a.id,'categoria_id',c.id,'subcategoria_id',s.id,
    'payment_method_id',(select id from public.medios_pago where household_id=public.current_household_id() and name='Efectivo'),'expense_type','variable','is_recurring',false)
    ||case when moneda='USD' then jsonb_build_object('original_currency','USD','original_amount',importe,'conversion_method','manual','exchange_rate',tasa,'exchange_rate_source','Usuario','exchange_rate_reference_date',fm.mes(n)+14,'amount',0)
      else jsonb_build_object('amount',importe) end
  from public.ambitos a join public.categorias c on c.ambito_id=a.id join public.subcategorias s on s.categoria_id=c.id
  where a.household_id=public.current_household_id() and a.name='Personal' and c.name='Alimentación' and s.name='Bebidas'
$$;
-- Capacidad restante nominal de un fondo, en su moneda.
create function fm.resta(fid uuid) returns numeric language sql stable as $$
  select b.assigned_amount-coalesce((select sum(a.fund_amount) from public.expense_fund_allocations a where a.fund_id=fid),0) from public.fund_period_budgets b where b.fund_id=fid $$;
create function fm.alloc(eid uuid) returns text language sql stable as $$
  select coalesce(string_agg(f.name||':'||a.fund_currency||':'||a.fund_amount||':'||a.amount,' | ' order by f.is_general,f.priority),'-') from public.expense_fund_allocations a join public.funds f on f.id=a.fund_id where a.expense_id=eid $$;
grant execute on all functions in schema fm to authenticated;

-- Fondos de cada caso (como propietario de la base: es la estructura, no la operación bajo prueba).
select fm.f(0,'USD50','USD',50,10), fm.f(0,'Gen0','PEN',1000,1000,true);                                  -- caso 1
select fm.f(1,'USD15','USD',15,10), fm.f(1,'Gen1','PEN',1000,1000,true,true);                             -- caso 2: General con cobertura cruzada
select fm.f(2,'USD15','USD',15,10), fm.f(2,'Gen2','PEN',1000,1000,true,false);                            -- caso 3: General sin cobertura cruzada
select fm.f(3,'USD50','USD',50,10,false,true), fm.f(3,'Gen3','PEN',1000,1000,true);                       -- caso 4: PEN cubierto por USD
select fm.f(4,'USD50','USD',50,10);                                                                         -- caso 5: solo USD sin cruzada
select fm.f(5,'PEN100','PEN',100,1), fm.f(5,'USD50','USD',50,20), fm.f(5,'Gen5','PEN',1000,1000,true);    -- caso 6: prioridad de moneda
select fm.f(6,'USD5','USD',5,10), fm.f(6,'Gen6','PEN',1000,1000,true);                                     -- caso 7a: con General no utilizable
select fm.f(7,'USD5','USD',5,10);                                                                           -- caso 7b: sin General
select fm.f(8,'A','USD',4,10), fm.f(8,'B','USD',3.33,20), fm.f(8,'Gen8','PEN',1000,1000,true,true);        -- caso 9: redondeo
select fm.f(9,'Gen9','PEN',10,1000,true);                                                                   -- caso 8: General negativo
select fm.f(10,'USD50','USD',50,10,false,true);                                                             -- sin cotización
insert into public.exchange_rate_quotes(date_requested,rate,reference_date,source,fetched_at) values (fm.mes(3)+14,3.5,fm.mes(3)+14,'BCRP:PD04640PD',now())
  on conflict (date_requested) do update set rate=excluded.rate,reference_date=excluded.reference_date,source=excluded.source;
delete from public.exchange_rate_quotes where date_requested between fm.mes(10)+7 and fm.mes(10)+14; -- sin dato para el caso 10

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);

-- Caso 1: USD cubierto por un fondo USD: se descuenta en dólares, el gasto conserva su equivalente PEN.
insert into fm.ids select 'e1',(public.create_expense(fm.g(0,'c1',20,'USD'),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e1')),'USD50:USD:20.00:70.00','caso 1: el fondo USD consume US$ 20 (S/ 70 contables), sin convertir su saldo');
select is(fm.resta(fm.id('USD50:0')),30.00::numeric,'caso 1: disponible US$ 30');
select is(fm.resta(fm.id('Gen0:0')),1000.00::numeric,'caso 1: el General PEN no se toca');
select is((select count(*)::int from public.expense_uncovered where expense_id=fm.id('e1')),0,'caso 1: nada queda sin cubrir');

-- Caso 2: excedente USD hacia el General PEN con cobertura cruzada: 15 USD + 30.10 PEN = 82.60 PEN.
insert into fm.ids select 'e2',(public.create_expense(fm.g(1,'c2',23.60,'USD'),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e2')),'USD15:USD:15.00:52.50 | Gen1:PEN:30.10:30.10','caso 2: US$ 15 al fondo USD y S/ 30.10 al General');
select is((select sum(amount) from public.expense_fund_allocations where expense_id=fm.id('e2')),82.60::numeric,'caso 2: total contable S/ 82.60');

-- Caso 3: sin cobertura cruzada el General PEN no consume: US$ 8.60 quedan sin cubrir, registrados explícitamente.
insert into fm.rep select 'e3',public.create_expense(fm.g(2,'c3',23.60,'USD'),gen_random_uuid());
insert into fm.ids select 'e3',(r->>'expense_id')::uuid from fm.rep where k='e3';
select is(fm.alloc(fm.id('e3')),'USD15:USD:15.00:52.50','caso 3: solo el fondo USD cubre');
select results_eq($$select uncovered_amount,uncovered_original,original_currency from public.expense_uncovered where expense_id=fm.id('e3')$$,$$ values (30.10::numeric,8.60::numeric,'USD'::text) $$,'caso 3: quedan US$ 8.60 (S/ 30.10) sin cubrir');
select is(fm.resta(fm.id('Gen2:2')),1000.00::numeric,'caso 3: el General PEN no se descuenta');
select is((select (r->'uncovered'->>'original_amount')::numeric from fm.rep where k='e3'),8.60::numeric,'caso 3: el informe del gasto muestra el remanente (vista previa y detalle)');
select is((select amount from public.expenses where id=fm.id('e3')),82.60::numeric,'caso 3: el gasto conserva el 100 % de su importe contable');

-- Caso 4: gasto PEN cubierto por un fondo USD con cobertura cruzada (tasa 3.50 verificada de esa fecha).
insert into fm.ids select 'e4',(public.create_expense(fm.g(3,'c4',70),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e4')),'USD50:USD:20.00:70.00','caso 4: S/ 70 consumen US$ 20 del fondo USD');
select results_eq($$select exchange_rate,rate_source from public.expense_fund_allocations where expense_id=fm.id('e4')$$,$$ values (3.500000000000::numeric,'BCRP:PD04640PD'::text) $$,'caso 4: la imputación guarda tasa y fuente');
select is(fm.resta(fm.id('USD50:3')),30.00::numeric,'caso 4: disponible US$ 30');

-- Caso 5: gasto PEN con solo un fondo USD sin cobertura cruzada: sin imputación; el gasto se conserva completo.
insert into fm.ids select 'e5',(public.create_expense(fm.g(4,'c5',70),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e5')),'-','caso 5: no hay imputación al fondo USD');
select is((select uncovered_amount from public.expense_uncovered where expense_id=fm.id('e5')),70.00::numeric,'caso 5: S/ 70 sin cubrir');

-- Caso 6: prioridad de moneda: el fondo USD (prioridad 20) va antes que el PEN (prioridad 1) para un gasto USD.
insert into fm.ids select 'e6',(public.create_expense(fm.g(5,'c6',10,'USD'),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e6')),'USD50:USD:10.00:35.00','caso 6: se usa primero el fondo de la misma moneda');
select is(fm.resta(fm.id('PEN100:5')),100.00::numeric,'caso 6: el fondo PEN no se toca');

-- Caso 7: un fondo específico no se excede si hay General; el remanente sin utilizar queda sin cubrir.
insert into fm.ids select 'e7a',(public.create_expense(fm.g(6,'c7a',12,'USD'),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e7a')),'USD5:USD:5.00:17.50','caso 7: el fondo USD aporta solo su saldo (US$ 5)');
select is((select uncovered_original from public.expense_uncovered where expense_id=fm.id('e7a')),7.00::numeric,'caso 7: US$ 7 sin cubrir (General PEN sin cobertura cruzada)');
select is(fm.resta(fm.id('USD5:6')),0.00::numeric,'caso 7: el fondo específico queda en 0, no negativo');
-- Sin General se conserva la regla histórica: el excedente va al primer específico con sobregasto advertido.
insert into fm.ids select 'e7b',(public.create_expense(fm.g(7,'c7b',12,'USD'),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e7b')),'USD5:USD:5.00:17.50 | USD5:USD:7.00:24.50','caso 7b: sin General rige el sobregasto histórico (saldo + excedente en dos filas), en la moneda del fondo');
select is(fm.resta(fm.id('USD5:7')),-7.00::numeric,'caso 7b: saldo negativo en dólares, advertido');

-- Caso 8: el General conserva su saldo negativo (en su moneda).
insert into fm.ids select 'e8',(public.create_expense(fm.g(9,'c8',30),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.resta(fm.id('Gen9:9')),-20.00::numeric,'caso 8: el General PEN queda en -20 como siempre');

-- Caso 9: redondeo. US$ 10.01 × 3.4190 = S/ 34.22; A(4.00) + B(3.33) + remanente US$ 2.68 al General PEN.
insert into fm.ids select 'e9',(public.create_expense(fm.g(8,'c9',10.01,'USD',3.4190),gen_random_uuid())->>'expense_id')::uuid;
select is((select amount from public.expenses where id=fm.id('e9')),34.22::numeric,'caso 9: equivalente contable S/ 34.22');
select is(fm.alloc(fm.id('e9')),'A:USD:4.00:13.68 | B:USD:3.33:11.39 | Gen8:PEN:9.15:9.15','caso 9: el residuo de redondeo lo absorbe la última pieza');
select is((select sum(amount) from public.expense_fund_allocations where expense_id=fm.id('e9')),34.22::numeric,'caso 9: la suma de imputaciones reconcilia con el gasto');
select is((select count(*)::int from public.expense_fund_allocations where expense_id=fm.id('e9') and amount<=0),0,'caso 9: ninguna pieza negativa ni nula');

-- Sin cotización verificada no hay cobertura cruzada hacia un fondo USD (no se inventa una tasa).
insert into fm.ids select 'e10',(public.create_expense(fm.g(10,'c10',70),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e10')),'-','sin cotización: no se imputa al fondo USD cruzado');
select is((select uncovered_amount from public.expense_uncovered where expense_id=fm.id('e10')),70.00::numeric,'sin cotización: el gasto queda sin cubrir, no con una tasa ficticia');

-- Caso 12: editar un gasto con imputación mixta reconcilia sin duplicar consumos.
select public.update_expense(fm.id('e2'),jsonb_build_object('original_currency','USD','original_amount',30.00,'conversion_method','manual','exchange_rate',3.5,'exchange_rate_source','Usuario','exchange_rate_reference_date',fm.mes(1)+14));
select is(fm.alloc(fm.id('e2')),'USD15:USD:15.00:52.50 | Gen1:PEN:52.50:52.50','caso 12: tras editar a US$ 30 el General absorbe S/ 52.50 (sin duplicar)');
select is((select count(*)::int from public.expense_fund_allocations where expense_id=fm.id('e2')),2,'caso 12: siguen siendo dos imputaciones');
-- Caso 13: un gasto nuevo no hereda imputaciones del original.
insert into fm.ids select 'e2b',(public.create_expense(fm.g(1,'c2 copia',10,'USD')||jsonb_build_object('expense_date',fm.mes(1)+15,'exchange_rate_reference_date',fm.mes(1)+15),gen_random_uuid())->>'expense_id')::uuid;
select is(fm.alloc(fm.id('e2b')),'Gen1:PEN:35.00:35.00','caso 13: la copia consume solo lo que queda (el fondo USD ya está agotado)');

-- Conciliación global: cubierto + no cubierto = gasto, y ninguna imputación cruzada sin autorización.
select is((select count(*)::int from public.expenses e where e.status='active' and e.household_id=fm.hid()
  and coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.expense_id=e.id),0)+coalesce((select sum(u.uncovered_amount) from public.expense_uncovered u where u.expense_id=e.id),0)<>e.amount),0,'conciliación: cubierto + no cubierto = importe del gasto, en todos los casos');
select is((select count(*)::int from public.expense_fund_allocations a join public.funds f on f.id=a.fund_id join public.expenses e on e.id=a.expense_id where f.currency<>e.original_currency and not f.allow_cross_currency),0,'caso 19: sin imputaciones cruzadas donde la cobertura está desactivada');
select is((select count(*)::int from public.expense_fund_allocations a join public.funds f on f.id=a.fund_id where f.currency='PEN' and a.fund_amount<>a.amount),0,'los fondos PEN descuentan exactamente el importe contable');

-- Caso 18: aislamiento entre cuentas.
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}',true);
select is((select count(*)::int from public.expense_fund_allocations),0,'caso 18: otra cuenta no ve imputaciones ajenas');
select is((select count(*)::int from public.expense_uncovered),0,'caso 18: ni remanentes sin cubrir ajenos');
select throws_ok($$select public.update_expense(fm.id('e3'),jsonb_build_object('description','x'))$$,'GD004',null,'caso 18: otra cuenta no puede alterar un gasto (ni sus imputaciones)');

-- Reglas de base de datos (acceso directo).
reset role;
select throws_ok($$update public.funds set currency='PEN' where id=fm.id('USD50:0')$$,'GD012',null,'un fondo con gastos imputados no cambia de moneda');
select lives_ok($$update public.funds set allow_cross_currency=true where id=fm.id('Gen2:2')$$,'cambiar la cobertura cruzada es una configuración, no reasigna el histórico');
select is(fm.alloc(fm.id('e3')),'USD15:USD:15.00:52.50','caso 9 (histórico): habilitar la cobertura después no reasigna gastos pasados por sí solo');
select throws_ok($$insert into public.expense_uncovered(expense_id,household_id,period_id,uncovered_amount,uncovered_original,original_currency) select id,household_id,(select period_id from public.expense_fund_allocations limit 1),-1,1,'PEN' from public.expenses limit 1$$,'23514',null,'un remanente no cubierto no puede ser negativo');
select throws_ok($$insert into public.expense_uncovered(expense_id,household_id,period_id,uncovered_amount,uncovered_original,original_currency) select expense_id,household_id,period_id,uncovered_amount,uncovered_original,original_currency from public.expense_uncovered limit 1$$,'23505',null,'un gasto no puede tener dos remanentes (sin duplicados)');
select throws_ok($$update public.expense_fund_allocations set fund_amount=1 where id=(select id from public.expense_fund_allocations a where a.fund_currency='PEN' limit 1)$$,'23514',null,'una imputación a un fondo PEN no puede diverger del importe contable');
-- El recálculo explícito del período sí aplica la nueva configuración (operación deliberada).
select public.recalc_period(public.ensure_period(fm.hid(),fm.mes(2)));
select is(fm.alloc(fm.id('e3')),'USD15:USD:15.00:52.50 | Gen2:PEN:30.10:30.10','recalcular explícitamente el mes aplica la cobertura cruzada ya habilitada');
select * from finish();
rollback;
