-- Catálogo administrable: ámbitos, categorías, subcategorías y medios de pago.
-- Integridad: claves foráneas compuestas mantienen todo dentro del mismo hogar y de la misma jerarquía.

create function public.is_valid_icon(k text)
returns boolean
language sql
immutable
as $$
  select k = any (array[
    'user','home','baby','briefcase','users','heart','shopping-cart','utensils','car','bus','bike','plane',
    'graduation-cap','stethoscope','pill','shirt','gift','gamepad-2','tv','wifi','zap','droplets','flame',
    'phone','wallet','credit-card','banknote','landmark','smartphone','repeat','receipt','paw-print',
    'dumbbell','coffee','shopping-bag','wrench','fuel','sparkles','book-open','music','tag','circle-ellipsis'
  ]);
$$;

create function public.is_valid_color(k text)
returns boolean
language sql
immutable
as $$
  select k = any (array['c1','c2','c3','c4','c5','pri','acc','muted']);
$$;

-- Normaliza el nombre (sin espacios en los extremos).
create function public.normalize_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name = btrim(new.name);
  return new;
end;
$$;

create table public.ambitos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon_key text not null default 'tag' check (public.is_valid_icon(icon_key)),
  color_token text not null default 'c1' check (public.is_valid_color(color_token)),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index ambitos_name_uq on public.ambitos (household_id, lower(btrim(name)));

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  ambito_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon_key text not null default 'tag' check (public.is_valid_icon(icon_key)),
  color_token text not null default 'c1' check (public.is_valid_color(color_token)),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (id, ambito_id),
  foreign key (ambito_id, household_id) references public.ambitos (id, household_id) on delete restrict
);
create unique index categorias_name_uq on public.categorias (household_id, ambito_id, lower(btrim(name)));
create index categorias_ambito_idx on public.categorias (ambito_id);

create table public.subcategorias (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  categoria_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon_key text not null default 'tag' check (public.is_valid_icon(icon_key)),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (id, categoria_id),
  foreign key (categoria_id, household_id) references public.categorias (id, household_id) on delete restrict
);
create unique index subcategorias_name_uq on public.subcategorias (household_id, categoria_id, lower(btrim(name)));
create index subcategorias_categoria_idx on public.subcategorias (categoria_id);

