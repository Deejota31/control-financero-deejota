-- Datos DEMO solo para desarrollo local. Este archivo NO es una migración: `supabase db push` no lo ejecuta y
-- las migraciones de producción no crean usuarios ni datos de ejemplo.
-- Se reinicia con `npm run db:reset`.
--
-- Usuario de prueba local: demo@gastodeejota.local / DemoLocal123  (no es una credencial real)
-- Todo lo que cuelga de ese hogar está marcado como demo (households.is_demo = true).
--
-- Las funciones dev_* solo existen en bases locales y no se pueden invocar desde la API (solo el rol postgres).
-- Las pruebas E2E las usan para crear y reiniciar su PROPIO usuario, sin tocar el hogar demo.

create function public.dev_amb(hid uuid, n text) returns uuid language sql as
$$ select id from public.ambitos where household_id = hid and name = n $$;
create function public.dev_cat(hid uuid, a text, n text) returns uuid language sql as
$$ select c.id from public.categorias c join public.ambitos x on x.id = c.ambito_id where c.household_id = hid and x.name = a and c.name = n $$;
create function public.dev_sub(hid uuid, a text, c text, n text) returns uuid language sql as
$$ select s.id from public.subcategorias s join public.categorias k on k.id = s.categoria_id join public.ambitos x on x.id = k.ambito_id
   where s.household_id = hid and x.name = a and k.name = c and s.name = n $$;
create function public.dev_med(hid uuid, n text) returns uuid language sql as
$$ select id from public.medios_pago where household_id = hid and name = n $$;

