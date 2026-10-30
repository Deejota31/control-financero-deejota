import { createContext, useContext } from 'react'

export interface ControlPlanificacion {
  /** Abre la ventana de estado de la planificación de un mes (por defecto, el actual). */
  abrirEstado: (mes?: string) => void
  /** Abre directamente el asistente de tres etapas para un mes. */
  abrirAsistente: (mes: string) => void
}

export const PlanificacionCtx = createContext<ControlPlanificacion | null>(null)

export function usePlanificacionUI(): ControlPlanificacion {
  const c = useContext(PlanificacionCtx)
  if (!c) throw new Error('usePlanificacionUI debe usarse dentro de PlanificacionProvider')
  return c
}
