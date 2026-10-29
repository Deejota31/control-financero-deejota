/**
 * Filtros por varios IDs. Varias categorías se llaman igual en ámbitos distintos (y varias subcategorías bajo categorías distintas): son
 * registros diferentes con su propio ID, que no se fusionan. El selector muestra UNA opción por nombre y la elección conserva todos esos IDs,
 * separados por coma, de modo que el filtro incluye todas las clasificaciones homónimas.
 */
export const SEP_IDS = ','

export const idsDe = (valor: string | null | undefined): string[] => (valor ? valor.split(SEP_IDS).filter(Boolean) : [])
export const unirIds = (ids: string[]): string => ids.join(SEP_IDS)

export interface GrupoNombre<T> {
  /** IDs unidos: es el valor del filtro y de la opción del selector. */
  valor: string
  nombre: string
  ids: string[]
  /** Primer elemento del grupo (en el orden del Catálogo): aporta icono y color. */
  primero: T
}

const normalizar = (s: string) => s.trim().toLocaleLowerCase('es')

/** Agrupa por nombre conservando el orden del Catálogo (aparición del primer elemento). Solo activos, más el elegido aunque esté desactivado. */
export function agruparPorNombre<T extends { id: string; name: string; is_active: boolean }>(items: T[], actual?: string | null): GrupoNombre<T>[] {
  const elegidos = new Set(idsDe(actual))
  const grupos = new Map<string, GrupoNombre<T>>()
  for (const i of items) {
    if (!i.is_active && !elegidos.has(i.id)) continue
    const k = normalizar(i.name)
    const g = grupos.get(k)
    if (g) { g.ids.push(i.id); g.valor = unirIds(g.ids) } else grupos.set(k, { valor: i.id, nombre: i.name.trim(), ids: [i.id], primero: i })
  }
  return [...grupos.values()]
}

/** Valor del selector para la elección actual: el del grupo que contiene sus IDs (así «Alimentación» se ve elegida aunque se haya acotado). */
export function valorDeGrupo<T>(grupos: GrupoNombre<T>[], actual: string | null | undefined): string | null {
  const ids = idsDe(actual)
  if (ids.length === 0) return null
  return grupos.find((g) => ids.every((id) => g.ids.includes(id)))?.valor ?? actual ?? null
}
