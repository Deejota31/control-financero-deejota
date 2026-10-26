import { ALIAS_ICONOS, ICONOS_CATALOGO, SECCIONES_ICONOS, type IconoCatalogo } from './iconosCatalogo'

/** Minúsculas, sin tildes ni signos y con espacios simples: «  Barbería » → «barberia». */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Palabras que no identifican nada por sí solas. */
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'u', 'en', 'a', 'al', 'por', 'para', 'con', 'sin', 'un', 'una', 'mi', 'mis', 'su', 'gasto', 'gastos', 'pago', 'pagos'])
/** Palabras amplias: sirven, pero pesan menos que una coincidencia específica. */
const GENERICAS = new Set(['servicio', 'servicios', 'general', 'varios', 'compras', 'casa', 'otro', 'viaje', 'cuidado', 'mantenimiento', 'cuenta', 'equipo', 'lugar'])

export interface Sugerencia { id: string; nombre: string; puntaje: number }

interface Indice { icono: IconoCatalogo; claves: { clave: string; palabras: number; principal: boolean }[] }

const INDICE: Indice[] = ICONOS_CATALOGO.map((icono) => {
  const claves = [normalizar(icono.nombre), ...icono.palabras.map(normalizar)]
  return { icono, claves: Array.from(new Set(claves)).filter(Boolean).map((clave, i) => ({ clave, palabras: clave.split(' ').length, principal: i <= 1 })) }
})

/** Prefijo común (para tolerar singular/plural y derivados: «vehicular» ~ «vehiculo»). */
function prefijoComun(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function puntuar(nombre: string, tokens: string[], idx: Indice): number {
  let mejor = 0
  const encontrados: number[] = []
  for (const { clave, palabras, principal } of idx.claves) {
    let p = 0
    if (nombre === clave) p = 100
    else if (palabras >= 2 && ` ${nombre} `.includes(` ${clave} `)) p = 80 + 5 * palabras
    else if (palabras === 1) {
      if (tokens.includes(clave)) p = 60
      else if (clave.length >= 4 && tokens.some((t) => t.length >= 4 && prefijoComun(t, clave) >= Math.min(5, Math.min(t.length, clave.length)))) p = 35
    } else if (palabras >= 2 && clave.split(' ').every((w) => tokens.includes(w))) p = 70
    if (p === 0) continue
    if (GENERICAS.has(clave)) p *= 0.4
    if (!principal) p *= 0.97
    encontrados.push(p)
    mejor = Math.max(mejor, p)
  }
  // Varias coincidencias distintas refuerzan (sin superar una coincidencia exacta del nombre completo)
  encontrados.sort((a, b) => b - a)
  return mejor + (encontrados[1] ?? 0) * 0.15
}

/** Íconos de uso general cuando el nombre no dice nada. */
export const ICONOS_GENERALES = ['tag', 'shapes', 'star', 'wallet', 'clipboard-list'] as const

/**
 * Sugiere entre 3 y 5 íconos a partir del nombre (y, si existe, del nombre del elemento padre). Todo es local:
 * sinónimos, sin tildes ni mayúsculas, y prioriza coincidencias específicas sobre palabras amplias.
 */
export function sugerirIconos(nombre: string, padre?: string | null, max = 5): Sugerencia[] {
  const n = normalizar(nombre)
  const tokens = n.split(' ').filter((t) => t && !VACIAS.has(t))
  const ctx = padre ? normalizar(padre).split(' ').filter((t) => t && !VACIAS.has(t)) : []
  const puntajes = new Map<string, number>()
  if (tokens.length) {
    for (const idx of INDICE) {
      let p = puntuar(n, tokens, idx)
      if (ctx.length) {
        const pc = puntuar(normalizar(padre ?? ''), ctx, idx)
        p = p > 0 ? p + pc * 0.2 : pc > 0 ? Math.min(20, pc * 0.25) : 0
      }
      if (p >= 12) puntajes.set(idx.icono.id, p)
    }
  }
  const lista = Array.from(puntajes, ([id, puntaje]) => ({ id, puntaje }))
    .sort((a, b) => b.puntaje - a.puntaje || a.id.localeCompare(b.id))
    .slice(0, max)
    .map(({ id, puntaje }) => ({ id, nombre: ICONOS_CATALOGO.find((i) => i.id === id)!.nombre, puntaje: Math.round(puntaje) }))
  if (lista.length >= 3) return lista
  // Completa con opciones generales (sin repetir)
  const generales = ICONOS_GENERALES.filter((g) => !lista.some((l) => l.id === g)).map((id) => ({ id, nombre: nombreDe(id), puntaje: 0 }))
  return [...lista, ...generales].slice(0, Math.max(3, Math.min(max, lista.length + 3)))
}

export function nombreDe(id: string): string {
  const k = ALIAS_ICONOS[id] ?? id
  return ICONOS_CATALOGO.find((i) => i.id === k)?.nombre ?? (k === 'tag' ? 'Etiqueta' : k === 'circle-ellipsis' ? 'Otros' : k)
}

/** Búsqueda por nombre y sinónimos (ignora tildes y mayúsculas). Con consulta vacía devuelve todo. */
export function buscarIconos(consulta: string, seccion?: string | null): IconoCatalogo[] {
  const q = normalizar(consulta)
  const base = seccion ? ICONOS_CATALOGO.filter((i) => i.seccion === seccion) : ICONOS_CATALOGO
  if (!q) return base
  const palabras = q.split(' ')
  return INDICE.filter((idx) => base.includes(idx.icono))
    .map((idx) => {
      const texto = idx.claves.map((c) => c.clave).join(' | ')
      const todas = palabras.every((w) => texto.includes(w))
      const exacta = idx.claves.some((c) => c.clave === q)
      const empieza = idx.claves.some((c) => c.clave.startsWith(q) || c.clave.split(' ').some((w) => w.startsWith(q)))
      return { icono: idx.icono, puntaje: todas ? (exacta ? 3 : empieza ? 2 : 1) : 0 }
    })
    .filter((x) => x.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .map((x) => x.icono)
}

export { SECCIONES_ICONOS }
