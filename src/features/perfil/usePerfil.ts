import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { claves } from '@/lib/consultas'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { PerfilValues } from './perfil'

export function usePerfil() {
  const { user } = useAuth()
  return useQuery({
    queryKey: claves.perfil(user?.id),
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single()
      if (error) throw error
      return data
    },
  })
}

export function useActualizarPerfil() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<PerfilValues> & { planning_reminders?: boolean }) => {
      const patch = { ...values, display_name: values.display_name === undefined ? undefined : values.display_name || null }
      const { data, error } = await supabase.from('profiles').update(patch).eq('user_id', user!.id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.setQueryData(claves.perfil(user?.id), data),
  })
}
