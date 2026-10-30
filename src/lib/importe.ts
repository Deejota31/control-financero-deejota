/** Máximo representable en las columnas numeric(14,2) de la base: 999 999 999 999,99 (en céntimos). */
export const IMPORTE_MAX_CENTIMOS = 99_999_999_999_999

export type ResultadoImporte = { ok: true; centimos: number; valor: number } | { ok: false; error: string }

const GRUPOS_MILES = /^\d{1,3}(?:[ ,.]\d{3})*$/
const MAXIMO = 'El importe supera el máximo permitido (999 999 999 999,99).'

/**
 * Contrato de importes escritos por el usuario (soles). Se aceptan:
 *  - decimal con coma o punto y 1–2 decimales: "12,50", "12.5", ",5";
 *  - miles explícitos: "1,234.56", "1.234,56", "1 234,56", "1,234,567" (grupos de 3 y, si hay decimales, un separador distinto);
 *  - prefijo "S/" y espacios alrededor.
 * Se rechazan, con un mensaje, las entradas ambiguas ("1,250": ¿mil doscientos cincuenta o uno con 250 milésimas?), las agrupaciones mal
 * formadas, más de 2 decimales, signos, texto, y lo que excede la columna numeric(14,2). Nunca se adivina: ante la duda se pide corregir.
 * El resultado se calcula en céntimos enteros para no arrastrar errores de coma flotante.
 */
export function analizarImporte(texto: string, opciones: { permitirCero?: boolean } = {}): ResultadoImporte {
  const t = texto.replace(/S\//gi, '').replace(/[\s  ]+/g, ' ').trim()
  const fallo = (error: string): ResultadoImporte => ({ ok: false, error })
  if (t === '') return fallo('Ingresa el importe.')
  if (/^[-−+]/.test(t)) return fallo('El importe no puede llevar signo ni ser negativo.')
  if (!/^[\d ,.]+$/.test(t)) return fallo('Usa solo números, coma o punto decimal (por ejemplo 12,50).')
  if (/ (?=[,.])|(?<=[,.]) /.test(t)) return fallo('Hay espacios junto al separador decimal.')

  const comas = (t.match(/,/g) ?? []).length, puntos = (t.match(/\./g) ?? []).length
  let entero: string, decimales = ''
  if (comas && puntos) {
    // El último separador es el decimal; el otro solo puede ser de miles.
    const dec = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.'
    if ((dec === ',' ? comas : puntos) > 1) return fallo('El importe mezcla separadores de forma ambigua. Escríbelo como 1234,50.')
    const [i, d] = t.split(dec)
    if (!GRUPOS_MILES.test(i)) return fallo('El separador de miles está mal colocado (grupos de 3 cifras).')
    if (d.length === 0) return fallo('Falta la parte decimal después del separador.')
    if (d.length > 2) return fallo('Máximo 2 decimales.')
    entero = i.replace(/[ ,.]/g, ''); decimales = d
  } else if (comas + puntos > 0) {
    const sep = comas ? ',' : '.', veces = comas || puntos
    if (veces > 1) {
      if (!GRUPOS_MILES.test(t) || t.includes(sep === ',' ? '.' : ',')) return fallo('Formato de importe no válido: repites el separador sin que sean miles.')
      entero = t.replace(/[ ,.]/g, '')
    } else {
      const [i, d] = t.split(sep)
      if (d.length === 0) return fallo('Falta la parte decimal después del separador.')
      if (d.length === 3 && /^\d{1,3}$/.test(i.replace(/ /g, ''))) return fallo(`«${t}» es ambiguo: escribe ${i}${d} (sin separador) si son miles, o ${i}${sep}${d.slice(0, 2)} si son decimales.`)
      if (d.length > 2) return fallo('Máximo 2 decimales.')
      if (i.includes(' ') && !GRUPOS_MILES.test(i)) return fallo('Formato de importe no válido.')
      entero = i.replace(/ /g, ''); decimales = d
    }
  } else {
    if (t.includes(' ') && !GRUPOS_MILES.test(t)) return fallo('Formato de importe no válido.')
    entero = t.replace(/ /g, '')
  }
  const e = entero.replace(/^0+(?=\d)/, '') || '0'
  if (e.length > 12) return fallo(MAXIMO)
  const centimos = Number(e) * 100 + Number((decimales + '00').slice(0, 2))
  if (centimos > IMPORTE_MAX_CENTIMOS) return fallo(MAXIMO)
  if (centimos === 0 && !opciones.permitirCero) return fallo('El importe debe ser mayor que 0.')
  return { ok: true, centimos, valor: centimos / 100 }
}

/** Importe > 0 de un texto escrito por el usuario, o null si no cumple el contrato de `analizarImporte`. */
export function parseImporte(texto: string): number | null {
  const r = analizarImporte(texto)
  return r.ok ? r.valor : null
}

/** Como `parseImporte` pero admite 0 (presupuestos de fondos). */
export function parseMontoNoNegativo(texto: string): number | null {
  const r = analizarImporte(texto, { permitirCero: true })
  return r.ok ? r.valor : null
}

/** Mensaje de error de un importe (o null si es válido), para validaciones de formularios. */
export function errorImporte(texto: string, opciones: { permitirCero?: boolean } = {}): string | null {
  const r = analizarImporte(texto, opciones)
  return r.ok ? null : r.error
}

/** Suma de importes en céntimos enteros (evita 0.1 + 0.2 ≠ 0.3). */
export function sumarImportes(valores: number[]): number {
  return valores.reduce((a, v) => a + Math.round(v * 100), 0) / 100
}
