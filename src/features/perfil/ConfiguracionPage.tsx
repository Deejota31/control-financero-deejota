import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { useAuth } from '@/features/auth/AuthProvider'
import { PasswordForm } from '@/features/auth/PasswordForm'
import { useTema } from '@/features/tema/ThemeProvider'
import { FORMATOS_FECHA, perfilSchema, zonasHorarias, type PerfilValues } from './perfil'
import { useActualizarPerfil, usePerfil } from './usePerfil'

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-bold">{titulo}</h2>
      {children}
    </section>
  )
}

export function ConfiguracionPage() {
  const { user, signOut } = useAuth()
  const perfil = usePerfil()
  const actualizar = useActualizarPerfil()
  const { setTema } = useTema()
  const zonas = useMemo(() => zonasHorarias(), [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PerfilValues>({ resolver: zodResolver(perfilSchema) })

  useEffect(() => {
    if (perfil.data) {
      reset({
        display_name: perfil.data.display_name ?? '',
        timezone: perfil.data.timezone,
        date_format: perfil.data.date_format as PerfilValues['date_format'],
        theme: perfil.data.theme as PerfilValues['theme'],
      })
    }
  }, [perfil.data, reset])

  const onSubmit = handleSubmit((values) =>
    actualizar.mutateAsync(values).then(
      () => {
        setTema(values.theme)
        toast.success('Perfil guardado.')
      },
      () => toast.error('No se pudo guardar el perfil. Inténtalo de nuevo.'),
    ),
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Seccion titulo="Perfil">
        {perfil.isPending && (
          <div role="status" className="flex flex-col gap-3" aria-label="Cargando perfil">
            <div className="h-9 animate-pulse rounded-md bg-surface-2" />
            <div className="h-9 animate-pulse rounded-md bg-surface-2" />
          </div>
        )}
        {perfil.isError && (
          <div className="flex flex-col gap-3">
            <Alert tone="error">No se pudo cargar tu perfil.</Alert>
            <Button variant="secondary" className="w-fit" onClick={() => perfil.refetch()}>
              Reintentar
            </Button>
          </div>
        )}
        {perfil.data && (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Field label="Nombre" error={errors.display_name?.message}>
              {(p) => <Input {...p} autoComplete="name" {...register('display_name')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Zona horaria" error={errors.timezone?.message}>
                {(p) => (
                  <Select {...p} {...register('timezone')}>
                    {!zonas.includes(perfil.data.timezone) && <option value={perfil.data.timezone}>{perfil.data.timezone}</option>}
                    {zonas.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Formato de fecha">
                {(p) => (
                  <Select {...p} {...register('date_format')}>
                    {FORMATOS_FECHA.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Tema">
                {(p) => (
                  <Select {...p} {...register('theme')}>
                    <option value="claro">Claro</option>
                    <option value="oscuro">Oscuro</option>
                  </Select>
                )}
              </Field>
              <Field label="Moneda de visualización" hint="Soles peruanos. No hay conversión de monedas.">
                {(p) => <Input {...p} value="PEN (S/)" readOnly />}
              </Field>
            </div>
            <Button type="submit" loading={actualizar.isPending} disabled={!isDirty} className="w-fit">
              {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </form>
        )}
      </Seccion>

      <Seccion titulo="Cuenta">
        <dl className="grid gap-1 text-sm">
          <dt className="text-muted">Correo de acceso</dt>
          <dd className="font-medium">{user?.email}</dd>
        </dl>
        <Button variant="secondary" className="w-fit" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </Seccion>

      <Seccion titulo="Cambiar contraseña">
        <PasswordForm submitLabel="Cambiar contraseña" onDone={() => toast.success('Contraseña actualizada.')} />
      </Seccion>
    </div>
  )
}
