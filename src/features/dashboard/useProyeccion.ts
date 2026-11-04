import { useQuery } from '@tanstack/react-query'
import { addMonths, format, parse } from 'date-fns'
import { useMemo } from 'react'
import { proyectarCierre, type FilaProy, type PlantillaPlan, type Proyeccion } from '@/domain/proyeccion'
import type { FiltrosAnalisis } from '@/domain/analisis'
import { usePlantillas } from '@/features/gastos/usePlantillas'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'

interface FilaBd {
  expense_date: string
  amount: number
  expense_type: string
  is_recurring: boolean
  template_id: string | null
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  payment_method_id: string
}

/**
 * Datos para estimar el cierre del mes: el gasto activo de los cinco meses anteriores y del rango (lectura completa, sin truncar) y las plantillas
 * que ya se registraron o se marcaron «No aplica» este mes. Solo lectura: ninguna escritura ni creación de períodos.
 */
export function useDatosProyeccion(desde: string, hasta: string, habilitado: boolean) {
  const inicio = format(addMonths(parse(desde, 'yyyy-MM-dd', new Date(2000, 0, 1)), -5), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['dashboard', 'proyeccion', inicio, hasta],
    enabled: habilitado,
    queryFn: async ({ signal }) => {
      const [bd, periodo] = await Promise.all([
        leerTodo<FilaBd>((d, h) =>
          supabase.from('expenses').select('expense_date, amount, expense_type, is_recurring, template_id, ambito_id, categoria_id, subcategoria_id, payment_method_id', { count: 'exact' })
            .eq('status', 'active').gte('expense_date', inicio).lte('expense_date', hasta).order('id').range(d, h).abortSignal(signal)),
        supabase.from('budget_periods').select('id').eq('start_date', desde).abortSignal(signal).maybeSingle(),
      ])
      if (periodo.error) throw periodo.error
      const resueltas = new Set<string>(bd.filter((f) => f.template_id && f.expense_date >= desde && f.expense_date <= hasta).map((f) => f.template_id as string))
      if (periodo.data) {
        const lotes = await supabase.from('template_batches').select('created_at, template_batch_items(template_id, outcome)').eq('period_id', periodo.data.id).order('created_at').abortSignal(signal)
        if (lotes.error) throw lotes.error
        // Prevalece la decisión más reciente de cada plantilla (igual que en el registro mensual).
        const ultimo = new Map<string, string>()
        for (const lote of lotes.data ?? []) for (const it of lote.template_batch_items ?? []) ultimo.set(it.template_id, it.outcome)
        for (const [id, o] of ultimo) if (o === 'not_applicable') resueltas.add(id)
      }
      const filas: FilaProy[] = bd.map((f) => ({
        fecha: f.expense_date, monto: f.amount, tipo: f.expense_type, recurrente: f.is_recurring,
        ambito_id: f.ambito_id, categoria_id: f.categoria_id, subcategoria_id: f.subcategoria_id, medio_id: f.payment_method_id,
      }))
      return { filas, resueltas }
    },
  })
}

type EntradaHook = {
  desde: string
  hasta: string
  hoy: string
  filtros: Omit<FiltrosAnalisis, 'dia'>
  presupuesto: number | null
}

/** Proyección de cierre lista para mostrar; `null` mientras carga o si la lectura falla (el Dashboard sigue sin proyección en lugar de mostrar una cifra dudosa). */
export function useProyeccion(e: EntradaHook & { habilitado: boolean }): { proyeccion: Proyeccion | null; cargando: boolean } {
  const datos = useDatosProyeccion(e.desde, e.hasta, e.habilitado)
  const plantillas = usePlantillas()
  const { desde, hasta, hoy, filtros, presupuesto } = e
  const activas: PlantillaPlan[] | null = useMemo(() => {
    if (!plantillas.data) return null
    const lista = plantillas.data.filter((p) => p.is_active && Number(p.default_amount) > 0)
    return lista.map((p) => ({ id: p.id, monto: Number(p.default_amount), tipo: p.expense_type, ambito_id: p.ambito_id, categoria_id: p.categoria_id, subcategoria_id: p.subcategoria_id, medio_id: p.payment_method_id }))
  }, [plantillas.data])
  const proyeccion = useMemo(
    () => (datos.data && activas !== null ? proyectarCierre({ desde, hasta, hoy, filas: datos.data.filas, plantillas: activas, plantillasResueltas: datos.data.resueltas, filtros, presupuesto }) : null),
    [datos.data, activas, desde, hasta, hoy, filtros, presupuesto],
  )
  return { proyeccion, cargando: e.habilitado && (datos.isPending || plantillas.isPending) }
}
