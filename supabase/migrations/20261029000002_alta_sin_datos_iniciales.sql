-- El alta de un usuario ya NO crea catálogo ni fondos de partida: cada persona configura su hogar desde cero
-- (ámbitos, categorías, subcategorías, medios de pago, fondos, presupuestos, plantillas).
-- Solo se crean los registros técnicos mínimos para poder entrar: hogar propio, membresía owner y perfil.
--
-- `bootstrap_catalog` se conserva (sin cambios, sin permisos para la API) solo como utilidad de fixtures de pruebas.
-- Reversión: volver a crear handle_new_user con `perform public.bootstrap_catalog(hid)` y el Fondo General
-- (ver 20261026000006_storage_y_alta.sql).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  insert into public.households (created_by) values (new.id) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, new.id, 'owner');
  insert into public.profiles (user_id, household_id) values (new.id, hid);
  return new;
end;
$$;
