/**
 * PostgREST limita cada respuesta (`max_rows`, 1000 por defecto) sin avisar. Para métricas financieras nunca se debe
 * trabajar con un resultado parcial como si fuera completo: este lector pagina hasta agotar la consulta y comprueba el
 * total declarado por el servidor; si no coincide, falla en lugar de devolver datos incompletos.
 */
export class ResultadoIncompletoError extends Error {
  constructor(public readonly leidas: number, public readonly esperadas: number | null) {
    super(`Resultado incompleto: se leyeron ${leidas} de ${esperadas ?? 'un número desconocido de'} filas.`)
    this.name = 'ResultadoIncompletoError'
  }
}

export interface PaginaPostgrest<T> {
  data: T[] | null
  error: { message: string } | null
  /** Total exacto (requiere `select('*', { count: 'exact' })`). */
  count?: number | null
}

export async function leerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<PaginaPostgrest<T>>,
  opciones: { tam?: number; maximo?: number } = {},
): Promise<T[]> {
  const tam = opciones.tam ?? 1000
  const maximo = opciones.maximo ?? 1_000_000
  const filas: T[] = []
  let total: number | null = null
  // El desplazamiento avanza según lo que realmente devolvió el servidor, sea cual sea su límite por respuesta.
  for (let desde = 0; ; desde = filas.length) {
    const { data, error, count } = await pagina(desde, desde + tam - 1)
    if (error) throw error
    if (desde === 0 && typeof count === 'number') total = count
    const recibidas = data?.length ?? 0
    filas.push(...(data ?? []))
    if (recibidas === 0) break
    if (total !== null && filas.length >= total) break
    if (filas.length >= maximo) throw new ResultadoIncompletoError(filas.length, total)
  }
  if (total !== null && filas.length !== total) throw new ResultadoIncompletoError(filas.length, total)
  return filas
}
