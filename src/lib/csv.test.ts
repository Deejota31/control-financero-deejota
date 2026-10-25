import { describe, expect, it } from 'vitest'
import { aCsv, celdaCsv } from './csv'

describe('celdaCsv', () => {
  it('escapa comillas, comas y saltos de línea', () => {
    expect(celdaCsv('a,b')).toBe('"a,b"')
    expect(celdaCsv('dice "hola"')).toBe('"dice ""hola"""')
    expect(celdaCsv('l1\nl2')).toBe('"l1\nl2"')
  })
  it('neutraliza fórmulas pero respeta números negativos', () => {
    expect(celdaCsv('=SUMA(A1)')).toBe("'=SUMA(A1)")
    expect(celdaCsv('@cmd')).toBe("'@cmd")
    expect(celdaCsv('-5.50')).toBe('-5.50')
  })
  it('trata nulos como vacío', () => {
    expect(celdaCsv(null)).toBe('')
    expect(celdaCsv(undefined)).toBe('')
  })
})

describe('aCsv', () => {
  it('genera encabezados, filas y BOM', () => {
    const csv = aCsv(['Fecha', 'Importe'], [['2026-10-01', 12.5]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Fecha,Importe\r\n2026-10-01,12.5\r\n')
  })
})
