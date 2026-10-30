import { describe, expect, it } from 'vitest'
import { agrupar, claveDeNombre, estadoSeleccion, moverAntes, moverDelta, ordenarSecciones, reordenarVisibles } from './agrupacion'

const f = (id: string, cat: string) => ({ id, cat })

describe('agrupar', () => {
  it('agrupa por la clave dada, conserva el orden de los elementos y de aparición de las secciones', () => {
    const s = agrupar([f('1', 'Servicios'), f('2', 'Hogar'), f('3', 'Servicios')], (x) => ({ clave: claveDeNombre(x.cat), titulo: x.cat }))
    expect(s.map((x) => x.titulo)).toEqual(['Servicios', 'Hogar'])
    expect(s[0].items.map((x) => x.id)).toEqual(['1', '3'])
  })
  it('las categorías homónimas de distintos ámbitos forman una sola sección (ignora mayúsculas y espacios)', () => {
    const s = agrupar([f('1', 'Alimentación'), f('2', ' alimentación ')], (x) => ({ clave: claveDeNombre(x.cat), titulo: x.cat.trim() }))
    expect(s).toHaveLength(1)
    expect(s[0].items).toHaveLength(2)
  })
})

describe('ordenarSecciones', () => {
  const s = agrupar([f('1', 'a'), f('2', 'b'), f('3', 'c')], (x) => ({ clave: x.cat, titulo: x.cat }))
  it('aplica el orden guardado y deja al final las secciones nuevas', () => {
    expect(ordenarSecciones(s, ['c', 'a']).map((x) => x.clave)).toEqual(['c', 'a', 'b'])
  })
  it('ignora claves guardadas que ya no existen', () => {
    expect(ordenarSecciones(s, ['z', 'b']).map((x) => x.clave)).toEqual(['b', 'a', 'c'])
  })
})

describe('estadoSeleccion', () => {
  it('distingue ninguna, algunas y todas', () => {
    expect(estadoSeleccion(['a', 'b'], new Set())).toBe('none')
    expect(estadoSeleccion(['a', 'b'], new Set(['a']))).toBe('some')
    expect(estadoSeleccion(['a', 'b'], new Set(['a', 'b', 'x']))).toBe('all')
    expect(estadoSeleccion([], new Set(['a']))).toBe('none')
  })
})

describe('mover', () => {
  it('moverAntes coloca el origen antes del destino', () => {
    expect(moverAntes(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
    expect(moverAntes(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
  })
  it('moverAntes no cambia nada con ids desconocidos o iguales', () => {
    expect(moverAntes(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
    expect(moverAntes(['a', 'b'], 'x', 'b')).toEqual(['a', 'b'])
  })
  it('moverDelta respeta los extremos', () => {
    expect(moverDelta(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moverDelta(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moverDelta(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })
  it('reordenarVisibles solo permuta los visibles y deja fijos los ocultos', () => {
    expect(reordenarVisibles(['a', 'x', 'b', 'y', 'c'], ['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'x', 'a', 'y', 'b'])
  })
})
