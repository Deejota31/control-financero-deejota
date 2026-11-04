import { describe, expect, it } from 'vitest'
import { CRITERIOS, diasDelMes, proyectarCierre, type EntradaProyeccion, type FilaProy, type PlantillaPlan } from './proyeccion'

const FILTROS = { ambito: '', categoria: '', subcategoria: '', medio: '', tipo: '' as const }
const fila = (fecha: string, monto: number, extra: Partial<FilaProy> = {}): FilaProy => ({ fecha, monto, tipo: 'variable', recurrente: false, ambito_id: 'a1', categoria_id: 'c1', subcategoria_id: null, medio_id: 'm1', ...extra })
const entrada = (e: Partial<EntradaProyeccion> & Pick<EntradaProyeccion, 'desde' | 'hasta' | 'hoy' | 'filas'>): EntradaProyeccion => ({ plantillas: null, plantillasResueltas: new Set(), filtros: FILTROS, presupuesto: 3680, ...e })
const NOV = { desde: '2026-11-01', hasta: '2026-11-30' }

/** Tres meses cerrados (ago, sep, oct) con 3 000 variables y 1 000 recurrentes cada uno, repartidos en un gasto variable por día y un pago recurrente el día 2. */
function historial3(): FilaProy[] {
  const out: FilaProy[] = []
  for (const [mes, dias] of [['2026-08', 31], ['2026-09', 30], ['2026-10', 31]] as const) {
    for (let dia = 1; dia <= dias; dia++) out.push(fila(`${mes}-${String(dia).padStart(2, '0')}`, 3000 / dias))
    out.push(fila(`${mes}-02`, 1000, { tipo: 'fixed', recurrente: true }))
  }
  return out
}

describe('caso de la captura: 4 días con S/ 2 358.30', () => {
  const filas = [fila('2026-11-01', 80), fila('2026-11-02', 478.3, { recurrente: true }), fila('2026-11-03', 700, { recurrente: true }), fila('2026-11-03', 900), fila('2026-11-04', 200)]
  it('la proyección lineal da 17 687.25 pero NO se presenta como estimación: datos insuficientes', () => {
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-04', filas }))
    expect(p.real).toBe(2358.3)
    expect(p.lineal).toBe(17687.25) // 2 358.30 ÷ 4 × 30, la cifra de la captura
    expect(p.confiabilidad).toBe('insuficiente')
    expect(p.ajustada).toBeNull()
    expect(p.motivo).toMatch(/Datos insuficientes/)
    expect(p.motivo).toMatch(/3 días completos/)
  })

  it('con tres meses de historial la estimación vuelve a ser razonable (no 5 veces el presupuesto)', () => {
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-04', filas: [...historial3(), ...filas] }))
    expect(p.confiabilidad).toBe('preliminar') // 3 días completos < 10: aún preliminar
    expect(p.ajustada).not.toBeNull()
    expect(p.ajustada!).toBeLessThan(p.lineal! / 2)
    expect(p.ajustada!).toBeGreaterThan(p.real)
    expect(p.advertencias.join(' ')).toMatch(/Estimación preliminar/)
  })
})

describe('confiabilidad (criterios objetivos)', () => {
  it('sin historial: insuficiente con menos de 7 días completos, preliminar desde 7', () => {
    const dias = (n: number) => Array.from({ length: n }, (_, i) => fila(`2026-11-${String(i + 1).padStart(2, '0')}`, 100))
    expect(proyectarCierre(entrada({ ...NOV, hoy: '2026-11-07', filas: dias(7) })).confiabilidad).toBe('insuficiente') // 6 días completos
    const p8 = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-08', filas: dias(8) }))
    expect(p8.confiabilidad).toBe('preliminar') // 7 días completos
    expect(p8.componentes.diasCompletos).toBe(CRITERIOS.diasMinimos)
  })

  it('con dos meses de historial se puede estimar desde el primer día', () => {
    const filas = historial3().filter((f) => f.fecha >= '2026-09-01')
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-02', filas }))
    expect(p.componentes.mesesHistorial).toBe(2)
    expect(p.confiabilidad).toBe('preliminar')
    expect(p.ajustada).not.toBeNull()
  })

  it('«con historial»: 3 meses cerrados y 10 días completos', () => {
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas: historial3() }))
    expect(p.componentes.diasCompletos).toBe(10)
    expect(p.confiabilidad).toBe('con-historial')
    expect(p.advertencias.join(' ')).not.toMatch(/preliminar/)
  })

  it('un mes sin ningún gasto y sin historial no inventa importes', () => {
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-15', filas: [] }))
    expect(p.confiabilidad).toBe('preliminar')
    expect(p.real).toBe(0)
    expect(p.ajustada).toBe(0) // tasa 0 observada, nada que sumar
    expect(p.lineal).toBe(0)
  })
})

