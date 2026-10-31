import { describe, expect, it } from 'vitest'
import { PALETA, armonizar, colorEfectivo, hexARgb, hsvARgb, idDeColor, normalizarHex, rgbAHex, rgbAHsv, tonos } from './color'

describe('color', () => {
  it('HEX y RGB se mantienen sincronizados (#5B5BD6 ↔ 91, 91, 214)', () => {
    expect(hexARgb('#5B5BD6')).toEqual([91, 91, 214])
    expect(rgbAHex([91, 91, 214])).toBe('#5B5BD6')
    expect(rgbAHex([91, 91, 200])).toBe('#5B5BC8')
  })

  it('normaliza el HEX y rechaza lo inválido', () => {
    expect(normalizarHex('5b5bd6')).toBe('#5B5BD6')
    expect(normalizarHex(' #abc123 ')).toBe('#ABC123')
    for (const malo of ['', '#12345', '#GGGGGG', 'rojo', '#1234567']) expect(normalizarHex(malo)).toBeNull()
    expect(hexARgb('zzz')).toBeNull()
  })

  it('HSV ida y vuelta conserva el color', () => {
    for (const c of PALETA) {
      const rgb = hexARgb(c.hex)!
      expect(rgbAHex(hsvARgb(rgbAHsv(rgb)))).toBe(c.hex)
    }
  })

  it('los 36 colores de la paleta cumplen 4.5:1 (texto) y 3:1 (ícono) en claro y oscuro', () => {
    expect(PALETA).toHaveLength(36)
    for (const c of PALETA) {
      for (const tema of ['claro', 'oscuro'] as const) {
        const t = tonos(c.hex, tema)!
        expect(t.contrasteTexto, `${c.nombre} texto ${tema}`).toBeGreaterThanOrEqual(4.5)
        expect(t.contrasteIcono, `${c.nombre} ícono ${tema}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('también ajusta colores extremos elegidos a mano', () => {
    for (const hex of ['#FFFF00', '#000000', '#FFFFFF', '#00FF00']) {
      for (const tema of ['claro', 'oscuro'] as const) expect(tonos(hex, tema)!.contrasteTexto).toBeGreaterThanOrEqual(4.5)
    }
    expect(tonos('nope', 'claro')).toBeNull()
  })

  it('el color efectivo hereda del ámbito, usa el libre o cae al token heredado', () => {
    const ambito = { color_hex: '#4F46E5', color_token: 'c1' }
    expect(colorEfectivo({ color_mode: 'inherit' }, ambito)).toEqual({ hex: '#4F46E5', origen: 'heredado' })
    expect(colorEfectivo({ color_mode: 'own', color_hex: '#16A34A' }, ambito)).toEqual({ hex: '#16A34A', origen: 'propio' })
    expect(colorEfectivo({ color_mode: 'own', color_token: 'c2' }, ambito).hex).toBe('#E0622F')
    expect(colorEfectivo({ color_token: 'desconocido' }).hex).toBe('#58587A')
  })

  it('armonizar reparte colores distintos', () => {
    const c = armonizar(5)
    expect(new Set(c).size).toBe(5)
    expect(armonizar(0)).toEqual([])
  })
})

describe('paleta ampliada', () => {
  it('tiene 36 colores únicos con nombre en seis familias', () => {
    expect(new Set(PALETA.map((c) => c.hex)).size).toBe(36)
    expect(new Set(PALETA.map((c) => c.nombre)).size).toBe(36)
    expect(new Set(PALETA.map((c) => c.familia)).size).toBe(6)
  })
})

describe('identificadores estables', () => {
  it('cada color tiene un id único y legible', () => {
    expect(new Set(PALETA.map((c) => idDeColor(c.nombre))).size).toBe(36)
    expect(idDeColor('Índigo')).toBe('indigo')
    expect(idDeColor('Rojos y rosas')).toBe('rojos-y-rosas')
  })
})
