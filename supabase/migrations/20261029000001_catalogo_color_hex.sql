-- Catálogo: color libre (HEX) para ámbitos, categorías y medios de pago, y herencia de color de la categoría.
-- Aditiva y reversible: `color_token` se conserva como respaldo (valor heredado de antes) y los gastos solo
-- referencian ids, de modo que cambiar un color nunca altera importes ni períodos cerrados.
--
-- Reversión manual:
--   alter table public.ambitos     drop column color_hex;
--   alter table public.medios_pago drop column color_hex;
--   alter table public.categorias  drop constraint categorias_color_herencia_ck, drop column color_mode, drop column color_hex;

alter table public.ambitos
  add column color_hex text check (color_hex ~ '^#[0-9A-F]{6}$');

alter table public.medios_pago
  add column color_hex text check (color_hex ~ '^#[0-9A-F]{6}$');

alter table public.categorias
  add column color_hex text check (color_hex ~ '^#[0-9A-F]{6}$'),
  add column color_mode text not null default 'own' check (color_mode in ('own', 'inherit')),
  add constraint categorias_color_herencia_ck check (color_mode = 'own' or color_hex is null);

comment on column public.ambitos.color_hex is 'Color personalizado #RRGGBB; null = se usa color_token.';
comment on column public.categorias.color_mode is 'own = color propio (color_hex o color_token); inherit = usa el color efectivo de su ámbito.';
