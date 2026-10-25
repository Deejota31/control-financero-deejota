-- Datos DEMO solo para desarrollo local. Se reinician con `npm run db:reset`.
-- Usuario de prueba: demo@gastodeejota.local / DemoLocal123  (no es una credencial real)

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

update public.profiles set nombre = 'Usuario Demo' where user_id = '11111111-1111-1111-1111-111111111111';
