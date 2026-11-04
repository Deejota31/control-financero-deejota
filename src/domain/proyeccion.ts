/**
 * Proyección de cierre del mes (función pura, sin pantalla). Metodología documentada en docs/proyeccion.md.
 *
 * Por qué no basta el promedio diario: la proyección lineal «gasto ÷ días transcurridos × días del mes» trata cada gasto como si se repitiera todos los días.
 * Con 4 días de datos, un ahorro mensual de S/ 700 hecho el día 3 se «repite» 10 veces y el cierre sale 5 veces mayor que el presupuesto.
 * La estimación ajustada separa lo que ocurre UNA vez al mes (gastos fijos y recurrentes) de lo que ocurre día a día (gasto variable):
 *
 *   cierre = gasto real hasta hoy + compromisos pendientes + tasa diaria variable × días restantes
 *
 * - Compromisos pendientes: los pagos planificados (plantillas mensuales activas que aún no se registraron ni se marcaron «No aplica») si existen;
 *   si no hay plantillas, el promedio mensual de gastos fijos/recurrentes de los meses cerrados menos lo ya registrado; si tampoco hay historial, 0.
 *   Un pago planificado NO es un gasto real: solo entra en la estimación y se descuenta cuando se registra (nunca se cuenta dos veces).
 * - Tasa diaria variable: solo con días COMPLETOS (hoy se excluye de la tasa porque aún no terminó), mezclada con el historial de meses cerrados
 *   (cada día de historial pesa igual que un día del mes en curso, con un peso previo equivalente a 7 días).
 * - Nada se excluye en silencio por ser grande. Si un solo gasto concentra gran parte del variable se advierte, pero se cuenta.
 */
import { addMonths, differenceInCalendarDays, endOfMonth, format, parse } from 'date-fns'
import { filtrar, type FiltrosAnalisis } from './analisis'
import { esMesCompleto } from './dashboard'
import { aCentimos, deCentimos, redondear } from './dinero'

export type Confiabilidad = 'insuficiente' | 'preliminar' | 'con-historial'

/** Criterios objetivos (también en docs/proyeccion.md). */
export const CRITERIOS = {
  /** Días completos mínimos del mes en curso para estimar solo con sus datos. */
  diasMinimos: 7,
  /** Meses cerrados con datos que bastan para estimar aunque el mes recién empiece. */
  mesesMinimos: 2,
  /** Para «con historial»: al menos este número de meses cerrados y de días completos. */
  mesesHistorial: 3,
  diasHistorial: 10,
  /** Peso previo del historial, en «días equivalentes». */
  pesoPrevio: 7,
  /** Un gasto que supera este porcentaje del variable genera una advertencia. */
  concentracionPct: 40,
} as const

export interface FilaProy {
  fecha: string
  monto: number | string
  /** `expense_type` del gasto. */
  tipo: string
  /** Marcado como recurrente (nace de una plantilla mensual o se registró como recurrente). */
  recurrente: boolean
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  medio_id: string
}

export interface PlantillaPlan {
  id: string
  monto: number | string
  tipo: string
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  medio_id: string | null
}

export interface EntradaProyeccion {
  desde: string
  hasta: string
  hoy: string
  /** Gastos activos del rango y de los seis meses anteriores, SIN filtros (el filtrado se hace aquí). */
  filas: FilaProy[]
  /** Plantillas activas con importe; `null` si la persona no usa plantillas. */
  plantillas: PlantillaPlan[] | null
  /** Plantillas ya registradas este mes (por `template_id`) o marcadas «No aplica». */
  plantillasResueltas: ReadonlySet<string>
  filtros: Omit<FiltrosAnalisis, 'dia'>
  presupuesto: number | null
}

export interface Proyeccion {
  /** false si el rango no es un mes completo en curso: no hay nada que proyectar. */
  aplicable: boolean
  real: number
  /** Referencia lineal simple (nunca se presenta como predicción fiable). */
  lineal: number | null
  /** Estimación ajustada; null con datos insuficientes. */
  ajustada: number | null
  confiabilidad: Confiabilidad
  /** Qué modelo produjo `ajustada`, en una frase. */
  modelo: string
  /** Por qué no hay estimación, o qué la limita. */
  motivo: string
  componentes: {
    diasTranscurridos: number
    diasCompletos: number
    diasRestantes: number
    mesesHistorial: number
    tasaDiariaVariable: number | null
    compromisosPendientes: number
    origenCompromisos: 'planificados' | 'historial' | 'ninguno'
    variableRestante: number
  }
  /** (Ajustada) − presupuesto; null sin presupuesto o sin estimación. */
  diferenciaVsPresupuesto: number | null
  advertencias: string[]
}

