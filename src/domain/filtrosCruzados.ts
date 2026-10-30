/**
 * Estado único de filtros del Dashboard y reglas de selección cruzada (dona, barras, acumulado, Top 5).
 * Es una función pura: la interfaz la usa dentro de un hook ligado a la URL.
 */
import { idsDe, unirIds } from './idsFiltro'

/** `categoria` y `subcategoria` pueden llevar varios IDs unidos por coma (todas las clasificaciones con el mismo nombre; ver idsFiltro). */
export interface FiltrosDashboard {
  desde: string
  hasta: string
  ambito: string
  categoria: string
  subcategoria: string
  medio: string
  tipo: '' | 'fixed' | 'variable'
  /** Día seleccionado dentro del período (yyyy-MM-dd) o ''. */
  dia: string
}

export type ClaveFiltro = 'ambito' | 'categoria' | 'subcategoria' | 'medio' | 'tipo' | 'dia'

/** Relaciones del catálogo necesarias para mantener coherentes ámbito, categoría y subcategoría. */
export interface RelacionesCatalogo {
  ambitoDeCategoria: Map<string, string>
  categoriaDeSubcategoria: Map<string, string>
}

export const CLAVES_CRUZADAS: ClaveFiltro[] = ['ambito', 'categoria', 'subcategoria', 'medio', 'tipo', 'dia']

/**
 * Aplica una selección. Seleccionar de nuevo el valor activo lo desactiva.
 * - Cambiar de ámbito limpia categoría/subcategoría que no le pertenecen.
 * - Elegir una subcategoría fija también su categoría (y esa su ámbito si ya hay uno incompatible se reemplaza).
 * - El día debe estar dentro del período.
 */
export function aplicarSeleccion(actual: FiltrosDashboard, clave: ClaveFiltro, valor: string, rel: RelacionesCatalogo): FiltrosDashboard {
  const activo = actual[clave] === valor
  const siguiente: FiltrosDashboard = { ...actual }

  if (clave === 'dia') {
    if (!activo && (valor < actual.desde || valor > actual.hasta)) return actual
    siguiente.dia = activo ? '' : valor
    return siguiente
  }
  if (clave === 'tipo') {
    siguiente.tipo = activo ? '' : (valor as FiltrosDashboard['tipo'])
    return siguiente
  }
  if (activo) {
    siguiente[clave] = ''
    return siguiente
  }

  siguiente[clave] = valor
  if (clave === 'ambito') {
    // La categoría elegida (varias si es un grupo por nombre) se acota a las de este ámbito; si ninguna le pertenece, se limpia.
    const cats = idsDe(siguiente.categoria).filter((c) => rel.ambitoDeCategoria.get(c) === valor)
    if (idsDe(siguiente.categoria).length && cats.length === 0) {
      siguiente.categoria = ''
      siguiente.subcategoria = ''
    } else if (cats.length) {
      siguiente.categoria = unirIds(cats)
      const subs = idsDe(siguiente.subcategoria).filter((s) => cats.includes(rel.categoriaDeSubcategoria.get(s) ?? ''))
      siguiente.subcategoria = unirIds(subs)
    }
  } else if (clave === 'categoria') {
    const cats = idsDe(valor)
    const subs = idsDe(siguiente.subcategoria).filter((s) => cats.includes(rel.categoriaDeSubcategoria.get(s) ?? ''))
    siguiente.subcategoria = unirIds(subs)
    const ambitos = new Set(cats.map((c) => rel.ambitoDeCategoria.get(c)))
    if (siguiente.ambito && !ambitos.has(siguiente.ambito)) siguiente.ambito = ''
  } else if (clave === 'subcategoria') {
    const cats = [...new Set(idsDe(valor).map((s) => rel.categoriaDeSubcategoria.get(s)).filter((c): c is string => Boolean(c)))]
    // Con una sola categoría posible se fija también; con varias (p. ej. «Otros») se deja la categoría tal como está.
    if (cats.length === 1) {
      siguiente.categoria = cats[0]
      const amb = rel.ambitoDeCategoria.get(cats[0])
      if (amb && siguiente.ambito && siguiente.ambito !== amb) siguiente.ambito = ''
    }
  }
  return siguiente
}

/** Quita todos los filtros cruzados y conserva el período. */
export function limpiarCruzados(f: FiltrosDashboard): FiltrosDashboard {
  return { ...f, ambito: '', categoria: '', subcategoria: '', medio: '', tipo: '', dia: '' }
}

export const hayCruzados = (f: FiltrosDashboard) => CLAVES_CRUZADAS.some((k) => f[k] !== '')

/** Cambiar el período invalida el día seleccionado si queda fuera. */
export function conPeriodo(f: FiltrosDashboard, desde: string, hasta: string): FiltrosDashboard {
  const dia = f.dia && f.dia >= desde && f.dia <= hasta ? f.dia : ''
  return { ...f, desde, hasta, dia }
}

/** Parámetros de la página Gastos que conservan el contexto (un día se traduce a un rango de un solo día). */
export function paramsGastos(f: FiltrosDashboard): URLSearchParams {
  const p = new URLSearchParams({ desde: f.dia || f.desde, hasta: f.dia || f.hasta })
  for (const k of ['ambito', 'categoria', 'subcategoria', 'medio', 'tipo'] as const) if (f[k]) p.set(k, f[k])
  return p
}
