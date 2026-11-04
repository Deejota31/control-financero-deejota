import { describe, expect, it } from 'vitest'
import { aCentimos, deCentimos, redondear, repartirIgual, sumar } from './dinero'

describe('dinero (céntimos enteros)', () => {
  it('convierte sin error de coma flotante', () => {
    expect(aCentimos('2358.30')).toBe(235830)
    expect(aCentimos(0.1 + 0.2)).toBe(30)
    expect(aCentimos(1.005)).toBe(101) // 1.005 · 100 = 100.49999… en binario
    expect(aCentimos(-1.005)).toBe(-101)
    expect(deCentimos(235830)).toBe(2358.3)
  })

  it('suma exacta: 10 000 importes de 0.10 dan 1 000.00 (con coma flotante darían 999.9999999999)', () => {
    const diez = Array.from({ length: 10_000 }, () => 0.1)
    expect(diez.reduce((s, x) => s + x, 0)).not.toBe(1000) // el problema que se evita
    expect(sumar(diez)).toBe(1000)
    expect(sumar(['0.10', 0.2, '0.3'])).toBe(0.6)
    expect(sumar([])).toBe(0)
  })

  it('redondea a dos decimales de forma estable', () => {
    expect(redondear(17687.25)).toBe(17687.25)
    expect(redondear(122.6666667)).toBe(122.67)
    expect(redondear(2358.3 / 4)).toBe(589.58)
  })

  it('reparte un importe entre partes sin perder ni inventar céntimos', () => {
    for (const [total, partes] of [[100, 3], [0.01, 2], [55, 4], [1000, 7], [-10, 3]] as const) {
      const r = repartirIgual(total, partes)
      expect(r).toHaveLength(partes)
      expect(sumar(r)).toBe(total)
      expect(Math.max(...r) - Math.min(...r)).toBeLessThanOrEqual(0.01 + 1e-9) // reparto lo más parejo posible
    }
    expect(repartirIgual(10, 0)).toEqual([])
  })
})
