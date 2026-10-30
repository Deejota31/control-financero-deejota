import { describe, expect, it } from 'vitest'
import { admite, admiteClasificacion, admiteMedio, resumirFondo, type Clasificacion, type ReglaAlcance, cambiosPorPeriodo } from './fondos'

const c: Clasificacion = { ambito_id: 'hogar', categoria_id: 'servicios', subcategoria_id: 'luz', payment_method_id: 'yape' }
const alc = (p: Partial<ReglaAlcance>): ReglaAlcance => ({ ambito_id: null, categoria_id: null, subcategoria_id: null, effect: 'include', ...p })

describe('compatibilidad de fondos', () => {
  it('sin reglas admite todo', () => {
    expect(admite([], [], c)).toBe(true)
  })
  it('include por ámbito, categoría o subcategoría', () => {
    expect(admiteClasificacion([alc({ ambito_id: 'hogar' })], c)).toBe(true)
    expect(admiteClasificacion([alc({ categoria_id: 'servicios' })], c)).toBe(true)
    expect(admiteClasificacion([alc({ subcategoria_id: 'luz' })], c)).toBe(true)
    expect(admiteClasificacion([alc({ ambito_id: 'personal' })], c)).toBe(false)
  })
  it('exclude gana sobre include', () => {
    expect(admiteClasificacion([alc({ ambito_id: 'hogar' }), alc({ subcategoria_id: 'luz', effect: 'exclude' })], c)).toBe(false)
  })
  it('una subcategoría nula nunca coincide con una regla de subcategoría', () => {
    expect(admiteClasificacion([alc({ subcategoria_id: 'luz' })], { ...c, subcategoria_id: null })).toBe(false)
  })
  it('medios incluidos y excluidos', () => {
    expect(admiteMedio([{ payment_method_id: 'yape', effect: 'include' }], 'yape')).toBe(true)
    expect(admiteMedio([{ payment_method_id: 'yape', effect: 'include' }], 'plin')).toBe(false)
    expect(admiteMedio([{ payment_method_id: 'plin', effect: 'exclude' }], 'plin')).toBe(false)
    expect(admiteMedio([{ payment_method_id: 'plin', effect: 'exclude' }], 'yape')).toBe(true)
  })
  it('combina clasificación y medio', () => {
    expect(admite([alc({ ambito_id: 'hogar' })], [{ payment_method_id: 'yape', effect: 'exclude' }], c)).toBe(false)
  })
})

describe('resumirFondo', () => {
  it('calcula disponible y estado', () => {
    expect(resumirFondo(100, 40)).toMatchObject({ disponible: 60, estado: 'ok' })
    expect(resumirFondo(100, 90).estado).toBe('casi')
    expect(resumirFondo(100, 100).estado).toBe('agotado')
    expect(resumirFondo(100, 130)).toMatchObject({ disponible: -30, estado: 'negativo' })
    expect(resumirFondo(0, 0).estado).toBe('ok')
  })
  it('evita errores de punto flotante', () => {
    expect(resumirFondo(0.3, 0.1).disponible).toBe(0.2)
  })
})

describe('cambiosPorPeriodo', () => {
  const fila = (period_id: string, start: string, fund_id: string, fund_name: string, assigned: number, consumed: number) => ({ period_id, start, fund_id, fund_name, assigned, consumed })
  it('separa por período, omite lo que no cambia y calcula el impacto en lo disponible', () => {
    const antes = [fila('p1', '2026-09-01', 'f1', 'Sodexo', 300, 280), fila('p2', '2026-10-01', 'f1', 'Sodexo', 300, 100), fila('p2', '2026-10-01', 'f2', 'Hogar', 500, 400)]
    const despues = [fila('p1', '2026-09-01', 'f1', 'Sodexo', 300, 280), fila('p2', '2026-10-01', 'f1', 'Sodexo', 0, 0), fila('p2', '2026-10-01', 'f2', 'Hogar', 500, 500)]
    const r = cambiosPorPeriodo(antes, despues)
    expect(r.map((p) => p.start)).toEqual(['2026-10-01'])
    const sodexo = r[0].filas.find((x) => x.nombre === 'Sodexo')!
    expect(sodexo).toMatchObject({ asignadoAntes: 300, asignadoDespues: 0, consumoAntes: 100, consumoDespues: 0, impacto: -200 })
    expect(r[0].filas.find((x) => x.nombre === 'Hogar')!.impacto).toBe(-100)
  })
  it('un presupuesto del período a cero no se confunde con el predeterminado: solo cambia la fila de ese período', () => {
    const antes = [fila('p1', '2026-09-01', 'f1', 'Sodexo', 300, 0), fila('p2', '2026-10-01', 'f1', 'Sodexo', 300, 0)]
    const despues = [fila('p1', '2026-09-01', 'f1', 'Sodexo', 300, 0), fila('p2', '2026-10-01', 'f1', 'Sodexo', 0, 0)]
    const r = cambiosPorPeriodo(antes, despues)
    expect(r).toHaveLength(1)
    expect(r[0].period_id).toBe('p2')
  })
  it('un fondo eliminado aparece con «después» en 0', () => {
    const r = cambiosPorPeriodo([fila('p1', '2026-10-01', 'f1', 'Viejo', 100, 40)], [])
    expect(r[0].filas[0]).toMatchObject({ asignadoDespues: 0, consumoDespues: 0, impacto: -60 })
  })
})
