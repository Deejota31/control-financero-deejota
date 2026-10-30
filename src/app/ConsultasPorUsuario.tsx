import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { crearQueryClient } from '@/lib/consultas'

/**
 * Un QueryClient por identidad. Al cambiar de usuario (o cerrar sesión) se crea uno nuevo EN EL MISMO RENDER, de modo que ni siquiera
 * un fotograma puede leer la caché del anterior (invalidar no basta: los datos viejos seguirían en memoria hasta el refetch).
 * El cliente anterior se cancela y se vacía al desmontarse, también las consultas con `staleTime` largo.
 */
export function ConsultasPorUsuario({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.id ?? null
  // `uid` define la identidad del cliente aunque no se lea dentro de la función.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cliente = useMemo(() => crearQueryClient(), [uid])
  useEffect(() => () => { void cliente.cancelQueries(); cliente.clear() }, [cliente])
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}
