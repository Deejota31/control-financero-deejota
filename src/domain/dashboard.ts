import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, parse } from 'date-fns'

/** Funciones puras del Dashboard y Salud financiera. Las fechas son cadenas ISO (yyyy-MM-dd). */

const d = (iso: string) => parse(iso, 'yyyy-MM-dd', new Date(2000, 0, 1))
const iso = (x: Date) => format(x, 'yyyy-MM-dd')
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface GastoBasico {
  expense_date: string
  amount: number | string
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  expense_type?: string
  is_recurring?: boolean
}

export const diasEnRango = (desde: string, hasta: string) => differenceInCalendarDays(d(hasta), d(desde)) + 1

/** ¿El rango es exactamente un mes calendario? */
export function esMesCompleto(desde: string, hasta: string): boolean {
  return desde.endsWith('-01') && iso(endOfMonth(d(desde))) === hasta
}

/** Rango anterior comparable: el mes calendario previo si el rango es un mes completo; si no, el de igual duración. */
export function rangoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  if (esMesCompleto(desde, hasta)) {
    const ini = addMonths(d(desde), -1)
    return { desde: iso(ini), hasta: iso(endOfMonth(ini)) }
  }
  const n = diasEnRango(desde, hasta)
  return { desde: iso(addDays(d(desde), -n)), hasta: iso(addDays(d(desde), -1)) }
}

export const total = (gastos: GastoBasico[]) => round2(gastos.reduce((s, g) => s + Number(g.amount), 0))

/** Variación porcentual; null cuando no hay base de comparación. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return round2(((actual - anterior) / anterior) * 100)
}

export interface PuntoDiario {
  fecha: string
  dia: number
  gasto: number
  /** Acumulado real; null después de `hoy` (aún no ocurrió). */
  acumulado: number | null
  /** Ritmo ideal: presupuesto repartido por igual entre los días del rango. */
  ideal: number | null
  /** Proyección lineal desde hoy hasta el final del rango (estimación). */
  proyeccion: number | null
}

export interface MontoDia {
  expense_date: string
  amount: number | string
}

export function serieDiaria(gastos: MontoDia[], desde: string, hasta: string, hoy: string, presupuesto: number | null): PuntoDiario[] {
  const dias = diasEnRango(desde, hasta)
  const porDia = new Map<string, number>()
  for (const g of gastos) porDia.set(g.expense_date, (porDia.get(g.expense_date) ?? 0) + Number(g.amount))
  const ultimoReal = hoy < desde ? null : hoy > hasta ? hasta : hoy
  const transcurridos = ultimoReal ? diasEnRango(desde, ultimoReal) : 0
  const proy = proyeccionCierre(
    [...porDia].filter(([f]) => ultimoReal !== null && f <= ultimoReal).reduce((s, [, v]) => s + v, 0),
    transcurridos,
    dias,
  )
  let acum = 0
  const out: PuntoDiario[] = []
  for (let i = 0; i < dias; i++) {
    const f = iso(addDays(d(desde), i))
    const g = round2(porDia.get(f) ?? 0)
    const esReal = ultimoReal !== null && f <= ultimoReal
    if (esReal) acum = round2(acum + g)
    out.push({
      fecha: f,
      dia: i + 1,
      gasto: g,
      acumulado: esReal ? acum : null,
      ideal: presupuesto === null ? null : round2((presupuesto * (i + 1)) / dias),
      // La proyección arranca en el último día real para que la línea sea continua.
      proyeccion: proy !== null && ultimoReal !== null && transcurridos < dias && f >= ultimoReal ? (f === ultimoReal ? acum : round2(acum + ((proy - acum) * (differenceInCalendarDays(d(f), d(ultimoReal)))) / (dias - transcurridos))) : null,
    })
  }
  return out
}

/** Promedio diario hasta hoy por el total de días. Devuelve null si no hay días transcurridos. */
export function proyeccionCierre(gastoHastaHoy: number, diasTranscurridos: number, diasTotales: number): number | null {
  if (diasTranscurridos <= 0) return null
  return round2((gastoHastaHoy / diasTranscurridos) * diasTotales)
}

export interface Agrupado {
  id: string
  total: number
  cantidad: number
}

export function agruparPor(gastos: GastoBasico[], clave: 'ambito_id' | 'categoria_id' | 'subcategoria_id'): Agrupado[] {
  const m = new Map<string, Agrupado>()
  for (const g of gastos) {
    const id = g[clave]
    if (!id) continue
    const a = m.get(id) ?? { id, total: 0, cantidad: 0 }
    a.total = round2(a.total + Number(g.amount))
    a.cantidad += 1
    m.set(id, a)
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}

/** Gasto por categoría dentro de un conjunto de gastos, para comparar períodos. */
export function totalesPorClave(gastos: GastoBasico[], clave: 'categoria_id' | 'subcategoria_id'): Map<string, number> {
  return new Map(agruparPor(gastos, clave).map((a) => [a.id, a.total]))
}