create function public.dev_seed_user(p_uid uuid, p_email text, p_password text, p_nombre text)
returns void
language plpgsql
as $$
declare
  hid uuid;
  fid uuid;
  m int;
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
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', p_uid, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values (gen_random_uuid(), p_uid, p_uid::text, jsonb_build_object('sub', p_uid::text, 'email', p_email), 'email', now(), now(), now());

  update public.profiles set display_name = p_nombre where user_id = p_uid;
  update public.households set name = 'Hogar demo', is_demo = true where created_by = p_uid;
  select household_id into hid from public.profiles where user_id = p_uid;

  -- Fondos de demostración
  update public.funds set default_amount = 1500 where household_id = hid and is_general;
  select id into fid from public.funds where household_id = hid and is_general;
  insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
  values (hid, fid, public.dev_med(hid, 'Sodexo'), 'exclude');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Alimentos Sodexo', 'Solo gastos pagados con Sodexo en alimentación.', 'utensils', 'c2', 300, 10) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, categoria_id, effect) values
    (hid, fid, public.dev_cat(hid, 'Personal', 'Alimentación'), 'include'),
    (hid, fid, public.dev_cat(hid, 'Trabajo', 'Alimentación'), 'include');
  insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
  values (hid, fid, public.dev_med(hid, 'Sodexo'), 'include');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Hogar', 'Servicios, despensa y mantenimiento.', 'home', 'c3', 700, 20) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, ambito_id, effect) values (hid, fid, public.dev_amb(hid, 'Hogar'), 'include');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Bebé', 'Todo lo relacionado con el bebé.', 'baby', 'c4', 350, 30) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, ambito_id, effect) values (hid, fid, public.dev_amb(hid, 'Bebé'), 'include');

  insert into public.funds (household_id, name, description, icon_key, color_token, default_amount, priority)
  values (hid, 'Familia', 'Educación, viajes y regalos.', 'users', 'c1', 600, 40) returning id into fid;
  insert into public.fund_scope_rules (household_id, fund_id, ambito_id, effect) values (hid, fid, public.dev_amb(hid, 'Familia'), 'include');

  -- Plantillas mensuales
  insert into public.expense_templates (household_id, name, description, default_amount, is_amount_variable, ambito_id, categoria_id, subcategoria_id, payment_method_id, expense_type, day_of_month, sort_order)
  values
    (hid, 'Pensión escolar', 'Pensión escolar', 650, false, public.dev_amb(hid, 'Familia'), public.dev_cat(hid, 'Familia', 'Educación'), public.dev_sub(hid, 'Familia', 'Educación', 'Pensión'), public.dev_med(hid, 'Transferencia'), 'fixed', 2, 1),
    (hid, 'Streaming', 'Suscripción de streaming', 45, false, public.dev_amb(hid, 'Personal'), public.dev_cat(hid, 'Personal', 'Ocio'), public.dev_sub(hid, 'Personal', 'Ocio', 'Suscripciones'), public.dev_med(hid, 'Transferencia'), 'fixed', 3, 2),
    (hid, 'Recibo de luz', 'Recibo de luz', 180, true, public.dev_amb(hid, 'Hogar'), public.dev_cat(hid, 'Hogar', 'Servicios'), public.dev_sub(hid, 'Hogar', 'Servicios', 'Luz'), public.dev_med(hid, 'Transferencia'), 'fixed', 5, 3),
    (hid, 'Internet', 'Internet del hogar', 120, false, public.dev_amb(hid, 'Hogar'), public.dev_cat(hid, 'Hogar', 'Servicios'), public.dev_sub(hid, 'Hogar', 'Servicios', 'Internet'), public.dev_med(hid, 'Transferencia'), 'fixed', 6, 4),
    (hid, 'Agua', 'Recibo de agua', 60, true, public.dev_amb(hid, 'Hogar'), public.dev_cat(hid, 'Hogar', 'Servicios'), public.dev_sub(hid, 'Hogar', 'Servicios', 'Agua'), public.dev_med(hid, 'Transferencia'), 'fixed', 8, 5);

  -- Períodos: mes actual y los dos anteriores. Los fondos ya existen, así reciben presupuesto.
  for m in 0..2 loop
    v_start := (date_trunc('month', current_date) - make_interval(months => m))::date;
    per := public.ensure_period(hid, v_start);
    for x in select * from jsonb_array_elements(rows) loop
      v_date := v_start + ((x ->> 4)::int - 1);
      continue when v_date > current_date;
      v_amount := round((x ->> 5)::numeric * (1 + ((m * 7 + (x ->> 4)::int) % 5) * 0.04), 2);
      insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id, payment_method_id, expense_type, is_recurring, created_by)
      values (hid, v_date, v_amount, x ->> 6, public.dev_amb(hid, x ->> 0), public.dev_cat(hid, x ->> 0, x ->> 1),
              public.dev_sub(hid, x ->> 0, x ->> 1, x ->> 2), public.dev_med(hid, x ->> 3), x ->> 7, (x ->> 8)::boolean, p_uid);
    end loop;
    -- Un gasto grande ocasional para mostrar excedentes y sobregasto
    if m = 1 then
      insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, subcategoria_id, payment_method_id, expense_type, created_by)
      values (hid, v_start + 13, 380, 'Pasajes de viaje familiar', public.dev_amb(hid, 'Familia'), public.dev_cat(hid, 'Familia', 'Viajes'),
              public.dev_sub(hid, 'Familia', 'Viajes', 'Pasajes'), public.dev_med(hid, 'Transferencia'), 'variable', p_uid);
    end if;
    perform public.recalc_period(per);
  end loop;

  -- Cierra el período más antiguo como ejemplo de histórico (suplanta al usuario solo dentro de esta transacción).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform public.close_period((select id from public.budget_periods where household_id = hid order by start_date limit 1));
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Borra al usuario (y, en cascada, su hogar y todos sus datos) y lo vuelve a sembrar. Uso: pruebas E2E.
create function public.dev_reset_user(p_uid uuid, p_email text, p_password text, p_nombre text)
returns void
language plpgsql
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.profiles where user_id = p_uid;
  if hid is not null then
    -- Los archivos de comprobantes del hogar (el trigger de storage exige este ajuste para borrar por SQL).
    begin
      perform set_config('storage.allow_delete_query', 'true', true);
      delete from storage.objects where bucket_id = 'comprobantes' and name like hid::text || '/%';
    exception when others then
      null; -- un archivo suelto en el bucket local no afecta a las pruebas
    end;
  end if;
  delete from auth.users where id = p_uid;
  perform public.dev_seed_user(p_uid, p_email, p_password, p_nombre);
end;
$$;

revoke all on function public.dev_seed_user(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.dev_reset_user(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.dev_amb(uuid, text), public.dev_cat(uuid, text, text), public.dev_sub(uuid, text, text, text), public.dev_med(uuid, text) from public, anon, authenticated;

select public.dev_seed_user('11111111-1111-1111-1111-111111111111', 'demo@gastodeejota.local', 'DemoLocal123', 'Usuario Demo');
