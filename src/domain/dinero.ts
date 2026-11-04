/**
 * Importes monetarios exactos. La base de datos guarda `numeric(12,2)`; en JavaScript los decimales binarios acumulan error
 * (0.1 + 0.2 ≠ 0.3), así que toda suma de importes se hace en CÉNTIMOS ENTEROS y solo se convierte a soles al final.
 * Las divisiones (promedios, porcentajes, proyecciones) se redondean una sola vez, al presentar el resultado.
 */

/** Soles → céntimos enteros. El épsilon evita que 1.005 · 100 = 100.49999… se redondee hacia abajo. */
export const aCentimos = (soles: number | string): number => {
  const n = Number(soles)
  return Math.round((n + Math.sign(n) * Number.EPSILON) * 100)
}

/** Céntimos enteros → soles con a lo sumo dos decimales. */
export const deCentimos = (centimos: number): number => Math.round(centimos) / 100

/** Redondeo monetario a dos decimales (mitad hacia arriba en valor absoluto). */
export const redondear = (soles: number): number => deCentimos(aCentimos(soles))

/** Suma exacta de una lista de importes. */
export const sumar = (importes: Iterable<number | string>): number => {
  let c = 0
  for (const x of importes) c += aCentimos(x)
  return deCentimos(c)
}

/**
 * Reparte `total` en `partes` importes que suman EXACTAMENTE `total` (el sobrante de céntimos se reparte de uno en uno desde la primera parte).
 * Útil para dividir un importe entre varios fondos sin que aparezcan ni desaparezcan céntimos.
 */
export function repartirIgual(total: number, partes: number): number[] {
  if (partes <= 0) return []
  const c = aCentimos(total)
  const base = Math.trunc(c / partes)
  const resto = c - base * partes
  return Array.from({ length: partes }, (_, i) => deCentimos(base + (i < Math.abs(resto) ? Math.sign(resto) : 0)))
}
