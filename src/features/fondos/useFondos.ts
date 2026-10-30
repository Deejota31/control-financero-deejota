import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leerTodo } from '@/lib/leerTodo'
import { DOMINIOS, invalidar } from '@/lib/consultas'
import { cambioFondos, eliminacionFondo, leerRpc, resultadoCopia, vistaPreviaCambio } from '@/lib/contratos'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

/** Fondos DEL MES indicado (cada fondo es una instancia de un solo período) con sus reglas. Sin período no consulta nada. */
export function useFondos(periodId: string | undefined) {
  return useQuery({
    queryKey: ['fondos', 'lista', periodId],
    enabled: Boolean(periodId),
    queryFn: async () => {
      const f = await supabase.from('funds').select('*').eq('period_id', periodId!).order('priority').order('name')
      if (f.error) throw f.error
      const ids = f.data.map((x) => x.id)
      if (ids.length === 0) return { fondos: f.data, alcance: [], medios: [] }
      const [s, p] = await Promise.all([
        supabase.from('fund_scope_rules').select('*').in('fund_id', ids),
        supabase.from('fund_payment_rules').select('*').in('fund_id', ids),
      ])
      if (s.error) throw s.error
      if (p.error) throw p.error
      return { fondos: f.data, alcance: s.data, medios: p.data }
    },
  })
}

/** Fondos de todos los meses que toca un rango de fechas (para filtrar gastos por fondo). Cada fila sigue siendo de un solo mes. */
export function useFondosRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['fondos', 'rango', desde, hasta],
    // Un rango largo (años × fondos por mes) puede pasar el límite por respuesta de PostgREST: se lee completo y con orden determinista.
    queryFn: ({ signal }) => leerTodo((d, h) => supabase.from('funds').select('*, budget_periods!inner(start_date, end_date)', { count: 'exact' })
      .lte('budget_periods.start_date', hasta).gte('budget_periods.end_date', desde).order('priority').order('name').order('id').range(d, h).abortSignal(signal)),
  })
}

export interface ResultadoCopia {
  created: { source_id: string; id: string; name: string; amount: number }[]
  skipped: { source_id: string; name: string | null; reason: 'already_copied' | 'name_exists' | 'general_exists' | 'not_in_source' }[]
}

/** Copia explícita de fondos a otro mes: crea instancias independientes y nunca sobrescribe lo que ya existe. */
export function useCopiarFondos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { origen: string; destino: string; items: { fund_id: string; amount?: number; name?: string }[] }) => {
      const { data, error } = await supabase.rpc('copy_funds', { p_source: v.origen, p_target: v.destino, p_items: v.items as unknown as Json })
      if (error) throw error
      return leerRpc(resultadoCopia, data, 'copy_funds')
    },
    onSettled: () => {
      void invalidar(qc, DOMINIOS.fondos)
    },
  })
}

export function usePresupuestosPeriodo(periodId: string | undefined) {
  return useQuery({
    queryKey: ['fondos', 'presupuestos', periodId],
    enabled: Boolean(periodId),
    queryFn: () => leerTodo((d, h) => supabase.from('fund_period_budgets').select('*', { count: 'exact' }).eq('period_id', periodId!).order('id').range(d, h)),
  })
}

export function useAsignacionesPeriodo(periodId: string | undefined) {
  return useQuery({
    queryKey: ['fondos', 'asignaciones', periodId],
    enabled: Boolean(periodId),
    queryFn: () => leerTodo((d, h) => supabase.from('expense_fund_allocations').select('*', { count: 'exact' }).eq('period_id', periodId!).order('id').range(d, h)),
  })
}

export function useSnapshotsPeriodo(periodId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['fondos', 'snapshots', periodId],
    enabled: Boolean(periodId) && habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.from('period_fund_snapshots').select('*').eq('period_id', periodId!)
      if (error) throw error
      return data
    },
  })
}

/** Respuesta de `delete_fund`: dependencias del fondo, destinos compatibles y, con destino, el efecto simulado. */
export interface EliminacionFondo {
  dry_run: boolean
  fund_name: string
  is_general: boolean
  open_expenses: number
  open_allocations: number
  closed_allocations: number
  closed_snapshots: number
  budgets: number
  templates: number
  destinations: { id: string; name: string; is_general: boolean }[]
  /** El fondo no se puede eliminar (Fondo General o historial en períodos cerrados). */
  blocked: boolean
  code: string | null
  changed_expenses?: number | null
  consumption_before?: Record<string, number>
  consumption_after?: Record<string, number> | null
}

