/**
 * Registro de formularios con cambios sin guardar. Los diálogos con `sucio` se anotan aquí mientras están abiertos; así cualquier parte de la
 * aplicación (p. ej. la actualización de versión) puede saber si recargar la página haría perder trabajo de la persona.
 */
const abiertos = new Set<symbol>()

/** Marca un formulario como «con cambios». Devuelve la función que lo libera. */
export function registrarCambiosPendientes(): () => void {
  const id = Symbol('cambios-pendientes')
  abiertos.add(id)
  return () => void abiertos.delete(id)
}

export const hayCambiosPendientes = () => abiertos.size > 0