const d = (iso: string) => parse(iso, 'yyyy-MM-dd', new Date(2000, 0, 1))
const iso = (x: Date) => format(x, 'yyyy-MM-dd')
const mesDe = (fecha: string) => `${fecha.slice(0, 7)}-01`
export const diasDelMes = (mes: string) => endOfMonth(d(mes)).getDate()
const esComprometido = (f: { tipo: string; recurrente: boolean }) => f.tipo === 'fixed' || f.recurrente

const NO_APLICA: Proyeccion = {
  aplicable: false, real: 0, lineal: null, ajustada: null, confiabilidad: 'insuficiente', modelo: '', motivo: '',
  componentes: { diasTranscurridos: 0, diasCompletos: 0, diasRestantes: 0, mesesHistorial: 0, tasaDiariaVariable: null, compromisosPendientes: 0, origenCompromisos: 'ninguno', variableRestante: 0 },
  diferenciaVsPresupuesto: null, advertencias: [],
}

export function proyectarCierre(e: EntradaProyeccion): Proyeccion {
  const { desde, hasta, hoy } = e
  // Solo un mes calendario completo y en curso (el primer día ya empezó y el último aún no terminó).
  if (!esMesCompleto(desde, hasta) || hoy < desde || hoy >= hasta) return { ...NO_APLICA, componentes: { ...NO_APLICA.componentes } }

  const diasTotales = differenceInCalendarDays(d(hasta), d(desde)) + 1
  const diasTranscurridos = differenceInCalendarDays(d(hoy), d(desde)) + 1
  const diasCompletos = diasTranscurridos - 1 // hoy aún no terminó: no entra en la tasa diaria
  const diasRestantes = diasTotales - diasTranscurridos

  const paraFiltro = (f: FilaProy, extra: Record<string, unknown> = {}) => ({ ...f, monto: Number(f.monto), ...extra })
  const pasa = (f: FilaProy) => filtrar([paraFiltro(f)], { ...e.filtros, dia: '' }).length === 1

  // ---- Gasto real del mes en curso (nunca movimientos posteriores a hoy)
  const delMes = e.filas.filter((f) => f.fecha >= desde && f.fecha <= hasta && pasa(f))
  const reales = delMes.filter((f) => f.fecha <= hoy)
  const realCent = reales.reduce((s, f) => s + aCentimos(f.monto), 0)
  const real = deCentimos(realCent)
  const lineal = redondear((real / diasTranscurridos) * diasTotales)

  // ---- Historial: meses cerrados anteriores con datos (observados SIN filtros; los importes, con filtros)
  const iniMes = d(desde)
  const mesesAnteriores = Array.from({ length: 5 }, (_, i) => iso(addMonths(iniMes, -(i + 1))))
  const observados = mesesAnteriores.filter((m) => e.filas.some((f) => mesDe(f.fecha) === m))
  const hist = observados.map((m) => {
    const filas = e.filas.filter((f) => mesDe(f.fecha) === m && pasa(f))
    return {
      mes: m,
      dias: diasDelMes(m),
      variable: filas.filter((f) => !esComprometido(f)).reduce((s, f) => s + aCentimos(f.monto), 0),
      comprometido: filas.filter(esComprometido).reduce((s, f) => s + aCentimos(f.monto), 0),
    }
  })
  const mesesHistorial = hist.length

  // ---- Confiabilidad (criterios objetivos)
  let confiabilidad: Confiabilidad
  if (diasCompletos < CRITERIOS.diasMinimos && mesesHistorial < CRITERIOS.mesesMinimos) confiabilidad = 'insuficiente'
  else if (diasCompletos >= CRITERIOS.diasHistorial && mesesHistorial >= CRITERIOS.mesesHistorial) confiabilidad = 'con-historial'
  else confiabilidad = 'preliminar'

  const advertencias: string[] = []
  const base = { aplicable: true, real, lineal, componentes: { diasTranscurridos, diasCompletos, diasRestantes, mesesHistorial, tasaDiariaVariable: null as number | null, compromisosPendientes: 0, origenCompromisos: 'ninguno' as const, variableRestante: 0 } }
  if (confiabilidad === 'insuficiente') {
    return {
      ...base, ajustada: null, confiabilidad, modelo: '', diferenciaVsPresupuesto: null, advertencias,
      motivo: `Datos insuficientes: la estimación necesita al menos ${CRITERIOS.diasMinimos} días completos del mes o ${CRITERIOS.mesesMinimos} meses cerrados con gasto. Llevas ${diasCompletos} ${diasCompletos === 1 ? 'día completo' : 'días completos'} y ${mesesHistorial} ${mesesHistorial === 1 ? 'mes' : 'meses'} de historial.`,
    }
  }

  // ---- Tasa diaria variable
  const variableCompletoCent = reales.filter((f) => !esComprometido(f) && f.fecha < hoy).reduce((s, f) => s + aCentimos(f.monto), 0)
  const histVariableCent = hist.reduce((s, h) => s + h.variable, 0)
  const histDias = hist.reduce((s, h) => s + h.dias, 0)
  let tasaCent: number
  if (mesesHistorial >= 1) {
    const tasaHist = histVariableCent / histDias
    tasaCent = (variableCompletoCent + tasaHist * CRITERIOS.pesoPrevio) / (diasCompletos + CRITERIOS.pesoPrevio)
  } else {
    tasaCent = variableCompletoCent / diasCompletos // sin historial: solo el propio mes (ya hay ≥ 7 días completos)
  }
  const variableRestanteCent = Math.round(tasaCent * diasRestantes)

  // ---- Compromisos pendientes (pagos que ocurren una vez al mes)
  const comprometidoRealCent = reales.filter(esComprometido).reduce((s, f) => s + aCentimos(f.monto), 0)
  let pendienteCent = 0
  let origen: 'planificados' | 'historial' | 'ninguno' = 'ninguno'
  if (e.plantillas !== null && e.plantillas.length > 0) {
    const pendientes = e.plantillas.filter((p) => !e.plantillasResueltas.has(p.id) && filtrar([{ ...p, medio_id: p.medio_id ?? '', monto: Number(p.monto) }], { ...e.filtros, dia: '' }).length === 1)
    pendienteCent = pendientes.reduce((s, p) => s + aCentimos(p.monto), 0)
    origen = 'planificados'
  } else if (mesesHistorial >= CRITERIOS.mesesMinimos) {
    const esperado = hist.reduce((s, h) => s + h.comprometido, 0) / mesesHistorial
    pendienteCent = Math.max(0, Math.round(esperado - comprometidoRealCent))
    origen = 'historial'
  }

  const ajustadaCent = realCent + pendienteCent + variableRestanteCent
  const ajustada = deCentimos(ajustadaCent)
  const modelo = origen === 'planificados' ? 'Gasto real + pagos planificados pendientes + ritmo diario variable'
    : origen === 'historial' ? 'Gasto real + compromisos típicos de meses anteriores + ritmo diario variable'
    : 'Gasto real + ritmo diario variable'

  // ---- Advertencias (contexto, nunca errores técnicos)
  const variablesReales = reales.filter((f) => !esComprometido(f))
  const variableRealCent = variablesReales.reduce((s, f) => s + aCentimos(f.monto), 0)
  const mayor = variablesReales.reduce((m, f) => Math.max(m, aCentimos(f.monto)), 0)
  if (variableRealCent > 0 && (mayor / variableRealCent) * 100 > CRITERIOS.concentracionPct && diasCompletos < 15) {
    advertencias.push(`Un solo gasto (S/ ${deCentimos(mayor).toFixed(2)}) concentra el ${Math.round((mayor / variableRealCent) * 100)} % del gasto variable de estos días: la estimación puede quedar por encima de lo real.`)
  }
  if (confiabilidad === 'preliminar') {
    advertencias.push(mesesHistorial < CRITERIOS.mesesMinimos
      ? 'Estimación preliminar: se calcula solo con los días transcurridos de este mes, sin historial suficiente.'
      : 'Estimación preliminar: todavía hay pocos días de este mes; se apoya en el historial.')
  }
  const diferenciaVsPresupuesto = e.presupuesto === null ? null : redondear(ajustada - e.presupuesto)
  if (diferenciaVsPresupuesto !== null && e.presupuesto! > 0 && diferenciaVsPresupuesto > 0) {
    advertencias.push(`Si el ritmo se mantiene, el cierre superaría el presupuesto en S/ ${diferenciaVsPresupuesto.toFixed(2)}. Es una estimación, no un hecho.`)
  }

  return {
    ...base,
    ajustada, confiabilidad, modelo, motivo: '', diferenciaVsPresupuesto, advertencias,
    componentes: { ...base.componentes, tasaDiariaVariable: deCentimos(Math.round(tasaCent)), compromisosPendientes: deCentimos(pendienteCent), origenCompromisos: origen, variableRestante: deCentimos(variableRestanteCent) },
  }
}
