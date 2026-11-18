import { describe, expect, it } from 'vitest'
import { convertirPen, formatOriginal, formatTasa, importeATexto, tasaATexto, tasaEfectiva } from './moneda'

describe('conversión USD → PEN con decimales exactos', () => {
  it('caso A: US$ 10.00 a 3.45 = S/ 34.50', () => expect(convertirPen('10.00', '3.45')).toBe('34.50'))
  it('caso B: US$ 20.00 a 3.52 (tasa manual) = S/ 70.40', () => expect(convertirPen('20.00', '3.52')).toBe('70.40'))
  it('caso C: cargo exacto S/ 35.80 por US$ 10.00 → tasa efectiva 3.58', () => {
    expect(Number(tasaEfectiva('10.00', '35.80'))).toBe(3.58)
    expect(tasaEfectiva('10.00', '35.80')).toBe('3.580000000000')
  })
  it('caso E y F: dos meses con tasas distintas conservan su importe', () => {
    expect(convertirPen('20.00', '3.42')).toBe('68.40')
    expect(convertirPen('20.00', '3.50')).toBe('70.00')
  })
  it('caso J: redondea una sola vez, half-up, sin perder la precisión de la tasa', () => {
    expect(convertirPen('10.00', '3.45876')).toBe('34.59') // 34.5876
    expect(convertirPen('0.01', '3.45')).toBe('0.03') // 0.0345 → 0.03
    expect(convertirPen('0.01', '3.50')).toBe('0.04') // 0.035 → 0.04 (half-up)
    expect(convertirPen('1.00', '3.455')).toBe('3.46') // en coma flotante 3.455 sería 3.45499…
  })
  it('no usa coma flotante: productos que fallan con Number salen exactos', () => {
    expect(convertirPen('0.10', '3.0')).toBe('0.30')
    expect(convertirPen('1234567.89', '3.4519')).toBe('4261604.90') // 4 261 604.8995… → .90
  })
  it('rechaza importes, tasas y cargos nulos o mal formados', () => {
    expect(() => convertirPen('0', '3.45')).toThrow()
    expect(() => convertirPen('10', '0')).toThrow()
    expect(() => convertirPen('-1', '3.45')).toThrow()
    expect(() => convertirPen('10', '3,45')).toThrow()
    expect(() => tasaEfectiva('10', '0')).toThrow()
  })
})

describe('entradas del usuario', () => {
  it('acepta los mismos formatos de importe que el resto de la app', () => {
    expect(importeATexto('12,5')).toBe('12.50')
    expect(importeATexto('1.234,56')).toBe('1234.56')
    expect(importeATexto('S/ 10')).toBe('10.00')
    expect(importeATexto('10.00')).toBe('10.00')
  })
  it('rechaza importes ambiguos o inválidos', () => {
    expect(importeATexto('')).toBeNull()
    expect(importeATexto('1,250')).toBeNull()
    expect(importeATexto('abc')).toBeNull()
    expect(importeATexto('0')).toBeNull()
  })
  it('normaliza tipos de cambio con coma o punto y rechaza lo inválido', () => {
    expect(tasaATexto('3,52')).toBe('3.52')
    expect(tasaATexto(' 3.5201 ')).toBe('3.5201')
    for (const malo of ['', '0', '0.0', '-3', '3.45.6', 'tres', '3.1234567']) expect(tasaATexto(malo)).toBeNull()
  })
})

describe('presentación', () => {
  it('distingue el símbolo de la moneda', () => {
    expect(formatOriginal('10', 'USD')).toBe('US$ 10.00')
    expect(formatOriginal(34.5)).toBe('S/ 34.50')
    expect(formatOriginal(1234.5, 'PEN')).toBe('S/ 1,234.50')
  })
  it('muestra la tasa con cuatro decimales', () => expect(formatTasa('3.419')).toBe('3.4190'))
})
