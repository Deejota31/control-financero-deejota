import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import type { CambioFondos } from '@/domain/fondos'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { Periodo } from '@/lib/tipos'
import { fromIso, toIso } from '@/lib/format'

export const mesDeFecha = (d: Date) => format(startOfMonth(d), 'yyyy-MM-dd')
export const sumarMeses = (iso: string, n: number) => mesDeFecha(addMonths(fromIso(iso), n))
export const finDeMes = (iso: string) => toIso(endOfMonth(fromIso(iso)))

/** Período mensual (se crea si no existía) para el mes dado, p. ej. "2026-10-01". */
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

export function useFondos() {
  return useQuery({
    queryKey: ['fondos', 'lista'],
    queryFn: async () => {
      const [f, s, p] = await Promise.all([
        supabase.from('funds').select('*').order('priority').order('name'),
        supabase.from('fund_scope_rules').select('*'),
        supabase.from('fund_payment_rules').select('*'),
      ])
      if (f.error) throw f.error
      if (s.error) throw s.error
      if (p.error) throw p.error
      return { fondos: f.data, alcance: s.data, medios: p.data }
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
}

export function useFondoMutaciones() {
  const qc = useQueryClient()
  const refrescar = () => {
    for (const k of ['fondos', 'gastos', 'periodo', 'dashboard']) qc.invalidateQueries({ queryKey: [k] })
  }

  const simular = useMutation({
    mutationFn: async (payload: FondoPayload) => {
      const { data, error } = await supabase.rpc('save_fund', { p: payload as unknown as Json, p_dry_run: true })
      if (error) throw error
      return data as unknown as CambioFondos
    },
  })
  const guardar = useMutation({
    mutationFn: async (payload: FondoPayload) => {
      const { data, error } = await supabase.rpc('save_fund', { p: payload as unknown as Json, p_dry_run: false })
      if (error) throw error
      return data as unknown as CambioFondos
    },
    onSettled: refrescar,
  })
  const simularOrden = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('reorder_funds', { p_ids: ids, p_dry_run: true })
      if (error) throw error
      return data as unknown as CambioFondos
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
      return data as unknown as CambioFondos
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

  return { simular, guardar, simularOrden, ordenar, simularPresupuesto, presupuesto, cerrarPeriodo }
}
