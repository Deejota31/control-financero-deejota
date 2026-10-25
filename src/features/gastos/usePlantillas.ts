import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePerfil } from '@/features/perfil/usePerfil'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { Plantilla } from '@/lib/tipos'

export function usePlantillas() {
  return useQuery({
    queryKey: ['plantillas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_templates').select('*').order('sort_order').order('name')
      if (error) throw error
      return data as Plantilla[]
    },
  })
}

/** Qué plantillas ya se registraron en el período y cuáles se marcaron como "No aplica este mes". */
export function useEstadoLote(periodId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['plantillas', 'estado', periodId, desde, hasta],
    enabled: Boolean(periodId),
    queryFn: async () => {
      const [g, b] = await Promise.all([
        supabase.from('expenses').select('template_id').eq('status', 'active').not('template_id', 'is', null).gte('expense_date', desde).lte('expense_date', hasta),
        supabase.from('template_batches').select('created_at, template_batch_items(template_id, outcome)').eq('period_id', periodId!).order('created_at'),
      ])
      if (g.error) throw g.error
      if (b.error) throw b.error
      const registradas = new Set((g.data ?? []).map((x) => x.template_id as string))
      // Prevalece la decisión más reciente de cada plantilla.
      const ultimo = new Map<string, string>()
      for (const lote of b.data ?? []) for (const it of lote.template_batch_items ?? []) ultimo.set(it.template_id, it.outcome)
      const noAplica = new Set([...ultimo].filter(([, o]) => o === 'not_applicable').map(([id]) => id))
      return { registradas, noAplica }
    },
  })
}

export interface PlantillaValores {
  name: string
  description: string
  default_amount: number | null
  is_amount_variable: boolean
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  payment_method_id: string | null
  default_fund_id: string | null
  expense_type: 'fixed' | 'variable'
  day_of_month: number | null
}

export function usePlantillaMutaciones() {
  const qc = useQueryClient()
  const perfil = usePerfil()
  const refrescar = () => {
    for (const k of ['plantillas', 'gastos', 'fondos', 'dashboard', 'salud']) qc.invalidateQueries({ queryKey: [k] })
  }
  const guardar = useMutation({
    mutationFn: async (v: { id?: string; valores: PlantillaValores; orden?: number }) => {
      if (v.id) {
        const { error } = await supabase.from('expense_templates').update(v.valores).eq('id', v.id)
        if (error) throw error
        return
      }
      const hid = perfil.data?.household_id
      if (!hid) throw new Error('Perfil sin hogar')
      const { error } = await supabase.from('expense_templates').insert({ ...v.valores, household_id: hid, sort_order: v.orden ?? 0 })
      if (error) throw error
    },
    onSettled: refrescar,
  })
  const activar = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('expense_templates').update({ is_active: v.is_active }).eq('id', v.id)
      if (error) throw error
    },
    onSettled: refrescar,
  })
  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: refrescar,
  })
  const aplicarLote = useMutation({
    mutationFn: async (v: { fecha: string; items: Record<string, unknown>[]; clave: string }) => {
      const { data, error } = await supabase.rpc('apply_template_batch', { p_period_date: v.fecha, p_items: v.items as unknown as Json, p_key: v.clave })
      if (error) throw error
      return data as unknown as { batch_id: string; count: number; total: number; replayed: boolean }
    },
    onSettled: refrescar,
  })
  return { guardar, activar, eliminar, aplicarLote }
}
