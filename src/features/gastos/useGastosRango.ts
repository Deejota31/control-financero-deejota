import { useQuery } from '@tanstack/react-query'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'
import type { Gasto } from '@/lib/tipos'

/**
 * Todos los gastos (activos por defecto) de un rango de fechas ISO. Se leen por páginas hasta agotar el resultado:
 * si el servidor no entrega todo lo que declara, la consulta falla en vez de devolver datos parciales.
 */
export function useGastosRango(desde: string, hasta: string, opciones: { incluirAnulados?: boolean; habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: ['gastos', 'rango', desde, hasta, Boolean(opciones.incluirAnulados)],
    enabled: opciones.habilitado ?? true,
    queryFn: ({ signal }) =>
      leerTodo<Gasto>((d, h) => {
        let q = supabase
          .from('expenses')
          .select('*', { count: 'exact' })
          .gte('expense_date', desde)
          .lte('expense_date', hasta)
          .order('expense_date')
          .order('created_at')
          .order('id')
          .range(d, h)
          .abortSignal(signal)
        if (!opciones.incluirAnulados) q = q.eq('status', 'active')
        return q
      }),
  })
}
