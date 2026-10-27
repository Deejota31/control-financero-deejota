import { endOfMonth, getDate } from 'date-fns'
import { fromIso, toIso } from '@/lib/format'

/** Fecha efectiva de una plantilla en un mes: su día, o el último día válido si el mes es más corto (31 → 30 en septiembre, 28 en febrero). */
export function fechaEfectiva(dia: number | null, mes: string): { iso: string; ajustada: boolean } {
  const d0 = fromIso(mes), ultimo = getDate(endOfMonth(d0)), dia1 = dia ?? 1, dia2 = Math.min(Math.max(dia1, 1), ultimo)
  return { iso: toIso(new Date(d0.getFullYear(), d0.getMonth(), dia2)), ajustada: dia2 !== dia1 }
}
