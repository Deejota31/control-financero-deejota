import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfMonth, startOfMonth } from 'date-fns'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { idsDe } from '@/domain/idsFiltro'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { toIso } from '@/lib/format'
import type { Gasto } from '@/lib/tipos'

export const TAMANO_PAGINA = 20

export interface FiltrosGastos {
  desde: string
  hasta: string
  q: string
  ambito: string
  categoria: string
  subcategoria: string
  medio: string
  fondo: string
  tipo: '' | 'fixed' | 'variable'
  estado: 'active' | 'annulled' | 'all'
  pagina: number
  orden: 'fecha' | 'monto' | 'descripcion'
  dir: 'asc' | 'desc'
}

const INICIO_MES = toIso(startOfMonth(new Date()))
const FIN_MES = toIso(endOfMonth(new Date()))

export const FILTROS_BASE: FiltrosGastos = {
  desde: INICIO_MES, hasta: FIN_MES, q: '', ambito: '', categoria: '', subcategoria: '', medio: '', fondo: '',
  tipo: '', estado: 'active', pagina: 1, orden: 'fecha', dir: 'desc',
}

const CLAVES = Object.keys(FILTROS_BASE) as (keyof FiltrosGastos)[]

function leer(params: URLSearchParams): FiltrosGastos {
  const f: FiltrosGastos = { ...FILTROS_BASE }
  for (const k of CLAVES) {
    const v = params.get(k)
    if (v === null) continue
    if (k === 'pagina') f.pagina = Math.max(1, parseInt(v, 10) || 1)
    else if (k === 'tipo') f.tipo = v === 'fixed' || v === 'variable' ? v : ''
    else if (k === 'estado') f.estado = v === 'annulled' || v === 'all' ? v : 'active'
    else if (k === 'orden') f.orden = v === 'monto' || v === 'descripcion' ? v : 'fecha'
    else if (k === 'dir') f.dir = v === 'asc' ? 'asc' : 'desc'
    else (f[k] as string) = v
  }
  return f
}

/** Filtros del módulo Gastos, persistidos en la URL (compartibles y coherentes con el Dashboard). */
export function useFiltrosGastos() {
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => leer(params), [params])
  const cambiar = useCallback(
    (patch: Partial<FiltrosGastos>) => {
      setParams(
        (prev) => {
          const actual = leer(prev)
          const sig: FiltrosGastos = { ...actual, ...patch, pagina: patch.pagina ?? 1 }
          const out = new URLSearchParams(prev)
          for (const k of CLAVES) {
            if (sig[k] === FILTROS_BASE[k] || sig[k] === '') out.delete(k)
            else out.set(k, String(sig[k]))
          }
          return out
        },
        { replace: true },
      )
    },
    [setParams],
  )
  const limpiar = useCallback(() => setParams((prev) => {
    const out = new URLSearchParams(prev)
    for (const k of CLAVES) out.delete(k)
    return out
  }, { replace: true }), [setParams])
  const hayFiltros = CLAVES.some((k) => !['pagina', 'orden', 'dir'].includes(k) && filtros[k] !== FILTROS_BASE[k])
  return { filtros, cambiar, limpiar, hayFiltros }
}

export interface GastoConFondos extends Gasto {
  expense_fund_allocations: { fund_id: string; amount: number; allocation_kind: string }[]
}

const SEL = '*, expense_fund_allocations(fund_id, amount, allocation_kind)'
const SEL_FONDO = '*, expense_fund_allocations(fund_id, amount, allocation_kind), filtro:expense_fund_allocations!inner(fund_id)'

const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

