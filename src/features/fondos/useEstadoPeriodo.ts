import { useQuery } from '@tanstack/react-query'
import { startOfMonth } from 'date-fns'
import { fromIso, toIso } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { usePerfil } from '@/features/perfil/usePerfil'
import { hoyEnZona } from '@/lib/hoy'
import { esMesNatural, type EstadoPeriodo } from '@/components/ui/FiltroFecha'

/** Hoy en la zona horaria configurada por la persona. */
export function useHoy(): string {
  const zona = usePerfil().data?.timezone
  return hoyEnZona(zona)
}

/**
 * Estado del período presupuestario que muestra un rango (solo si es un mes natural). Solo lectura: no crea períodos al navegar.
 * Sin registro, el mes en curso o futuro se considera abierto; un mes pasado sin registro no se etiqueta.
 */
export function useEstadoPeriodo(desde: string, hasta: string, hoy: string): EstadoPeriodo {
  const mes = esMesNatural(desde, hasta) ? desde : null
  const q = useQuery({
    queryKey: ['periodo-estado', mes],
    enabled: Boolean(mes),
    queryFn: async () => {
      const { data, error } = await supabase.from('budget_periods').select('status').eq('start_date', mes!).maybeSingle()
      if (error) throw error
      return (data?.status as 'open' | 'closed' | undefined) ?? null
    },
  })
  if (!mes || q.isPending) return null
  if (q.data) return q.data
  return mes >= toIso(startOfMonth(fromIso(hoy))) ? 'open' : null
}
