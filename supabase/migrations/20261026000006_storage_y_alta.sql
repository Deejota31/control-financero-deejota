-- Comprobantes (bucket privado) y alta de usuario con catálogo y Fondo General iniciales.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Primer segmento de la ruta = id del hogar. Devuelve null si no es un uuid.
create function public.storage_household(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

create policy comprobantes_select on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.is_household_member(public.storage_household(name)));
create policy comprobantes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.is_household_member(public.storage_household(name)));
create policy comprobantes_update on storage.objects for update to authenticated
  using (bucket_id = 'comprobantes' and public.is_household_member(public.storage_household(name)))
  with check (bucket_id = 'comprobantes' and public.is_household_member(public.storage_household(name)));
create policy comprobantes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and public.is_household_member(public.storage_household(name)));

-- Alta de usuario: perfil, hogar propio, membresía owner, catálogo de partida y Fondo General.
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
  perform public.bootstrap_catalog(hid);
  insert into public.funds (household_id, name, description, is_general, default_amount, priority, icon_key, color_token)
  values (hid, 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri');
  return new;
end;
$$;

-- Hogares existentes sin catálogo (instalaciones previas).
do $$
declare
  h record;
begin
  for h in select id from public.households loop
    perform public.bootstrap_catalog(h.id);
    insert into public.funds (household_id, name, description, is_general, default_amount, priority, icon_key, color_token)
    select h.id, 'Fondo General', 'Cobertura general; absorbe el excedente de los fondos específicos.', true, 0, 1000, 'wallet', 'pri'
    where not exists (select 1 from public.funds f where f.household_id = h.id and f.is_general);
  end loop;
end $$;
