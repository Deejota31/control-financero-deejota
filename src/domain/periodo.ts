import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { fromIso, toIso } from '@/lib/format'

/** Etiqueta temporal de un mes respecto a hoy. Es calendario: no cambia ningún permiso de edición ni el cierre contable de los fondos. */
export type EstadoMes = 'open' | 'closed' | 'future'

const indice = (iso: string) => { const [y, m] = iso.split('-').map(Number); return y * 12 + (m - 1) }

/**
 * Compara año y mes (no solo el mes): el mes de `hoy` está abierto, los anteriores cerrados y los posteriores son futuros.
 * `hoy` debe venir ya en la zona horaria del usuario (por ejemplo America/Lima) para no desplazar el mes al cruzar la medianoche.
 */
export function estadoDelMes(mes: string, hoy: string): EstadoMes {
  const a = indice(mes), b = indice(hoy)
  return a < b ? 'closed' : a === b ? 'open' : 'future'
}

export const TEXTO_ESTADO: Record<EstadoMes, string> = { open: 'Período abierto', closed: 'Período cerrado', future: 'Período futuro' }

/** Primer día del mes de una fecha (yyyy-MM-dd). */
export const mesDeFecha = (d: Date) => format(startOfMonth(d), 'yyyy-MM-dd')
export const sumarMeses = (iso: string, n: number) => mesDeFecha(addMonths(fromIso(iso), n))
/** Último día del mes de una fecha ISO. */
export const finDeMes = (iso: string) => toIso(endOfMonth(fromIso(iso)))
