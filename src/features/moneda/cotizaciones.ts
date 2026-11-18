import { supabase } from '@/lib/supabase'

export interface Cotizacion { rate: string; reference_date: string; source: string; fetched_at: string }

const CADUCIDAD_MS = 15 * 60_000
const MAX_ENTRADAS = 100
const cache = new Map<string, { expira: number; valor: Cotizacion }>()
const pendientes = new Map<string, Promise<Cotizacion>>()

/** Valida y normaliza la respuesta del servidor: la tasa siempre es texto decimal y su fecha nunca es posterior a la pedida. */
export function normalizarCotizacion(bruta: unknown, fecha: string): Cotizacion {
  const v = bruta as Partial<Record<keyof Cotizacion, unknown>> | null
  const rate = String(v?.rate ?? '')
  const ref = String(v?.reference_date ?? '')
  const fuente = String(v?.source ?? '')
  const consultada = String(v?.fetched_at ?? '')
  if (!/^\d+(\.\d{1,12})?$/.test(rate) || Number(rate) <= 0 || Number(rate) >= 1_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(ref) || ref > fecha || !fuente || !consultada) {
    throw new Error('El proveedor no devolvió una cotización válida.')
  }
  return { rate, reference_date: ref, source: fuente, fetched_at: consultada }
}

/**
 * Única entrada a la cotización USD/PEN: deduplica consultas simultáneas, guarda una caché acotada y de corta vida,
 * y nunca devuelve una tasa sin su fuente y su fecha de referencia. La caché solo evita llamadas repetidas: los gastos
 * guardados conservan su propia instantánea y jamás se recalculan con ella.
 */
export function consultarCotizacion(fecha: string): Promise<Cotizacion> {
  const guardada = cache.get(fecha)
  if (guardada && guardada.expira > Date.now()) return Promise.resolve(guardada.valor)
  const enCurso = pendientes.get(fecha)
  if (enCurso) return enCurso
  const promesa = (async () => {
    const { data, error } = await supabase.functions.invoke('exchange-rate', { body: { date: fecha } })
    if (error) throw new Error('No se pudo consultar la cotización. Puedes introducir una tasa o el cargo exacto.')
    const valor = normalizarCotizacion(data, fecha)
    if (cache.size >= MAX_ENTRADAS) cache.delete(cache.keys().next().value!)
    cache.set(fecha, { expira: Date.now() + CADUCIDAD_MS, valor })
    return valor
  })().finally(() => pendientes.delete(fecha))
  pendientes.set(fecha, promesa)
  return promesa
}

/** Vacía la caché en memoria (pruebas y cambio de sesión). */
export function olvidarCotizaciones() {
  cache.clear()
}
