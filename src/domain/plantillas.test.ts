import { describe, expect, it } from 'vitest'
import { fechaEfectiva } from './plantillas'

describe('fechaEfectiva', () => {
  it('usa el día pedido cuando el mes lo tiene', () => {
    expect(fechaEfectiva(15, '2026-10-01')).toEqual({ iso: '2026-10-15', ajustada: false })
    expect(fechaEfectiva(31, '2026-10-01')).toEqual({ iso: '2026-10-31', ajustada: false })
  })
  it('en meses más cortos usa el último día válido y lo señala', () => {
    expect(fechaEfectiva(31, '2026-09-01')).toEqual({ iso: '2026-09-30', ajustada: true })
    expect(fechaEfectiva(30, '2026-02-01')).toEqual({ iso: '2026-02-28', ajustada: true })
    expect(fechaEfectiva(29, '2027-02-01')).toEqual({ iso: '2027-02-28', ajustada: true })
    expect(fechaEfectiva(29, '2028-02-01')).toEqual({ iso: '2028-02-29', ajustada: false }) // año bisiesto
  })
  it('sin día se propone el 1', () => {
    expect(fechaEfectiva(null, '2026-10-01')).toEqual({ iso: '2026-10-01', ajustada: false })
  })
})
