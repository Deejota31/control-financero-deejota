import { describe, expect, it } from 'vitest'
import { admite, admiteClasificacion, admiteMedio, resumirFondo, type Clasificacion, type ReglaAlcance } from './fondos'

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
