/**
 * Reglas de compatibilidad de fondos, espejo de `fund_admits` en PostgreSQL.
 * La base de datos es la fuente de verdad; esto solo sirve para explicar y resaltar en la interfaz.
 */
export type Efecto = 'include' | 'exclude'

export interface ReglaAlcance {
  ambito_id: string | null
  categoria_id: string | null
  subcategoria_id: string | null
  effect: string
}
export interface ReglaMedio {
  payment_method_id: string
  effect: string
}
export interface Clasificacion {
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  payment_method_id: string
}

function coincide(r: ReglaAlcance, c: Clasificacion): boolean {
  return (
    (r.ambito_id !== null && r.ambito_id === c.ambito_id) ||
    (r.categoria_id !== null && r.categoria_id === c.categoria_id) ||
    (r.subcategoria_id !== null && r.subcategoria_id === c.subcategoria_id)
  )
}

export function admiteClasificacion(reglas: ReglaAlcance[], c: Clasificacion): boolean {
  const incluye = reglas.filter((r) => r.effect === 'include')
  const excluye = reglas.filter((r) => r.effect === 'exclude')
  return (incluye.length === 0 || incluye.some((r) => coincide(r, c))) && !excluye.some((r) => coincide(r, c))
}

export function admiteMedio(reglas: ReglaMedio[], medioId: string): boolean {
  const incluye = reglas.filter((r) => r.effect === 'include')
  const excluye = reglas.filter((r) => r.effect === 'exclude')
  return (incluye.length === 0 || incluye.some((r) => r.payment_method_id === medioId)) && !excluye.some((r) => r.payment_method_id === medioId)
}

export function admite(alcance: ReglaAlcance[], medios: ReglaMedio[], c: Clasificacion): boolean {
  return admiteClasificacion(alcance, c) && admiteMedio(medios, c.payment_method_id)
}

export interface ResumenFondo {
  asignado: number
  consumido: number
  disponible: number
  /** Porcentaje consumido sobre lo asignado (sin tope). */
  pct: number
  estado: 'ok' | 'casi' | 'agotado' | 'negativo'
}

export function resumirFondo(asignado: number, consumido: number): ResumenFondo {
  const disponible = round2(asignado - consumido)
  const pct = asignado > 0 ? (consumido / asignado) * 100 : consumido > 0 ? 100 : 0
  const estado = disponible < 0 ? 'negativo' : disponible === 0 && asignado > 0 ? 'agotado' : pct >= 85 ? 'casi' : 'ok'
  return { asignado, consumido, disponible, pct, estado }
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Resultado de las funciones `save_fund`, `reorder_funds` y `set_fund_period_budget`. */
export interface CambioFondos {
  dry_run: boolean
  fund_id?: string | null
  blocked?: string | null
  changed_expenses: number | null
  consumption_before: Record<string, number>
  consumption_after: Record<string, number> | null
  /** Detalle por período abierto (función preview_fund_change); puede faltar si la vista previa no estuvo disponible. */
  periodos?: { before: FilaPeriodoFondo[]; after: FilaPeriodoFondo[] | null }
}

export interface FilaPeriodoFondo {
  period_id: string
  /** Primer día del período (yyyy-MM-dd). */
  start: string
  fund_id: string
  fund_name: string
  assigned: number
  consumed: number
}

export interface CambioPorPeriodo {
  period_id: string
  start: string
  filas: {
    fund_id: string
    nombre: string
    asignadoAntes: number
    asignadoDespues: number
    consumoAntes: number
    consumoDespues: number
    /** Variación del disponible (asignado − consumo) del fondo en ese período: lo que gana o pierde de margen. */
    impacto: number
  }[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Compara el estado por período antes/después y deja solo lo que cambia. Cada período se trata por separado: sumar varios
 * períodos abiertos no equivale al consumo de un solo mes. Un fondo que desaparece (eliminado) se muestra con «después» en 0.
 */
export function cambiosPorPeriodo(antes: FilaPeriodoFondo[], despues: FilaPeriodoFondo[]): CambioPorPeriodo[] {
  const clave = (f: FilaPeriodoFondo) => `${f.period_id}|${f.fund_id}`
  const a = new Map(antes.map((f) => [clave(f), f]))
  const b = new Map(despues.map((f) => [clave(f), f]))
  const porPeriodo = new Map<string, CambioPorPeriodo>()
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(k), y = b.get(k), ref = (x ?? y)!
    const asignadoAntes = x?.assigned ?? 0, asignadoDespues = y?.assigned ?? 0
    const consumoAntes = x?.consumed ?? 0, consumoDespues = y?.consumed ?? 0
    if (r2(asignadoAntes) === r2(asignadoDespues) && r2(consumoAntes) === r2(consumoDespues)) continue
    const p = porPeriodo.get(ref.period_id) ?? { period_id: ref.period_id, start: ref.start, filas: [] }
    p.filas.push({ fund_id: ref.fund_id, nombre: ref.fund_name, asignadoAntes, asignadoDespues, consumoAntes, consumoDespues, impacto: r2((asignadoDespues - consumoDespues) - (asignadoAntes - consumoAntes)) })
    porPeriodo.set(ref.period_id, p)
  }
  return [...porPeriodo.values()].sort((m, n) => m.start.localeCompare(n.start))
}
