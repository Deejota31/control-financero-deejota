import { describe, expect, it } from 'vitest'
import { aplicarSeleccion, conPeriodo, hayCruzados, limpiarCruzados, paramsGastos, type FiltrosDashboard, type RelacionesCatalogo } from './filtrosCruzados'

const base: FiltrosDashboard = { desde: '2026-10-01', hasta: '2026-10-31', ambito: '', categoria: '', subcategoria: '', medio: '', tipo: '', dia: '' }
const rel: RelacionesCatalogo = {
  ambitoDeCategoria: new Map([['cat-hogar', 'amb-hogar'], ['cat-ocio', 'amb-personal']]),
  categoriaDeSubcategoria: new Map([['sub-luz', 'cat-hogar'], ['sub-salidas', 'cat-ocio']]),
}

describe('aplicarSeleccion', () => {
  it('activa y desactiva un filtro al seleccionar dos veces', () => {
    const a = aplicarSeleccion(base, 'ambito', 'amb-hogar', rel)
    expect(a.ambito).toBe('amb-hogar')
    expect(aplicarSeleccion(a, 'ambito', 'amb-hogar', rel).ambito).toBe('')
  })

  it('cambiar de ámbito limpia categoría y subcategoría incompatibles', () => {
    const f = { ...base, ambito: 'amb-hogar', categoria: 'cat-hogar', subcategoria: 'sub-luz' }
    const r = aplicarSeleccion(f, 'ambito', 'amb-personal', rel)
    expect(r).toMatchObject({ ambito: 'amb-personal', categoria: '', subcategoria: '' })
  })

  it('seleccionar el mismo ámbito de la categoría la conserva', () => {
    const f = { ...base, categoria: 'cat-hogar' }
    expect(aplicarSeleccion(f, 'ambito', 'amb-hogar', rel).categoria).toBe('cat-hogar')
  })

  it('elegir una subcategoría fija su categoría', () => {
    const r = aplicarSeleccion(base, 'subcategoria', 'sub-luz', rel)
    expect(r).toMatchObject({ subcategoria: 'sub-luz', categoria: 'cat-hogar' })
  })

  it('elegir una categoría limpia una subcategoría que no es suya y un ámbito incompatible', () => {
    const f = { ...base, ambito: 'amb-personal', subcategoria: 'sub-salidas' }
    const r = aplicarSeleccion(f, 'categoria', 'cat-hogar', rel)
    expect(r).toMatchObject({ categoria: 'cat-hogar', subcategoria: '', ambito: '' })
  })

  it('el día solo se acepta dentro del período', () => {
    expect(aplicarSeleccion(base, 'dia', '2026-10-12', rel).dia).toBe('2026-10-12')
    expect(aplicarSeleccion(base, 'dia', '2026-11-02', rel)).toBe(base)
    const f = aplicarSeleccion(base, 'dia', '2026-10-12', rel)
    expect(aplicarSeleccion(f, 'dia', '2026-10-12', rel).dia).toBe('')
  })

  it('combina filtros independientes (medio, tipo y ámbito)', () => {
    let f = aplicarSeleccion(base, 'medio', 'yape', rel)
    f = aplicarSeleccion(f, 'tipo', 'variable', rel)
    f = aplicarSeleccion(f, 'ambito', 'amb-hogar', rel)
    expect(f).toMatchObject({ medio: 'yape', tipo: 'variable', ambito: 'amb-hogar' })
    expect(hayCruzados(f)).toBe(true)
  })
})

describe('limpieza y período', () => {
  it('limpiar conserva el período y quita todo lo demás', () => {
    const f = { ...base, ambito: 'a', categoria: 'c', subcategoria: 's', medio: 'm', tipo: 'fixed' as const, dia: '2026-10-05' }
    const r = limpiarCruzados(f)
    expect(r).toEqual(base)
    expect(hayCruzados(r)).toBe(false)
  })

  it('cambiar el período descarta un día que queda fuera y conserva el resto', () => {
    const f = { ...base, ambito: 'a', dia: '2026-10-05' }
    expect(conPeriodo(f, '2026-09-01', '2026-09-30')).toMatchObject({ dia: '', ambito: 'a' })
    expect(conPeriodo(f, '2026-10-01', '2026-10-15').dia).toBe('2026-10-05')
  })
})

describe('paramsGastos', () => {
  it('conserva los criterios y convierte el día en un rango de un día', () => {
    const f = { ...base, ambito: 'a', medio: 'm', tipo: 'fixed' as const, dia: '2026-10-05' }
    const p = paramsGastos(f)
    expect(p.get('desde')).toBe('2026-10-05')
    expect(p.get('hasta')).toBe('2026-10-05')
    expect(p.get('ambito')).toBe('a')
    expect(p.get('medio')).toBe('m')
    expect(p.get('tipo')).toBe('fixed')
    expect(p.has('categoria')).toBe(false)
  })
})
