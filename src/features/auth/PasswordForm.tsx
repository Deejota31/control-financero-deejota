import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { newPasswordSchema, type NewPasswordValues } from './schemas'

/** Formulario de contraseña nueva, compartido por restablecimiento y configuración. */
export function PasswordForm({ submitLabel, onDone }: { submitLabel: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(
          err.code === 'same_password'
            ? 'La contraseña nueva debe ser distinta de la actual.'
            : err.code === 'weak_password'
              ? 'La contraseña es demasiado débil. Usa letras, números y más caracteres.'
              : 'No se pudo actualizar la contraseña. Inténtalo de nuevo.',
        )
        return
      }
      reset()
      onDone()
    } catch {
      setError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Contraseña nueva" error={errors.password?.message} hint="Mínimo 8 caracteres.">
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
      </Field>
      <Field label="Repite la contraseña" error={errors.confirm?.message}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
      </Field>
      <Button type="submit" loading={isSubmitting}>
        {isSubmitting ? 'Guardando…' : submitLabel}
      </Button>
    </form>
  )
}
