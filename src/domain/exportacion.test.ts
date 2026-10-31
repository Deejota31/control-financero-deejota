import { describe, expect, it } from 'vitest'
import { construirCsvGastos, construirRespaldo, filtrarGastos, nombreArchivo, type GastoFila } from './exportacion'

const g = (o: Partial<GastoFila>): GastoFila => ({
  id: 'g1', expense_date: '2026-10-05', amount: '12.5', currency: 'PEN', description: 'Almuerzo', ambito_id: 'a1', categoria_id: 'c1', subcategoria_id: null,
  payment_method_id: 'm1', expense_type: 'variable', is_recurring: false, status: 'active', notes: null, receipt_path: null, created_at: '2026-10-05T10:00:00Z', ...o,
})
const base = {
  ambitos: [{ id: 'a1', name: 'Hogar' }], categorias: [{ id: 'c1', name: 'Comida' }], subcategorias: [{ id: 's1', name: 'Menú' }],
  medios: [{ id: 'm1', name: 'Yape' }], fondos: [{ id: 'f1', name: 'General' }], asignaciones: [{ expense_id: 'g1', fund_id: 'f1', amount: 12.5, allocation_kind: 'normal' }],
}

describe('exportación', () => {
  it('nombra los archivos con la fecha', () => {
    expect(nombreArchivo('gastos', '2026-10-25')).toBe('control-financiero-gastos-2026-10-25.csv')
    expect(nombreArchivo('respaldo', '2026-10-25')).toBe('control-financiero-respaldo-2026-10-25.json')
  })

  it('CSV con nombres legibles, importe inequívoco y fondos imputados', () => {
    const csv = construirCsvGastos({ ...base, gastos: [g({})], incluirAnulados: false })
    const [enc, fila] = csv.replace('﻿', '').trim().split('\r\n')
    expect(enc.startsWith('fecha,importe,moneda')).toBe(true)
    expect(fila).toContain('2026-10-05,12.50,PEN,Almuerzo,Hogar,Comida,,Yape,Variable,No,Activo,')
    expect(fila).toContain('General: 12.50')
  })

  it('neutraliza fórmulas y escapa comillas, comas y saltos de línea', () => {
    const csv = construirCsvGastos({ ...base, gastos: [g({ description: '=HYPERLINK("http://x")', notes: 'a,b\nc' })], incluirAnulados: false })
    expect(csv).toContain('"\'=HYPERLINK(""http://x"")"')
    expect(csv).toContain('"a,b\nc"')
  })

  it('excluye anulados por defecto y aplica rango inclusivo', () => {
    const lista = [g({ id: '1', expense_date: '2026-10-01' }), g({ id: '2', expense_date: '2026-10-10', status: 'annulled' }), g({ id: '3', expense_date: '2026-10-20' })]
    expect(filtrarGastos(lista, { incluirAnulados: false }).map((x) => x.id)).toEqual(['1', '3'])
    expect(filtrarGastos(lista, { incluirAnulados: true, desde: '2026-10-10', hasta: '2026-10-20' }).map((x) => x.id)).toEqual(['2', '3'])
  })

  it('el respaldo no contiene autoría, rutas de comprobantes ni identificadores de usuario', () => {
    const r = construirRespaldo({
      perfil: { display_name: 'Ana', timezone: 'America/Lima', date_format: 'dd/MM/yyyy', theme: 'claro', display_currency: 'PEN' },
      hogar: { id: 'h', name: 'Casa', created_by: 'u1' }, ambitos: [], categorias: [], subcategorias: [], medios_pago: [], fondos: [], reglas_ambito: [], reglas_medio: [],
      periodos: [], presupuestos_fondo: [], gastos: [{ id: 'g', created_by: 'u1', annulled_by: 'u1', receipt_path: 'h/g/a.pdf', amount: 1 }], imputaciones: [], plantillas: [],
    }, '2026-10-25T00:00:00Z')
    const texto = JSON.stringify({ ...r, nota: '' })
    for (const x of ['u1', 'h/g/a.pdf', 'receipt_path', 'created_by', 'password', 'token']) expect(texto).not.toContain(x)
    expect(r.version_esquema).toBe(1)
    expect(r.gastos[0].tiene_comprobante).toBe(true)
  })
})
