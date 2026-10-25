import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { env, supabase } from '@/lib/supabase'
import { AuthShell } from './AuthShell'
import { recoverSchema, type RecoverValues } from './schemas'

export function RecoverPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoverValues>({ resolver: zodResolver(recoverSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/restablecer` })
      // Respuesta neutra: no revela si el correo existe.
      if (err && err.status !== 400 && err.code !== 'user_not_found') {
        setError(err.status === 429 ? 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' : 'No se pudo enviar el enlace. Inténtalo de nuevo.')
        return
      }
      setSent(true)
    } catch {
      setError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
    }
  })

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una contraseña nueva.">
      {sent ? (
        <div className="flex flex-col gap-3">
          <Alert tone="success">Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.</Alert>
          {env.appEnv === 'local' && (
            <p className="text-sm text-muted">
              Entorno local: los correos llegan a Mailpit en <code>http://127.0.0.1:54324</code>.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Correo" error={errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
          </Field>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
      <Link to="/acceso" className="text-sm font-medium text-pri underline">
        Volver a iniciar sesión
      </Link>
    </AuthShell>
  )
}
