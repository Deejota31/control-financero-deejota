import { describe, expect, it } from 'vitest'
import { ContratoRpcError, cambioFondos, eliminacionFondo, leerRpc, planFila, reporteGasto, resumenPlan, resultadoAplicacion } from './contratos'

const reporte = { allocations: [{ fund_id: 'f1', fund_name: 'Hogar', is_general: false, kind: 'specific', amount: 10.5, remaining_after: 89.5 }], warnings: [], blocked: null, replayed: false }

describe('contratos de las RPC', () => {
  it('acepta la forma real y convierte null en «ausente» (como espera la interfaz)', () => {
    const r = leerRpc(reporteGasto, { ...reporte, expense_id: 'e1', code: null }, 'create_expense')
    expect(r.expense_id).toBe('e1')
    expect(r.blocked).toBeUndefined()
    expect(r.code).toBeUndefined()
    expect(r.allocations[0].amount).toBe(10.5)
  })

  it('un cambio incompatible falla con un error claro que nombra la RPC y el campo', () => {
    const roto = { ...reporte, allocations: [{ ...reporte.allocations[0], amount: '10.50' }] } // el importe llega como texto
    expect(() => leerRpc(reporteGasto, roto, 'create_expense')).toThrow(ContratoRpcError)
    expect(() => leerRpc(reporteGasto, roto, 'create_expense')).toThrow(/create_expense.*allocations\.0\.amount/)
  })

  it('una respuesta vacía o de otro tipo no se propaga como datos válidos', () => {
    expect(() => leerRpc(reporteGasto, null, 'preview_expense')).toThrow(ContratoRpcError)
    expect(() => leerRpc(reporteGasto, { allocations: 'x' }, 'preview_expense')).toThrow(/preview_expense/)
    expect(() => leerRpc(resultadoAplicacion, { created: [] }, 'apply_fund_templates')).toThrow(/skipped/)
  })

  it('rechaza un motivo de omisión desconocido (una RPC nueva no se interpreta a ciegas)', () => {
    const r = { created: [], skipped: [{ template_id: 't', name: null, reason: 'nuevo_motivo' }] }
    expect(() => leerRpc(resultadoAplicacion, r, 'apply_fund_templates')).toThrow(/reason/)
  })

  it('cambio de fondos: acepta la simulación con consumo antes/después', () => {
    const r = leerRpc(cambioFondos, { dry_run: true, fund_id: null, blocked: null, changed_expenses: 3, consumption_before: { a: 10 }, consumption_after: { a: 12.5 } }, 'save_fund')
    expect(r.changed_expenses).toBe(3)
    expect(r.consumption_after).toEqual({ a: 12.5 })
    expect(() => leerRpc(cambioFondos, { dry_run: 'sí' }, 'save_fund')).toThrow(ContratoRpcError)
  })

  it('resumen del plan: normaliza los importes que llegan como texto y exige el plan o null', () => {
    const r = leerRpc(resumenPlan, { period_id: 'p', funds_total: 2, funds_count: 2, budget_total: '1500.50', expenses_total: 20, expenses_count: 1, overspent_funds: 0, plan: null }, 'planning_summary')
    expect(r.budget_total).toBe(1500.5)
    expect(() => leerRpc(resumenPlan, { period_id: 'p' }, 'planning_summary')).toThrow(ContratoRpcError)
  })

  it('el plan exige etapas válidas', () => {
    const base = { id: 'x', period_id: 'p', status: 'pending', funds_stage: 'pending', expenses_stage: 'done', started_at: null, completed_at: null, remind_after: null, updated_at: 't' }
    expect(leerRpc(planFila, base, 'save_period_plan').expenses_stage).toBe('done')
    expect(() => leerRpc(planFila, { ...base, funds_stage: 'otra' }, 'save_period_plan')).toThrow(/funds_stage/)
  })

  it('un gasto bloqueado trae solo código, motivo y mensaje (sin asignaciones): es una respuesta válida', () => {
    const r = leerRpc(reporteGasto, { blocked: true, code: 'GD001', reason: 'classification', message: 'Ningún fondo admite…' }, 'preview_expense')
    expect(r.blocked).toBe(true)
    expect(r.allocations).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('eliminar fondo: el código puede faltar cuando se puede eliminar', () => {
    const base = { dry_run: false, fund_name: 'Vacío', is_general: false, open_expenses: 0, open_allocations: 0, closed_allocations: 0, closed_snapshots: 0, budgets: 1, templates: 0, destinations: [], blocked: false, changed_expenses: 0, consumption_before: {}, consumption_after: {} }
    expect(leerRpc(eliminacionFondo, base, 'delete_fund').code).toBeNull()
    expect(() => leerRpc(eliminacionFondo, { ...base, blocked: 'no' }, 'delete_fund')).toThrow(ContratoRpcError)
  })
})
