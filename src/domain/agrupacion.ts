/**
 * Agrupación y orden de listas de plantillas. Es solo presentación: el orden visual y las secciones nunca cambian la clasificación financiera
 * (ámbito, categoría) ni la prioridad de una plantilla; esas se editan de forma explícita.
 */
export interface Seccion<T> {
  clave: string
  titulo: string
  icono?: string | null
  color?: string | null
  items: T[]
}

export interface ClaveSeccion {
  clave: string
  titulo: string
  icono?: string | null
  color?: string | null
}

/** Clave estable para comparar nombres: sin mayúsculas ni espacios sobrantes (así «Alimentación» de dos ámbitos es una sola sección). */
export const claveDeNombre = (nombre: string) => nombre.trim().toLowerCase()

/** Agrupa conservando el orden de los elementos; las secciones salen por primera aparición. */
export function agrupar<T>(items: T[], claveDe: (x: T) => ClaveSeccion): Seccion<T>[] {
  const mapa = new Map<string, Seccion<T>>()
  for (const x of items) {
    const k = claveDe(x)
    const s = mapa.get(k.clave)
    if (s) s.items.push(x)
    else mapa.set(k.clave, { ...k, items: [x] })
  }
  return [...mapa.values()]
}

/** Aplica un orden guardado de secciones: primero las conocidas en ese orden, después las nuevas en su orden natural. */
export function ordenarSecciones<T>(secciones: Seccion<T>[], orden: string[]): Seccion<T>[] {
  const pos = new Map(orden.map((k, i) => [k, i]))
  const conocidas = secciones.filter((s) => pos.has(s.clave)).sort((a, b) => pos.get(a.clave)! - pos.get(b.clave)!)
  return [...conocidas, ...secciones.filter((s) => !pos.has(s.clave))]
}

export type EstadoSeleccion = 'none' | 'some' | 'all'

/** Estado de un grupo de casillas: ninguna, algunas (indeterminado) o todas. Un grupo vacío es «none». */
export function estadoSeleccion(ids: string[], seleccion: ReadonlySet<string>): EstadoSeleccion {
  const n = ids.filter((id) => seleccion.has(id)).length
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
}

/** Mueve `origen` justo antes de `destino`. Si alguno no está, devuelve la lista igual. */
export function moverAntes(ids: string[], origen: string, destino: string): string[] {
  if (origen === destino || !ids.includes(origen) || !ids.includes(destino)) return ids
  const sin = ids.filter((x) => x !== origen)
  sin.splice(sin.indexOf(destino), 0, origen)
  return sin
}

/** Mueve un elemento una posición hacia arriba (-1) o abajo (+1) dentro de `ids`. */
export function moverDelta(ids: string[], id: string, delta: -1 | 1): string[] {
  const i = ids.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const n = [...ids]
  ;[n[i], n[j]] = [n[j], n[i]]
  return n
}

/** Reordena `todos` (orden global) para que los `visibles` queden en el orden `nuevoVisible`, sin mover los que no se ven. */
export function reordenarVisibles(todos: string[], visibles: string[], nuevoVisible: string[]): string[] {
  const set = new Set(visibles)
  const cola = [...nuevoVisible]
  return todos.map((id) => (set.has(id) ? (cola.shift() as string) : id))
}
