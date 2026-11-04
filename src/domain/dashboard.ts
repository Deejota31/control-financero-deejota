import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, parse } from 'date-fns'
import { aCentimos, deCentimos, redondear } from './dinero'

/** Funciones puras del Dashboard y Salud financiera. Las fechas son cadenas ISO (yyyy-MM-dd). Todo importe se suma en céntimos enteros (ver `dinero.ts`). */

const d = (iso: string) => parse(iso, 'yyyy-MM-dd', new Date(2000, 0, 1))
const iso = (x: Date) => format(x, 'yyyy-MM-dd')
export const round2 = redondear

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

export interface RangoComparable {
  /** Último día del rango actual que ya ocurrió (el rango completo si ya terminó). */
  corte: string
  /** Rango contra el que se compara. Tiene los mismos días transcurridos que el tramo actual. */
  anterior: { desde: string; hasta: string }
  /** true si el rango actual sigue en curso: se compara el mismo tramo, no el período completo anterior. */
  parcial: boolean
  /** false si el rango aún no empezó: no hay nada que comparar. */
  comparable: boolean
}

/**
 * Qué comparar con qué. Contrastar un mes en curso (4 días de gasto) con el mes anterior completo (31 días) siempre mostraría una «bajada» enorme
 * que no significa nada. Por eso, mientras el rango sigue en curso, se compara el MISMO TRAMO: del día 1 al día N de este mes contra del día 1 al
 * día N del mes anterior (acotado a su último día: el 31 frente a febrero compara con el 28). Un rango ya terminado compara período completo con período completo.
 */
export function rangoComparable(desde: string, hasta: string, hoy: string): RangoComparable {
  if (hoy < desde) return { corte: hasta, anterior: rangoAnterior(desde, hasta), parcial: false, comparable: false }
  if (hoy >= hasta) return { corte: hasta, anterior: rangoAnterior(desde, hasta), parcial: false, comparable: true }
  // En curso: el tramo actual va de `desde` a hoy.
  const transcurridos = diasEnRango(desde, hoy)
  if (esMesCompleto(desde, hasta)) {
    const ini = addMonths(d(desde), -1)
    const finMes = endOfMonth(ini)
    const fin = addDays(ini, transcurridos - 1)
    return { corte: hoy, anterior: { desde: iso(ini), hasta: iso(fin > finMes ? finMes : fin) }, parcial: true, comparable: true }
  }
  return { corte: hoy, anterior: { desde: iso(addDays(d(desde), -transcurridos)), hasta: iso(addDays(d(desde), -1)) }, parcial: true, comparable: true }
}

export const total = (gastos: GastoBasico[]) => deCentimos(gastos.reduce((s, g) => s + aCentimos(g.amount), 0))

/** Variación porcentual; null cuando no hay base de comparación (anterior ≤ 0): nunca infinito ni un porcentaje artificial. */
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
  /** Ritmo ideal: presupuesto × día / días del rango. Termina exactamente en el presupuesto. */
  ideal: number | null
  /** Proyección desde el último día real hasta el final del rango (estimación); null si no hay. */
  proyeccion: number | null
}

export interface MontoDia {
  expense_date: string
  amount: number | string
}

/** Ritmo ideal del día `n` (1…dias): presupuesto repartido por igual. Se calcula en céntimos: el último día es EXACTAMENTE el presupuesto. */
export const ritmoIdeal = (presupuesto: number, n: number, dias: number): number => deCentimos(Math.round((aCentimos(presupuesto) * n) / dias))

/**
 * Serie día a día del rango.
 * @param cierre importe de cierre que debe alcanzar la línea de proyección: `undefined` usa la proyección lineal simple, `null` no dibuja proyección
 *               y un número dibuja una recta desde el último gasto real hasta ese importe (el valor de una proyección ajustada).
 */
export function serieDiaria(gastos: MontoDia[], desde: string, hasta: string, hoy: string, presupuesto: number | null, cierre?: number | null): PuntoDiario[] {
  const dias = diasEnRango(desde, hasta)
  const porDia = new Map<string, number>()
  for (const g of gastos) porDia.set(g.expense_date, (porDia.get(g.expense_date) ?? 0) + aCentimos(g.amount))
  const ultimoReal = hoy < desde ? null : hoy > hasta ? hasta : hoy
  const transcurridos = ultimoReal ? diasEnRango(desde, ultimoReal) : 0
  const realCent = [...porDia].filter(([f]) => ultimoReal !== null && f <= ultimoReal).reduce((s, [, v]) => s + v, 0)
  const proy = cierre === undefined ? proyeccionCierre(deCentimos(realCent), transcurridos, dias) : cierre
  let acumCent = 0
  const out: PuntoDiario[] = []
  for (let i = 0; i < dias; i++) {
    const f = iso(addDays(d(desde), i))
    const gCent = porDia.get(f) ?? 0
    const esReal = ultimoReal !== null && f <= ultimoReal
    if (esReal) acumCent += gCent
    const restantes = dias - transcurridos
    out.push({
      fecha: f,
      dia: i + 1,
      gasto: deCentimos(gCent),
      acumulado: esReal ? deCentimos(acumCent) : null,
      ideal: presupuesto === null ? null : ritmoIdeal(presupuesto, i + 1, dias),
      // La proyección arranca en el último día real (el mismo acumulado) para que la línea sea continua, sin saltos.
      proyeccion:
        proy !== null && ultimoReal !== null && restantes > 0 && f >= ultimoReal
          ? f === ultimoReal ? deCentimos(acumCent) : deCentimos(Math.round(acumCent + ((aCentimos(proy) - acumCent) * differenceInCalendarDays(d(f), d(ultimoReal))) / restantes))
          : null,
    })
  }
  return out
}

/**
 * Proyección LINEAL simple: promedio diario hasta hoy × días del rango. Es una referencia matemática, no una predicción: con pocos días de datos
 * extrapola cualquier gasto concentrado (un pago único al inicio del mes se «repite» todos los días). La estimación que se muestra al usuario sale de `proyeccion.ts`.
 */
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
  const m = new Map<string, { id: string; centimos: number; cantidad: number }>()
  for (const g of gastos) {
    const id = g[clave]
    if (!id) continue
    const a = m.get(id) ?? { id, centimos: 0, cantidad: 0 }
    a.centimos += aCentimos(g.amount)
    a.cantidad += 1
    m.set(id, a)
  }
  return [...m.values()].map((a) => ({ id: a.id, total: deCentimos(a.centimos), cantidad: a.cantidad })).sort((a, b) => b.total - a.total)
}
