import { describe, expect, it } from 'vitest'
import { hoyEnZona } from './hoy'

describe('hoyEnZona', () => {
  it('respeta la zona horaria elegida (Lima va 5 h por detrás de UTC)', () => {
    const ahora = new Date('2026-11-01T02:30:00Z')
    expect(hoyEnZona('America/Lima', ahora)).toBe('2026-10-31')
    expect(hoyEnZona('UTC', ahora)).toBe('2026-11-01')
    expect(hoyEnZona('Asia/Tokyo', ahora)).toBe('2026-11-01')
  })
  it('una zona inválida no rompe: usa la del navegador', () => {
    expect(hoyEnZona('No/Existe', new Date('2026-06-15T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
