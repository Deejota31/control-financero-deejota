import { agruparPor, round2, type GastoBasico } from './dashboard'

/** Lógica de Salud financiera. Todo se deriva de los gastos reales; nada se inventa cuando faltan datos. */

export interface FilaTendencia {
  id: string
  actual: number
  /** Promedio de los meses anteriores con datos, para el mismo tramo del mes. */
  promedio: number
  diferencia: number
  pct: number | null
}

export interface Tendencias {
  /** Cantidad de meses anteriores con gasto usados como base. 0 = datos insuficientes. */
  mesesBase: number
  aumentando: FilaTendencia[]
}

type Clave = 'categoria_id' | 'subcategoria_id'

/**
 * Compara el gasto del mes actual (hasta el mismo día) con el promedio de meses anteriores (mismo tramo).
 * Marca como "aumentando" lo que sube al menos `minPct` % y `minMonto` soles.
 */
export function tendencias(actual: GastoBasico[], previos: GastoBasico[][], clave: Clave, opc: { minPct?: number; minMonto?: number } = {}): Tendencias {
  const { minPct = 10, minMonto = 30 } = opc
  const base = previos.filter((m) => m.length > 0)
  if (base.length === 0) return { mesesBase: 0, aumentando: [] }
  const acumPrev = new Map<string, number>()
  for (const mes of base) for (const a of agruparPor(mes, clave)) acumPrev.set(a.id, (acumPrev.get(a.id) ?? 0) + a.total)
  const filas: FilaTendencia[] = agruparPor(actual, clave).map((a) => {
    const promedio = round2((acumPrev.get(a.id) ?? 0) / base.length)
    const diferencia = round2(a.total - promedio)
    return { id: a.id, actual: a.total, promedio, diferencia, pct: promedio > 0 ? round2((diferencia / promedio) * 100) : null }
  })
  const aumentando = filas
    .filter((f) => f.diferencia >= minMonto && (f.pct === null || f.pct >= minPct))
    .sort((a, b) => b.diferencia - a.diferencia)
  return { mesesBase: base.length, aumentando }
}

export interface PromedioCategoria {
  id: string
  promedio: number
  participacion: number
}

/** Gastos variables con mayor promedio mensual (candidatos a reducir). Null si no hay meses anteriores con datos. */
export function variablesReducibles(previos: GastoBasico[][], limite = 5): { mesesBase: number; filas: PromedioCategoria[] } {
  const base = previos.filter((m) => m.some((g) => g.expense_type === 'variable'))
  if (base.length === 0) return { mesesBase: 0, filas: [] }
  const acum = new Map<string, number>()
  for (const mes of base) for (const a of agruparPor(mes.filter((g) => g.expense_type === 'variable'), 'categoria_id')) acum.set(a.id, (acum.get(a.id) ?? 0) + a.total)
  const totalVar = [...acum.values()].reduce((s, v) => s + v, 0)
  const filas = [...acum]
    .map(([id, v]) => ({ id, promedio: round2(v / base.length), participacion: totalVar > 0 ? round2((v / totalVar) * 100) : 0 }))
    .sort((a, b) => b.promedio - a.promedio)
    .slice(0, limite)
  return { mesesBase: base.length, filas }
}

export interface Compromisos {
  mesesBase: number
  promedio: number | null
  maximo: number | null
}

const esCompromiso = (g: GastoBasico) => g.is_recurring === true || g.expense_type === 'fixed'

/** Compromisos mensuales: gastos recurrentes o fijos de meses anteriores. */
export function compromisosMensuales(previos: GastoBasico[][]): Compromisos {
  const totales = previos.map((m) => round2(m.filter(esCompromiso).reduce((s, g) => s + Number(g.amount), 0))).filter((t) => t > 0)
  if (totales.length === 0) return { mesesBase: 0, promedio: null, maximo: null }
  return {
    mesesBase: totales.length,
    promedio: round2(totales.reduce((s, t) => s + t, 0) / totales.length),
    maximo: Math.max(...totales),
  }
}

export const totalCompromisos = (gastos: GastoBasico[]) => round2(gastos.filter(esCompromiso).reduce((s, g) => s + Number(g.amount), 0))

/** Reserva sugerida: lo mayor entre el promedio histórico y lo esperado por plantillas, redondeado hacia arriba a 10 soles. */
export function reservaSugerida(historico: Compromisos, esperadoPlantillas: number): number | null {
  const candidatos = [historico.promedio ?? 0, esperadoPlantillas].filter((n) => n > 0)
  if (candidatos.length === 0) return null
  return Math.ceil(Math.max(...candidatos) / 10) * 10
}

/** Ahorro hipotético de recortar `pct` % del promedio mensual. Es una sugerencia, no una certeza. */
export const ahorroPosible = (promedio: number, pct: number) => round2((promedio * pct) / 100)
