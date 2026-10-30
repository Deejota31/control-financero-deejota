import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Periodo } from '@/lib/tipos'

/**
 * Período mensual para el mes dado, p. ej. "2026-10-01". `ensure_period_rpc` obtiene o crea (idempotente: índice único por hogar y mes), así que
 * repetir la llamada al volver a montar o reconectar no duplica nada. Es una escritura dentro de una lectura a propósito: toda la app necesita
 * que el mes exista antes de mostrar fondos o registrar gastos, y separar «crear» de «leer» exigiría decidir en cada pantalla quién lo crea.
 */
export function usePeriodo(mes: string) {
  return useQuery({
    queryKey: ['periodo', mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ensure_period_rpc', { p_date: mes })
      if (error) throw error
      return data as Periodo
    },
  })
}
