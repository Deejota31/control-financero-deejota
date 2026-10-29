import { describe, expect, it } from 'vitest'
import { agruparPorNombre, idsDe, unirIds, valorDeGrupo } from './idsFiltro'

const it_ = (id: string, name: string, is_active = true) => ({ id, name, is_active })

describe('agruparPorNombre', () => {
  const items = [it_('1', 'Alimentación'), it_('2', 'Salud'), it_('3', 'Alimentación'), it_('4', ' alimentación '), it_('5', 'Auto')]
  it('una opción por nombre, con todos sus IDs y en el orden del catálogo', () => {
    const g = agruparPorNombre(items)
    expect(g.map((x) => x.nombre)).toEqual(['Alimentación', 'Salud', 'Auto'])
    expect(g[0].ids).toEqual(['1', '3', '4'])
    expect(g[0].valor).toBe('1,3,4')
    expect(g[1].valor).toBe('2')
  })
  it('omite inactivos salvo el elegido', () => {
    const l = [it_('1', 'Otros'), it_('2', 'Viejo', false)]
    expect(agruparPorNombre(l).map((x) => x.nombre)).toEqual(['Otros'])
    expect(agruparPorNombre(l, '2').map((x) => x.nombre)).toEqual(['Otros', 'Viejo'])
  })
  it('catálogo vacío', () => expect(agruparPorNombre([])).toEqual([]))
})

describe('valorDeGrupo', () => {
  const g = agruparPorNombre([it_('1', 'Alimentación'), it_('3', 'Alimentación'), it_('5', 'Auto')])
  it('reconoce el grupo aunque la elección esté acotada', () => {
    expect(valorDeGrupo(g, '1,3')).toBe('1,3')
    expect(valorDeGrupo(g, '3')).toBe('1,3')
    expect(valorDeGrupo(g, '')).toBeNull()
  })
  it('ids y unir son inversos', () => expect(idsDe(unirIds(['a', 'b']))).toEqual(['a', 'b']))
})
