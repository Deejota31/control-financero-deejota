// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PALETA, contraste, hexARgb, tonos } from './color'

/**
 * El sistema de diseño se verifica sobre el propio index.css: cada tema define sus tokens base con contraste WCAG AA comprobado y la capa semántica
 * (nombres de propósito) está completa. Si alguien retoca un color y rompe el contraste, esta prueba falla.
 */
const css = readFileSync('src/index.css', 'utf8')

function bloque(selector: string): string {
  const i = css.indexOf(selector)
  if (i < 0) throw new Error(`No se encontró ${selector}`)
  const fin = css.indexOf('\n}\n', i)
  return css.slice(i, fin)
}
function tokens(b: string): Record<string, string> {
  return Object.fromEntries([...b.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]))
}
const claro = tokens(bloque(':root {'))
const oscuro = { ...claro, ...tokens(bloque(":root[data-theme='dark'] {")) }

const rgb = (t: Record<string, string>, k: string) => {
  const v = hexARgb(t[k] ?? '')
  if (!v) throw new Error(`El token --${k} no es un HEX: ${t[k]}`)
  return v
}
const ratio = (t: Record<string, string>, a: string, b: string) => contraste(rgb(t, a), rgb(t, b))

/** Pares texto/fondo que la interfaz usa de verdad (texto normal: 4.5:1). */
const PARES_TEXTO: [string, string][] = [
  ['fg', 'bg'], ['fg', 'surface'], ['fg', 'surface-2'], ['fg', 'surface-3'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['pri', 'bg'], ['pri', 'surface'], ['pri', 'surface-2'], ['pri', 'pri-soft'],
  ['pri-fg', 'pri'],
  ['ok', 'surface'], ['ok', 'ok-soft'], ['warn', 'surface'], ['warn', 'warn-soft'], ['bad', 'surface'], ['bad', 'bad-soft'], ['info', 'surface'], ['info', 'info-soft'],
  ['acc', 'surface'], ['acc', 'acc-soft'],
]

describe.each([['claro', claro], ['oscuro', oscuro]] as const)('tokens base · tema %s', (_n, t) => {
  it.each(PARES_TEXTO)('texto --%s sobre --%s cumple WCAG AA (≥ 4.5:1)', (texto, fondo) => {
    expect(ratio(t, texto, fondo)).toBeGreaterThanOrEqual(4.5)
  })
  it('las superficies se distinguen entre sí y de los bordes (jerarquía por elevación y borde)', () => {
    expect(ratio(t, 'surface', 'bg')).toBeGreaterThan(1.02)
    expect(ratio(t, 'surface-2', 'surface')).toBeGreaterThan(1.05)
    expect(ratio(t, 'surface-3', 'surface-2')).toBeGreaterThan(1.05)
    expect(ratio(t, 'line', 'surface')).toBeGreaterThan(1.1)
    expect(ratio(t, 'line-strong', 'surface')).toBeGreaterThanOrEqual(1.5)
  })
})

describe('modo oscuro: azul medianoche, nunca negro puro', () => {
  it('el fondo y las superficies son índigo (el azul domina) y no negro', () => {
    for (const k of ['bg', 'surface', 'surface-2', 'surface-3']) {
      const [r, g, b] = rgb(oscuro, k)
      expect(b, `--${k}`).toBeGreaterThan(r + 25)
      expect(b, `--${k}`).toBeGreaterThan(g + 25)
      expect(r + g + b, `--${k}`).toBeGreaterThan(60) // no negro
    }
  })
  it('usa la paleta de marca: Midnight Navy de fondo y Deep Indigo de superficie', () => {
    expect(oscuro.bg).toBe(claro['aur-medianoche'])
    expect(oscuro.surface).toBe(claro['aur-indigo'])
  })
})

describe('modo claro: lavanda muy claro con superficies blancas', () => {
  it('el fondo no es blanco plano y la superficie sí es blanca', () => {
    expect(claro.bg).not.toBe('#ffffff')
    expect(claro.surface).toBe('#ffffff')
    const [r, , b] = rgb(claro, 'bg')
    expect(b).toBeGreaterThan(r) // matiz lavanda
  })
})

describe('capa semántica completa', () => {
  const nombres = [
    'background-primary', 'background-secondary', 'background-tertiary',
    'surface-primary', 'surface-secondary', 'surface-elevated', 'surface-overlay', 'surface-hover', 'surface-selected', 'surface-disabled',
    'text-primary', 'text-secondary', 'text-tertiary', 'text-inverse', 'text-disabled', 'text-link',
    'border-default', 'border-subtle', 'border-strong', 'border-focus', 'border-selected', 'border-error',
    'brand-primary', 'brand-secondary', 'brand-accent', 'brand-gradient', 'brand-hover', 'brand-pressed',
    ...['success', 'warning', 'danger', 'info', 'neutral'].flatMap((e) => ['bg', 'fg', 'border', 'icon'].map((v) => `${e}-${v}`)),
    ...Array.from({ length: 8 }, (_, i) => `chart-series-${i + 1}`),
    'chart-grid', 'chart-axis', 'chart-tooltip', 'chart-highlight', 'chart-positive', 'chart-negative',
    'shadow-sm', 'shadow-md', 'shadow-lg', 'transition-fast', 'transition-normal', 'focus-ring',
  ]
  it.each(nombres)('--%s existe', (n) => expect(claro[n], `--${n}`).toBeTruthy())
  it('las series de los gráficos son ocho colores distintos y las del tema oscuro son más claras', () => {
    const c = Array.from({ length: 8 }, (_, i) => claro[`chart-series-${i + 1}`])
    expect(new Set(c).size).toBe(8)
    const lum = (t: Record<string, string>, k: string) => { const [r, g, b] = rgb(t, k); return r + g + b }
    for (let i = 1; i <= 8; i++) expect(lum(oscuro, `chart-series-${i}`)).toBeGreaterThan(lum(claro, `chart-series-${i}`) - 40)
    for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) expect(ratio(oscuro, `chart-series-${i}` as never, 'surface')).toBeGreaterThanOrEqual(3) // legibles sobre la superficie oscura
  })
  it('las series se leen sobre la superficie clara (≥ 3:1, WCAG 1.4.11)', () => {
    for (let i = 1; i <= 8; i++) expect(ratio(claro, `chart-series-${i}`, 'surface')).toBeGreaterThanOrEqual(3)
  })
})

