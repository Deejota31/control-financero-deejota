import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { FullScreenLoader } from '@/components/ui/Spinner'
import { useAuth } from './AuthProvider'

/** Rutas privadas: solo con sesión activa. */
export function RequireAuth() {
  const { status, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader label="Recuperando tu sesión…" />
  if (status === 'error') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="font-display text-2xl font-bold">No se pudo verificar tu sesión</h1>
        <p className="text-muted">Revisa tu conexión (en local, que Supabase esté en marcha) e inténtalo de nuevo.</p>
        <Button onClick={retry} className="w-fit">
          Reintentar
        </Button>
      </main>
    )
  }
  if (status === 'expired') return <Navigate to="/sesion-expirada" replace />
  if (status === 'unauthenticated') return <Navigate to="/acceso" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Rutas de acceso: si ya hay sesión, se envía al inicio. */
export function PublicOnly() {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
