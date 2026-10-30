import { describe, expect, it } from 'vitest'
import type { Plantilla } from '@/lib/tipos'
import { diferenciasConBase, payloadDePlantilla, problemasDeFila, valoresBase } from './registroPlantillas'

const plantilla = (o: Partial<Plantilla> = {}) => ({
  id: 'p1', name: 'Luz', description: 'Recibo de luz', notes: null, default_amount: '180', is_amount_variable: false, day_of_month: 31,
  ambito_id: 'a', categoria_id: 'c', subcategoria_id: null, payment_method_id: 'm1', expense_type: 'fixed', ...o,
}) as unknown as Plantilla

describe('valoresBase', () => {
  it('propone importe, medio y día sugerido; en un mes corto usa su último día', () => {
    const v = valoresBase(plantilla(), '2026-02-01')
    expect(v).toEqual({ amount: '180.00', date: '2026-02-28', method: 'm1', confirmado: true })
  })
  it('un importe variable exige confirmación y sin importe parte vacío', () => {
    const v = valoresBase(plantilla({ is_amount_variable: true, default_amount: null }), '2026-10-01')
    expect(v.amount).toBe('')
    expect(v.confirmado).toBe(false)
  })
})

describe('problemasDeFila', () => {
  const base = { amount: '180.00', date: '2026-10-05', method: 'm1', confirmado: true }
  it('una fila completa no tiene problemas', () => expect(problemasDeFila(base, '2026-10-01')).toEqual([]))
  it('exige confirmar el importe variable, el medio y una fecha dentro del mes', () => {
    expect(problemasDeFila({ ...base, confirmado: false }, '2026-10-01')).toContain('Revisa y confirma el importe de este mes.')
    expect(problemasDeFila({ ...base, method: '' }, '2026-10-01')).toContain('Elige el medio de pago.')
    expect(problemasDeFila({ ...base, date: '2026-11-02' }, '2026-10-01')[0]).toMatch(/^La fecha debe estar en /)
    expect(problemasDeFila({ ...base, date: '' }, '2026-10-01')).toContain('Elige la fecha.')
  })
  it('un importe inválido se informa y no se pide confirmarlo', () => {
    const p = problemasDeFila({ ...base, amount: 'abc', confirmado: false }, '2026-10-01')
    expect(p.length).toBeGreaterThan(0)
    expect(p).not.toContain('Revisa y confirma el importe de este mes.')
  })
})

describe('diferenciasConBase', () => {
  const b = { amount: '180.00', date: '2026-10-31', method: 'm1', confirmado: true }
  it('sin cambios no hay diferencias', () => expect(diferenciasConBase(b, b)).toEqual({}))
  it('detecta importe, medio y día cambiados (solo el día, no la fecha completa)', () => {
    expect(diferenciasConBase({ ...b, amount: '200', method: 'm2', date: '2026-10-05' }, b)).toEqual({ importe: 200, medio: 'm2', dia: 5 })
  })
  it('un importe equivalente escrito distinto no cuenta como cambio', () => expect(diferenciasConBase({ ...b, amount: '180' }, b)).toEqual({}))
})

describe('payloadDePlantilla', () => {
  it('arma el gasto con los valores del mes, es recurrente y enlaza la plantilla (idempotencia por plantilla)', () => {
    const p = payloadDePlantilla(plantilla(), { amount: '195.50', date: '2026-10-05', method: 'm2' })
    expect(p).toMatchObject({ amount: 195.5, expense_date: '2026-10-05', payment_method_id: 'm2', template_id: 'p1', is_recurring: true, expense_type: 'fixed', notes: '' })
  })
})
