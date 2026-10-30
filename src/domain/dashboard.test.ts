import { describe, expect, it } from 'vitest'
import { agruparPor, diasEnRango, proyeccionCierre, rangoAnterior, serieDiaria, total, variacion, type GastoBasico } from './dashboard'

const g = (fecha: string, monto: number, ambito = 'a', cat = 'c', sub: string | null = null): GastoBasico => ({ expense_date: fecha, amount: monto, ambito_id: ambito, categoria_id: cat, subcategoria_id: sub })

describe('rangos', () => {
  it('cuenta los días de forma inclusiva', () => {
    expect(diasEnRango('2026-10-01', '2026-10-31')).toBe(31)
    expect(diasEnRango('2026-02-01', '2026-02-28')).toBe(28)
  })
  it('el rango anterior es contiguo y de igual duración', () => {
    expect(rangoAnterior('2026-10-01', '2026-10-31')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(rangoAnterior('2026-10-10', '2026-10-16')).toEqual({ desde: '2026-10-03', hasta: '2026-10-09' })
    expect(rangoAnterior('2026-03-01', '2026-03-31')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
  })
})

describe('variación y totales', () => {
  it('calcula el porcentaje y evita dividir por cero', () => {
    expect(variacion(120, 100)).toBe(20)
    expect(variacion(80, 100)).toBe(-20)
    expect(variacion(50, 0)).toBeNull()
  })
  it('suma sin errores de punto flotante', () => {
    expect(total([g('2026-10-01', 0.1), g('2026-10-02', 0.2)])).toBe(0.3)
  })
})

describe('proyeccionCierre', () => {
  it('extrapola el promedio diario', () => {
    expect(proyeccionCierre(250, 25, 31)).toBe(310)
    expect(proyeccionCierre(0, 0, 31)).toBeNull()
  })
})

describe('serieDiaria', () => {
  const gastos = [g('2026-10-01', 100), g('2026-10-01', 50), g('2026-10-03', 30)]
  it('acumula por día hasta hoy y deja el resto vacío', () => {
    const s = serieDiaria(gastos, '2026-10-01', '2026-10-05', '2026-10-03', 500)
    expect(s.map((p) => p.acumulado)).toEqual([150, 150, 180, null, null])
    expect(s.map((p) => p.gasto)).toEqual([150, 0, 30, 0, 0])
  })
  it('reparte el presupuesto como ritmo ideal', () => {
    const s = serieDiaria(gastos, '2026-10-01', '2026-10-05', '2026-10-03', 500)
    expect(s.map((p) => p.ideal)).toEqual([100, 200, 300, 400, 500])
  })
  it('la proyección continúa desde hoy y llega al promedio extrapolado', () => {
    const s = serieDiaria(gastos, '2026-10-01', '2026-10-05', '2026-10-03', null)
    expect(s[2].proyeccion).toBe(180)
    expect(s[4].proyeccion).toBe(300)
    expect(s[0].proyeccion).toBeNull()
    expect(s[0].ideal).toBeNull()
  })
  it('un rango ya terminado no tiene proyección y acumula todo', () => {
    const s = serieDiaria(gastos, '2026-10-01', '2026-10-05', '2026-11-20', null)
    expect(s.every((p) => p.proyeccion === null)).toBe(true)
    expect(s.at(-1)!.acumulado).toBe(180)
  })
  it('un rango futuro no tiene acumulado', () => {
    const s = serieDiaria([], '2026-12-01', '2026-12-03', '2026-10-25', null)
    expect(s.every((p) => p.acumulado === null)).toBe(true)
  })
})

describe('agruparPor', () => {
  it('agrupa y ordena de mayor a menor', () => {
    const r = agruparPor([g('2026-10-01', 10, 'x'), g('2026-10-02', 30, 'y'), g('2026-10-03', 5, 'x')], 'ambito_id')
    expect(r).toEqual([{ id: 'y', total: 30, cantidad: 1 }, { id: 'x', total: 15, cantidad: 2 }])
  })
  it('ignora gastos sin subcategoría', () => {
    expect(agruparPor([g('2026-10-01', 10)], 'subcategoria_id')).toEqual([])
  })
})
