import * as Tabs from '@radix-ui/react-tabs'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2, Download, History, Home, LogOut, Moon, ShieldCheck, Sun, User, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { Field, Input } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { formatFecha, toIso } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import { PasswordForm } from '@/features/auth/PasswordForm'
import { useTema } from '@/features/tema/ThemeProvider'
import { ActividadReciente } from './Actividad'
import { DatosHogar } from './DatosHogar'
import { ExportarDatos } from './ExportarDatos'
import { FORMATOS_FECHA, perfilSchema, zonasHorarias, type PerfilValues } from './perfil'
import { useActualizarPerfil, usePerfil } from './usePerfil'

const HOY = toIso(new Date())

const SECCIONES: { id: string; titulo: string; descripcion: string; icono: LucideIcon }[] = [
  { id: 'perfil', titulo: 'Perfil y preferencias', descripcion: 'Nombre, zona horaria, fecha y tema', icono: User },
  { id: 'hogar', titulo: 'Hogar', descripcion: 'Nombre y acceso', icono: Home },
  { id: 'exportar', titulo: 'Exportar datos', descripcion: 'CSV de gastos y respaldo JSON', icono: Download },
  { id: 'cuenta', titulo: 'Cuenta y seguridad', descripcion: 'Correo, contraseña y sesión', icono: ShieldCheck },
  { id: 'actividad', titulo: 'Actividad reciente', descripcion: 'Registro de cambios', icono: History },
]

const ETIQUETA_FORMATO: Record<string, string> = { 'dd/MM/yyyy': 'Día / mes / año', 'MM/dd/yyyy': 'Mes / día / año', 'yyyy-MM-dd': 'Año-mes-día (ISO)' }

function Panel({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6">
      <header>
        <h2 className="font-display text-xl font-bold">{titulo}</h2>
        <p className="text-sm text-muted">{descripcion}</p>
      </header>
      {children}
    </section>
  )
}

/** Estado de guardado visible: pendientes, guardando, guardado o error. */
function EstadoGuardado({ sucio, guardando, error, guardado }: { sucio: boolean; guardando: boolean; error: boolean; guardado: boolean }) {
  const [texto, Icono, clase] = guardando
    ? ['Guardando…', null, 'text-muted'] as const
    : error ? ['No se pudo guardar. Inténtalo de nuevo.', AlertCircle, 'text-bad'] as const
      : sucio ? ['Hay cambios sin guardar', AlertCircle, 'text-warn'] as const
        : guardado ? ['Cambios guardados', CheckCircle2, 'text-ok'] as const
          : ['Sin cambios', null, 'text-muted'] as const
  return (
    <p role="status" aria-live="polite" className={cn('flex items-center gap-1.5 text-sm font-medium', clase)}>
      {Icono && <Icono className="size-4" aria-hidden="true" />}{texto}
    </p>
  )
}

function PerfilForm() {
  const perfil = usePerfil()
  const actualizar = useActualizarPerfil()
  const { setTema } = useTema()
  const zonas = useMemo(() => zonasHorarias(), [])
  const { register, handleSubmit, reset, control, formState: { errors, isDirty } } = useForm<PerfilValues>({ resolver: zodResolver(perfilSchema) })
  const formato = useWatch({ control, name: 'date_format' })

  useEffect(() => {
    if (perfil.data) {
      reset({ display_name: perfil.data.display_name ?? '', timezone: perfil.data.timezone, date_format: perfil.data.date_format as PerfilValues['date_format'], theme: perfil.data.theme as PerfilValues['theme'] })
    }
  }, [perfil.data, reset])

  const opcionesZona = useMemo(() => {
    const actual = perfil.data?.timezone
    const lista = actual && !zonas.includes(actual) ? [actual, ...zonas] : zonas
    return lista.map((z) => ({ value: z, label: z.replaceAll('_', ' ') }))
  }, [zonas, perfil.data?.timezone])

  const onSubmit = handleSubmit((values) =>
    actualizar.mutateAsync(values).then(
      () => { setTema(values.theme); toast.success('Preferencias guardadas.') },
      () => toast.error('No se pudo guardar el perfil. Inténtalo de nuevo.'),
    ),
  )

  if (perfil.isPending) return <div role="status" aria-label="Cargando perfil" className="flex flex-col gap-3"><div className="h-9 animate-pulse rounded-md bg-surface-2" /><div className="h-9 animate-pulse rounded-md bg-surface-2" /></div>
  if (perfil.isError) return <div className="flex flex-col gap-3"><Alert tone="error">No se pudo cargar tu perfil.</Alert><Button variant="secondary" className="w-fit" onClick={() => perfil.refetch()}>Reintentar</Button></div>

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Nombre" error={errors.display_name?.message}>{(p) => <Input {...p} autoComplete="name" {...register('display_name')} />}</Field>
        <Field label="Zona horaria" hint="Escribe para buscar, por ejemplo «Lima» o «Madrid»." error={errors.timezone?.message}>
          {(p) => (
            <Controller control={control} name="timezone" render={({ field }) => (
              <Combobox id={p.id} aria-describedby={p['aria-describedby']} invalid={Boolean(errors.timezone)} value={field.value} options={opcionesZona} placeholder="Elegir zona horaria" searchPlaceholder="Buscar zona horaria…" onChange={(v) => v && field.onChange(v)} />
            )} />
          )}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Formato de fecha</legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
          <Controller control={control} name="date_format" render={({ field }) => (
            <>
              {FORMATOS_FECHA.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={field.value === f} onClick={() => field.onChange(f)}
                  className={cn('flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors', field.value === f ? 'border-pri bg-pri-soft' : 'border-line hover:bg-surface-2')}>
                  <span className="text-xs text-muted">{ETIQUETA_FORMATO[f]}</span>
                  <span className="num text-base font-semibold">{formatFecha(HOY, f)}</span>
                </button>
              ))}
            </>
          )} />
        </div>
        <p className="text-sm text-muted" aria-live="polite">Así se verán las fechas en toda la aplicación: <b className="num text-fg">{formatFecha(HOY, formato ?? 'dd/MM/yyyy')}</b> (hoy).</p>
      </fieldset>

      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Tema</legend>
          <div className="inline-flex w-fit rounded-lg border border-line bg-surface-2 p-1" role="radiogroup">
            <Controller control={control} name="theme" render={({ field }) => (
              <>
                {([['claro', 'Claro', Sun], ['oscuro', 'Oscuro', Moon]] as const).map(([v, etiqueta, Icono]) => (
                  <button key={v} type="button" role="radio" aria-checked={field.value === v} onClick={() => field.onChange(v)}
                    className={cn('flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium', field.value === v ? 'bg-surface text-pri shadow-sm' : 'text-muted hover:text-fg')}>
                    <Icono className="size-4" aria-hidden="true" /> {etiqueta}
                  </button>
                ))}
              </>
            )} />
          </div>
          <p className="text-sm text-muted">El tema se aplica y recuerda en este dispositivo al guardar.</p>
        </fieldset>
        <Field label="Moneda" hint="Fija en soles peruanos (PEN). La aplicación no convierte monedas, por eso no se puede cambiar.">
          {(p) => <Input {...p} value="PEN (S/)" readOnly />}
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" loading={actualizar.isPending} disabled={!isDirty}>Guardar cambios</Button>
        <Button variant="ghost" disabled={!isDirty || actualizar.isPending} onClick={() => reset()}>Descartar</Button>
        <EstadoGuardado sucio={isDirty} guardando={actualizar.isPending} error={actualizar.isError && isDirty} guardado={actualizar.isSuccess && !isDirty} />
      </div>
    </form>
  )
}

