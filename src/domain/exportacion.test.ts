import { describe, expect, it } from 'vitest'
import { construirCsvGastos, construirRespaldo, filtrarGastos, nombreArchivo, normalizarRespaldo, type GastoFila } from './exportacion'

const g = (o: Partial<GastoFila>): GastoFila => ({
  id: 'g1', expense_date: '2026-10-05', amount: '12.5', currency: 'PEN', description: 'Almuerzo', ambito_id: 'a1', categoria_id: 'c1', subcategoria_id: null,
  payment_method_id: 'm1', expense_type: 'variable', is_recurring: false, status: 'active', notes: null, receipt_path: null, created_at: '2026-10-05T10:00:00Z', ...o,
})
const base = {
  ambitos: [{ id: 'a1', name: 'Hogar' }], categorias: [{ id: 'c1', name: 'Comida' }], subcategorias: [{ id: 's1', name: 'Menú' }],
  medios: [{ id: 'm1', name: 'Yape' }], fondos: [{ id: 'f1', name: 'General' }], asignaciones: [{ expense_id: 'g1', fund_id: 'f1', amount: 12.5, allocation_kind: 'normal' }],
}

describe('exportación', () => {
  it('exporta USD original y PEN contable conservando las primeras columnas', () => {
    const csv = construirCsvGastos({ ...base, gastos: [g({ amount: '34.50', original_currency: 'USD', original_amount: '10.00', exchange_rate: '3.45', conversion_method: 'manual', exchange_rate_reference_date: '2026-10-05' })], incluirAnulados: false })
    expect(csv).toContain('34.50,PEN,Almuerzo')
    expect(csv).toContain('10.00,USD,3.45,manual,,2026-10-05,34.50')
  })
  it('normaliza PEN antiguo sin recalcular y conserva snapshots v2', () => {
    expect(normalizarRespaldo({ version_esquema: 1, gastos: [{ amount: '100.00', currency: 'PEN' }] }).gastos).toEqual([expect.objectContaining({ original_amount: '100.00', amount: '100.00', original_currency: 'PEN', exchange_rate: '1' })])
    const datos = { version_esquema: 3, gastos: [{ amount: '34.50', original_amount: '10.00', original_currency: 'USD', exchange_rate: '3.45' }] }
    expect(normalizarRespaldo(datos)).toEqual(datos)
    expect(() => normalizarRespaldo({ version_esquema: 1, gastos: [{ amount: 10, currency: 'USD' }] })).toThrow('ambigua')
  })
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
    expect(r.version_esquema).toBe(3)
    expect(r.gastos[0].tiene_comprobante).toBe(true)
  })

  it('CSV: los fondos PEN conservan su formato y los USD muestran su importe nominal; el no cubierto va en su columna', () => {
    const csv = construirCsvGastos({ ...base, fondos: [{ id: 'f1', name: 'Suscripciones' }, { id: 'f2', name: 'General' }], gastos: [g({ amount: '82.60', original_currency: 'USD', original_amount: '23.60', exchange_rate: '3.5', conversion_method: 'manual' })],
      asignaciones: [{ expense_id: 'g1', fund_id: 'f1', amount: '52.50', allocation_kind: 'specific', fund_amount: '15.00', fund_currency: 'USD' }, { expense_id: 'g1', fund_id: 'f2', amount: '10.00', allocation_kind: 'general', fund_amount: '10.00', fund_currency: 'PEN' }],
      noCubierto: [{ expense_id: 'g1', uncovered_amount: '20.10', uncovered_original: '5.74', original_currency: 'USD' }], incluirAnulados: false })
    expect(csv).toContain('Suscripciones: 15.00 USD | General: 10.00')
    expect(csv).toContain('Suscripciones: 52.50 | General: 10.00,20.10')
  })
  it('restaurar un respaldo anterior a los fondos multimoneda no los convierte: PEN, sin cobertura cruzada, imputaciones intactas', () => {
    const viejo = { version_esquema: 2, gastos: [], fondos: { fondos: [{ id: 'f1', name: 'Hogar' }], reglas_ambito: [] }, imputaciones: [{ expense_id: 'g1', fund_id: 'f1', amount: '70.40' }] }
    const r = normalizarRespaldo(viejo) as { version_esquema: number; fondos: { fondos: Record<string, unknown>[] }; imputaciones: Record<string, unknown>[]; no_cubierto: unknown[] }
    expect(r.version_esquema).toBe(3)
    expect(r.fondos.fondos[0]).toMatchObject({ id: 'f1', currency: 'PEN', allow_cross_currency: false })
    expect(r.imputaciones[0]).toMatchObject({ amount: '70.40', fund_currency: 'PEN', fund_amount: '70.40', exchange_rate: '1' })
    expect(r.no_cubierto).toEqual([])
  })
  it('restaurar un respaldo v3 conserva monedas e importes nominales sin tocarlos', () => {
    const v3 = { version_esquema: 3, gastos: [], fondos: { fondos: [{ id: 'f1', name: 'Suscripciones', currency: 'USD', allow_cross_currency: true }] }, imputaciones: [{ amount: '52.50', fund_currency: 'USD', fund_amount: '15.00', exchange_rate: '3.5' }], no_cubierto: [{ expense_id: 'g1' }] }
    const r = normalizarRespaldo(v3) as { fondos: { fondos: unknown[] }; imputaciones: unknown[]; no_cubierto: unknown[] }
    expect(r.fondos.fondos[0]).toEqual(v3.fondos.fondos[0])
    expect(r.imputaciones[0]).toEqual(v3.imputaciones[0])
    expect(r.no_cubierto).toEqual(v3.no_cubierto)
  })
})
