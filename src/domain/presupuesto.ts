import { diasEnRango, round2 } from './dashboard'
import { aCentimos, deCentimos } from './dinero'

/** Resta exacta de importes (en céntimos): 3 680 − 2 358.30 es 1 321.70, no 1 321.7000000000003. */
const restar = (a: number, b: number) => deCentimos(aCentimos(a) - aCentimos(b))

/** Fondo tal como lo devuelve `dashboard_panel` (importes ya en número). */
export interface FondoPanel {
  fund_id: string
  /** Moneda del fondo: `asignado` y `consumido` están en ella. Ausente = PEN. */
  moneda?: 'PEN' | 'USD'
  nombre: string
  es_general: boolean
  prioridad: number
  asignado: number
  consumido: number
  consumido_filtrado: number
}

/** Fondos en dólares del rango (nominal en US$) y su valoración referencial en soles con la última cotización de cada período. */
export interface UsdPanel {
  presupuesto_usd: number
  consumido_usd: number
  saldo_usd: number
  /** Algún período con fondos USD no tiene cotización: no se inventa una tasa y la valoración queda sin calcular. */
  sin_cotizacion: boolean
  /** Consumo (en soles) de los fondos PEN: se separa del de los fondos USD para no mezclar monedas. */
  consumido_pen_fondos: number
  presupuesto_valorizado: number | null
  consumido_valorizado: number | null
  saldo_valorizado: number | null
  tasas: { periodo: string; tasa: number; fecha_referencia: string; fuente: string; consultada_para: string }[]
}

export interface EntradaPresupuesto {
  /** null si el rango no toca ningún período con presupuesto. En soles: solo fondos PEN. */
  presupuesto: number | null
  /** Fondos USD del rango, o null/ausente si no hay ninguno (el cálculo es entonces el de siempre). */
  usd?: UsdPanel | null
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
  /** Desglose por moneda cuando hay fondos USD (presupuesto y saldo nominales; el consolidado en soles es referencial). */
  usd: {
    presupuestoUsd: number
    consumidoUsd: number
    saldoUsd: number
    /** Presupuesto/saldo de fondos PEN, en soles. */
    presupuestoPen: number
    saldoPen: number
    valorizado: boolean
    presupuestoValorizado: number | null
    saldoValorizado: number | null
    tasas: UsdPanel['tasas']
  } | null
  /**
   * Diferencia entre «asignado − gasto imputado» y el disponible valorizado: el consumo contable usa la tasa de cada gasto y el saldo de los
   * fondos USD la cotización del período. 0 si no hay fondos USD o no se pudieron valorizar.
   */
  diferenciaCambiaria: number
}

export function resumirPresupuesto(e: EntradaPresupuesto): ResumenPresupuesto {
  const usd = e.usd ?? null
  const valorizable = usd !== null && !usd.sin_cotizacion && usd.presupuesto_valorizado !== null && usd.saldo_valorizado !== null
  // Con fondos USD el consolidado en soles suma el presupuesto PEN y el valorizado de los USD (referencial); sin cotización solo cuenta el PEN.
  const penBase = usd !== null ? round2(e.presupuesto ?? 0) : null
  const asignado = usd !== null ? round2((penBase ?? 0) + (valorizable ? usd.presupuesto_valorizado! : 0)) : e.presupuesto === null ? null : round2(e.presupuesto)
  const imputado = round2(e.imputado)
  // Saldo FIRMADO: un sobregiro se ve como saldo negativo, nunca se oculta. El exceso consolidado es max(0, imputado − asignado); un fondo agotado no implica exceso global.
  // Con fondos USD el saldo es el nominal de cada fondo valorizado: PEN (asignado − consumido) + USD (saldo × tasa del período).
  const saldoPen = usd !== null ? restar(penBase ?? 0, usd.consumido_pen_fondos) : null
  const disponible = asignado === null ? null : usd !== null ? round2(saldoPen! + (valorizable ? usd.saldo_valorizado! : 0)) : restar(asignado, imputado)
  const diferenciaCambiaria = usd !== null && valorizable && asignado !== null && disponible !== null ? round2(restar(asignado, imputado) - disponible) : 0
  const exceso = disponible !== null && disponible < 0 ? deCentimos(-aCentimos(disponible)) : 0
  // El % consumido es lo realmente consumido del presupuesto (asignado − disponible); sin fondos USD coincide con imputado.
  const consumidoEfectivo = usd !== null && asignado !== null && disponible !== null ? restar(asignado, disponible) : imputado
  const consumoPct = asignado === null ? null : asignado > 0 ? round2((consumidoEfectivo / asignado) * 100) : consumidoEfectivo > 0 ? null : 0

  let estado: EstadoBarra
  if (asignado === null || asignado <= 0) estado = consumidoEfectivo > 0 && asignado !== null ? 'excedido' : 'sin-presupuesto'
  else if (disponible! < 0) estado = 'excedido'
  else if (disponible === 0) estado = 'agotado'
  else if ((consumoPct ?? 0) >= 85) estado = 'casi'
  else estado = 'ok'

  const porFondo = e.fondos.map((f) => ({ ...f, disponible: restar(f.asignado, f.consumido) }))
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
    usd: usd === null ? null : {
      presupuestoUsd: usd.presupuesto_usd, consumidoUsd: usd.consumido_usd, saldoUsd: usd.saldo_usd, presupuestoPen: penBase ?? 0, saldoPen: saldoPen ?? 0,
      valorizado: valorizable, presupuestoValorizado: valorizable ? usd.presupuesto_valorizado : null, saldoValorizado: valorizable ? usd.saldo_valorizado : null, tasas: usd.tasas,
    },
    diferenciaCambiaria,
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
