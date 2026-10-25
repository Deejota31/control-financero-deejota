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
}
