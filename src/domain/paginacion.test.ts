import { describe, expect, it } from 'vitest'
import { paginasVisibles, rangoVisible, totalPaginas } from './paginacion'

describe('totalPaginas / rangoVisible', () => {
  it('calcula páginas y rango con el último tramo incompleto', () => {
    expect(totalPaginas(83, 20)).toBe(5)
    expect(totalPaginas(0, 20)).toBe(1)
    expect(rangoVisible(1, 20, 83)).toEqual({ desde: 1, hasta: 20 })
    expect(rangoVisible(5, 20, 83)).toEqual({ desde: 81, hasta: 83 })
    expect(rangoVisible(1, 20, 0)).toEqual({ desde: 0, hasta: 0 })
  })
})

describe('paginasVisibles', () => {
  it('muestra todas cuando caben', () => expect(paginasVisibles(2, 5)).toEqual([1, 2, 3, 4, 5]))
  it('resume el final con «…» cerca del inicio', () => expect(paginasVisibles(1, 18)).toEqual([1, 2, 3, 4, 5, '…', 18]))
  it('resume el inicio con «…» cerca del final', () => expect(paginasVisibles(18, 18)).toEqual([1, '…', 14, 15, 16, 17, 18]))
  it('en medio muestra la actual con sus vecinas entre dos «…»', () => expect(paginasVisibles(9, 18)).toEqual([1, '…', 8, 9, 10, '…', 18]))
  it('siempre incluye la actual y nunca supera el máximo', () => {
    for (let t = 1; t <= 40; t++) for (let a = 1; a <= t; a++) {
      const v = paginasVisibles(a, t)
      expect(v).toContain(a)
      expect(v.length).toBeLessThanOrEqual(7)
      expect(v[0]).toBe(1)
      expect(v[v.length - 1]).toBe(t)
    }
  })
  it('respeta un máximo menor (pantallas estrechas)', () => {
    const v = paginasVisibles(9, 18, 5)
    expect(v.length).toBeLessThanOrEqual(5)
    expect(v).toContain(9)
  })
})
