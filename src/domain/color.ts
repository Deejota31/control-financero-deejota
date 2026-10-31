/** Colores del Catálogo y de los fondos: paleta de 36, conversiones HEX/RGB/HSV y tratamiento por tema con contraste garantizado. */

/** Paleta de 36 colores en seis familias (fríos, verdes, cálidos, rojos y rosas, violetas y neutros). */
export const FAMILIAS_COLOR = ["Azules","Verdes","Cálidos","Rojos y rosas","Violetas","Neutros"] as const
export const PALETA = [
  { nombre: 'Índigo', hex: '#4F46E5', familia: 'Azules' },
  { nombre: 'Azul', hex: '#2563EB', familia: 'Azules' },
  { nombre: 'Celeste', hex: '#0EA5E9', familia: 'Azules' },
  { nombre: 'Turquesa', hex: '#06B6D4', familia: 'Azules' },
  { nombre: 'Cobalto', hex: '#1D4ED8', familia: 'Azules' },
  { nombre: 'Marino', hex: '#1E40AF', familia: 'Azules' },
  { nombre: 'Teal', hex: '#0D9488', familia: 'Verdes' },
  { nombre: 'Esmeralda', hex: '#059669', familia: 'Verdes' },
  { nombre: 'Verde', hex: '#16A34A', familia: 'Verdes' },
  { nombre: 'Lima', hex: '#65A30D', familia: 'Verdes' },
  { nombre: 'Oliva', hex: '#7C8B2A', familia: 'Verdes' },
  { nombre: 'Menta', hex: '#10B981', familia: 'Verdes' },
  { nombre: 'Amarillo', hex: '#CA8A04', familia: 'Cálidos' },
  { nombre: 'Ámbar', hex: '#D97706', familia: 'Cálidos' },
  { nombre: 'Naranja', hex: '#EA580C', familia: 'Cálidos' },
  { nombre: 'Coral', hex: '#F0614E', familia: 'Cálidos' },
  { nombre: 'Terracota', hex: '#B45309', familia: 'Cálidos' },
  { nombre: 'Mostaza', hex: '#A16207', familia: 'Cálidos' },
  { nombre: 'Rojo', hex: '#DC2626', familia: 'Rojos y rosas' },
  { nombre: 'Carmesí', hex: '#BE123C', familia: 'Rojos y rosas' },
  { nombre: 'Rosa', hex: '#DB2777', familia: 'Rojos y rosas' },
  { nombre: 'Magenta', hex: '#C026D3', familia: 'Rojos y rosas' },
  { nombre: 'Frambuesa', hex: '#9D174D', familia: 'Rojos y rosas' },
  { nombre: 'Rubí', hex: '#E11D48', familia: 'Rojos y rosas' },
  { nombre: 'Violeta', hex: '#7C3AED', familia: 'Violetas' },
  { nombre: 'Púrpura', hex: '#7E22CE', familia: 'Violetas' },
  { nombre: 'Lavanda', hex: '#8B5CF6', familia: 'Violetas' },
  { nombre: 'Ciruela', hex: '#6B21A8', familia: 'Violetas' },
  { nombre: 'Orquídea', hex: '#A855F7', familia: 'Violetas' },
  { nombre: 'Berenjena', hex: '#581C87', familia: 'Violetas' },
  { nombre: 'Pizarra', hex: '#64748B', familia: 'Neutros' },
  { nombre: 'Grafito', hex: '#374151', familia: 'Neutros' },
  { nombre: 'Piedra', hex: '#78716C', familia: 'Neutros' },
  { nombre: 'Cobre', hex: '#92400E', familia: 'Neutros' },
  { nombre: 'Arena', hex: '#A8A29E', familia: 'Neutros' },
  { nombre: 'Carbón', hex: '#1F2937', familia: 'Neutros' },
] as const

/** Equivalente HEX (tema claro) de los tokens heredados de antes, para calcular tonos de elementos sin color libre. */
export const TOKEN_HEX: Record<string, string> = {
  c1: '#3A3FA6', c2: '#E0622F', c3: '#1E8A8A', c4: '#A8478F', c5: '#8A8A2E', pri: '#3A3FA6', acc: '#B4411F', muted: '#58587A',
}

/** Nombres de los colores heredados de antes (tokens), para no mostrarlos como «Personalizado». */
const NOMBRE_TOKEN: Record<string, string> = { '#3a3fa6': 'Índigo clásico', '#e0622f': 'Naranja', '#1e8a8a': 'Verde azulado', '#a8478f': 'Magenta', '#8a8a2e': 'Oliva', '#b4411f': 'Terracota', '#58587a': 'Gris pizarra' }

