import { describe, expect, it } from 'vitest'
import { estadoDelMes } from './periodo'

describe('estadoDelMes', () => {
  it('el mes en curso está abierto', () => expect(estadoDelMes('2026-10-01', '2026-10-28')).toBe('open'))
  it('los meses anteriores están cerrados, también los de años anteriores', () => {
    expect(estadoDelMes('2026-09-01', '2026-10-28')).toBe('closed')
    expect(estadoDelMes('2025-12-01', '2026-01-05')).toBe('closed')
    expect(estadoDelMes('2025-12-01', '2026-10-28')).toBe('closed')
  })
  it('los meses posteriores son futuros, también los de años siguientes', () => {
    expect(estadoDelMes('2026-11-01', '2026-10-28')).toBe('future')
    expect(estadoDelMes('2027-01-01', '2026-12-31')).toBe('future')
    expect(estadoDelMes('2027-03-01', '2026-10-28')).toBe('future')
  })
  it('no compara solo el número del mes (enero de 2027 es posterior a diciembre de 2026)', () => {
    expect(estadoDelMes('2027-01-01', '2026-12-15')).toBe('future')
    expect(estadoDelMes('2026-12-01', '2027-01-02')).toBe('closed')
  })
})
