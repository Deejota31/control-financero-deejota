import { describe, expect, it } from 'vitest'
import { geometriaBarra, resumirPresupuesto, type EntradaPresupuesto, type FondoPanel } from './presupuesto'

const fondo = (p: Partial<FondoPanel> & { fund_id: string }): FondoPanel => ({ nombre: p.fund_id, es_general: false, prioridad: 10, asignado: 100, consumido: 0, consumido_filtrado: 0, ...p })
const base: EntradaPresupuesto = {
  presupuesto: 1000, gastoRango: 400, imputado: 400, sinFondo: 0, excedente: 0, fondos: [fondo({ fund_id: 'a', asignado: 1000, consumido: 400 })],
  total: 400, cantidad: 8, diasConGasto: 5, desde: '2026-10-01', hasta: '2026-10-31', hoy: '2026-10-20', hayFiltros: false,
}

describe('resumirPresupuesto', () => {
  it('caso normal: disponible = asignado − imputado', () => {
    const r = resumirPresupuesto(base)
    expect(r).toMatchObject({ asignado: 1000, imputado: 400, disponible: 600, exceso: 0, consumoPct: 40, estado: 'ok' })
  })

  it('casi agotado a partir del 85 %', () => {
    expect(resumirPresupuesto({ ...base, imputado: 900, gastoRango: 900 }).estado).toBe('casi')
  })

  it('agotado: disponible exactamente cero', () => {
    const r = resumirPresupuesto({ ...base, imputado: 1000, gastoRango: 1000, fondos: [fondo({ fund_id: 'a', asignado: 1000, consumido: 1000 })] })
    expect(r).toMatchObject({ disponible: 0, exceso: 0, estado: 'agotado', fondosAgotados: 1, fondosSobregirados: 0 })
  })

  it('excedido: muestra el exceso real y el porcentaje sin tope', () => {
    const r = resumirPresupuesto({ ...base, imputado: 1320.5, gastoRango: 1320.5, fondos: [fondo({ fund_id: 'a', asignado: 1000, consumido: 1320.5 })] })
    expect(r).toMatchObject({ disponible: -320.5, exceso: 320.5, consumoPct: 132.05, estado: 'excedido', fondosSobregirados: 1 })
  })

  it('sin presupuesto en el rango no inventa un disponible', () => {
    const r = resumirPresupuesto({ ...base, presupuesto: null, fondos: [] })
    expect(r).toMatchObject({ asignado: null, disponible: null, consumoPct: null, estado: 'sin-presupuesto', fondosActivos: 0 })
  })

  it('gasto sin fondo asignable se informa aparte y no altera el disponible', () => {
    const r = resumirPresupuesto({ ...base, gastoRango: 450, sinFondo: 50 })
    expect(r.sinFondo).toBe(50)
    expect(r.disponible).toBe(600)
    expect(r.gastado).toBe(450)
  })

  it('cuenta fondos con excedente solo si el General absorbió algo', () => {
    const fondos = [fondo({ fund_id: 'esp', asignado: 100, consumido: 100 }), fondo({ fund_id: 'gen', es_general: true, asignado: 500, consumido: 120 })]
    expect(resumirPresupuesto({ ...base, fondos, excedente: 20 }).fondosConExcedente).toBe(1)
    expect(resumirPresupuesto({ ...base, fondos, excedente: 0 }).fondosConExcedente).toBe(0)
  })

  it('con filtros no resta el gasto filtrado del presupuesto: lo muestra aparte', () => {
    const r = resumirPresupuesto({ ...base, total: 100, cantidad: 2, hayFiltros: true })
    expect(r.disponible).toBe(600)
    expect(r.gastoFiltrado).toBe(100)
    expect(r.porcentajeFiltradoDelGastado).toBe(25)
  })

  it('promedios: diario sobre días transcurridos y por movimiento', () => {
    const r = resumirPresupuesto(base)
    expect(r.promedioDiario).toBe(20)
    expect(r.promedioPorMovimiento).toBe(50)
    expect(resumirPresupuesto({ ...base, hoy: '2026-09-15' }).promedioDiario).toBeNull()
    expect(resumirPresupuesto({ ...base, hoy: '2026-12-01' }).promedioDiario).toBeCloseTo(400 / 31, 2)
    expect(resumirPresupuesto({ ...base, cantidad: 0, total: 0 }).promedioPorMovimiento).toBeNull()
  })

  it('no redondea antes de calcular', () => {
    const r = resumirPresupuesto({ ...base, presupuesto: 0.3, imputado: 0.1, gastoRango: 0.1, fondos: [] })
    expect(r.disponible).toBe(0.2)
  })
})

describe('geometriaBarra', () => {
  it('sin exceso: la barra ocupa el consumo y el límite llega al 100 %', () => {
    expect(geometriaBarra(1000, 250)).toEqual({ consumidoPct: 25, limitePct: 100, excesoPct: 0 })
  })

  it('con exceso: la escala crece y el límite se desplaza, sin recortar nada', () => {
    const g = geometriaBarra(1000, 1250)
    expect(g.consumidoPct).toBe(100)
    expect(g.limitePct).toBeCloseTo(80, 5)
    expect(g.excesoPct).toBeCloseTo(20, 5)
  })

  it('sin presupuesto no coloca límite', () => {
    expect(geometriaBarra(null, 50).limitePct).toBe(0)
  })
})
