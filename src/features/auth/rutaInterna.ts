/** Devuelve `destino` solo si es una ruta interna de la app; en otro caso, la raíz. Evita redirecciones abiertas. */
export function rutaInterna(destino: unknown): string {
  if (typeof destino !== 'string' || destino.length > 2048) return '/'
  if (!destino.startsWith('/') || destino.startsWith('//') || destino.includes('\\')) return '/'
  if ([...destino].some((c) => c.charCodeAt(0) < 32)) return '/'
  return destino
}