describe('fórmula: real + compromisos pendientes + tasa variable × días restantes', () => {
  it('solo variable, sin historial: 100 por día durante 10 días completos → cierre = real + 100 × restantes', () => {
    const filas = [...Array.from({ length: 10 }, (_, i) => fila(`2026-11-${String(i + 1).padStart(2, '0')}`, 100)), fila('2026-11-11', 50)]
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas }))
    expect(p.real).toBe(1050)
    expect(p.componentes.tasaDiariaVariable).toBe(100) // hoy (parcial) no entra en la tasa
    expect(p.componentes.diasRestantes).toBe(19)
    expect(p.ajustada).toBe(1050 + 100 * 19)
    expect(p.confiabilidad).toBe('preliminar')
  })

  it('un gasto fijo al inicio del mes no se extrapola todos los días', () => {
    // 10 días: S/ 1 000 de alquiler el día 1 (fijo) + 20 diarios de variable
    const filas = [fila('2026-11-01', 1000, { tipo: 'fixed' }), ...Array.from({ length: 10 }, (_, i) => fila(`2026-11-${String(i + 1).padStart(2, '0')}`, 20)), fila('2026-11-11', 0)]
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas }))
    expect(p.componentes.tasaDiariaVariable).toBe(20)
    expect(p.ajustada).toBe(1000 + 200 + 20 * 19) // 1 580; la lineal diría 1 200 ÷ 11 × 30 = 3 272.73
    expect(p.lineal).toBe(3272.73)
    expect(p.ajustada!).toBeLessThan(p.lineal!)
  })

  it('varios movimientos el mismo día y días sin gasto cuentan como días transcurridos', () => {
    const filas = [fila('2026-11-01', 50), fila('2026-11-01', 50), fila('2026-11-01', 50), fila('2026-11-09', 10), fila('2026-11-10', 0)]
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-10', filas }))
    expect(p.componentes.diasCompletos).toBe(9)
    expect(p.componentes.tasaDiariaVariable).toBeCloseTo(160 / 9, 2) // denominador: días calendario, no solo los días con gasto
  })

  it('con historial la tasa mezcla el mes en curso y los meses cerrados', () => {
    const filas = [...historial3(), ...Array.from({ length: 5 }, (_, i) => fila(`2026-11-0${i + 1}`, 90))]
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-06', filas }))
    const tasaHist = 9000 / (31 + 30 + 31)
    const esperada = (450 + tasaHist * 7) / (5 + 7)
    expect(p.componentes.tasaDiariaVariable).toBeCloseTo(esperada, 1) // la tasa se presenta redondeada a céntimos
    expect(p.componentes.origenCompromisos).toBe('historial')
    expect(p.componentes.compromisosPendientes).toBe(1000) // el pago recurrente de 1 000 aún no ocurrió este mes
    expect(p.ajustada!).toBeCloseTo(450 + 1000 + esperada * 24, 1)
  })

  it('el gasto recurrente ya registrado no se vuelve a sumar como pendiente (sin doble contabilización)', () => {
    const filas = [...historial3(), fila('2026-11-02', 1000, { tipo: 'fixed', recurrente: true }), fila('2026-11-03', 90)]
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-04', filas }))
    expect(p.componentes.compromisosPendientes).toBe(0)
  })
})

describe('pagos planificados (plantillas)', () => {
  const plantillas: PlantillaPlan[] = [
    { id: 'p1', monto: 700, tipo: 'fixed', ambito_id: 'a1', categoria_id: 'c1', subcategoria_id: null, medio_id: 'm1' },
    { id: 'p2', monto: 120.5, tipo: 'fixed', ambito_id: 'a2', categoria_id: 'c2', subcategoria_id: null, medio_id: 'm1' },
    { id: 'p3', monto: 80, tipo: 'fixed', ambito_id: 'a1', categoria_id: 'c1', subcategoria_id: null, medio_id: null },
  ]
  const dias10 = Array.from({ length: 10 }, (_, i) => fila(`2026-11-${String(i + 1).padStart(2, '0')}`, 100))

  it('solo suman las plantillas aún no registradas ni marcadas «No aplica»', () => {
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas: dias10, plantillas, plantillasResueltas: new Set(['p1']) }))
    expect(p.componentes.origenCompromisos).toBe('planificados')
    expect(p.componentes.compromisosPendientes).toBe(200.5) // p2 + p3
    expect(p.real).toBe(1000) // los pagos planificados NO son gasto real
    expect(p.ajustada).toBe(1000 + 200.5 + 100 * 19)
  })

  it('al registrar la plantilla el pendiente baja y el gasto real sube: la estimación no cambia por duplicado', () => {
    const antes = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas: dias10, plantillas, plantillasResueltas: new Set() }))
    const despues = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas: [...dias10, fila('2026-11-11', 700, { tipo: 'fixed', recurrente: true })], plantillas, plantillasResueltas: new Set(['p1']) }))
    expect(despues.real).toBe(antes.real + 700)
    expect(despues.componentes.compromisosPendientes).toBe(antes.componentes.compromisosPendientes - 700)
    expect(despues.ajustada).toBe(antes.ajustada)
  })

  it('sin plantillas activas se usa el historial; sin historial tampoco, 0', () => {
    expect(proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas: dias10, plantillas: [] })).componentes.origenCompromisos).toBe('ninguno')
  })
})

