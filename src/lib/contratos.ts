import { z } from 'zod'
import type { CambioFondos, FilaPeriodoFondo } from '@/domain/fondos'
import type { EliminacionFondo, ResultadoCopia } from '@/features/fondos/useFondos'
import type { ResultadoAplicacion } from '@/features/fondos/usePlantillasFondos'
import type { ReporteGasto } from '@/features/gastos/useGastos'
import type { PlanFila, ResumenPlan } from '@/features/planificacion/usePlanificacion'

/**
 * Contratos de las RPC financieras. El tipo `Json` que devuelve Supabase no dice nada de la forma real: aquí se comprueba en el límite.
 * Si una función cambia de forma de manera incompatible, falla con un error claro (nombre de la RPC y campo) en vez de propagar datos a medias.
 */
export class ContratoRpcError extends Error {
  constructor(public readonly rpc: string, public readonly detalle: string) {
    super(`La respuesta de ${rpc} no tiene la forma esperada (${detalle}). La base de datos y la aplicación no están en la misma versión.`)
    this.name = 'ContratoRpcError'
  }
}

export function leerRpc<T>(schema: z.ZodType<T, unknown>, data: unknown, rpc: string): T {
  const r = schema.safeParse(data)
  if (!r.success) {
    const i = r.error.issues[0]
    throw new ContratoRpcError(rpc, `${i.path.join('.') || 'raíz'}: ${i.message}`)
  }
  return r.data
}

/** jsonb entrega null donde la interfaz usa «ausente». */
const op = <S extends z.ZodType>(s: S) => s.nullish().transform((v) => v ?? undefined)
const num = z.number()
const dinero = z.record(z.string(), num)

// Una respuesta bloqueada (`blocked: true`) trae solo código, motivo y mensaje: sin asignaciones ni advertencias.
const lista = <S extends z.ZodType>(s: S) => z.array(s).nullish().transform((v) => v ?? [])
export const reporteGasto: z.ZodType<ReporteGasto, unknown> = z.object({
  expense_id: op(z.string()),
  allocations: lista(z.object({
    fund_id: z.string(), fund_name: z.string(), is_general: z.boolean(), kind: z.enum(['specific', 'general']), amount: num, remaining_after: num,
  })),
  warnings: lista(z.object({ code: z.enum(['general_negative', 'specific_overspend']), fund_id: z.string(), fund_name: z.string(), remaining_after: num })),
  replayed: op(z.boolean()),
  blocked: op(z.boolean()),
  code: op(z.string()),
  reason: op(z.string()),
  message: op(z.string()),
})

const filaPeriodoFondo: z.ZodType<FilaPeriodoFondo, unknown> = z.object({
  period_id: z.string(), start: z.string(), fund_id: z.string(), fund_name: z.string(), assigned: num, consumed: num,
})

export const cambioFondos: z.ZodType<CambioFondos, unknown> = z.object({
  dry_run: z.boolean(),
  fund_id: op(z.string()),
  blocked: op(z.string()),
  changed_expenses: z.number().nullable(),
  consumption_before: dinero,
  consumption_after: dinero.nullable(),
  periodos: op(z.object({ before: z.array(filaPeriodoFondo), after: z.array(filaPeriodoFondo).nullable() })),
})

export const vistaPreviaCambio = z.object({ blocked: z.string().nullable(), before: z.array(filaPeriodoFondo), after: z.array(filaPeriodoFondo).nullable() })

export const resultadoCopia: z.ZodType<ResultadoCopia, unknown> = z.object({
  created: z.array(z.object({ source_id: z.string(), id: z.string(), name: z.string(), amount: num })),
  skipped: z.array(z.object({ source_id: z.string(), name: z.string().nullable(), reason: z.enum(['already_copied', 'name_exists', 'general_exists', 'not_in_source']) })),
})

export const resultadoAplicacion: z.ZodType<ResultadoAplicacion, unknown> = z.object({
  created: z.array(z.object({ template_id: z.string(), id: z.string(), name: z.string(), amount: num })),
  skipped: z.array(z.object({
    template_id: z.string(), name: z.string().nullable(),
    reason: z.enum(['not_found', 'inactive', 'already_applied', 'name_exists', 'general_exists', 'invalid_rules']),
  })),
})

export const eliminacionFondo: z.ZodType<EliminacionFondo, unknown> = z.object({
  dry_run: z.boolean(), fund_name: z.string(), is_general: z.boolean(),
  open_expenses: num, open_allocations: num, closed_allocations: num, closed_snapshots: num, budgets: num, templates: num,
  destinations: z.array(z.object({ id: z.string(), name: z.string(), is_general: z.boolean() })),
  blocked: z.boolean(),
  code: z.string().nullish().transform((v) => v ?? null), // ausente cuando el fondo se puede eliminar
  changed_expenses: op(z.number()),
  consumption_before: op(dinero),
  consumption_after: z.record(z.string(), num).nullish().transform((v) => v),
}) as z.ZodType<EliminacionFondo, unknown>

export const resultadoLote = z.object({ batch_id: z.string(), count: num, total: num, replayed: z.boolean() })

const etapa = z.enum(['pending', 'done', 'skipped'])
export const planFila: z.ZodType<PlanFila, unknown> = z.object({
  id: z.string(), period_id: z.string(), status: z.enum(['pending', 'in_progress', 'completed']), funds_stage: etapa, expenses_stage: etapa,
  started_at: z.string().nullable(), completed_at: z.string().nullable(), remind_after: z.string().nullable(), updated_at: z.string(),
})

export const resumenPlan: z.ZodType<ResumenPlan, unknown> = z.object({
  period_id: z.string().nullable(), funds_total: num, funds_count: num,
  budget_total: z.coerce.number(), expenses_total: z.coerce.number(), expenses_count: num, overspent_funds: num,
  plan: planFila.nullable(),
})
