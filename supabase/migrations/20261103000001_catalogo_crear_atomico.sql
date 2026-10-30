-- Crear un elemento del catálogo y dejar «Otros» al final es UNA operación: todo o nada.
-- Antes eran dos peticiones (insert y reorder_catalog): si fallaba la segunda, el elemento ya existía aunque la interfaz informara error.
--
-- SECURITY INVOKER: la RLS de cada tabla sigue decidiendo quién puede escribir. El hogar sale de la sesión, no del cliente.
-- p_siblings: ids de los hermanos actuales (mismo ámbito/categoría/hogar) en su orden visible; sirve para colocar el nuevo antes de «Otros».

create function public.create_catalog_item(p_kind text, p_values jsonb, p_siblings uuid[] default '{}')
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  hid uuid := public.current_household_id();
  permitidas text[];
  columnas text;
  nuevo uuid;
  otros uuid[];
  resto uuid[];
  es_otros boolean := coalesce(p_values ->> 'name', '') ~* '^\s*otros?\s*$';
begin
  if hid is null then raise exception 'Perfil sin hogar' using errcode = '42501'; end if;
  permitidas := case p_kind
    when 'ambitos' then array['name', 'icon_key', 'color_token', 'color_hex']
    when 'medios_pago' then array['name', 'icon_key', 'color_token', 'color_hex']
    when 'categorias' then array['name', 'icon_key', 'color_token', 'color_hex', 'color_mode', 'ambito_id']
    when 'subcategorias' then array['name', 'icon_key', 'color_token', 'color_hex', 'color_mode', 'categoria_id']
    else null end;
  if permitidas is null then raise exception 'Tipo de catálogo no válido: %', p_kind; end if;

  -- Solo las columnas permitidas que el cliente envió; el resto toma su valor por defecto.
  select string_agg(quote_ident(k), ', ') into columnas from jsonb_object_keys(p_values) k where k = any (permitidas);
  if columnas is null then raise exception 'Faltan datos del elemento'; end if;

  execute format(
    'insert into public.%1$I (household_id, sort_order, %2$s) select $1, $2, %2$s from jsonb_populate_record(null::public.%1$I, $3) returning id',
    p_kind, columnas)
  into nuevo using hid, coalesce(array_length(p_siblings, 1), 0) + 1, p_values;

  -- «Otros» siempre al final, salvo que el elemento nuevo sea el propio «Otros».
  select coalesce(array_agg(id order by ord) filter (where nombre ~* '^\s*otros?\s*$'), '{}'),
         coalesce(array_agg(id order by ord) filter (where nombre !~* '^\s*otros?\s*$'), '{}')
    into otros, resto
    from (select s.id, s.ord, (public.catalog_name(p_kind, s.id)) as nombre from unnest(p_siblings) with ordinality as s(id, ord)) q;
  if array_length(otros, 1) > 0 and not es_otros then
    perform public.reorder_catalog(p_kind, resto || nuevo || otros);
  end if;
  return nuevo;
end;
$$;

-- Nombre de un elemento del catálogo por tipo e id (apoyo de create_catalog_item; INVOKER: respeta la RLS).
create function public.catalog_name(p_kind text, p_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare n text;
begin
  if p_kind not in ('ambitos', 'categorias', 'subcategorias', 'medios_pago') then raise exception 'Tipo de catálogo no válido: %', p_kind; end if;
  execute format('select name from public.%I where id = $1', p_kind) into n using p_id;
  return n;
end;
$$;

revoke all on function public.create_catalog_item(text, jsonb, uuid[]) from public, anon;
grant execute on function public.create_catalog_item(text, jsonb, uuid[]) to authenticated;
revoke all on function public.catalog_name(text, uuid) from public, anon;
grant execute on function public.catalog_name(text, uuid) to authenticated;
