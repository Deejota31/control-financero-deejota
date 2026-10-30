import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { FullScreenLoader } from '@/components/ui/Spinner'
import { useAuth } from './AuthProvider'
import { AuthShell } from './AuthShell'
import { PasswordForm } from './PasswordForm'

/** Destino del enlace del correo: Supabase crea una sesión temporal de recuperación. */
export function ResetPasswordPage() {
  const { status } = useAuth()
  const navigate = useNavigate()

  if (status === 'loading') return <FullScreenLoader label="Validando el enlace…" />

  if (status !== 'authenticated') {
    return (
      <AuthShell title="Enlace no válido">
        <Alert tone="error">Este enlace venció o ya se usó. Solicita uno nuevo para restablecer tu contraseña.</Alert>
        <Link to="/recuperar" className="text-sm font-medium text-pri underline">
          Solicitar un enlace nuevo
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Crea tu contraseña nueva">
      <PasswordForm
        submitLabel="Guardar contraseña"
        onDone={() => {
          toast.success('Contraseña actualizada.')
          navigate('/', { replace: true })
        }}
      />
    </AuthShell>
  )
}
