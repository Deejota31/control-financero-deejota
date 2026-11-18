import { analizarImporte } from '@/lib/importe'

/** Doble representación: el importe original (PEN o USD) y su equivalente contable en PEN, congelado al guardar. */
export type Moneda = 'PEN' | 'USD'
export type MetodoConversion = 'none' | 'automatic' | 'manual' | 'exact'
export interface Conversion {
  original_currency: Moneda
  original_amount: string
  /** Importe contable en PEN: lo único que consumen fondos, dashboard, eventos y proyecciones. */
  amount: string
  exchange_rate: string
  exchange_rate_source: string | null
  exchange_rate_reference_date: string | null
  conversion_method: MetodoConversion
  exchange_rate_fetched_at: string | null
  conversion_snapshot_version: number
}

export const MONEDAS: readonly Moneda[] = ['PEN', 'USD']
export const SIMBOLO: Record<Moneda, string> = { PEN: 'S/', USD: 'US$' }
/** Decimales de la tasa: los mismos que `numeric(24,12)` en la base. */
export const DECIMALES_TASA = 12

/** Decimales exactos no negativos; el cociente se redondea half-up una sola vez, sin pasar por coma flotante. */
function decimal(v: string): [bigint, bigint] {
  if (!new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_TASA}})?$`).test(v)) throw new Error('Escribe un decimal positivo válido.')
  const [a, b = ''] = v.split('.')
  return [BigInt(a + b), 10n ** BigInt(b.length)]
}
function cociente(n: bigint, d: bigint, precision: number) {
  const escala = 10n ** BigInt(precision)
  const unidades = (n * escala * 2n + d) / (d * 2n)
  return `${unidades / escala}.${String(unidades % escala).padStart(precision, '0')}`
}

/** Importe escrito por el usuario («12,5», «1.234,56», «S/ 12») → «12.50», o null si no cumple el contrato de importes de la app. */
export function importeATexto(texto: string): string | null {
  const r = analizarImporte(texto)
  if (!r.ok) return null
  return `${Math.floor(r.centimos / 100)}.${String(r.centimos % 100).padStart(2, '0')}`
}

/** Tipo de cambio escrito por el usuario («3,52», «3.5201») → decimal con punto, o null. Admite hasta 6 decimales. */
export function tasaATexto(texto: string): string | null {
  const t = texto.trim().replace(',', '.')
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(t)) return null
  return Number(t) > 0 ? t : null
}

/** PEN contable = round-half-up(importe × tasa, 2). */
export function convertirPen(importe: string, tasa: string): string {
  const [a, b] = decimal(importe), [c, d] = decimal(tasa)
  if (a <= 0n || c <= 0n) throw new Error('El importe y la tasa deben ser mayores que cero.')
  return cociente(a * c, b * d, 2)
}

/** Tipo de cambio efectivo = cargo en PEN ÷ importe original (misma precisión que la base). */
export function tasaEfectiva(importe: string, cargo: string): string {
  const [a, b] = decimal(importe), [c, d] = decimal(cargo)
  if (a <= 0n || c <= 0n) throw new Error('El importe y el cargo deben ser mayores que cero.')
  return cociente(c * b, d * a, DECIMALES_TASA)
}

const miles = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** «S/ 1,234.50» / «US$ 10.00». Solo para mostrar: los cálculos usan decimales exactos. */
export function formatOriginal(importe: number | string, moneda: string = 'PEN') {
  return `${moneda === 'USD' ? 'US$' : 'S/'} ${miles.format(Number(importe))}`
}

/** Tasa para mostrar: 4 decimales («3.4190»). */
export function formatTasa(tasa: number | string) {
  return Number(tasa).toFixed(4)
}
