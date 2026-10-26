import { describe, expect, it } from 'vitest'
import { buscarIconos, normalizar, sugerirIconos } from './iconos'
import { ALIAS_ICONOS, ICONOS_CATALOGO, ICONOS_HEREDADOS, SECCIONES_ICONOS } from './iconosCatalogo'

const top = (nombre: string, padre?: string) => sugerirIconos(nombre, padre).map((s) => s.id)

describe('catálogo de íconos', () => {
  it('tiene identificadores únicos, secciones válidas y nombres en español', () => {
    const ids = ICONOS_CATALOGO.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(115)
    const secciones = new Set<string>(SECCIONES_ICONOS.map((s) => s.id))
    expect(SECCIONES_ICONOS).toHaveLength(12)
    for (const i of ICONOS_CATALOGO) {
      expect(secciones.has(i.seccion), i.id).toBe(true)
      expect(i.nombre.length, i.id).toBeGreaterThan(2)
      expect(i.palabras.length, i.id).toBeGreaterThan(0)
    }
  })
  it('conserva compatibilidad con las claves guardadas antes', () => {
    expect(ALIAS_ICONOS.home).toBe('house')
    expect(ICONOS_HEREDADOS).toEqual(expect.arrayContaining(['tag', 'circle-ellipsis']))
  })
})

describe('normalizar y buscar', () => {
  it('ignora mayúsculas, tildes y espacios sobrantes', () => {
    expect(normalizar('  Barbería  ')).toBe('barberia')
    expect(normalizar('Cuidado   INFANTIL')).toBe('cuidado infantil')
  })
  it('busca por nombre y por sinónimo, con o sin tildes', () => {
    expect(buscarIconos('gasolina').map((i) => i.id)).toContain('fuel')
    expect(buscarIconos('BARBERIA').map((i) => i.id)).toContain('scissors')
    expect(buscarIconos('barbería').map((i) => i.id)).toContain('scissors')
    expect(buscarIconos('uber').map((i) => i.id)).toContain('taxi')
  })
  it('restringe por sección y devuelve vacío sin coincidencias', () => {
    expect(buscarIconos('', 'alimentacion').every((i) => i.seccion === 'alimentacion')).toBe(true)
    expect(buscarIconos('xyzqwerty')).toEqual([])
  })
})

describe('sugerencias por nombre', () => {
  const casos: [string, string][] = [
    ['Familia', 'users'], ['Alimentación', 'utensils'], ['Gasolina', 'fuel'], ['Estacionamiento', 'parking'], ['Barbería', 'scissors'],
    ['Sodexo', 'credit-card'], ['Internet', 'wifi'], ['Viaje a Ica', 'luggage'], ['Cuidado Infantil', 'baby'], ['Seguro vehicular', 'shield'],
  ]
  for (const [nombre, esperado] of casos) it(`«${nombre}» → ${esperado} primero`, () => expect(top(nombre)[0]).toBe(esperado))

  it('«Yape» y «Plin» sugieren celular y billetera', () => {
    for (const n of ['Yape', 'Plin']) expect(top(n).slice(0, 3)).toEqual(expect.arrayContaining(['smartphone', 'wallet']))
  })
  it('ignora tildes, mayúsculas y espacios', () => {
    expect(top('  GASOLINA ')[0]).toBe('fuel')
    expect(top('alimentacion')[0]).toBe('utensils')
  })
  it('devuelve entre 3 y 5 sugerencias ordenadas por relevancia', () => {
    for (const n of ['Familia', 'Viaje a Ica', 'zzz raro', '']) {
      const s = sugerirIconos(n)
      expect(s.length, n).toBeGreaterThanOrEqual(3)
      expect(s.length, n).toBeLessThanOrEqual(5)
      expect(s.map((x) => x.puntaje)).toEqual([...s.map((x) => x.puntaje)].sort((a, b) => b - a))
    }
  })
  it('sin coincidencias ofrece opciones generales', () => {
    expect(top('qwxzv').slice(0, 2)).toEqual(['tag', 'shapes'])
    expect(top('')).toContain('tag')
  })
  it('prioriza una coincidencia específica sobre una palabra genérica', () => {
    expect(top('Servicio técnico')[0]).toBe('settings')
    expect(top('Recibo de luz')[0]).toBe('zap')
  })
  it('aprovecha el contexto del elemento padre', () => {
    // sin coincidencia propia, el padre aporta una pista
    const sinContexto = top('Extras')
    const conContexto = top('Extras', 'Mascotas')
    expect(sinContexto).not.toContain('paw-print')
    expect(conContexto).toContain('paw-print')
  })
})
