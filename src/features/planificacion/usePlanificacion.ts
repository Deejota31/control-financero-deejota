import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays } from 'date-fns'
import { leerRpc, planFila, resumenPlan } from '@/lib/contratos'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { fromIso, toIso } from '@/lib/format'

export type EtapaPlan = 'pending' | 'done' | 'skipped'
export type EstadoPlan = 'pending' | 'in_progress' | 'completed'

export interface PlanFila {
  id: string
  period_id: string
  status: EstadoPlan
  funds_stage: EtapaPlan
  expenses_stage: EtapaPlan
  started_at: string | null
  completed_at: string | null
  remind_after: string | null
  updated_at: string
}

/** Cifras reales del mes (solo sus fondos y sus gastos) y el estado de su planificación. */
export interface ResumenPlan {
  period_id: string | null
  /** Fondos configurados en el mes (activos e inactivos). */
  funds_total: number
  /** Fondos activos del mes. */
  funds_count: number
  budget_total: number
  expenses_total: number
  expenses_count: number
  overspent_funds: number
  plan: PlanFila | null
}

export const ETIQUETA_ESTADO: Record<EstadoPlan, string> = { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada' }

export function useResumenPlan(mes: string) {
  return useQuery({
    queryKey: ['planificacion', 'resumen', mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('planning_summary', { p_month: mes })
      if (error) throw error
      return leerRpc(resumenPlan, data, 'planning_summary') // los importes se normalizan a número en el contrato
    },
  })
}

/** Guarda el avance del plan de un mes: etapas, estado y aplazamiento del aviso. Nunca crea fondos ni gastos. */
export function useGuardarPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { mes: string; patch: Partial<Pick<PlanFila, 'funds_stage' | 'expenses_stage' | 'status' | 'remind_after'>> }) => {
      const { data, error } = await supabase.rpc('save_period_plan', { p_month: v.mes, p_patch: v.patch as unknown as Json })
      if (error) throw error
      return leerRpc(planFila, data, 'save_period_plan')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['planificacion'] }),
  })
}

/** Estado que se muestra en cada tarjeta del asistente. */
export type EstadoVisual = 'pending' | 'in_progress' | 'done' | 'skipped' | 'por_finalizar' | 'finalizada'

export const ETIQUETA_VISUAL: Record<EstadoVisual, string> = {
  pending: 'Pendiente', in_progress: 'En progreso', done: 'Completada', skipped: 'Omitida', por_finalizar: 'Por finalizar', finalizada: 'Finalizada',
}

/**
 * Estado visual de las tres tarjetas a partir de lo realmente guardado: una etapa solo está «Completada» u «Omitida» si se confirmó o se omitió
 * (visitarla no basta). La primera etapa aún pendiente es la que se está trabajando («En progreso»); las siguientes quedan «Pendiente». El resumen
 * está «Por finalizar» hasta que se pulsa «Finalizar planificación».
 */
export function estadosVisuales(plan: Pick<PlanFila, 'status' | 'funds_stage' | 'expenses_stage'> | null): { fondos: EstadoVisual; gastos: EstadoVisual; resumen: EstadoVisual } {
  const etapas: EtapaPlan[] = [plan?.funds_stage ?? 'pending', plan?.expenses_stage ?? 'pending']
  const primeraPendiente = etapas.indexOf('pending')
  const visual = (e: EtapaPlan, i: number): EstadoVisual => (e === 'done' ? 'done' : e === 'skipped' ? 'skipped' : i === primeraPendiente ? 'in_progress' : 'pending')
  return { fondos: visual(etapas[0], 0), gastos: visual(etapas[1], 1), resumen: plan?.status === 'completed' ? 'finalizada' : 'por_finalizar' }
}

/**
 * ¿Hay que invitar a planificar el mes en curso? Sí mientras el mes no esté completado, el aviso no esté aplazado y los recordatorios estén activos.
 * Si el mes ya tiene fondos y no hay un proceso empezado se considera preparado a mano y no se insiste. `hoy` es la fecha en la zona de la persona.
 */
export function debeInvitar(v: { recordatorios: boolean; fondos: number; plan: Pick<PlanFila, 'status' | 'remind_after'> | null; hoy: string }): boolean {
  if (!v.recordatorios) return false
  if (v.plan?.status === 'completed') return false
  if (v.plan?.remind_after && v.plan.remind_after > v.hoy) return false
  return v.plan?.status === 'in_progress' || v.fondos === 0
}

/** Mañana (en la zona horaria de la persona), para posponer el aviso. */
export const mananaDe = (hoy: string) => toIso(addDays(fromIso(hoy), 1))
