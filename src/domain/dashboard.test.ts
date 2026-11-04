import { describe, expect, it } from 'vitest'
import { agruparPor, diasEnRango, proyeccionCierre, rangoAnterior, rangoComparable, ritmoIdeal, serieDiaria, total, variacion, type GastoBasico } from './dashboard'

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

describe('rango comparable (mes en curso contra el mismo tramo anterior)', () => {
  it('un mes en curso compara del día 1 al día de corte con el mismo tramo del mes anterior', () => {
    const c = rangoComparable('2026-11-01', '2026-11-30', '2026-11-04')
    expect(c).toEqual({ corte: '2026-11-04', anterior: { desde: '2026-10-01', hasta: '2026-10-04' }, parcial: true, comparable: true })
  })
  it('el tramo anterior se acota a su último día (el 30 de marzo frente a febrero compara con el 28)', () => {
    expect(rangoComparable('2027-03-01', '2027-03-31', '2027-03-30').anterior).toEqual({ desde: '2027-02-01', hasta: '2027-02-28' })
    expect(rangoComparable('2028-03-01', '2028-03-31', '2028-03-30').anterior).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })
  it('un mes ya terminado compara período completo con período completo', () => {
    expect(rangoComparable('2026-10-01', '2026-10-31', '2026-11-04')).toEqual({ corte: '2026-10-31', anterior: { desde: '2026-09-01', hasta: '2026-09-30' }, parcial: false, comparable: true })
    expect(rangoComparable('2026-11-01', '2026-11-30', '2026-11-30').parcial).toBe(false) // el último día ya cuenta como mes completo
  })
  it('un mes futuro no se compara', () => {
    expect(rangoComparable('2026-12-01', '2026-12-31', '2026-11-04').comparable).toBe(false)
  })
  it('un rango libre en curso compara los mismos días anteriores', () => {
    expect(rangoComparable('2026-11-10', '2026-11-20', '2026-11-12')).toEqual({ corte: '2026-11-12', anterior: { desde: '2026-11-07', hasta: '2026-11-09' }, parcial: true, comparable: true })
  })
})

describe('ritmo ideal del presupuesto', () => {
  it('noviembre, presupuesto S/ 3 680: día 1 ≈ 122.67, día 15 = 1 840 y día 30 = 3 680 exactos', () => {
    expect(ritmoIdeal(3680, 1, 30)).toBe(122.67)
    expect(ritmoIdeal(3680, 15, 30)).toBe(1840)
    expect(ritmoIdeal(3680, 30, 30)).toBe(3680)
  })
  it.each([28, 29, 30, 31])('en un mes de %i días la línea termina exactamente en el presupuesto y nunca decrece', (dias) => {
    const presupuesto = 3333.33
    const linea = Array.from({ length: dias }, (_, i) => ritmoIdeal(presupuesto, i + 1, dias))
    expect(linea.at(-1)).toBe(presupuesto)
    expect(linea.every((v, i) => i === 0 || v >= linea[i - 1])).toBe(true)
  })
  it('la serie diaria usa ese ritmo y empieza el acumulado en cero antes del primer gasto', () => {
    const s = serieDiaria([], '2026-11-01', '2026-11-30', '2026-11-04', 3680)
    expect(s.at(-1)!.ideal).toBe(3680)
    expect(s[0].ideal).toBe(122.67)
    expect(s[0].acumulado).toBe(0)
  })
  it('un presupuesto cero da una línea en cero (sin dividir por cero)', () => {
    const s = serieDiaria([], '2026-11-01', '2026-11-30', '2026-11-04', 0)
    expect(s.every((p) => p.ideal === 0)).toBe(true)
  })
})

describe('serie con proyección inyectada', () => {
  const gastos = [g('2026-11-01', 100), g('2026-11-02', 50)]
  it('la línea de proyección arranca en el último acumulado real y termina en el cierre indicado, sin saltos', () => {
    const s = serieDiaria(gastos, '2026-11-01', '2026-11-10', '2026-11-04', null, 400)
    expect(s[3].acumulado).toBe(150)
    expect(s[3].proyeccion).toBe(150) // mismo punto: conexión continua
    expect(s.at(-1)!.proyeccion).toBe(400)
    const p = s.map((x) => x.proyeccion).filter((x): x is number => x !== null)
    expect(p.every((v, i) => i === 0 || v >= p[i - 1])).toBe(true)
    expect(s[2].proyeccion).toBeNull() // antes del último día real no hay proyección
  })
  it('con cierre null no se dibuja proyección aunque haya gasto', () => {
    expect(serieDiaria(gastos, '2026-11-01', '2026-11-10', '2026-11-04', null, null).every((p) => p.proyeccion === null)).toBe(true)
  })
  it('sin gasto posterior a hoy en la serie: nunca se incluyen movimientos futuros en el acumulado real', () => {
    const s = serieDiaria([...gastos, g('2026-11-08', 999)], '2026-11-01', '2026-11-10', '2026-11-04', null, null)
    expect(s[3].acumulado).toBe(150)
    expect(s[7].acumulado).toBeNull()
  })
})

describe('precisión monetaria', () => {
  it('agruparPor suma en céntimos exactos', () => {
    const gs = Array.from({ length: 10 }, () => g('2026-11-01', 0.1, 'amb'))
    expect(agruparPor(gs, 'ambito_id')).toEqual([{ id: 'amb', total: 1, cantidad: 10 }])
  })
  it('la variación nunca es infinita: base cero o negativa devuelve null', () => {
    expect(variacion(500, 0)).toBeNull()
    expect(variacion(0, 0)).toBeNull()
    expect(variacion(500, -3)).toBeNull()
    expect(variacion(0, 100)).toBe(-100)
  })
})
