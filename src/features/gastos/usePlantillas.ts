import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePerfil } from '@/features/perfil/usePerfil'
import { leerTodo } from '@/lib/leerTodo'
import { DOMINIOS, invalidar } from '@/lib/consultas'
import { leerRpc, resultadoLote } from '@/lib/contratos'
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
        leerTodo<{ template_id: string | null }>((d, h) => supabase.from('expenses').select('template_id', { count: 'exact' }).eq('status', 'active').not('template_id', 'is', null).gte('expense_date', desde).lte('expense_date', hasta).order('id').range(d, h)),
        supabase.from('template_batches').select('created_at, template_batch_items(template_id, outcome)').eq('period_id', periodId!).order('created_at'),
      ])
      if (b.error) throw b.error
      const registradas = new Set(g.map((x) => x.template_id as string))
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
  notes: string | null
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
    void invalidar(qc, DOMINIOS.plantillasGastos)
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
      return leerRpc(resultadoLote, data, 'apply_template_batch')
    },
    onSettled: refrescar,
  })
  /** Orden manual de la biblioteca (solo presentación: no cambia categoría ni ámbito). Se refleja al instante y se confirma en el servidor. */
  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_templates', { p_kind: 'expense', p_ids: ids })
      if (error) throw error
    },
    onMutate: (ids) => {
      qc.setQueryData<Plantilla[]>(['plantillas'], (old) => (old ? [...ids.map((id) => old.find((x) => x.id === id)).filter((x): x is Plantilla => Boolean(x)), ...old.filter((x) => !ids.includes(x.id))] : old))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  })
  /** Cambia la configuración ORIGINAL de la plantilla con los valores usados al registrar (acción explícita y confirmada, nunca automática). */
  const actualizarBase = useMutation({
    mutationFn: async (v: { id: string; valores: { default_amount?: number | null; payment_method_id?: string | null; day_of_month?: number | null } }) => {
      const { error } = await supabase.from('expense_templates').update(v.valores).eq('id', v.id)
      if (error) throw error
    },
    onSettled: refrescar,
  })
  return { guardar, activar, eliminar, aplicarLote, reordenar, actualizarBase }
}

/** Cuántas veces se usó cada plantilla (gastos activos que salieron de ella) y cuándo fue la última. Es historial: no es un movimiento. */
export function useUsosPlantillas() {
  return useQuery({
    queryKey: ['plantillas', 'usos'],
    queryFn: async () => {
      const filas = await leerTodo<{ template_id: string | null; expense_date: string }>((d, h) =>
        supabase.from('expenses').select('template_id, expense_date', { count: 'exact' }).eq('status', 'active').not('template_id', 'is', null).order('id').range(d, h))
      const usos = new Map<string, { veces: number; ultima: string }>()
      for (const f of filas) {
        const id = f.template_id as string
        const u = usos.get(id)
        usos.set(id, { veces: (u?.veces ?? 0) + 1, ultima: u && u.ultima > f.expense_date ? u.ultima : f.expense_date })
      }
      return usos
    },
  })
}