/** Dependencias del fondo (consulta sin efectos) para explicar qué implica eliminarlo. */
export function useDependenciasFondo(fundId: string) {
  return useQuery({
    queryKey: ['fondos', 'dependencias', fundId],
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('delete_fund', { p_fund: fundId, p_dry_run: true })
      if (error) throw error
      return leerRpc(eliminacionFondo, data, 'delete_fund')
    },
  })
}

export interface FondoPayload {
  id?: string
  name: string
  description: string
  icon_key: string
  color_token: string
  is_general: boolean
  default_amount: number
  is_active: boolean
  priority?: number
  scope_rules?: { kind: 'ambito' | 'categoria' | 'subcategoria'; ref: string; effect: 'include' | 'exclude' }[]
  payment_rules?: { method: string; effect: 'include' | 'exclude' }[]
  period_id?: string
  period_amount?: number
  /** Plantilla de la que sale el fondo (solo al crearlo). */
  template_id?: string
  /** Grupo propio de una plantilla de fondo (solo plantillas). */
  group_name?: string | null
}

export function useFondoMutaciones() {
  const qc = useQueryClient()
  const refrescar = () => {
    void invalidar(qc, DOMINIOS.fondos)
  }

  /** Estado por período antes/después del cambio (la operación se ejecuta y se revierte en el servidor; no guarda nada). */
  const vistaPrevia = useMutation({
    mutationFn: async (v: { kind: 'save_fund' | 'reorder_funds' | 'set_fund_period_budget' | 'delete_fund'; args: unknown }) => {
      const { data, error } = await supabase.rpc('preview_fund_change', { p_kind: v.kind, p_args: v.args as Json })
      if (error) throw error
      return leerRpc(vistaPreviaCambio, data, 'preview_fund_change')
    },
  })
  const simular = useMutation({
    mutationFn: async (payload: FondoPayload) => {
      const { data, error } = await supabase.rpc('save_fund', { p: payload as unknown as Json, p_dry_run: true })
      if (error) throw error
      return leerRpc(cambioFondos, data, 'save_fund')
    },
  })
  const guardar = useMutation({
    mutationFn: async (payload: FondoPayload) => {
      const { data, error } = await supabase.rpc('save_fund', { p: payload as unknown as Json, p_dry_run: false })
      if (error) throw error
      return leerRpc(cambioFondos, data, 'save_fund')
    },
    onSettled: refrescar,
  })
  const simularOrden = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('reorder_funds', { p_ids: ids, p_dry_run: true })
      if (error) throw error
      return leerRpc(cambioFondos, data, 'reorder_funds')
    },
  })
  const ordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_funds', { p_ids: ids, p_dry_run: false })
      if (error) throw error
    },
    onSettled: refrescar,
  })
  const simularPresupuesto = useMutation({
    mutationFn: async (v: { fund: string; period: string; amount: number }) => {
      const { data, error } = await supabase.rpc('set_fund_period_budget', { p_fund: v.fund, p_period: v.period, p_amount: v.amount, p_dry_run: true })
      if (error) throw error
      return leerRpc(cambioFondos, data, 'set_fund_period_budget')
    },
  })
  const presupuesto = useMutation({
    mutationFn: async (v: { fund: string; period: string; amount: number }) => {
      const { error } = await supabase.rpc('set_fund_period_budget', { p_fund: v.fund, p_period: v.period, p_amount: v.amount, p_dry_run: false })
      if (error) throw error
    },
    onSettled: refrescar,
  })
  const cerrarPeriodo = useMutation({
    mutationFn: async (period: string) => {
      const { error } = await supabase.rpc('close_period', { p_period: period })
      if (error) throw error
    },
    onSettled: refrescar,
  })

  /** Simula la eliminación con un destino: devuelve el efecto exacto y no deja rastro. */
  const simularEliminar = useMutation({
    mutationFn: async (v: { fund: string; destino: string | null }) => {
      const { data, error } = await supabase.rpc('delete_fund', { p_fund: v.fund, p_destino: v.destino ?? undefined, p_dry_run: true })
      if (error) throw error
      return leerRpc(eliminacionFondo, data, 'delete_fund')
    },
  })
  /** Elimina el fondo en una sola operación atómica: si algo falla, todo queda como estaba. */
  const eliminar = useMutation({
    mutationFn: async (v: { fund: string; destino: string | null }) => {
      const { data, error } = await supabase.rpc('delete_fund', { p_fund: v.fund, p_destino: v.destino ?? undefined, p_dry_run: false })
      if (error) throw error
      return leerRpc(eliminacionFondo, data, 'delete_fund')
    },
    onSettled: () => {
      refrescar()
      qc.invalidateQueries({ queryKey: ['catalogo'] })
    },
  })

  return { simular, vistaPrevia, guardar, simularOrden, ordenar, simularPresupuesto, presupuesto, cerrarPeriodo, simularEliminar, eliminar }
}
