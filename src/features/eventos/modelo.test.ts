import { describe, expect, it } from 'vitest'
import { recibeGastos, segmentosProgreso } from './modelo'

describe('ciclo de vida de eventos', () => {
  it('solo eventos reales abiertos reciben gastos', () => {
    const base = { status: 'planned', archived_at: null, is_template: false }
    expect(recibeGastos(base)).toBe(true)
    expect(recibeGastos({ ...base, status: 'in_progress' })).toBe(true)
    for (const status of ['completed','cancelled']) expect(recibeGastos({ ...base, status })).toBe(false)
    expect(recibeGastos({ ...base, is_template: true })).toBe(false)
    expect(recibeGastos({ ...base, archived_at: '2026-11-16' })).toBe(false)
  })
  it('separa lo pagado de lo comprometido en la barra', () => {
    expect(segmentosProgreso(30,90)).toEqual({ real: 30, pendiente: 60 })
    expect(segmentosProgreso(90,130)).toEqual({ real: 90, pendiente: 10 })
  })
  it('limita solo el ancho visual y trata presupuesto cero sin porcentaje ficticio', () => {
    expect(segmentosProgreso(130,130)).toEqual({ real: 100, pendiente: 0 })
    expect(segmentosProgreso(null,null)).toEqual({ real: 0, pendiente: 0 })
    expect(segmentosProgreso(20,10)).toEqual({ real: 20, pendiente: 0 })
  })
})
