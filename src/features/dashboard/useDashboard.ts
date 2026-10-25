import { useQuery } from '@tanstack/react-query'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'

export interface AgrupadoSql {
  id: string
  total: number
  cantidad: number
}

export interface ResumenDashboard {
  total: number
  cantidad: number
  total_prev: number
  cantidad_prev: number
  /** null cuando el rango no toca ningún período con presupuesto. */
  presupuesto: number | null
  serie: { fecha: string; monto: number }[]
  por_ambito: AgrupadoSql[]
  por_categoria: AgrupadoSql[]
  por_subcategoria: AgrupadoSql[]
  recientes: { id: string; expense_date: string; description: string; amount: number; categoria_id: string; created_at: string }[]
  fondos: { fund_id: string; nombre: string; es_general: boolean; prioridad: number; asignado: number; consumido: number }[]
  excedente: number
}

/**
 * KPIs, series y distribuciones calculados en PostgreSQL para el rango pedido: incluyen todos los gastos,
 * sin depender del límite de filas del API. Las listas cortas (recientes) son listas, no métricas.
 */
export function useResumenDashboard(desde: string, hasta: string, prev: { desde: string; hasta: string }, habilitado = true) {
  return useQuery({
    queryKey: ['dashboard', 'resumen', desde, hasta, prev.desde, prev.hasta],
    enabled: habilitado,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc('dashboard_resumen', { p_desde: desde, p_hasta: hasta, p_prev_desde: prev.desde, p_prev_hasta: prev.hasta })
        .abortSignal(signal)
      if (error) throw error
      return data as unknown as ResumenDashboard
    },
  })
}

/** Períodos que toca el rango, con sus presupuestos por fondo e imputaciones (lectura completa, sin truncar). */
export function usePresupuestoRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'presupuesto', desde, hasta],
    queryFn: async ({ signal }) => {
      const p = await supabase.from('budget_periods').select('*').lte('start_date', hasta).gte('end_date', desde).abortSignal(signal)
      if (p.error) throw p.error
      const ids = p.data.map((x) => x.id)
      if (ids.length === 0) return { periodos: p.data, presupuestos: [], asignaciones: [] }
      const [presupuestos, asignaciones] = await Promise.all([
        leerTodo((d, h) => supabase.from('fund_period_budgets').select('*', { count: 'exact' }).in('period_id', ids).order('id').range(d, h).abortSignal(signal)),
        leerTodo((d, h) => supabase.from('expense_fund_allocations').select('*', { count: 'exact' }).in('period_id', ids).order('id').range(d, h).abortSignal(signal)),
      ])
      return { periodos: p.data, presupuestos, asignaciones }
    },
  })
}

export function useHogar() {
  return useQuery({
    queryKey: ['hogar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('households').select('id, name, is_demo').limit(1).single()
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })
}
