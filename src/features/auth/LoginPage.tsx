import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { InputConIcono } from '@/components/ui/InputConIcono'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { env } from '@/lib/supabase'
import { AccesoSocial } from './AccesoSocial'
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
    <AuthShell title="Bienvenido de nuevo" subtitle="Ingresa a tu cuenta para continuar." tituloPestana="Iniciar sesión">
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
        <Field label="Correo electrónico" error={errors.email?.message}>
          {(p) => <InputConIcono {...p} icono={Mail} type="email" autoComplete="username" placeholder="tu@correo.com" className="campo-login" {...register('email')} />}
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          {(p) => <PasswordInput {...p} icono={Lock} autoComplete="current-password" placeholder="Tu contraseña" className="campo-login" {...register('password')} />}
        </Field>
        <div className="-mt-1 flex justify-end">
          <Link to="/recuperar" className="rounded text-sm font-medium text-[var(--esc-texto)] underline decoration-[var(--esc-icono-borde)] underline-offset-4 hover:decoration-[var(--esc-linea)]">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Button type="submit" variant="marca" loading={isSubmitting} className="h-[3.25rem] w-full rounded-xl text-[15px]">
          {isSubmitting ? 'Iniciando sesión…' : <>Iniciar sesión <ArrowRight className="size-4" aria-hidden="true" /></>}
        </Button>
      </form>
      {/* Solo visual por ahora: sin OAuth, SDK ni redirecciones (ver AccesoSocial). */}
      <AccesoSocial />
    </AuthShell>
  )
}
