/** Tamaños de página que ofrecen las tablas; cada tabla elige los que admite. */
export const TAMANOS_PAGINA = [10, 20, 50, 100] as const

export const totalPaginas = (total: number, tamano: number) => Math.max(1, Math.ceil(total / Math.max(1, tamano)))

/** Rango visible (1-based) de la página: «1–20 de 83». Con cero resultados es 0–0. */
export function rangoVisible(pagina: number, tamano: number, total: number): { desde: number; hasta: number } {
  if (total <= 0) return { desde: 0, hasta: 0 }
  const desde = (pagina - 1) * tamano + 1
  return { desde, hasta: Math.min(total, pagina * tamano) }
}

/**
 * Números de página que se muestran: siempre la primera, la última y la actual con sus vecinas; el resto se resume con «…». Nunca más de `max` elementos
 * (impar, mínimo 5), así el paginador no crece con el número de páginas.
 */
export function paginasVisibles(actual: number, total: number, max = 7): (number | '…')[] {
  const m = Math.max(5, max)
  if (total <= m) return Array.from({ length: total }, (_, i) => i + 1)
  const hueco = m - 2 // sitios entre la primera y la última, incluidos los «…»
  const cerca = Math.ceil(hueco / 2) + 1
  if (actual < cerca) return [...Array.from({ length: m - 2 }, (_, i) => i + 1), '…', total]
  if (actual > total - cerca + 1) return [1, '…', ...Array.from({ length: m - 2 }, (_, i) => total - (m - 3) + i)]
  const medio = m - 4
  const ini = actual - Math.floor((medio - 1) / 2)
  return [1, '…', ...Array.from({ length: medio }, (_, i) => ini + i), '…', total]
}