describe('filtros', () => {
  it('la estimación solo considera lo que cumple los filtros (también historial y plantillas)', () => {
    const filas = [...historial3(), ...historial3().map((f) => ({ ...f, ambito_id: 'a2' })), fila('2026-11-03', 90), fila('2026-11-03', 500, { ambito_id: 'a2' })]
    const todo = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-06', filas }))
    const soloA2 = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-06', filas, filtros: { ...FILTROS, ambito: 'a2' } }))
    expect(todo.real).toBe(590)
    expect(soloA2.real).toBe(500)
    expect(soloA2.componentes.mesesHistorial).toBe(3) // los meses observados no dependen del filtro
    expect(soloA2.ajustada).not.toBe(todo.ajustada)
  })

  it('la diferencia contra el presupuesto se calcula solo si hay presupuesto', () => {
    const filas = historial3()
    const con = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas, presupuesto: 1000 }))
    expect(con.diferenciaVsPresupuesto).toBe(Math.round((con.ajustada! - 1000) * 100) / 100)
    expect(con.advertencias.join(' ')).toMatch(/superaría el presupuesto/)
    expect(proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas, presupuesto: null })).diferenciaVsPresupuesto).toBeNull()
    expect(proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas, presupuesto: 0 })).advertencias.join(' ')).not.toMatch(/superaría/) // presupuesto cero: sin comparación artificial
  })
})

describe('un gasto extraordinario no se excluye en silencio', () => {
  it('cuenta en el real y la tasa, y se advierte su peso', () => {
    const filas = [...historial3(), fila('2026-11-02', 800), fila('2026-11-03', 20), fila('2026-11-04', 20)]
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-05', filas }))
    expect(p.real).toBe(840)
    expect(p.componentes.tasaDiariaVariable!).toBeGreaterThan(9000 / 92) // el gasto grande sube la tasa: no se descarta
    expect(p.advertencias.join(' ')).toMatch(/Un solo gasto \(S\/ 800\.00\) concentra el 95 %/)
  })
})

describe('calendario: meses de 28, 29, 30 y 31 días', () => {
  it.each([
    ['2027-02-01', '2027-02-28', 28],
    ['2028-02-01', '2028-02-29', 29],
    ['2026-11-01', '2026-11-30', 30],
    ['2026-12-01', '2026-12-31', 31],
  ])('%s: los días restantes y la lineal usan los días reales del mes', (desde, hasta, dias) => {
    expect(diasDelMes(desde)).toBe(dias)
    const hoy = `${desde.slice(0, 8)}10`
    const filas = Array.from({ length: 10 }, (_, i) => fila(`${desde.slice(0, 8)}${String(i + 1).padStart(2, '0')}`, 100))
    const p = proyectarCierre(entrada({ desde, hasta, hoy, filas }))
    expect(p.componentes.diasRestantes).toBe(dias - 10)
    expect(p.lineal).toBe(Math.round((1000 / 10) * dias * 100) / 100)
  })

  it('primer día: solo un día transcurrido, ninguno completo → sin estimación ajustada sin historial; la lineal existe como referencia', () => {
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-01', filas: [fila('2026-11-01', 100)] }))
    expect(p.lineal).toBe(3000)
    expect(p.ajustada).toBeNull()
    expect(p.componentes.diasCompletos).toBe(0)
  })

  it('último día del mes: el período termina, ya no hay nada que proyectar', () => {
    expect(proyectarCierre(entrada({ ...NOV, hoy: '2026-11-30', filas: historial3() })).aplicable).toBe(false)
  })
})

describe('cuándo no aplica', () => {
  const filas = historial3()
  it('mes cerrado, mes futuro y rango que no es un mes completo', () => {
    expect(proyectarCierre(entrada({ desde: '2026-10-01', hasta: '2026-10-31', hoy: '2026-11-04', filas })).aplicable).toBe(false)
    expect(proyectarCierre(entrada({ desde: '2026-12-01', hasta: '2026-12-31', hoy: '2026-11-04', filas })).aplicable).toBe(false)
    expect(proyectarCierre(entrada({ desde: '2026-11-01', hasta: '2026-11-15', hoy: '2026-11-10', filas })).aplicable).toBe(false)
  })

  it('los movimientos con fecha posterior a hoy no son gasto real', () => {
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas: [...historial3(), fila('2026-11-20', 5000)] }))
    expect(p.real).toBe(0)
  })
})

describe('precisión', () => {
  it('10 gastos de 0.10 suman exactamente 1.00 y el cierre sigue siendo un importe con dos decimales', () => {
    const filas = Array.from({ length: 10 }, (_, i) => fila(`2026-11-${String(i + 1).padStart(2, '0')}`, 0.1))
    const p = proyectarCierre(entrada({ ...NOV, hoy: '2026-11-11', filas }))
    expect(p.real).toBe(1)
    expect(Number.isInteger(Math.round(p.ajustada! * 100))).toBe(true)
    expect(Math.abs(p.ajustada! * 100 - Math.round(p.ajustada! * 100))).toBeLessThan(1e-6)
  })
})
