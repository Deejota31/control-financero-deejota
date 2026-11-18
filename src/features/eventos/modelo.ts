import type { Fila } from '@/lib/tipos'

export const TIPOS_EVENTO = [
  ['birthday', 'Cumpleaños'], ['travel', 'Viaje'], ['celebration', 'Celebración'], ['wedding', 'Matrimonio'],
  ['home', 'Hogar'], ['project', 'Proyecto'], ['family', 'Familia'], ['other', 'Otros'],
] as const
export const ESTADOS_EVENTO = [['planned', 'Planificado'], ['in_progress', 'En curso'], ['completed', 'Finalizado'], ['cancelled', 'Cancelado']] as const
export type Evento = Fila<'events'> & {
  paid: number; pending: number; projected: number; available: number; projected_available: number
  paid_percent: number | null; projected_percent: number | null; planned_total: number; unplanned: number; expense_count: number
}
export type Concepto = Fila<'event_items'> & { paid: number; pending: number }
export type Compromiso = Fila<'event_commitments'> & { paid: number; pending: number; overpaid: number; payment_status: string }
export const etiquetaEstado = (v: string) => ESTADOS_EVENTO.find(([id]) => id === v)?.[1] ?? v
export const etiquetaTipo = (v: string) => TIPOS_EVENTO.find(([id]) => id === v)?.[1] ?? v
export const recibeGastos = (e: Pick<Evento, 'is_template' | 'archived_at' | 'status'>) => !e.is_template && !e.archived_at && ['planned', 'in_progress'].includes(e.status)
/** Solo el ancho visual se limita; los porcentajes financieros se conservan. */
export function segmentosProgreso(pagado: number | null, proyectado: number | null) {
  const real = Math.max(0, Math.min(100, pagado ?? 0))
  return { real, pendiente: Math.max(0, Math.min(100, proyectado ?? 0) - real) }
}
