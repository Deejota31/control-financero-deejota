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

describe('presupuesto consolidado: caso de control (captura de noviembre)', () => {
  const nov: EntradaPresupuesto = {
    presupuesto: 3680, gastoRango: 2358.3, imputado: 2358.3, sinFondo: 0, excedente: 0,
    fondos: [fondo({ fund_id: 'g', es_general: true, asignado: 1500, consumido: 900 }), fondo({ fund_id: 'h', asignado: 700, consumido: 458.3 }), fondo({ fund_id: 'f', asignado: 1480, consumido: 1000 })],
    total: 2358.3, cantidad: 18, diasConGasto: 3, desde: '2026-11-01', hasta: '2026-11-30', hoy: '2026-11-04', hayFiltros: false,
  }

  it('S/ 3 680.00 asignado − S/ 2 358.30 imputado = S/ 1 321.70 disponible y 64.08 % consumido (valores exactos)', () => {
    const r = resumirPresupuesto(nov)
    expect(r.asignado).toBe(3680)
    expect(r.imputado).toBe(2358.3)
    expect(r.disponible).toBe(1321.7)
    expect(r.consumoPct).toBe(64.08)
    expect(r.exceso).toBe(0)
    expect(r.estado).toBe('ok')
    expect(r.disponible! + r.imputado).toBeCloseTo(r.asignado!, 10) // asignado = imputado + disponible
  })

  it('un fondo agotado no crea exceso consolidado si otros fondos tienen saldo', () => {
    const r = resumirPresupuesto({ ...nov, fondos: [fondo({ fund_id: 'a', asignado: 300, consumido: 300 }), fondo({ fund_id: 'b', asignado: 3380, consumido: 2058.3 })] })
    expect(r.fondosAgotados).toBe(1)
    expect(r.exceso).toBe(0)
    expect(r.disponible).toBe(1321.7)
  })

  it('el exceso consolidado es max(0, imputado − asignado) y el saldo firmado conserva el sobregiro', () => {
    const r = resumirPresupuesto({ ...nov, presupuesto: 2000, imputado: 2358.3, gastoRango: 2358.3 })
    expect(r.disponible).toBe(-358.3) // saldo firmado: no se oculta
    expect(r.exceso).toBe(358.3)
    expect(r.estado).toBe('excedido')
    expect(r.consumoPct).toBe(117.92)
  })

  it('un fondo específico sobregirado cuyo exceso absorbió el General no genera exceso global', () => {
    const r = resumirPresupuesto({ ...nov, excedente: 120, fondos: [fondo({ fund_id: 'e', asignado: 300, consumido: 300 }), fondo({ fund_id: 'g', es_general: true, asignado: 3380, consumido: 2058.3 })] })
    expect(r.fondosConExcedente).toBe(1)
    expect(r.exceso).toBe(0)
  })

  it('el gasto sin fondo compatible NO cuenta como imputado ni como disponible consumido', () => {
    const r = resumirPresupuesto({ ...nov, gastoRango: 2658.3, imputado: 2358.3, sinFondo: 300 })
    expect(r.gastado).toBe(2658.3)
    expect(r.imputado).toBe(2358.3)
    expect(r.sinFondo).toBe(300)
    expect(r.disponible).toBe(1321.7) // el disponible solo resta lo imputado
    expect(r.imputado + r.sinFondo).toBeCloseTo(r.gastado, 10)
  })

  it('presupuesto cero: sin porcentaje artificial; con gasto el estado es excedido', () => {
    expect(resumirPresupuesto({ ...nov, presupuesto: 0, imputado: 0, gastoRango: 0 }).consumoPct).toBe(0)
    const r = resumirPresupuesto({ ...nov, presupuesto: 0 })
    expect(r.consumoPct).toBeNull()
    expect(r.estado).toBe('excedido')
    expect(r.exceso).toBe(2358.3)
  })

  it('suma de 10 fondos de 0.10: sin error de coma flotante en el saldo', () => {
    const r = resumirPresupuesto({ ...nov, presupuesto: 1, imputado: 0.7, gastoRango: 0.7, fondos: Array.from({ length: 10 }, (_, i) => fondo({ fund_id: String(i), asignado: 0.1, consumido: 0.07 })) })
    expect(r.disponible).toBe(0.3)
    expect(r.fondosAgotados).toBe(0)
  })
})
