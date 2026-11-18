import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { leerTodo } from '@/lib/leerTodo'
import type { Json } from '@/lib/database.types'
import type { Fila, Gasto } from '@/lib/tipos'
import type { Compromiso, Concepto, Evento } from './modelo'
import { parseMontoNoNegativo } from '@/lib/format'

export interface FiltrosEventos { q: string; estado: string; year: string; desde: string; hasta: string; orden: string; pagina: number; plantillas: boolean; archivados: boolean }
export function useEventos(f: FiltrosEventos) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['eventos', user?.id, 'lista', f], queryFn: async ({ signal }) => {
    let q = supabase.from('event_metrics').select('*', { count: 'exact' }).eq('is_template', f.plantillas)
    q = f.archivados ? q.not('archived_at', 'is', null) : q.is('archived_at', null)
    if (f.q.trim()) q = q.ilike('name', `%${f.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    if (f.estado) q = q.eq('status', f.estado)
    if (/^\d{4}$/.test(f.year)) q = q.gte('target_date', `${f.year}-01-01`).lte('target_date', `${f.year}-12-31`)
    if (f.desde) q = q.gte('target_date', f.desde)
    if (f.hasta) q = q.lte('target_date', f.hasta)
    const orden = ({ lejano: ['target_date', false], reciente: ['created_at', false], presupuesto: ['budget', false], gasto: ['paid', false], nombre: ['name', true] } as Record<string, [string, boolean]>)[f.orden] ?? ['target_date', true]
    const { data, error, count } = await q.order(orden[0], { ascending: orden[1], nullsFirst: false }).order('id').range((f.pagina - 1) * 12, f.pagina * 12 - 1).abortSignal(signal)
    if (error) throw error
    return { filas: data as unknown as Evento[], total: count ?? 0 }
  } })
}
export function useEvento(id?: string) {
  return useQuery({ queryKey: ['eventos', 'detalle', id], enabled: Boolean(id), queryFn: async ({ signal }) => {
    const { data, error } = await supabase.from('event_metrics').select('*').eq('id', id!).abortSignal(signal).single()
    if (error) throw error
    return data as unknown as Evento
  } })
}
export function useOpcionesEventos() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['eventos', 'opciones', user?.id], queryFn: ({ signal }) => leerTodo((d, h) => supabase.from('events').select('*', { count: 'exact' }).eq('is_template', false).order('target_date').order('id').range(d, h).abortSignal(signal)) })
}
export function usePlanEvento(id: string) {
  return useQuery({ queryKey: ['eventos', 'plan', id], queryFn: async ({ signal }) => {
    const [items, compromisos] = await Promise.all([
      leerTodo((d, h) => supabase.from('event_item_metrics').select('*', { count: 'exact' }).eq('event_id', id).order('sort_order').order('id').range(d, h).abortSignal(signal)),
      leerTodo((d, h) => supabase.from('event_commitment_metrics').select('*', { count: 'exact' }).eq('event_id', id).order('due_date', { nullsFirst: false }).order('id').range(d, h).abortSignal(signal)),
    ])
    return { items: items as unknown as Concepto[], compromisos: compromisos as unknown as Compromiso[] }
  } })
}
export function useAnalisisEvento(id: string) {
  return useQuery({ queryKey: ['eventos', 'analisis', id], queryFn: async ({ signal }) => {
    return leerTodo((d, h) => supabase.rpc('event_analytics', { p_event: id }, { count: 'exact' }).range(d, h).abortSignal(signal))
  } })
}
export interface FiltroSeleccion { q: string; desde: string; hasta: string; ambito: string; categoria: string; subcategoria: string; medio: string; min: string; max: string; orden: string; pagina: number; estado: string; concepto: string; compromiso: string }
export const FILTRO_SELECCION: FiltroSeleccion = { q: '', desde: '', hasta: '', ambito: '', categoria: '', subcategoria: '', medio: '', min: '', max: '', orden: 'reciente', pagina: 1, estado: 'active', concepto: '', compromiso: '' }
export function useGastosEvento(id: string, f: FiltroSeleccion, selector = false) {
  return useQuery({ queryKey: ['eventos', 'gastos', id, f, selector], queryFn: async ({ signal }) => {
    let q = supabase.from('expenses').select('*', { count: 'exact' })
    if (!selector) q = q.eq('event_id', id)
    if (f.estado !== 'all') q = q.eq('status', f.estado)
    if (f.q) q = q.ilike('description', `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    if (f.desde) q = q.gte('expense_date', f.desde)
    if (f.hasta) q = q.lte('expense_date', f.hasta)
    if (f.ambito) q = q.eq('ambito_id', f.ambito)
    if (f.categoria) q = q.eq('categoria_id', f.categoria)
    if (f.subcategoria) q = q.eq('subcategoria_id', f.subcategoria)
    if (f.medio) q = q.eq('payment_method_id', f.medio)
    if (f.min && parseMontoNoNegativo(f.min) !== null) q = q.gte('amount', parseMontoNoNegativo(f.min)!)
    if (f.max && parseMontoNoNegativo(f.max) !== null) q = q.lte('amount', parseMontoNoNegativo(f.max)!)
    if (f.concepto) q = q.eq('event_item_id', f.concepto)
    if (f.compromiso) q = q.eq('event_commitment_id', f.compromiso)
    const col = f.orden === 'importe' ? 'amount' : f.orden === 'descripcion' ? 'description' : 'expense_date'
    const { data, error, count } = await q.order(col, { ascending: f.orden === 'antiguo' || f.orden === 'descripcion' }).order('id').range((f.pagina - 1) * 20, f.pagina * 20 - 1).abortSignal(signal)
    if (error) throw error
    return { filas: data as Gasto[], total: count ?? 0 }
  } })
}
/** Conversión congelada de un concepto o compromiso en USD: el importe contable PEN va en planned_amount / contracted_amount. */
type CamposMoneda = Pick<Fila<'event_items'>, 'original_currency' | 'original_amount' | 'exchange_rate' | 'exchange_rate_source' | 'exchange_rate_reference_date' | 'conversion_method' | 'exchange_rate_fetched_at' | 'conversion_snapshot_version'>
type Guardable<T> = Omit<T, keyof CamposMoneda> & Pick<CamposMoneda, 'original_amount'> & Partial<Omit<CamposMoneda, 'original_amount'>>
type ConceptoGuardable = Guardable<Fila<'event_items'>>
type CompromisoGuardable = Guardable<Fila<'event_commitments'>>

