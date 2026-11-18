-- Historial calculado: no duplica movimientos ni mantiene contadores mutables.
create function public.normalizar_descripcion(texto text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(btrim(regexp_replace(normalize(coalesce(texto, ''), NFC), '[[:space:]]+', ' ', 'g'))),
    'áéíóúü', 'aeiouu');
$$;

-- Asociación explícita por IDs. No se comparte ninguna otra clasificación por similitud.
create table public.description_shared_contexts (
  household_id uuid not null references public.households(id) on delete cascade,
  subcategoria_id uuid primary key,
  group_key text not null check (length(group_key) between 1 and 80),
  foreign key (subcategoria_id, household_id) references public.subcategorias(id, household_id) on delete cascade
);
alter table public.description_shared_contexts enable row level security;
revoke all on public.description_shared_contexts from public, anon, authenticated;
grant select on public.description_shared_contexts to authenticated;
create policy description_context_select on public.description_shared_contexts
  for select to authenticated using (public.is_household_member(household_id));

-- Regla inicial centralizada. Las etiquetas exactas solo sirven para registrar IDs;
-- las consultas de historial usan exclusivamente esos IDs y su grupo explícito.
create function public.grupo_descripcion_inicial(categoria text, subcategoria text)
returns text language sql immutable set search_path = '' as $$
  select case when public.normalizar_descripcion(categoria) = 'alimentacion'
    and public.normalizar_descripcion(subcategoria) = 'bebidas'
    then 'alimentacion-bebidas' end;
$$;

insert into public.description_shared_contexts(household_id, subcategoria_id, group_key)
select s.household_id, s.id, public.grupo_descripcion_inicial(c.name, s.name)
from public.subcategorias s join public.categorias c on c.id = s.categoria_id
where public.grupo_descripcion_inicial(c.name, s.name) is not null;