create table public.medios_pago (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon_key text not null default 'tag' check (public.is_valid_icon(icon_key)),
  color_token text not null default 'c1' check (public.is_valid_color(color_token)),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index medios_pago_name_uq on public.medios_pago (household_id, lower(btrim(name)));

do $$
declare
  t text;
begin
  foreach t in array array['ambitos', 'categorias', 'subcategorias', 'medios_pago'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.normalize_name()', t || '_normalize', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_household_member(household_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_household_member(household_id))', t || '_delete', t);
  end loop;
end $$;

-- Reordena de forma atómica (RLS aplica porque es SECURITY INVOKER).
create function public.reorder_catalog(p_kind text, p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_kind = 'ambitos' then
    update public.ambitos t set sort_order = o.ord::int from unnest(p_ids) with ordinality as o(id, ord) where t.id = o.id;
  elsif p_kind = 'categorias' then
    update public.categorias t set sort_order = o.ord::int from unnest(p_ids) with ordinality as o(id, ord) where t.id = o.id;
  elsif p_kind = 'subcategorias' then
    update public.subcategorias t set sort_order = o.ord::int from unnest(p_ids) with ordinality as o(id, ord) where t.id = o.id;
  elsif p_kind = 'medios_pago' then
    update public.medios_pago t set sort_order = o.ord::int from unnest(p_ids) with ordinality as o(id, ord) where t.id = o.id;
  else
    raise exception 'Tipo de catálogo no válido: %', p_kind;
  end if;
end;
$$;
revoke all on function public.reorder_catalog(text, uuid[]) from public, anon;
grant execute on function public.reorder_catalog(text, uuid[]) to authenticated;

-- Catálogo de partida para un hogar nuevo. Todo es editable desde la aplicación.
create function public.bootstrap_catalog(hid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  data jsonb := '[
    {"n":"Personal","i":"user","c":"c1","cats":[
      {"n":"Alimentación","i":"utensils","subs":["Comidas fuera","Snacks y antojos","Bebidas"]},
      {"n":"Transporte","i":"bus","subs":["Taxi","Combustible","Pasajes"]},
      {"n":"Salud","i":"stethoscope","subs":["Consultas","Medicinas"]},
      {"n":"Ocio","i":"gamepad-2","subs":["Salidas","Suscripciones"]},
      {"n":"Otros","i":"circle-ellipsis","subs":[]}]},
    {"n":"Hogar","i":"home","c":"c3","cats":[
      {"n":"Alimentación","i":"shopping-cart","subs":["Despensa","Mercado"]},
      {"n":"Servicios","i":"zap","subs":["Luz","Agua","Internet","Teléfono"]},
      {"n":"Mantenimiento","i":"wrench","subs":["Reparaciones","Limpieza"]},
      {"n":"Otros","i":"circle-ellipsis","subs":[]}]},
    {"n":"Bebé","i":"baby","c":"c4","cats":[
      {"n":"Cuidado","i":"sparkles","subs":["Pañales","Higiene"]},
      {"n":"Salud","i":"stethoscope","subs":["Controles","Vacunas","Medicinas"]},
      {"n":"Alimentación","i":"utensils","subs":["Fórmula y papillas"]},
      {"n":"Ropa y accesorios","i":"shirt","subs":[]},
      {"n":"Otros","i":"circle-ellipsis","subs":[]}]},
    {"n":"Trabajo","i":"briefcase","c":"c5","cats":[
      {"n":"Transporte","i":"bus","subs":["Taxi","Pasajes"]},
      {"n":"Alimentación","i":"utensils","subs":["Almuerzo"]},
      {"n":"Otros","i":"circle-ellipsis","subs":[]}]},
    {"n":"Familia","i":"users","c":"c2","cats":[
      {"n":"Educación","i":"graduation-cap","subs":["Pensión","Útiles"]},
      {"n":"Viajes","i":"plane","subs":["Pasajes","Hospedaje"]},
      {"n":"Regalos","i":"gift","subs":[]},
      {"n":"Otros","i":"circle-ellipsis","subs":[]}]}
  ]';
  medios jsonb := '[
    {"n":"Yape","i":"smartphone","c":"c4"},
    {"n":"Plin","i":"smartphone","c":"c3"},
    {"n":"Sodexo","i":"credit-card","c":"c2"},
    {"n":"Transferencia","i":"landmark","c":"c1"},
    {"n":"Efectivo","i":"banknote","c":"c5"},
    {"n":"Otro","i":"circle-ellipsis","c":"muted"}
  ]';
  a jsonb; c jsonb; s jsonb; m jsonb;
  aid uuid; cid uuid;
  ai int := 0; ci int; si int; mi int := 0;
begin
  if exists (select 1 from public.ambitos where household_id = hid) then
    return;
  end if;
  for a in select * from jsonb_array_elements(data) loop
    ai := ai + 1;
    insert into public.ambitos (household_id, name, icon_key, color_token, sort_order)
    values (hid, a->>'n', a->>'i', a->>'c', ai) returning id into aid;
    ci := 0;
    for c in select * from jsonb_array_elements(a->'cats') loop
      ci := ci + 1;
      insert into public.categorias (household_id, ambito_id, name, icon_key, color_token, sort_order)
      values (hid, aid, c->>'n', c->>'i', a->>'c', ci) returning id into cid;
      si := 0;
      for s in select * from jsonb_array_elements(c->'subs') loop
        si := si + 1;
        insert into public.subcategorias (household_id, categoria_id, name, icon_key, sort_order)
        values (hid, cid, s #>> '{}', c->>'i', si);
      end loop;
    end loop;
  end loop;
  for m in select * from jsonb_array_elements(medios) loop
    mi := mi + 1;
    insert into public.medios_pago (household_id, name, icon_key, color_token, sort_order)
    values (hid, m->>'n', m->>'i', m->>'c', mi);
  end loop;
end;
$$;
revoke all on function public.bootstrap_catalog(uuid) from public, anon, authenticated;
