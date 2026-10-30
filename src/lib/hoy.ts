/** Fecha de hoy (yyyy-MM-dd) en una zona horaria; si la zona no es válida se usa la del navegador. */
export function hoyEnZona(zona?: string | null, ahora = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zona || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
  }
}
