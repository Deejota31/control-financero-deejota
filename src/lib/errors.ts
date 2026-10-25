interface PgLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
  name?: string
}

const MENSAJES: Record<string, string> = {
  GD001: 'Ningún fondo admite esta combinación de clasificación y medio de pago.',
  GD002: 'El período está cerrado y su histórico no se modifica.',
  GD003: 'Esa plantilla ya está registrada en este período.',
  GD004: 'No se encontró el registro. Puede que ya no exista.',
  GD005: 'Restaura el gasto antes de editarlo.',
  GD006: 'Un fondo específico necesita al menos un ámbito, categoría o subcategoría incluido.',
  GD007: 'No se puede cerrar un período que aún no terminó.',
  GD008: 'Falta el importe de una plantilla.',
  GD009: 'La ruta del comprobante no es válida.',
  '23505': 'Ya existe un registro con ese nombre.',
  '23503': 'Esa opción está en uso o no es válida. Desactívala en lugar de eliminarla.',
  '23514': 'Algún dato no cumple las reglas de validación.',
  '42501': 'No tienes permiso para esa acción.',
}

export function esErrorDeRed(err: unknown): boolean {
  const e = err as PgLikeError | undefined
  if (!e) return false
  const msg = `${e.message ?? ''} ${e.name ?? ''}`
  return /Failed to fetch|NetworkError|Load failed|fetch failed|AuthRetryableFetchError/i.test(msg)
}

/** Mensaje comprensible para el usuario. Mantiene el texto del servidor cuando es una regla de negocio propia. */
export function mensajeDeError(err: unknown, porDefecto = 'No se pudo completar la acción. Inténtalo de nuevo.'): string {
  if (esErrorDeRed(err)) return 'Sin conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.'
  const e = err as PgLikeError | undefined
  const code = e?.code
  if (code && code.startsWith('GD') && e?.message && code !== 'GD004') return e.message
  if (code && MENSAJES[code]) return MENSAJES[code]
  return porDefecto
}

export function codigoDeError(err: unknown): string | undefined {
  return (err as PgLikeError | undefined)?.code
}
