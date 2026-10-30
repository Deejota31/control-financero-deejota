import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { env } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import { AuthShell } from './AuthShell'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [formError, setFormError] = useState<{ message: string; kind?: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    const { error, kind } = await signIn(email, password)
    if (error) {
      setFormError({ message: error, kind })
      return
    }
    navigate(from, { replace: true })
  })

  return (
    <AuthShell title="Iniciar sesión" subtitle="Accede a tu control de gastos.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <Alert tone="error">
            <p>{formError.message}</p>
            {env.appEnv === 'local' && formError.kind === 'credentials' && (
              <p className="mt-1">
                Entorno local: si es tu primera vez o reiniciaste la base, ejecuta <code>npm run db:reset</code> para recrear el usuario demo.
              </p>
            )}
            {env.appEnv === 'local' && formError.kind === 'network' && (
              <p className="mt-1">
                Entorno local: comprueba que Supabase esté en marcha con <code>npm run db:start</code>.
              </p>
            )}
          </Alert>
        )}
        <Field label="Correo" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="username" {...register('email')} />}
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('password')} />}
        </Field>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
        <Link to="/recuperar" className="text-sm font-medium text-pri underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </AuthShell>
  )
}
