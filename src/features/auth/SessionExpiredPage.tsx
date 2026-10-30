import { Link } from 'react-router'
import { AuthShell } from './AuthShell'

export function SessionExpiredPage() {
  return (
    <AuthShell title="Tu sesión venció" subtitle="Por seguridad cerramos la sesión. Tus datos no se perdieron.">
      <Link to="/acceso" className="inline-flex w-fit rounded-md bg-pri px-4 py-2 text-sm font-semibold text-pri-fg">
        Iniciar sesión de nuevo
      </Link>
    </AuthShell>
  )
}
