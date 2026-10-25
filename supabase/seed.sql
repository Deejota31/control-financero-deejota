-- Datos DEMO solo para desarrollo local. Se reinician con `npm run db:reset`.
-- Usuario de prueba: demo@gastodeejota.local / DemoLocal123  (no es una credencial real)
-- Todo lo que cuelga de este hogar está marcado como demo (households.is_demo = true).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'demo@gastodeejota.local',
  crypt('DemoLocal123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
values (
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@gastodeejota.local"}',
  'email', now(), now(), now()
);

update public.profiles set display_name = 'Usuario Demo' where user_id = '11111111-1111-1111-1111-111111111111';
update public.households set name = 'Hogar demo', is_demo = true where created_by = '11111111-1111-1111-1111-111111111111';

create function pg_temp.amb(hid uuid, n text) returns uuid language sql as
$$ select id from public.ambitos where household_id = hid and name = n $$;
create function pg_temp.cat(hid uuid, a text, n text) returns uuid language sql as
$$ select c.id from public.categorias c join public.ambitos x on x.id = c.ambito_id where c.household_id = hid and x.name = a and c.name = n $$;
create function pg_temp.sub(hid uuid, a text, c text, n text) returns uuid language sql as
$$ select s.id from public.subcategorias s join public.categorias k on k.id = s.categoria_id join public.ambitos x on x.id = k.ambito_id
   where s.household_id = hid and x.name = a and k.name = c and s.name = n $$;
create function pg_temp.med(hid uuid, n text) returns uuid language sql as
$$ select id from public.medios_pago where household_id = hid and name = n $$;

do $$
declare
  uid uuid := '11111111-1111-1111-1111-111111111111';
  hid uuid;
  fid uuid;
  m int;
  r record;
  per uuid;
  v_start date;
  v_date date;
  v_amount numeric;
  rows jsonb := '[
    ["Familia","Educación","Pensión","Transferencia",2,650,"Pensión escolar","fixed",true],
    ["Personal","Ocio","Suscripciones","Transferencia",3,45,"Streaming","fixed",true],
    ["Bebé","Cuidado","Pañales","Yape",4,95,"Pañales talla 3","variable",false],
    ["Hogar","Servicios","Luz","Transferencia",5,180,"Recibo de luz","fixed",true],
    ["Hogar","Servicios","Internet","Transferencia",6,120,"Internet del hogar","fixed",true],
    ["Personal","Alimentación","Bebidas","Sodexo",7,38,"Bebidas con Sodexo","variable",false],
    ["Hogar","Alimentación","Despensa","Plin",8,260,"Compras de despensa","variable",false],
    ["Personal","Alimentación","Comidas fuera","Yape",9,55,"Cena fuera","variable",false],
    ["Trabajo","Alimentación","Almuerzo","Sodexo",10,45,"Almuerzo de trabajo","variable",false],
    ["Personal","Alimentación","Snacks y antojos","Yape",11,18,"Snack","variable",false],
    ["Bebé","Salud","Controles","Efectivo",12,120,"Control pediátrico","variable",false],
    ["Trabajo","Transporte","Taxi","Yape",13,28,"Taxi al trabajo","variable",false],
    ["Hogar","Alimentación","Mercado","Efectivo",15,140,"Mercado semanal","variable",false],
    ["Personal","Transporte","Combustible","Efectivo",16,150,"Combustible","variable",false],
    ["Trabajo","Alimentación","Almuerzo","Sodexo",17,45,"Almuerzo de trabajo","variable",false],
    ["Bebé","Alimentación","Fórmula y papillas","Plin",18,110,"Fórmula","variable",false],
    ["Personal","Alimentación","Snacks y antojos","Yape",20,22,"Snack","variable",false],
    ["Trabajo","Transporte","Taxi","Yape",21,32,"Taxi","variable",false],
    ["Trabajo","Alimentación","Almuerzo","Sodexo",24,45,"Almuerzo de trabajo","variable",false]
  ]';
  x jsonb;
