import { QueryClient } from '@tanstack/react-query'

/**
 * Consultas: fábrica del cliente y claves/invalidaciones compartidas.
 * Cada sesión usa su propio QueryClient (ver app/ConsultasPorUsuario): los datos de un usuario nunca llegan a la caché de otro.
 */
export const crearQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

/** Claves de datos propios de la persona o del hogar: incluyen la identidad aunque el cliente ya sea por sesión (defensa en profundidad). */
export const claves = {
  hogar: (uid: string | undefined) => ['hogar', uid ?? null] as const,
  perfil: (uid: string | undefined) => ['perfil', uid ?? null] as const,
}

/** Dominios que un cambio financiero deja obsoletos. Se listan por operación: no se invalida todo por costumbre. */
export const DOMINIOS = {
  fondos: ['fondos', 'gastos', 'periodo', 'dashboard', 'planificacion'],
  plantillasFondos: ['plantillas-fondos', 'fondos', 'periodo', 'dashboard', 'planificacion', 'gastos'],
  gastos: ['gastos', 'fondos', 'dashboard', 'salud', 'plantillas'],
  plantillasGastos: ['plantillas', 'gastos', 'fondos', 'dashboard', 'salud'],
} as const

export function invalidar(qc: QueryClient, dominios: readonly string[]) {
  return Promise.all(dominios.map((k) => qc.invalidateQueries({ queryKey: [k] })))
}
