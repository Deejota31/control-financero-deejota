import { describe, expect, it } from 'vitest'
import { rutaInterna } from './rutaInterna'

describe('rutaInterna', () => {
  it('conserva rutas internas con consulta', () => {
    expect(rutaInterna('/gastos?mes=2026-11')).toBe('/gastos?mes=2026-11')
  })
  it('rechaza destinos externos o ambiguos', () => {
    for (const x of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', 'gastos', '/a\nb', undefined, 42]) {
      expect(rutaInterna(x)).toBe('/')
    }
  })
})
