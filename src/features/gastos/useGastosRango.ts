import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Gasto } from '@/lib/tipos'

/** Gastos (activos por defecto) de un rango de fechas ISO. Base del Dashboard, Fondos y Salud financiera. */
export function useGastosRango(desde: string, hasta: string, opciones: { incluirAnulados?: boolean; habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: ['gastos', 'rango', desde, hasta, Boolean(opciones.incluirAnulados)],
    enabled: opciones.habilitado ?? true,
    queryFn: async ({ signal }) => {
      let q = supabase.from('expenses').select('*').gte('expense_date', desde).lte('expense_date', hasta).order('expense_date').order('created_at').abortSignal(signal)
      if (!opciones.incluirAnulados) q = q.eq('status', 'active')
      const { data, error } = await q.limit(5000)
      if (error) throw error
      return data as Gasto[]
    },
  })
}