export function ConfiguracionPage() {
  const { user, signOut } = useAuth()
  const [params, setParams] = useSearchParams()
  const actual = SECCIONES.some((s) => s.id === params.get('seccion')) ? params.get('seccion')! : 'perfil'

  return (
    <Tabs.Root value={actual} onValueChange={(v) => setParams({ seccion: v }, { replace: true })} orientation="vertical" className="mx-auto flex max-w-[1200px] flex-col gap-6 lg:flex-row lg:items-start">
      <Tabs.List aria-label="Secciones de configuración" className="flex shrink-0 gap-1 overflow-x-auto lg:sticky lg:top-4 lg:w-72 lg:flex-col lg:overflow-visible">
        {SECCIONES.map(({ id, titulo, descripcion, icono: Icono }) => (
          <Tabs.Trigger key={id} value={id} className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left data-[state=active]:border-pri data-[state=active]:bg-pri-soft data-[state=inactive]:hover:bg-surface-2">
            <Icono className="size-5 shrink-0 text-pri" aria-hidden="true" />
            <span className="flex flex-col"><span className="text-sm font-semibold">{titulo}</span><span className="hidden text-xs text-muted lg:block">{descripcion}</span></span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <div className="min-w-0 flex-1">
        <Tabs.Content value="perfil" className="focus-visible:outline-none"><Panel titulo="Perfil y preferencias" descripcion="Cómo te llamamos y cómo se muestran las fechas y el tema."><PerfilForm /></Panel></Tabs.Content>
        <Tabs.Content value="hogar" className="focus-visible:outline-none"><Panel titulo="Hogar" descripcion="El espacio donde viven tus gastos, fondos y catálogo."><DatosHogar /></Panel></Tabs.Content>
        <Tabs.Content value="exportar" className="focus-visible:outline-none"><Panel titulo="Exportar datos" descripcion="Lleva tu información contigo: una hoja de cálculo o un respaldo completo."><ExportarDatos /></Panel></Tabs.Content>
        <Tabs.Content value="cuenta" className="focus-visible:outline-none">
          <Panel titulo="Cuenta y seguridad" descripcion="Acceso a tu cuenta.">
            <dl className="grid gap-1 text-sm"><dt className="text-muted">Correo de acceso</dt><dd className="font-medium">{user?.email}</dd></dl>
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <h3 className="font-display text-base font-bold">Cambiar contraseña</h3>
              <PasswordForm submitLabel="Cambiar contraseña" onDone={() => toast.success('Contraseña actualizada.')} />
            </div>
            <div className="border-t border-line pt-4"><Button variant="secondary" onClick={() => signOut()}><LogOut className="size-4" aria-hidden="true" /> Cerrar sesión</Button></div>
          </Panel>
        </Tabs.Content>
        <Tabs.Content value="actividad" className="focus-visible:outline-none"><Panel titulo="Actividad reciente" descripcion="Tus últimos movimientos. Es un registro de solo lectura."><ActividadReciente /></Panel></Tabs.Content>
      </div>
    </Tabs.Root>
  )
}
