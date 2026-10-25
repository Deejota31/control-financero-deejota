import { describe, expect, it } from 'vitest'
import type { GastoBasico } from './dashboard'
import { ahorroPosible, compromisosMensuales, reservaSugerida, tendencias, totalCompromisos, variablesReducibles } from './salud'

const g = (cat: string, monto: number, extra: Partial<GastoBasico> = {}): GastoBasico => ({ expense_date: '2026-10-01', amount: monto, ambito_id: 'a', categoria_id: cat, subcategoria_id: null, expense_type: 'variable', ...extra })

describe('tendencias', () => {
  it('sin meses anteriores con datos reporta datos insuficientes', () => {
    expect(tendencias([g('x', 100)], [[], []], 'categoria_id')).toEqual({ mesesBase: 0, aumentando: [] })
  })
  it('detecta lo que sube sobre el promedio de meses con datos', () => {
    const r = tendencias([g('comida', 300), g('ocio', 50)], [[g('comida', 100), g('ocio', 50)], [g('comida', 200)], []], 'categoria_id')
    expect(r.mesesBase).toBe(2)
    expect(r.aumentando).toEqual([{ id: 'comida', actual: 300, promedio: 150, diferencia: 150, pct: 100 }])
  })
  it('ignora aumentos pequeños en monto o porcentaje', () => {
    const r = tendencias([g('a', 110), g('b', 1010)], [[g('a', 100), g('b', 1000)]], 'categoria_id')
    expect(r.aumentando).toEqual([])
  })
  it('una categoría nueva sin historial cuenta como aumento si supera el mínimo', () => {
    const r = tendencias([g('nueva', 80)], [[g('otra', 10)]], 'categoria_id')
    expect(r.aumentando[0]).toMatchObject({ id: 'nueva', promedio: 0, pct: null })
  })
})

describe('variablesReducibles', () => {
  it('promedia solo gastos variables y calcula su participación', () => {
    const r = variablesReducibles([[g('a', 100), g('b', 300), g('fijo', 999, { expense_type: 'fixed' })], [g('a', 300)]])
    expect(r.mesesBase).toBe(2)
    expect(r.filas.map((f) => [f.id, f.promedio])).toEqual([['a', 200], ['b', 150]])
    expect(r.filas[0].participacion).toBeCloseTo(57.14, 1)
  })
  it('sin gastos variables previos no hay base', () => {
    expect(variablesReducibles([[g('x', 10, { expense_type: 'fixed' })]])).toEqual({ mesesBase: 0, filas: [] })
  })
})

describe('compromisos', () => {
  const rec = (m: number) => g('c', m, { is_recurring: true })
  it('promedio y máximo de meses con compromisos', () => {
    expect(compromisosMensuales([[rec(100), rec(50)], [rec(300)], [g('v', 20)]])).toEqual({ mesesBase: 2, promedio: 225, maximo: 300 })
  })
  it('sin compromisos devuelve nulos', () => {
    expect(compromisosMensuales([[g('v', 20)]])).toEqual({ mesesBase: 0, promedio: null, maximo: null })
  })
  it('suma fijos y recurrentes', () => {
    expect(totalCompromisos([rec(10), g('x', 5, { expense_type: 'fixed' }), g('y', 7)])).toBe(15)
  })
  it('la reserva se redondea hacia arriba y toma lo mayor', () => {
    expect(reservaSugerida({ mesesBase: 2, promedio: 225, maximo: 300 }, 0)).toBe(230)
    expect(reservaSugerida({ mesesBase: 0, promedio: null, maximo: null }, 301)).toBe(310)
    expect(reservaSugerida({ mesesBase: 0, promedio: null, maximo: null }, 0)).toBeNull()
  })
})

describe('ahorroPosible', () => {
  it('calcula el porcentaje del promedio', () => {
    expect(ahorroPosible(200, 10)).toBe(20)
  })
})