/** Identificador estable de un color de la paleta: minúsculas, sin tildes ni espacios. */
export const idDeColor = (nombre: string): string => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

export type Rgb =[number, number, number]
export type Tema = 'claro' | 'oscuro'

const HEX = /^#[0-9A-F]{6}$/

/** Acepta con o sin «#» y en cualquier caja; devuelve #RRGGBB en mayúsculas o null si no es un HEX de 6 dígitos. */
export function normalizarHex(texto: string): string | null {
  const t = texto.trim().toUpperCase()
  const c = t.startsWith('#') ? t : `#${t}`
  return HEX.test(c) ? c : null
}

export function hexARgb(hex: string): Rgb | null {
  const h = normalizarHex(hex)
  if (!h) return null
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbAHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export function rgbAHsv([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min
  let h = 0
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [(h * 60 + 360) % 360, max ? d / max : 0, max]
}

export function hsvARgb([h, s, v]: [number, number, number]): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5) * 255, f(3) * 255, f(1) * 255]
}

function luminancia([r, g, b]: Rgb): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** Relación de contraste WCAG entre dos colores. */
export function contraste(a: Rgb, b: Rgb): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const redondear = (c: Rgb): Rgb => c.map((v) => Math.round(v)) as Rgb
const mezcla = (a: Rgb, b: Rgb, t: number): Rgb => redondear(a.map((v, i) => v + (b[i] - v) * t) as Rgb)

/** Acerca el color al negro (o al blanco) hasta superar el mínimo con los valores ya redondeados a 8 bits y un pequeño margen. */
function ajustar(rgb: Rgb, fondo: Rgb, minimo: number, haciaOscuro: boolean): Rgb {
  let c = rgb
  for (let i = 0; i < 60 && contraste(c, fondo) < minimo + 0.1; i++) c = mezcla(c, haciaOscuro ? [0, 0, 0] : [255, 255, 255], 0.05)
  return c
}

/** Superficies de la aplicación sobre las que se calculan los tonos. */
const BASE: Record<Tema, Rgb> = { claro: [255, 255, 255], oscuro: [24, 26, 92] }

export interface Tonos { suave: string; borde: string; icono: string; texto: string; contrasteTexto: number; contrasteIcono: number }

/**
 * Tratamiento de un color en un tema (misma regla para la paleta y para colores personalizados):
 * claro → fondo 10 % de color sobre blanco, borde 35 %; oscuro → fondo 22 % sobre la superficie, borde 50 %.
 * El texto llega a 4.5:1 sobre el fondo suave y el ícono a 3:1 sobre la superficie, ajustando solo la luminosidad.
 */
export function tonos(hex: string, tema: Tema): Tonos | null {
  const rgb = hexARgb(hex)
  if (!rgb) return null
  const base = BASE[tema], claro = tema === 'claro'
  const suave = mezcla(base, rgb, claro ? 0.1 : 0.22)
  const borde = mezcla(base, rgb, claro ? 0.35 : 0.5)
  const texto = ajustar(rgb, suave, 4.5, claro)
  const fondoIcono = claro ? base : suave
  const icono = ajustar(rgb, fondoIcono, 3, claro)
  return { suave: rgbAHex(suave), borde: rgbAHex(borde), icono: rgbAHex(icono), texto: rgbAHex(texto), contrasteTexto: contraste(texto, suave), contrasteIcono: contraste(icono, fondoIcono) }
}

export function nombreDeColor(hex: string): string {
  const h = hex.toLowerCase()
  return PALETA.find((c) => c.hex.toLowerCase() === h)?.nombre ?? NOMBRE_TOKEN[h] ?? 'Personalizado'
}

interface ConColor { color_hex?: string | null; color_token?: string | null }
interface ConHerencia extends ConColor { color_mode?: string | null }

/** HEX base de un elemento: el libre si existe; si no, el equivalente del token heredado. */
export function hexPropio(it: ConColor): string {
  return it.color_hex ?? TOKEN_HEX[it.color_token ?? ''] ?? TOKEN_HEX.muted
}

/** Color efectivo: una categoría con herencia usa el de su ámbito. */
export function colorEfectivo(it: ConHerencia, ambito?: ConColor | null): { hex: string; origen: 'propio' | 'heredado' } {
  if (it.color_mode === 'inherit' && ambito) return { hex: hexPropio(ambito), origen: 'heredado' }
  return { hex: hexPropio(it), origen: 'propio' }
}

/** Reparte la paleta de forma uniforme entre `n` elementos (para «Armonizar»). */
export function armonizar(n: number): string[] {
  const paso = Math.max(1, Math.floor(PALETA.length / Math.max(1, n)))
  return Array.from({ length: n }, (_, i) => PALETA[(i * paso) % PALETA.length].hex)
}
