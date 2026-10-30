-- Colores libres en fondos y colores propios en subcategorías.
--
-- 1) `is_valid_color` admite también un #RRGGBB: los fondos (y el resto de tablas que usan color_token) pueden guardar un color de la
--    paleta ampliada o personalizado sin una columna nueva. Los tokens anteriores siguen siendo válidos.
-- 2) Las subcategorías pasan a poder heredar el color de su categoría (comportamiento actual, valor por defecto) o tener color propio.
--    Se guarda el MODO (no una copia del HEX heredado): si la categoría cambia de color, las que heredan la siguen.
--
-- Aditiva y reversible:
--   alter table public.subcategorias drop constraint subcategorias_color_ck, drop column color_mode, drop column color_hex;
--   create or replace function public.is_valid_color(k text) returns boolean language sql immutable as
--     $f$ select k = any (array['c1','c2','c3','c4','c5','pri','acc','muted']); $f$;

create or replace function public.is_valid_color(k text)
returns boolean
language sql
immutable
as $$
  select k = any (array['c1','c2','c3','c4','c5','pri','acc','muted']) or k ~ '^#[0-9A-Fa-f]{6}$';
$$;

alter table public.subcategorias
  add column color_hex text check (color_hex ~ '^#[0-9A-F]{6}$'),
  add column color_mode text not null default 'inherit' check (color_mode in ('own', 'inherit')),
  add constraint subcategorias_color_ck check ((color_mode = 'inherit' and color_hex is null) or (color_mode = 'own' and color_hex is not null));

comment on column public.subcategorias.color_mode is 'inherit = usa el color efectivo de su categoría; own = usa color_hex.';