function construir(f: FiltrosGastos, rango?: [number, number]) {
  let q = supabase.from('expenses').select((f.fondo ? SEL_FONDO : SEL) as typeof SEL, { count: 'exact' })
  q = q.gte('expense_date', f.desde).lte('expense_date', f.hasta)
  if (f.estado !== 'all') q = q.eq('status', f.estado)
  if (f.q.trim()) q = q.ilike('description', `%${escaparLike(f.q.trim())}%`)
  if (f.ambito) q = q.eq('ambito_id', f.ambito)
  if (f.categoria) q = q.in('categoria_id', idsDe(f.categoria))
  if (f.subcategoria) q = q.in('subcategoria_id', idsDe(f.subcategoria))
  if (f.medio) q = q.eq('payment_method_id', f.medio)
  if (f.tipo) q = q.eq('expense_type', f.tipo)
  if (f.fondo) q = q.eq('filtro.fund_id' as 'status', f.fondo)
  const col = f.orden === 'monto' ? 'amount' : f.orden === 'descripcion' ? 'description' : 'expense_date'
  q = q.order(col, { ascending: f.dir === 'asc' })
  if (col !== 'expense_date') q = q.order('expense_date', { ascending: false })
  q = q.order('created_at', { ascending: false })
  // Desempate único: sin él, filas con la misma fecha y created_at pueden repetirse u omitirse entre páginas.
  q = q.order('id', { ascending: false })
  if (rango) q = q.range(rango[0], rango[1])
  return q
}

/** Página de gastos con total. Las consultas obsoletas se cancelan al cambiar filtros rápidamente. */
export function useGastosPagina(f: FiltrosGastos) {
  return useQuery({
    queryKey: ['gastos', 'pagina', f],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const desde = (f.pagina - 1) * TAMANO_PAGINA
      const { data, error, count } = await construir(f, [desde, desde + TAMANO_PAGINA - 1]).abortSignal(signal)
      if (error) throw error
      return { filas: (data ?? []) as unknown as GastoConFondos[], total: count ?? 0 }
    },
  })
}

/** Todos los gastos que cumplen los filtros (para exportar). */
export async function gastosParaExportar(f: FiltrosGastos): Promise<GastoConFondos[]> {
  const filas = await leerTodo((d, h) => construir(f, [d, h]))
  return filas as unknown as GastoConFondos[]
}

export interface PayloadGasto {
  id?: string
  editing_id?: string
  expense_date: string
  amount: number
  description: string
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  payment_method_id: string
  expense_type: 'fixed' | 'variable'
  is_recurring: boolean
  notes: string
  receipt_path?: string | null
  template_id?: string | null
}

export interface AsignacionReporte {
  fund_id: string
  fund_name: string
  is_general: boolean
  kind: 'specific' | 'general'
  amount: number
  remaining_after: number
}
export interface AdvertenciaReporte {
  code: 'general_negative' | 'specific_overspend'
  fund_id: string
  fund_name: string
  remaining_after: number
}
export interface ReporteGasto {
  expense_id?: string
  allocations: AsignacionReporte[]
  warnings: AdvertenciaReporte[]
  replayed?: boolean
  blocked?: boolean
  code?: string
  reason?: string
  message?: string
}

/** Simulación exacta (ejecuta la operación real en el servidor y la revierte). */
export function usePrevisualizacion(payload: PayloadGasto | null) {
  return useQuery({
    queryKey: ['gastos', 'preview', payload],
    enabled: payload !== null,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('preview_expense', { p: payload as unknown as Json }).abortSignal(signal)
      if (error) throw error
      return data as unknown as ReporteGasto
    },
  })
}

export function useGastoMutaciones() {
  const qc = useQueryClient()
  const refrescar = () => {
    for (const k of ['gastos', 'fondos', 'dashboard', 'salud']) qc.invalidateQueries({ queryKey: [k] })
  }
  const crear = useMutation({
    mutationFn: async (v: { payload: PayloadGasto; clave: string }) => {
      const { data, error } = await supabase.rpc('create_expense', { p: v.payload as unknown as Json, p_key: v.clave })
      if (error) throw error
      return data as unknown as ReporteGasto
    },
    onSettled: refrescar,
  })
  const actualizar = useMutation({
    mutationFn: async (v: { id: string; payload: PayloadGasto }) => {
      const { data, error } = await supabase.rpc('update_expense', { p_id: v.id, p: v.payload as unknown as Json })
      if (error) throw error
      return data as unknown as ReporteGasto
    },
    onSettled: refrescar,
  })
  const anular = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('annul_expenses', { p_ids: ids })
      if (error) throw error
    },
    onSettled: refrescar,
  })
  const restaurar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('restore_expenses', { p_ids: ids })
      if (error) throw error
    },
    onSettled: refrescar,
  })
  return { crear, actualizar, anular, restaurar }
}
