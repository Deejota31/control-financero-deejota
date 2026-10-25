-- Base: hogares, membresías y perfiles, con RLS.
-- Hoy cada usuario tiene su propio hogar (owner); el modelo ya permite sumar miembros más adelante.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Mi hogar' check (char_length(nombre) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text check (nombre is null or char_length(nombre) <= 80),
  zona_horaria text not null default 'America/Lima',
  formato_fecha text not null default 'dd/MM/yyyy',
  moneda_visualizacion text not null default 'PEN' check (moneda_visualizacion = 'PEN'),
  tema text not null default 'claro' check (tema in ('claro', 'oscuro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pertenencia al hogar. SECURITY DEFINER para evitar recursión de RLS sobre household_members.
create function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Al crear un usuario: perfil + hogar propio + membresía owner.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  insert into public.profiles (user_id) values (new.id);
  insert into public.households (created_by) values (new.id) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles enable row level security;

create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy members_select on public.household_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy profiles_select on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
