-- Seed SOLO para desarrollo local (`npm run db:reset`). No es una migración: `supabase db push` no lo ejecuta.
--
-- Crea ÚNICAMENTE la cuenta de acceso local. No crea ámbitos, categorías, subcategorías, medios de pago, fondos,
-- presupuestos, plantillas ni gastos: la aplicación arranca vacía y se configura desde la propia interfaz.
-- El trigger de alta (handle_new_user) añade solo lo técnico: hogar propio, membresía owner y perfil.
--
-- Cuenta local: demo@gastodeejota.local  (contraseña de desarrollo en README.md; no es una credencial real).
--
-- Los datos de las pruebas E2E viven aparte, en supabase/fixtures/e2e.sql: se cargan al empezar las pruebas y se
-- eliminan al terminar, nunca desde este archivo.

do $$
declare
  uid uuid := '11111111-1111-1111-1111-111111111111';
  mail text := 'demo@gastodeejota.local';
  clave text := 'DemoLocal123';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    crypt(clave, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail), 'email', now(), now(), now());
end $$;
