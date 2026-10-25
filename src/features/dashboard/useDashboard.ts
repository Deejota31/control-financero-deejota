import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Períodos que toca el rango, con sus presupuestos por fondo e imputaciones. Para KPIs y resumen de fondos. */
export function usePresupuestoRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'presupuesto', desde, hasta],
    queryFn: async ({ signal }) => {
      const p = await supabase.from('budget_periods').select('*').lte('start_date', hasta).gte('end_date', desde).abortSignal(signal)
      if (p.error) throw p.error
      const ids = p.data.map((x) => x.id)
      if (ids.length === 0) return { periodos: p.data, presupuestos: [], asignaciones: [] }
      const [b, a] = await Promise.all([
        supabase.from('fund_period_budgets').select('*').in('period_id', ids).abortSignal(signal),
        supabase.from('expense_fund_allocations').select('*').in('period_id', ids).abortSignal(signal),
      ])
      if (b.error) throw b.error
      if (a.error) throw a.error
      return { periodos: p.data, presupuestos: b.data, asignaciones: a.data }
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
