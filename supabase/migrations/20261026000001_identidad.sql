-- Identidad: alinea households y profiles con el modelo objetivo (columnas en inglés) y agrega helpers.

alter table public.households rename column nombre to name;
alter table public.households add column updated_at timestamptz not null default now();
alter table public.households add column is_demo boolean not null default false;
create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

alter table public.profiles rename column nombre to display_name;
alter table public.profiles rename column zona_horaria to timezone;
alter table public.profiles rename column formato_fecha to date_format;
alter table public.profiles rename column tema to theme;
alter table public.profiles rename column moneda_visualizacion to display_currency;
alter table public.profiles
  add column household_id uuid references public.households (id) on delete set null;

update public.profiles p
set household_id = (
  select m.household_id from public.household_members m where m.user_id = p.user_id order by m.created_at limit 1
);

-- Un usuario solo puede apuntar su perfil a un hogar al que pertenece.
drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (household_id is null or public.is_household_member(household_id))
  );

create function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
  order by m.created_at
  limit 1;
$$;
revoke all on function public.current_household_id() from public, anon;
grant execute on function public.current_household_id() to authenticated;

create function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;
revoke all on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_owner(uuid) to authenticated;
