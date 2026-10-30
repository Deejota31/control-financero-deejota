import { endOfMonth, getDate } from 'date-fns'
import { fromIso, toIso } from '@/lib/format'

/** Fecha efectiva de una plantilla en un mes: su día, o el último día válido si el mes es más corto (31 → 30 en septiembre, 28 en febrero). */
export function fechaEfectiva(dia: number | null, mes: string): { iso: string; ajustada: boolean } {
  const d0 = fromIso(mes), ultimo = getDate(endOfMonth(d0)), dia1 = dia ?? 1, dia2 = Math.min(Math.max(dia1, 1), ultimo)
  return { iso: toIso(new Date(d0.getFullYear(), d0.getMonth(), dia2)), ajustada: dia2 !== dia1 }
}

/** Nombre para la copia de una plantilla: «X (copia)», «X (copia 2)»… sin repetir ninguno existente (la comparación ignora mayúsculas y espacios) y dentro del límite de largo. */
export function nombreCopia(nombre: string, existentes: string[], max = 80): string {
  const usados = new Set(existentes.map((n) => n.trim().toLowerCase()))
  const con = (sufijo: string) => `${nombre.trim().slice(0, Math.max(1, max - sufijo.length)).trimEnd()}${sufijo}`
  let candidato = con(' (copia)')
  for (let i = 2; usados.has(candidato.toLowerCase()); i++) candidato = con(` (copia ${i})`)
  return candidato
}
