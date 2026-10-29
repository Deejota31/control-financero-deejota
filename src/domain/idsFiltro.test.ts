import { describe, expect, it } from 'vitest'
import { agruparPorNombre, consolidarPorNombre, idsDe, unirIds, valorDeGrupo } from './idsFiltro'

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

describe('consolidarPorNombre (Top 5)', () => {
  const cat = [{ id: 'a1', name: 'Alimentación' }, { id: 'a2', name: 'Alimentación' }, { id: 's', name: 'Salud' }, { id: 'o', name: 'Otros' }]
  it('suma importes y movimientos de la misma categoría en varios ámbitos', () => {
    const r = consolidarPorNombre([{ id: 'a1', total: '407.30', cantidad: 12 }, { id: 'a2', total: '313.10', cantidad: 9 }, { id: 's', total: '500', cantidad: 3 }], cat)
    expect(r.map((x) => [x.nombre, x.total, x.cantidad])).toEqual([['Alimentación', 720.4, 21], ['Salud', 500, 3]])
    expect(r[0].ids).toEqual(['a1', 'a2'])
  })
  it('ordena de mayor a menor y no pierde céntimos', () => {
    const r = consolidarPorNombre([{ id: 'o', total: 0.1, cantidad: 1 }, { id: 'a1', total: 0.2, cantidad: 1 }, { id: 'a2', total: 0.1, cantidad: 1 }], cat)
    expect(r.map((x) => x.total)).toEqual([0.3, 0.1])
  })
  it('un ID fuera del catálogo no se mezcla con otro', () => {
    const r = consolidarPorNombre([{ id: 'x', total: 5, cantidad: 1 }, { id: 'y', total: 7, cantidad: 2 }], cat)
    expect(r).toHaveLength(2)
  })
  it('el total consolidado coincide con la suma original', () => {
    const f = [{ id: 'a1', total: 10.55, cantidad: 1 }, { id: 'a2', total: 4.45, cantidad: 2 }, { id: 's', total: 1, cantidad: 1 }]
    expect(consolidarPorNombre(f, cat).reduce((s, x) => s + x.total, 0)).toBe(16)
  })
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
