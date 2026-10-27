import { format as fmt, parse } from 'date-fns'
import { es } from 'date-fns/locale'

const pen = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formato peruano de soles: S/ 1,284.50 */
export function formatSoles(value: number): string {
  return pen.format(value).replace(/\s/g, ' ').replace('S/', 'S/ ').replace('S/  ', 'S/ ')
}

/** Versión compacta para ejes de gráficos: S/ 7.5k */
export function formatSolesCorto(value: number): string {
  const abs = Math.abs(value)
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k` : String(Math.round(abs))
  return `${value < 0 ? '−' : ''}S/${s}`
}

export type FormatoFecha = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd'

/** Fecha ISO (yyyy-MM-dd) → texto según el formato de la cuenta. Sin conversiones de zona horaria. */
export function formatFecha(iso: string, formato: string = 'dd/MM/yyyy'): string {
  const d = parse(iso, 'yyyy-MM-dd', new Date())
  return Number.isNaN(d.getTime()) ? iso : fmt(d, formato)
}

export function formatFechaLarga(iso: string): string {
  const d = parse(iso, 'yyyy-MM-dd', new Date())
  return fmt(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
}

export function formatMes(iso: string): string {
  const d = parse(iso, 'yyyy-MM-dd', new Date())
  const t = fmt(d, 'MMMM yyyy', { locale: es })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function toIso(d: Date): string {
  return fmt(d, 'yyyy-MM-dd')
}

export function fromIso(iso: string): Date {
  return parse(iso, 'yyyy-MM-dd', new Date())
}

export { analizarImporte, errorImporte, parseImporte, parseMontoNoNegativo, sumarImportes, IMPORTE_MAX_CENTIMOS } from './importe'