export function useMutacionesEvento() {
  const qc = useQueryClient()
  const refrescar = () => { void qc.invalidateQueries({ queryKey: ['eventos'] }); void qc.invalidateQueries({ queryKey: ['gastos'] }); void qc.invalidateQueries({ queryKey: ['plantillas'] }) }
  const guardar = useMutation({ mutationFn: async (v: Fila<'events'>) => {
    const { error } = await supabase.from('events').upsert(v)
    if (error) throw error
    return v.id
  }, onSuccess: refrescar })
  const cambiar = useMutation({ mutationFn: async ({ id, patch }: { id: string; patch: Partial<Fila<'events'>> }) => {
    const { error } = await supabase.from('events').update(patch).eq('id', id)
    if (error) throw error
  }, onSuccess: refrescar })
  const copiar = useMutation({ mutationFn: async (v: { source: string; values: Json; key: string }) => {
    const { data, error } = await supabase.rpc('clone_event', { p_source: v.source, p_values: v.values, p_key: v.key })
    if (error) throw error
    return data
  }, onSuccess: refrescar })
  const vincular = useMutation({ mutationFn: async (v: { ids: string[]; event: string | null; item?: string | null; commitment?: string | null; replace?: boolean }) => {
    const { data, error } = await supabase.rpc('link_event_expenses', { p_ids: v.ids, p_event: v.event ?? undefined, p_item: v.item ?? undefined, p_commitment: v.commitment ?? undefined, p_replace: v.replace ?? false })
    if (error) throw error
    return data
  }, onSuccess: refrescar })
  const concepto = useMutation({ mutationFn: async (v: ConceptoGuardable) => { const { id, event_id, household_id, name, planned_amount, sort_order, created_at, ...moneda } = v; const { error } = await supabase.from('event_items').upsert({ id, event_id, household_id, name, planned_amount, sort_order, created_at, ...moneda }); if (error) throw error }, onSuccess: refrescar })
  const quitarConcepto = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from('event_items').delete().eq('id', id); if (error) throw error }, onSuccess: refrescar })
  const compromiso = useMutation({ mutationFn: async (v: CompromisoGuardable) => { const { error } = await supabase.from('event_commitments').upsert(v); if (error) throw error }, onSuccess: refrescar })
  return { guardar, cambiar, copiar, vincular, concepto, quitarConcepto, compromiso }
}
