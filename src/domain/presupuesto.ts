import { diasEnRango, round2 } from './dashboard'

/** Fondo tal como lo devuelve `dashboard_panel` (importes ya en número). */
export interface FondoPanel {
  fund_id: string
  nombre: string
  es_general: boolean
  prioridad: number
  asignado: number
  consumido: number
  consumido_filtrado: number
}

export interface EntradaPresupuesto {
  /** null si el rango no toca ningún período con presupuesto. */
  presupuesto: number | null
  /** Gasto activo del rango sin filtros cruzados. */
  gastoRango: number
  /** Parte del gasto del rango que quedó imputada a fondos. */
  imputado: number
  sinFondo: number
  excedente: number
  fondos: FondoPanel[]
  /** Gasto con los filtros cruzados actuales. */
  total: number
  cantidad: number
  diasConGasto: number
  desde: string
  hasta: string
  hoy: string
  hayFiltros: boolean
}

export type EstadoBarra = 'sin-presupuesto' | 'ok' | 'casi' | 'agotado' | 'excedido'

export interface ResumenPresupuesto {
  asignado: number | null
  gastado: number
  imputado: number
  /** Presupuesto asignado − gasto imputado (puede ser negativo). */
  disponible: number | null
  /** Cuánto se superó el presupuesto (0 si no se superó). */
  exceso: number
  /** % consumido sobre lo asignado, sin tope. null sin presupuesto. */
  consumoPct: number | null
  estado: EstadoBarra
  fondosActivos: number
  fondosAgotados: number
  fondosSobregirados: number
  /** Fondos específicos agotados cuyo exceso absorbió el Fondo General. */
  fondosConExcedente: number
  sinFondo: number
  promedioDiario: number | null
  promedioPorMovimiento: number | null
  /** Con filtros cruzados no se puede repartir el presupuesto: se muestra aparte el gasto filtrado. */
  gastoFiltrado: number | null
  porcentajeFiltradoDelGastado: number | null
}

export function resumirPresupuesto(e: EntradaPresupuesto): ResumenPresupuesto {
  const asignado = e.presupuesto === null ? null : round2(e.presupuesto)
  const imputado = round2(e.imputado)
  const disponible = asignado === null ? null : round2(asignado - imputado)
  const exceso = disponible !== null && disponible < 0 ? round2(-disponible) : 0
  const consumoPct = asignado === null ? null : asignado > 0 ? round2((imputado / asignado) * 100) : imputado > 0 ? null : 0

  let estado: EstadoBarra
  if (asignado === null || asignado <= 0) estado = imputado > 0 && asignado !== null ? 'excedido' : 'sin-presupuesto'
  else if (disponible! < 0) estado = 'excedido'
  else if (disponible === 0) estado = 'agotado'
  else if ((consumoPct ?? 0) >= 85) estado = 'casi'
  else estado = 'ok'

  const porFondo = e.fondos.map((f) => ({ ...f, disponible: round2(f.asignado - f.consumido) }))
  const agotados = porFondo.filter((f) => f.asignado > 0 && f.disponible === 0)
  const sobregirados = porFondo.filter((f) => f.disponible < 0)
  const conExcedente = e.excedente > 0 ? agotados.filter((f) => !f.es_general).length : 0

  const ultimo = e.hoy < e.desde ? null : e.hoy > e.hasta ? e.hasta : e.hoy
  const transcurridos = ultimo === null ? 0 : diasEnRango(e.desde, ultimo)

  return {
    asignado,
    gastado: round2(e.gastoRango),
    imputado,
    disponible,
    exceso,
    consumoPct,
    estado,
    fondosActivos: e.fondos.length,
    fondosAgotados: agotados.length,
    fondosSobregirados: sobregirados.length,
    fondosConExcedente: conExcedente,
    sinFondo: round2(e.sinFondo),
    promedioDiario: transcurridos > 0 ? round2(e.total / transcurridos) : null,
    promedioPorMovimiento: e.cantidad > 0 ? round2(e.total / e.cantidad) : null,
    gastoFiltrado: e.hayFiltros ? round2(e.total) : null,
    porcentajeFiltradoDelGastado: e.hayFiltros && e.gastoRango > 0 ? round2((e.total / e.gastoRango) * 100) : null,
  }
}

export interface GeometriaBarra {
  /** Ancho (0-100) de lo consumido respecto de la escala de la barra. */
  consumidoPct: number
  /** Posición (0-100) del límite presupuestario. */
  limitePct: number
  /** Ancho (0-100) de la parte que supera el límite. */
  excesoPct: number
}

/**
 * La barra crece hasta mostrar el exceso real: la escala es el mayor entre presupuesto e imputado,
 * de modo que nada se recorta y el límite queda marcado donde corresponde.
 */
export function geometriaBarra(asignado: number | null, imputado: number): GeometriaBarra {
  const a = asignado ?? 0
  const escala = Math.max(a, imputado, 0.01)
  const limite = a > 0 ? (a / escala) * 100 : 0
  const consumido = (imputado / escala) * 100
  return { consumidoPct: consumido, limitePct: limite, excesoPct: Math.max(0, consumido - limite) }
}
