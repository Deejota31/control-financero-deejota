import { describe, expect, it } from 'vitest'
import { filtrar, perfil, ranking, seisMeses, type FilaAnalisis, type FiltrosAnalisis } from './analisis'

const SIN: FiltrosAnalisis = { ambito: '', categoria: '', subcategoria: '', medio: '', tipo: '', dia: '' }
const f = (o: Partial<FilaAnalisis> & { monto: number }): FilaAnalisis => ({ ambito_id: 'A1', categoria_id: 'C1', subcategoria_id: null, medio_id: 'M1', tipo: 'variable', cantidad: 1, ...o })

describe('seisMeses', () => {
  it('devuelve seis meses naturales terminando en el de hasta (cruza de año)', () => {
    expect(seisMeses('2026-10-31')).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'])
    expect(seisMeses('2026-02-15')).toEqual(['2025-09-01', '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'])
  })
})

describe('filtrar', () => {
  const filas = [f({ monto: 10, fecha: '2026-10-01' }), f({ monto: 20, fecha: '2026-10-02', ambito_id: 'A2' })]
  it('combina filtros de dimensiones distintas y respeta lo excluido', () => {
    expect(filtrar(filas, { ...SIN, ambito: 'A2' })).toHaveLength(1)
    expect(filtrar(filas, { ...SIN, ambito: 'A2' }, ['ambito'])).toHaveLength(2)
    expect(filtrar(filas, { ...SIN, dia: '2026-10-01' })).toHaveLength(1)
  })
  it('el día no afecta a filas históricas (sin fecha)', () => {
    expect(filtrar([f({ monto: 5, mes: '2026-09-01' })], { ...SIN, dia: '2026-10-01' })).toHaveLength(1)
  })
})

describe('ranking', () => {
  const ctx = { desde: '2026-10-01', hasta: '2026-10-31', hoy: '2026-11-05' }
  const actual = [f({ monto: 300, fecha: '2026-10-03' }), f({ monto: 100, fecha: '2026-10-04', categoria_id: 'C2' })]
  const historico: FilaAnalisis[] = [
    ...['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((mes) => f({ monto: 100, mes })),
    f({ monto: 300, mes: '2026-10-01' }), f({ monto: 100, mes: '2026-10-01', categoria_id: 'C2' }),
  ]
  it('calcula porcentaje con denominador del ranking, tendencia de seis meses y variación frente al promedio', () => {
    const r = ranking(actual, historico, 'categoria', SIN, ctx)
    expect(r.total).toBe(400)
    expect(r.items[0]).toMatchObject({ id: 'C1', monto: 300, pct: 75, referencia: 100, variacion: 2 })
    expect(r.items[0].serie).toEqual([100, 100, 100, 100, 100, 300])
  })
  it('sin historia no hay referencia ni división por cero', () => {
    const r = ranking(actual, historico, 'categoria', SIN, ctx)
    const c2 = r.items.find((i) => i.id === 'C2')!
    expect(c2.referencia).toBeNull()
    expect(c2.variacion).toBeNull()
  })
  it('un mes en curso se compara con la referencia prorrateada por los días transcurridos', () => {
    const r = ranking(actual, historico, 'categoria', SIN, { ...ctx, hoy: '2026-10-10' })
    expect(r.parcial).toBe(true)
    expect(r.items[0].referencia).toBeCloseTo(100 * (10 / 31), 2)
  })
  it('un rango que no es un mes no es comparable', () => {
    const r = ranking(actual, historico, 'categoria', SIN, { desde: '2026-10-05', hasta: '2026-10-20', hoy: '2026-11-05' })
    expect(r.comparable).toBe(false)
    expect(r.items.every((i) => i.referencia === null && i.variacion === null)).toBe(true)
  })
  it('la propia dimensión no se filtra a sí misma pero sí las demás', () => {
    const r = ranking(actual, historico, 'categoria', { ...SIN, categoria: 'C1' }, ctx)
    expect(r.items.map((i) => i.id).sort()).toEqual(['C1', 'C2'])
    const s = ranking(actual, historico, 'categoria', { ...SIN, medio: 'otro' }, ctx)
    expect(s.items).toHaveLength(0)
  })
})

describe('perfil', () => {
  it('usa los mayores grupos, una escala de 10 en 10 y la referencia histórica', () => {
    const ctx = { desde: '2026-10-01', hasta: '2026-10-31', hoy: '2026-11-05' }
    const actual = [f({ monto: 60, fecha: '2026-10-03' }), f({ monto: 40, fecha: '2026-10-04', categoria_id: 'C2' })]
    const historico = ['2026-09-01', '2026-08-01'].flatMap((mes) => [f({ monto: 50, mes }), f({ monto: 50, mes, categoria_id: 'C2' })])
    const r = ranking(actual, historico, 'categoria', SIN, ctx)
    const p = perfil(r, historico, 'categoria', SIN)
    expect(p.ejes.map((e) => e.id)).toEqual(['C1', 'C2'])
    expect(p.ejes[0].pct).toBe(60)
    expect(p.ejes[0].ref).toBe(50)
    expect(p.max).toBe(60)
  })
})
