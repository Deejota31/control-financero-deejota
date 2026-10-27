import { describe, expect, it } from 'vitest'
import { analizarImporte, errorImporte, parseImporte, parseMontoNoNegativo, sumarImportes } from './importe'

describe('importes: coma/punto decimal', () => {
  it.each([
    ['12,50', 12.5], ['12.50', 12.5], ['12,5', 12.5], ['12.5', 12.5], ['12', 12], ['0,05', 0.05], [',5', 0.5], ['.75', 0.75],
    ['S/ 12,50', 12.5], ['  S/12.50 ', 12.5], ['007,50', 7.5],
  ])('%s → %s', (t, v) => expect(parseImporte(t)).toBe(v))
  it('12,50 nunca se convierte en 1250', () => expect(parseImporte('12,50')).not.toBe(1250))
})

describe('importes: miles explícitos', () => {
  it.each([
    ['1,234.56', 1234.56], ['1.234,56', 1234.56], ['1 234,56', 1234.56], ['1,234,567', 1234567], ['1.234.567', 1234567], ['12 345', 12345],
    ['999999999999.99', 999999999999.99], ['999,999,999,999.99', 999999999999.99],
  ])('%s → %s', (t, v) => expect(parseImporte(t)).toBe(v))
  it('pegado con espacios duros y de ancho fino', () => {
    expect(parseImporte('S/ 1 234,50')).toBe(1234.5)
  })
})

describe('importes: entradas que se rechazan con mensaje', () => {
  it.each([
    ['', /Ingresa/], ['abc', /solo números/], ['12a', /solo números/], ['-5', /signo/], ['−5', /signo/], ['+5', /signo/],
    ['1,250', /ambiguo/], ['1.250', /ambiguo/], ['12.345', /ambiguo/], ['0,500', /ambiguo/],
    ['12,3456', /2 decimales/], ['12.500,001', /2 decimales/],
    ['1,23,456', /Formato|miles/], ['12,34,56', /Formato|miles/], ['1..2', /Formato/], ['1,2.3,4', /ambigua|miles|Formato/], ['1234.567,89', /miles/],
    ['12,', /decimal/], ['12.', /decimal/], ['1 2 3', /Formato/], ['12 ,50', /espacios/],
    ['0', /mayor que 0/], ['0,00', /mayor que 0/], ['9999999999999', /máximo/], ['1000000000000', /máximo/], ['999999999999,999', /2 decimales/],
  ])('%s', (t, re) => {
    expect(parseImporte(t)).toBeNull()
    expect(errorImporte(t)).toMatch(re)
  })
  it('NaN, Infinity y notación científica no son texto válido', () => {
    expect(parseImporte('NaN')).toBeNull()
    expect(parseImporte('Infinity')).toBeNull()
    expect(parseImporte('1e5')).toBeNull()
  })
})

describe('importes: cero (presupuestos)', () => {
  it('0 es válido solo para presupuestos', () => {
    expect(parseMontoNoNegativo('0')).toBe(0)
    expect(parseMontoNoNegativo('0,00')).toBe(0)
    expect(parseImporte('0')).toBeNull()
  })
  it('un presupuesto sigue rechazando negativos y ambiguos', () => {
    expect(parseMontoNoNegativo('-1')).toBeNull()
    expect(parseMontoNoNegativo('1,250')).toBeNull()
  })
})

describe('importes: exactitud', () => {
  it('trabaja en céntimos enteros', () => {
    const r = analizarImporte('1234,57')
    expect(r.ok && r.centimos).toBe(123457)
    expect(parseImporte('0,07')).toBe(0.07)
    expect(parseImporte('4.35')).toBe(4.35)
  })
  it('suma sin error de coma flotante', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumarImportes([0.1, 0.2])).toBe(0.3)
    expect(sumarImportes([19.99, 5.01, 0.07])).toBe(25.07)
  })
})
