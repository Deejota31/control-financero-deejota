import { construirCsvGastos, construirRespaldo, type DatosRespaldo, type GastoFila } from '@/domain/exportacion'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'

/** Tablas de las que se lee con la sesión del navegador (clave pública + RLS): solo se obtienen filas del propio hogar. */
type Tabla =
  | 'households' | 'ambitos' | 'categorias' | 'subcategorias' | 'medios_pago' | 'funds' | 'fund_scope_rules' | 'fund_payment_rules'
  | 'budget_periods' | 'fund_period_budgets' | 'expense_templates' | 'expenses' | 'expense_fund_allocations'

export type Progreso = (texto: string) => void

export function esCancelacion(e: unknown): boolean {
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return /abort/i.test(m)
}

/** Lee una tabla completa, por páginas, con verificación del total y cancelación. */
async function leerTabla<T = Record<string, unknown>>(tabla: Tabla, etiqueta: string, signal: AbortSignal, progreso: Progreso): Promise<T[]> {
  return leerTodo<T>(async (d, h) => {
    signal.throwIfAborted()
    progreso(`Leyendo ${etiqueta}… ${d.toLocaleString('es-PE')} registros`)
    const r = await supabase.from(tabla).select('*', { count: 'exact' }).order('id').range(d, h).abortSignal(signal)
    return r as unknown as { data: T[] | null; error: { message: string } | null; count: number | null }
  })
}

export interface OpcionesExportarCsv { incluirAnulados: boolean; desde?: string; hasta?: string }

export async function generarCsvGastos(o: OpcionesExportarCsv, signal: AbortSignal, progreso: Progreso): Promise<string> {
  const gastos = await leerTabla<GastoFila>('expenses', 'gastos', signal, progreso)
  const ambitos = await leerTabla<{ id: string; name: string }>('ambitos', 'ámbitos', signal, progreso)
  const categorias = await leerTabla<{ id: string; name: string }>('categorias', 'categorías', signal, progreso)
  const subcategorias = await leerTabla<{ id: string; name: string }>('subcategorias', 'subcategorías', signal, progreso)
  const medios = await leerTabla<{ id: string; name: string }>('medios_pago', 'medios de pago', signal, progreso)
  const fondos = await leerTabla<{ id: string; name: string }>('funds', 'fondos', signal, progreso)
  const asignaciones = await leerTabla<{ expense_id: string; fund_id: string; amount: number; allocation_kind: string }>('expense_fund_allocations', 'imputaciones a fondos', signal, progreso)
  progreso('Preparando archivo…')
  return construirCsvGastos({ gastos, ambitos, categorias, subcategorias, medios, fondos, asignaciones, ...o })
}

export async function generarRespaldo(
  perfil: DatosRespaldo['perfil'], signal: AbortSignal, progreso: Progreso,
): Promise<ReturnType<typeof construirRespaldo>> {
  const l = (t: Tabla, e: string) => leerTabla(t, e, signal, progreso)
  const hogar = (await l('households', 'hogar'))[0] ?? null
  const datos: DatosRespaldo = {
    perfil, hogar,
    ambitos: await l('ambitos', 'ámbitos'), categorias: await l('categorias', 'categorías'), subcategorias: await l('subcategorias', 'subcategorías'), medios_pago: await l('medios_pago', 'medios de pago'),
    fondos: await l('funds', 'fondos'), reglas_ambito: await l('fund_scope_rules', 'reglas de cobertura'), reglas_medio: await l('fund_payment_rules', 'reglas de medios de pago'),
    periodos: await l('budget_periods', 'períodos'), presupuestos_fondo: await l('fund_period_budgets', 'presupuestos por fondo'),
    gastos: await l('expenses', 'gastos'), imputaciones: await l('expense_fund_allocations', 'imputaciones a fondos'), plantillas: await l('expense_templates', 'plantillas'),
  }
  progreso('Preparando archivo…')
  return construirRespaldo(datos, new Date().toISOString())
}
