import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { FiltrosDashboard } from '@/domain/filtrosCruzados'
import { idsDe } from '@/domain/idsFiltro'
import type { FondoPanel } from '@/domain/presupuesto'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'

export interface AgrupadoSql {
  id: string
  total: number
  cantidad: number
}

export interface PanelDashboard {
  /** Con todos los filtros cruzados. */
  total: number
  cantidad: number
  dias_con_gasto: number
  mayor: { id: string; description: string; amount: number; expense_date: string } | null
  recientes: { id: string; expense_date: string; description: string; amount: number; categoria_id: string; created_at: string }[]
  total_prev: number
  cantidad_prev: number
  serie: { fecha: string; monto: number; cantidad: number }[]
  por_ambito: AgrupadoSql[]
  por_categoria: AgrupadoSql[]
  por_subcategoria: AgrupadoSql[]
  /** Presupuesto, gasto del rango y fondos: no dependen de los filtros cruzados. */
  presupuesto: number | null
  gasto_rango: number
  imputado_rango: number
  sin_fondo: number
  fondos_periodo: number
  fondos: FondoPanel[]
  excedente: number
}

/**
 * Una única consulta alimenta KPIs, gráficos, presupuesto y recientes: no puede haber diferencias entre ellos.
 * La clave incluye todos los filtros: al cambiarlos, TanStack Query cancela la petición anterior y una respuesta
 * vieja nunca sobrescribe a una reciente. Mientras llega la nueva se conserva la vista anterior (sin parpadeos).
 */
export function useDashboardPanel(f: FiltrosDashboard, prev: { desde: string; hasta: string }, habilitado = true) {
  return useQuery({
    queryKey: ['dashboard', 'panel', f, prev],
    enabled: habilitado,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc('dashboard_panel', {
          p_desde: f.desde,
          p_hasta: f.hasta,
          p_prev_desde: prev.desde,
          p_prev_hasta: prev.hasta,
          p_ambito: f.ambito || undefined,
          p_categoria: idsDe(f.categoria).length ? idsDe(f.categoria) : undefined,
          p_subcategoria: idsDe(f.subcategoria).length ? idsDe(f.subcategoria) : undefined,
          p_medio: f.medio || undefined,
          p_tipo: f.tipo || undefined,
          p_dia: f.dia || undefined,
        })
        .abortSignal(signal)
      if (error) throw error
      return data as unknown as PanelDashboard
    },
  })
}

/** Períodos que toca el rango, con sus presupuestos por fondo e imputaciones (lectura completa, sin truncar). */
export function usePresupuestoRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'presupuesto', desde, hasta],
    queryFn: async ({ signal }) => {
      const p = await supabase.from('budget_periods').select('*').lte('start_date', hasta).gte('end_date', desde).abortSignal(signal)
      if (p.error) throw p.error
      const ids = p.data.map((x) => x.id)
      if (ids.length === 0) return { periodos: p.data, presupuestos: [], asignaciones: [] }
      const [presupuestos, asignaciones] = await Promise.all([
        leerTodo((d, h) => supabase.from('fund_period_budgets').select('*', { count: 'exact' }).in('period_id', ids).order('id').range(d, h).abortSignal(signal)),
        leerTodo((d, h) => supabase.from('expense_fund_allocations').select('*', { count: 'exact' }).in('period_id', ids).order('id').range(d, h).abortSignal(signal)),
      ])
      return { periodos: p.data, presupuestos, asignaciones }
    },
  })
}

export function useHogar() {
  return useQuery({
    queryKey: ['hogar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('households').select('id, name, is_demo').limit(1).single()
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })
}
