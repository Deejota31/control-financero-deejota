import { describe, expect, it } from 'vitest'
import { filtrar, perfil, ranking, seisMeses, textoVariacion, type FilaAnalisis, type FiltrosAnalisis } from './analisis'

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

describe('tendencia: base histórica y contexto', () => {
  const ctx = { desde: '2026-11-01', hasta: '2026-11-30', hoy: '2026-11-04' }
  const actual = [f({ monto: 955, fecha: '2026-11-03' })]

  it('los meses sin ningún gasto del hogar no cuentan como cero: la base se divide entre los meses observados', () => {
    // El hogar empezó en octubre: solo hay un mes con datos. Dividir entre 5 daría una base 5 veces menor y un porcentaje 5 veces mayor.
    const historico = [f({ monto: 300, mes: '2026-10-01' }), f({ monto: 5000, mes: '2026-10-01', categoria_id: 'C9' })]
    const it = ranking(actual, historico, 'categoria', SIN, ctx).items[0]
    expect(it.mesesBase).toBe(1)
    expect(it.referencia).toBeCloseTo(300 * (4 / 30), 2) // promedio de 1 mes, prorrateado a 4 de 30 días
    expect(it.baseCorta).toBe(true)
    expect(it.variacionAbs).toBeCloseTo(955 - 40, 2)
  })

  it('un mes observado en que el grupo no gastó sí cuenta como cero', () => {
    const historico = [f({ monto: 300, mes: '2026-08-01' }), f({ monto: 10, mes: '2026-09-01', categoria_id: 'C9' }), f({ monto: 10, mes: '2026-10-01', categoria_id: 'C9' })]
    const it = ranking(actual, historico, 'categoria', SIN, { ...ctx, hoy: '2026-11-30' }).items[0]
    expect(it.mesesBase).toBe(3) // ago, sep y oct tienen gasto del hogar
    expect(it.referencia).toBe(100) // (300 + 0 + 0) / 3
    expect(it.baseCorta).toBe(false)
  })

  it('sin historial no hay referencia, variación ni porcentaje inventado', () => {
    const it = ranking(actual, [], 'categoria', SIN, ctx).items[0]
    expect(it).toMatchObject({ referencia: null, variacion: null, variacionAbs: null, mesesBase: 0 })
  })

  it('el texto de variación es exacto hasta 1000 % y por encima solo indica que la base es minúscula', () => {
    expect(textoVariacion(0.256)).toBe('▲ 26 %')
    expect(textoVariacion(-0.5)).toBe('▼ 50 %')
    expect(textoVariacion(0)).toBe('= 0 %')
    expect(textoVariacion(10)).toBe('▲ 1000 %')
    expect(textoVariacion(39.64)).toBe('▲ >1000 %')
  })

  it('la variación porcentual nunca se confunde con la participación', () => {
    // Un incremento de 300 % no significa que el grupo sea el 300 % del gasto: participación (≤ 100 %) y variación son campos distintos.
    const historico = [f({ monto: 100, mes: '2026-09-01' }), f({ monto: 100, mes: '2026-10-01' })]
    const it = ranking([f({ monto: 400, fecha: '2026-11-03' })], historico, 'categoria', SIN, { ...ctx, hoy: '2026-11-30' }).items[0]
    expect(it.pct).toBe(100)
    expect(it.variacion).toBe(3)
  })
})
