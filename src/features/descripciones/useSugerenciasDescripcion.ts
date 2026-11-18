import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { useDebounced } from '@/lib/useDebounced'
import { claveContexto, normalizarDescripcion, type ContextoDescripcion } from './contexto'

const sugerenciasSchema = z.array(z.object({ description: z.string(), frequency: z.number().int().positive(), last_used: z.string() })).max(10)

export function useSugerenciasDescripcion(contexto: ContextoDescripcion, texto: string) {
  const { user } = useAuth()
  const clave = claveContexto(contexto)
  const busqueda = normalizarDescripcion(texto)
  const solicitud = JSON.stringify([clave, busqueda])
  const diferida = useDebounced(solicitud, 250)
  const listo = contexto.tipo === 'expense' ? Boolean(contexto.ambito_id && contexto.categoria_id) : contexto.listo && (contexto.is_general || contexto.scope_rules.some((r) => r.effect === 'include'))
  const consulta = useQuery({
    queryKey: ['sugerencias-descripciones', user?.id, contexto.tipo, clave, busqueda],
    enabled: Boolean(user) && listo && solicitud === diferida,
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('sugerencias_descripciones', {
        p_tipo: contexto.tipo, p_contexto: JSON.parse(clave) as Json, p_busqueda: busqueda,
      }).abortSignal(signal)
      if (error) throw error
      return sugerenciasSchema.parse(data)
    },
  })
  // Nunca mostrar resultados de un contexto o texto anterior durante el debounce.
  return listo && solicitud === diferida && !consulta.isError ? consulta.data ?? [] : []
}
