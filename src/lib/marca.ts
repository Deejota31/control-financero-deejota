/**
 * Identidad del producto en UN solo lugar: nombre, eslogan, descripción y títulos de pestaña.
 * Para cambiar la marca en el futuro se edita aquí (y los recursos de public/); ningún componente escribe el nombre a mano.
 * Los identificadores técnicos (proyecto de Supabase, repositorio, claves) NO dependen de este nombre.
 */
export const MARCA = {
  nombre: 'Control Financiero',
  eslogan: 'Tus finanzas, bajo control.',
  descripcion: 'Organiza tus gastos, planifica tus presupuestos y toma mejores decisiones sobre tu dinero desde un solo lugar.',
  /** Prefijo de los archivos que descarga la persona (exportaciones). */
  archivo: 'control-financiero',
} as const

/** Título de pestaña: «Gastos | Control Financiero»; sin sección, solo el nombre. */
export function tituloPagina(seccion?: string | null): string {
  return seccion ? `${seccion} | ${MARCA.nombre}` : MARCA.nombre
}