begin
  select household_id into hid from public.profiles where user_id = uid;

  -- Fondos de demostración
  update public.funds set default_amount = 1500 where household_id = hid and is_general;
  select id into fid from public.funds where household_id = hid and is_general;
  insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
  values (hid, fid, pg_temp.med(hid, 'Sodexo'), 'exclude');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Alimentos Sodexo', 'Solo gastos pagados con Sodexo en alimentación.', 'utensils', 'c2', 300, 10) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, categoria_id, effect) values
    (hid, fid, pg_temp.cat(hid, 'Personal', 'Alimentación'), 'include'),
    (hid, fid, pg_temp.cat(hid, 'Trabajo', 'Alimentación'), 'include');
  insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
  values (hid, fid, pg_temp.med(hid, 'Sodexo'), 'include');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Hogar', 'Servicios, despensa y mantenimiento.', 'home', 'c3', 700, 20) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, ambito_id, effect) values (hid, fid, pg_temp.amb(hid, 'Hogar'), 'include');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Bebé', 'Todo lo relacionado con el bebé.', 'baby', 'c4', 350, 30) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, ambito_id, effect) values (hid, fid, pg_temp.amb(hid, 'Bebé'), 'include');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Familia', 'Educación, viajes y regalos.', 'users', 'c1', 600, 40) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, ambito_id, effect) values (hid, fid, pg_temp.amb(hid, 'Familia'), 'include');

  -- Plantillas mensuales
  insert into public.expense_templates (household_id, name, description, default_amount, is_amount_variable, ambito_id, categoria_id, subcategoria_id, payment_method_id, expense_type, day_of_month, sort_order)
  values
    (hid, 'Pensión escolar', 'Pensión escolar', 650, false, pg_temp.amb(hid, 'Familia'), pg_temp.cat(hid, 'Familia', 'Educación'), pg_temp.sub(hid, 'Familia', 'Educación', 'Pensión'), pg_temp.med(hid, 'Transferencia'), 'fixed', 2, 1),
    (hid, 'Streaming', 'Suscripción de streaming', 45, false, pg_temp.amb(hid, 'Personal'), pg_temp.cat(hid, 'Personal', 'Ocio'), pg_temp.sub(hid, 'Personal', 'Ocio', 'Suscripciones'), pg_temp.med(hid, 'Transferencia'), 'fixed', 3, 2),
    (hid, 'Recibo de luz', 'Recibo de luz', 180, true, pg_temp.amb(hid, 'Hogar'), pg_temp.cat(hid, 'Hogar', 'Servicios'), pg_temp.sub(hid, 'Hogar', 'Servicios', 'Luz'), pg_temp.med(hid, 'Transferencia'), 'fixed', 5, 3),
    (hid, 'Internet', 'Internet del hogar', 120, false, pg_temp.amb(hid, 'Hogar'), pg_temp.cat(hid, 'Hogar', 'Servicios'), pg_temp.sub(hid, 'Hogar', 'Servicios', 'Internet'), pg_temp.med(hid, 'Transferencia'), 'fixed', 6, 4),
    (hid, 'Agua', 'Recibo de agua', 60, true, pg_temp.amb(hid, 'Hogar'), pg_temp.cat(hid, 'Hogar', 'Servicios'), pg_temp.sub(hid, 'Hogar', 'Servicios', 'Agua'), pg_temp.med(hid, 'Transferencia'), 'fixed', 8, 5);

  -- Períodos: mes actual y los dos anteriores. Los fondos ya existen, así reciben presupuesto.
  for m in 0..2 loop
    v_start := (date_trunc('month', current_date) - make_interval(months => m))::date;
    per := public.ensure_period(hid, v_start);
    for x in select * from jsonb_array_elements(rows) loop
      v_date := v_start + ((x ->> 4)::int - 1);
      continue when v_date > current_date;
      v_amount := round((x ->> 5)::numeric * (1 + ((m * 7 + (x ->> 4)::int) % 5) * 0.04), 2);
      insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id, payment_method_id, expense_type, is_recurring, created_by)
      values (hid, v_date, v_amount, x ->> 6, pg_temp.amb(hid, x ->> 0), pg_temp.cat(hid, x ->> 0, x ->> 1),
              pg_temp.sub(hid, x ->> 0, x ->> 1, x ->> 2), pg_temp.med(hid, x ->> 3), x ->> 7, (x ->> 8)::boolean, uid);
    end loop;
    -- Un gasto grande ocasional para mostrar excedentes y sobregasto
    if m = 1 then
      insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id, payment_method_id, expense_type, created_by)
      values (hid, v_start + 13, 380, 'Pasajes de viaje familiar', pg_temp.amb(hid, 'Familia'), pg_temp.cat(hid, 'Familia', 'Viajes'),
              pg_temp.sub(hid, 'Familia', 'Viajes', 'Pasajes'), pg_temp.med(hid, 'Transferencia'), 'variable', uid);
    end if;
    perform public.recalc_period(per);
  end loop;

  -- Cierra el período más antiguo como ejemplo de histórico (suplanta al usuario demo solo dentro de esta transacción).
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  perform public.close_period((select id from public.budget_periods where household_id = hid order by start_date limit 1));
end $$;
