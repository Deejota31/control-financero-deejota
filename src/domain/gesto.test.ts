// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { arrastreVisible, ARRASTRE_MAXIMO, clasificarEje, puedeIniciarGesto, resolverGesto, UMBRAL_APERTURA, UMBRAL_INTENCION } from './gesto'

describe('clasificarEje', () => {
  it('espera mientras el movimiento es menor que el umbral de intención', () => {
    expect(clasificarEje(UMBRAL_INTENCION - 1, 0)).toBe('pendiente')
    expect(clasificarEje(-4, 3)).toBe('pendiente')
  })
  it('reconoce el gesto horizontal solo si el lateral supera claramente al vertical', () => {
    expect(clasificarEje(-30, 4)).toBe('horizontal')
    expect(clasificarEje(30, -8)).toBe('horizontal')
  })
  it('deja el desplazamiento vertical normal a la página', () => {
    expect(clasificarEje(2, -40)).toBe('vertical')
    expect(clasificarEje(8, 30)).toBe('vertical')
  })
  it('un movimiento diagonal no es horizontal', () => {
    expect(clasificarEje(-40, 35)).toBe('vertical')
    expect(clasificarEje(-30, 25)).toBe('vertical')
  })
  it('una diagonal suave que aún no define eje queda pendiente', () => {
    expect(clasificarEje(-12, 8)).toBe('pendiente')
  })
})

describe('resolverGesto', () => {
  it('abre solo con un deslizamiento completo a la izquierda', () => {
    expect(resolverGesto(-UMBRAL_APERTURA, false)).toBe('abrir')
    expect(resolverGesto(-UMBRAL_APERTURA + 1, false)).toBe('mantener')
    expect(resolverGesto(-20, false)).toBe('mantener')
  })
  it('deslizar a la derecha cuando está cerrado no abre nada', () => {
    expect(resolverGesto(120, false)).toBe('mantener')
  })
  it('cierra con un deslizamiento completo a la derecha', () => {
    expect(resolverGesto(UMBRAL_APERTURA, true)).toBe('cerrar')
    expect(resolverGesto(UMBRAL_APERTURA - 1, true)).toBe('mantener')
    expect(resolverGesto(-100, true)).toBe('mantener')
  })
})

describe('arrastreVisible', () => {
  it('acompaña al dedo hacia la izquierda con un tope', () => {
    expect(arrastreVisible(0, false)).toBe(0)
    expect(arrastreVisible(-40, false)).toBeLessThan(0)
    expect(Math.abs(arrastreVisible(-2000, false))).toBeLessThanOrEqual(ARRASTRE_MAXIMO * 1.2)
  })
  it('no se mueve hacia la derecha ni cuando ya está abierta', () => {
    expect(arrastreVisible(80, false)).toBe(0)
    expect(arrastreVisible(-80, true)).toBe(0)
  })
})

describe('puedeIniciarGesto', () => {
  const montar = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; document.body.append(d); return d }
  it('permite el gesto sobre texto y contenedores', () => {
    const r = montar('<div id="r"><p id="t">Luz</p></div>')
    expect(puedeIniciarGesto(r.querySelector('#t'), r.querySelector('#r')!)).toBe(true)
  })
  it.each([
    ['casilla', '<label><input id="x" type="checkbox"></label>'],
    ['botón', '<button id="x"><span>Editar</span></button>'],
    ['enlace', '<a id="x" href="/a">ir</a>'],
    ['campo de importe', '<input id="x" type="text">'],
    ['selector', '<div role="combobox" id="x">Medio</div>'],
    ['asa de orden', '<span data-sin-gesto id="x">::</span>'],
  ])('no captura gestos iniciados sobre %s', (_n, html) => {
    const r = montar(`<div id="r">${html}</div>`)
    expect(puedeIniciarGesto(r.querySelector('#x'), r.querySelector('#r')!)).toBe(false)
  })
  it('un botón puede declarar que admite el gesto (cuerpo seleccionable de una fila)', () => {
    const r = montar('<div id="r"><button data-gesto-ok id="x"><span id="y">Alimentación</span></button></div>')
    expect(puedeIniciarGesto(r.querySelector('#y'), r.querySelector('#r')!)).toBe(true)
  })
})
