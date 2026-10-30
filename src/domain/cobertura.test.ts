import { describe, expect, it } from 'vitest'
import { resumirCobertura, type NombresCatalogo } from './cobertura'

const nombres: NombresCatalogo = {
  ambito: new Map([['a1', 'Hogar'], ['a2', 'Trabajo']]),
  categoria: new Map([['c1', 'Alimentación'], ['c2', 'Alimentación'], ['c3', 'Servicios']]),
  subcategoria: new Map([['s1', 'Luz']]),
  medio: new Map([['m1', 'Sodexo'], ['m2', 'Efectivo']]),
}
const alc = (o: Partial<{ ambito_id: string; categoria_id: string; subcategoria_id: string; effect: string }>) => ({ ambito_id: null, categoria_id: null, subcategoria_id: null, effect: 'include', ...o })

describe('resumirCobertura', () => {
  it('el Fondo General sin reglas es «Cobertura general»', () => {
    const c = resumirCobertura(true, [], [], nombres)
    expect(c.etiquetas).toEqual([{ texto: 'Cobertura general', efecto: 'include', tipo: 'general' }])
    expect(c.sinReglas).toBe(false)
  })
  it('un fondo específico lista sus inclusiones de clasificación y de medio, sin repetir nombres', () => {
    const c = resumirCobertura(false, [alc({ categoria_id: 'c1' }), alc({ categoria_id: 'c2' })], [{ payment_method_id: 'm1', effect: 'include' }], nombres)
    expect(c.etiquetas.map((e) => e.texto)).toEqual(['Alimentación', 'Sodexo'])
  })
  it('no muestra «cobertura general» cuando hay restricciones específicas', () => {
    const c = resumirCobertura(true, [alc({ ambito_id: 'a1' })], [], nombres)
    expect(c.etiquetas.map((e) => e.texto)).toEqual(['Hogar'])
  })
  it('el General con solo exclusiones conserva «Cobertura general» y muestra qué excluye', () => {
    const c = resumirCobertura(true, [], [{ payment_method_id: 'm1', effect: 'exclude' }], nombres)
    expect(c.etiquetas).toEqual([
      { texto: 'Cobertura general', efecto: 'include', tipo: 'general' },
      { texto: 'Sodexo', efecto: 'exclude', tipo: 'medio' },
    ])
  })
  it('las exclusiones van después de las inclusiones y se distinguen por su efecto', () => {
    const c = resumirCobertura(false, [alc({ categoria_id: 'c3', effect: 'exclude' }), alc({ subcategoria_id: 's1' })], [], nombres)
    expect(c.etiquetas.map((e) => `${e.efecto}:${e.texto}`)).toEqual(['include:Luz', 'exclude:Servicios'])
  })
  it('un fondo específico sin ninguna regla se marca como sin reglas', () => {
    expect(resumirCobertura(false, [], [], nombres).sinReglas).toBe(true)
  })
  it('ignora reglas cuyo elemento ya no existe en el catálogo', () => {
    const c = resumirCobertura(false, [alc({ categoria_id: 'desconocida' })], [], nombres)
    expect(c.etiquetas).toEqual([])
    expect(c.sinReglas).toBe(true)
  })
})