-- También registra nuevas clasificaciones; un cambio de nombre/parentesco elimina
-- la asociación inicial si ya no corresponde. Otros grupos explícitos se conservan.
create function public.sincronizar_contexto_descripcion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'categorias' then
    delete from public.description_shared_contexts d using public.subcategorias s
      where d.subcategoria_id = s.id and s.categoria_id = new.id and d.group_key = 'alimentacion-bebidas';
    insert into public.description_shared_contexts(household_id, subcategoria_id, group_key)
      select s.household_id, s.id, public.grupo_descripcion_inicial(new.name, s.name)
      from public.subcategorias s where s.categoria_id = new.id
      and public.grupo_descripcion_inicial(new.name, s.name) is not null
      on conflict (subcategoria_id) do nothing;
  else
    delete from public.description_shared_contexts where subcategoria_id = new.id and group_key = 'alimentacion-bebidas';
    insert into public.description_shared_contexts(household_id, subcategoria_id, group_key)
      select new.household_id, new.id, public.grupo_descripcion_inicial(c.name, new.name)
      from public.categorias c where c.id = new.categoria_id
      and public.grupo_descripcion_inicial(c.name, new.name) is not null
      on conflict (subcategoria_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger description_sub_context after insert or update of name, categoria_id on public.subcategorias
  for each row execute function public.sincronizar_contexto_descripcion();
create trigger description_cat_context after update of name on public.categorias
  for each row execute function public.sincronizar_contexto_descripcion();

-- Cobertura efectiva, no orden de reglas: enumera clasificaciones válidas (incluida
-- categoría sin subcategoría) y medios admitidos. Exclusión gana, como fund_admits.
-- Los IDs de otros hogares o reglas incompletas nunca producen sugerencias.
create function public.firma_cobertura_descripcion(p_general boolean, p_scope jsonb, p_payment jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  hid uuid := public.current_household_id();
  clases jsonb;
  pagos jsonb;
begin
  if hid is null or jsonb_typeof(p_scope) is distinct from 'array' or jsonb_typeof(p_payment) is distinct from 'array' then return null; end if;
  if exists (
    select 1 from jsonb_array_elements(p_scope) r
    where coalesce(r->>'effect', '') not in ('include', 'exclude') or not coalesce((
      (r->>'kind' = 'ambito' and exists(select 1 from public.ambitos a where a.household_id=hid and a.id::text=r->>'ref')) or
      (r->>'kind' = 'categoria' and exists(select 1 from public.categorias c where c.household_id=hid and c.id::text=r->>'ref')) or
      (r->>'kind' = 'subcategoria' and exists(select 1 from public.subcategorias s where s.household_id=hid and s.id::text=r->>'ref'))
    ), false)
  ) or exists (
    select 1 from jsonb_array_elements(p_payment) r
    where coalesce(r->>'effect','') not in ('include','exclude') or not exists(
      select 1 from public.medios_pago m where m.household_id=hid and m.id::text=r->>'method'
    )
  ) then return null; end if;
  if not p_general and not exists(select 1 from jsonb_array_elements(p_scope) r where r->>'effect'='include') then return null; end if;

  with posibles as (
    select c.ambito_id, c.id as categoria_id, null::uuid as subcategoria_id from public.categorias c where c.household_id=hid
    union all
    select c.ambito_id, c.id, s.id from public.categorias c join public.subcategorias s on s.categoria_id=c.id where c.household_id=hid
  ), admitidas as (
    select p.* from posibles p where
    (not exists(select 1 from jsonb_array_elements(p_scope) r where r->>'effect'='include') or exists(
      select 1 from jsonb_array_elements(p_scope) r where r->>'effect'='include' and
      case r->>'kind' when 'ambito' then p.ambito_id::text when 'categoria' then p.categoria_id::text when 'subcategoria' then p.subcategoria_id::text end = r->>'ref'
    )) and not exists(
      select 1 from jsonb_array_elements(p_scope) r where r->>'effect'='exclude' and
      case r->>'kind' when 'ambito' then p.ambito_id::text when 'categoria' then p.categoria_id::text when 'subcategoria' then p.subcategoria_id::text end = r->>'ref'
    )
  ) select jsonb_agg(jsonb_build_array(categoria_id, subcategoria_id) order by categoria_id, subcategoria_id) into clases from admitidas;
  select jsonb_agg(m.id order by m.id) into pagos from public.medios_pago m where m.household_id=hid and
    (not exists(select 1 from jsonb_array_elements(p_payment) r where r->>'effect'='include') or exists(
      select 1 from jsonb_array_elements(p_payment) r where r->>'effect'='include' and r->>'method'=m.id::text
    )) and not exists(select 1 from jsonb_array_elements(p_payment) r where r->>'effect'='exclude' and r->>'method'=m.id::text);
  if clases is null or pagos is null then return null; end if;
  return jsonb_build_object('general', p_general, 'clases', clases, 'medios', pagos);
end;
$$;

create function public.sugerencias_descripciones(p_tipo text, p_contexto jsonb, p_busqueda text default '')
returns table(description text, frequency bigint, last_used timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
declare
  hid uuid := public.current_household_id();
  grupo text;
  firma jsonb;
begin
  if auth.uid() is null or hid is null then return; end if;
  if p_tipo = 'expense' then
    -- Validación completa de la jerarquía, sin confiar en el cliente.
    if not exists(select 1 from public.categorias c where c.household_id=hid and c.id::text=p_contexto->>'categoria_id' and c.ambito_id::text=p_contexto->>'ambito_id') then return; end if;
    if nullif(p_contexto->>'subcategoria_id','') is not null and not exists(
      select 1 from public.subcategorias s where s.household_id=hid and s.id::text=p_contexto->>'subcategoria_id' and s.categoria_id::text=p_contexto->>'categoria_id'
    ) then return; end if;
    select d.group_key into grupo from public.description_shared_contexts d
      where d.household_id=hid and d.subcategoria_id::text=p_contexto->>'subcategoria_id';
    return query
      with historial as (
        select e.description as texto, public.normalizar_descripcion(e.description) as normalizada, e.created_at as uso
        from public.expenses e where e.household_id=hid and e.created_by=auth.uid() and e.status='active'
        and ((grupo is null and e.ambito_id::text=p_contexto->>'ambito_id' and e.categoria_id::text=p_contexto->>'categoria_id'
          and coalesce(e.subcategoria_id::text,'')=coalesce(p_contexto->>'subcategoria_id',''))
          or (grupo is not null and exists(select 1 from public.description_shared_contexts d where d.household_id=hid and d.subcategoria_id=e.subcategoria_id and d.group_key=grupo)))
      ) select (array_agg(btrim(regexp_replace(texto,'[[:space:]]+',' ','g')) order by uso desc, texto collate "C"))[1], count(*), max(uso)
      from historial where normalizada<>'' and strpos(normalizada, public.normalizar_descripcion(p_busqueda))>0
      group by normalizada order by count(*) desc, max(uso) desc, normalizada collate "C" limit 10;
  elsif p_tipo = 'fund' then
    firma := public.firma_cobertura_descripcion(coalesce((p_contexto->>'is_general')::boolean,false), p_contexto->'scope_rules',p_contexto->'payment_rules');
    if firma is null then return; end if;
    return query
      with historial as (
        select f.description as texto, public.normalizar_descripcion(f.description) as normalizada, f.created_at as uso
        from public.funds f join public.households h on h.id=f.household_id
        where f.household_id=hid and h.created_by=auth.uid() and f.is_active and nullif(btrim(f.description),'') is not null
        and public.firma_cobertura_descripcion(f.is_general,
          coalesce((select jsonb_agg(jsonb_build_object('kind',case when r.ambito_id is not null then 'ambito' when r.categoria_id is not null then 'categoria' else 'subcategoria' end,
            'ref',coalesce(r.ambito_id,r.categoria_id,r.subcategoria_id),'effect',r.effect)) from public.fund_scope_rules r where r.fund_id=f.id),'[]'::jsonb),
          coalesce((select jsonb_agg(jsonb_build_object('method',r.payment_method_id,'effect',r.effect)) from public.fund_payment_rules r where r.fund_id=f.id),'[]'::jsonb)) = firma
      ) select (array_agg(btrim(regexp_replace(texto,'[[:space:]]+',' ','g')) order by uso desc, texto collate "C"))[1], count(*), max(uso)
      from historial where normalizada<>'' and strpos(normalizada,public.normalizar_descripcion(p_busqueda))>0
      group by normalizada order by count(*) desc, max(uso) desc, normalizada collate "C" limit 10;
  end if;
end;
$$;

revoke all on function public.normalizar_descripcion(text), public.grupo_descripcion_inicial(text,text),
  public.sincronizar_contexto_descripcion(), public.firma_cobertura_descripcion(boolean,jsonb,jsonb),
  public.sugerencias_descripciones(text,jsonb,text) from public, anon, authenticated;
grant execute on function public.normalizar_descripcion(text), public.firma_cobertura_descripcion(boolean,jsonb,jsonb),
  public.sugerencias_descripciones(text,jsonb,text) to authenticated;
notify pgrst, 'reload schema';
