import type { Catalogo } from '@/features/catalogo/useCatalogo'

/** Icono y color de la clasificación de una plantilla (el color efectivo del catálogo: subcategoría, categoría o, si no hay, ámbito). */
export function claseDe(cat: Catalogo, p: { ambito_id: string | null; categoria_id: string | null; subcategoria_id: string | null }) {
  const a = cat.ambitos.find((x) => x.id === p.ambito_id), c = cat.categorias.find((x) => x.id === p.categoria_id), s = cat.subcategorias.find((x) => x.id === p.subcategoria_id)
  return { a, c, s, icono: (s ?? c ?? a)?.icon_key, color: (s ?? c ?? a)?.color_css }
}