describe('acentos de color (.acento-*)', () => {
  const ACENTOS: Record<string, string> = { indigo: 'Índigo', blue: 'Azul', sky: 'Celeste', teal: 'Teal', amber: 'Ámbar', orange: 'Naranja', red: 'Rojo', violet: 'Violeta', slate: 'Pizarra', green: 'Verde' }
  const decl = (selector: string) => {
    const i = css.indexOf(selector + ' {')
    if (i < 0) throw new Error(`No se encontró ${selector}`)
    return Object.fromEntries([...css.slice(i, css.indexOf('}', i)).matchAll(/--(a[\w-]*):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]))
  }
  it.each(Object.entries(ACENTOS))('.acento-%s sale de la paleta y de domain/color.ts en ambos temas (no se editan a mano)', (clave, nombre) => {
    const hex = PALETA.find((c) => c.nombre === nombre)!.hex
    for (const [tema, selector] of [['claro', `.acento-${clave}`], ['oscuro', `:root[data-theme='dark'] .acento-${clave}`]] as const) {
      const t = tonos(hex, tema)!
      const d = decl(selector)
      expect(d, `${selector}`).toMatchObject({ 'a-soft': t.suave, 'a-bd': t.borde, 'a-ic': t.icono, 'a-fg': t.texto })
    }
  })
})

describe('los componentes no escriben colores a mano', () => {
  const archivos = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(join(d, e.name)) : [join(d, e.name)]))
  /** Excepciones justificadas: logotipos de terceros (colores de marca ajenos), el tile del isotipo y la barra del navegador. */
  const PERMITIDOS = ['LogosSociales.tsx', 'BrandLogo.tsx', 'ThemeProvider.tsx', 'SelectorColor.tsx']
  it('ningún .tsx fuera de la lista usa un HEX: todo color sale de un token', () => {
    const con = archivos('src')
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.') && !PERMITIDOS.some((p) => f.endsWith(p)))
      .filter((f) => /#[0-9a-fA-F]{6}/.test(readFileSync(f, 'utf8')))
    expect(con).toEqual([])
  })
})
