import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { DatePicker } from '@/components/ui/DatePicker'
import { SelectorIcono } from '@/components/ui/SelectorIcono'
import { ColorCompacto } from '@/components/ui/SelectorColor'
import { useAuth } from '@/features/auth/AuthProvider'
import { usePerfil } from '@/features/perfil/usePerfil'
import { errorImporte, parseMontoNoNegativo } from '@/lib/format'
import { mensajeDeError } from '@/lib/errors'
import { sugerirIconos } from '@/domain/iconos'
import { ESTADOS_EVENTO, TIPOS_EVENTO, type Evento } from './modelo'
import { useMutacionesEvento } from './useEventos'

export const estiloSelect = 'min-h-11 w-full min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-base text-fg sm:text-sm [@media(pointer:coarse)]:text-base'
const schema = z.object({ name: z.string().trim().min(1, 'Escribe un nombre.').max(100, 'Máximo 100 caracteres.'), description: z.string().max(1000), event_type: z.string(), target_date: z.string(), start_date: z.string(), budget: z.string().superRefine((v, ctx) => { const e = errorImporte(v, { permitirCero: true }); if (e) ctx.addIssue({ code: 'custom', message: e }) }), icon_key: z.string(), color_token: z.string(), status: z.string() })
type Valores = z.infer<typeof schema>

export function EventoForm({ source, clonar = false, plantilla = false, onClose, onSaved }: { source?: Evento; clonar?: boolean; plantilla?: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const mut = useMutacionesEvento()
  const perfil = usePerfil()
  const { user } = useAuth()
  const [clave] = useState(() => crypto.randomUUID())
  const [creado] = useState(() => new Date().toISOString())
  const [error, setError] = useState('')
  const idForm = useId()
  const form = useForm<Valores>({ resolver: zodResolver(schema), defaultValues: {
    name: source ? source.name + (clonar && source.is_template === plantilla ? ' (copia)' : '') : '',
    description: source?.description ?? '', event_type: source?.event_type ?? 'other',
    target_date: clonar ? '' : source?.target_date ?? '', start_date: clonar ? '' : source?.start_date ?? '',
    budget: Number(source?.budget ?? 0).toFixed(2), icon_key: source?.icon_key ?? 'party-popper', color_token: source?.color_token ?? 'c1', status: clonar ? 'planned' : source?.status ?? 'planned',
  } })
  const v = useWatch({ control: form.control })
  const guardando = mut.guardar.isPending || mut.copiar.isPending
  const enviar = form.handleSubmit(async (vals) => {
    if (!plantilla && !vals.target_date) { form.setError('target_date', { message: 'Elige la fecha objetivo.' }); return }
    if (vals.start_date && vals.target_date && vals.start_date > vals.target_date) { form.setError('start_date', { message: 'El inicio debe ser anterior o igual a la fecha objetivo.' }); return }
    if (!user || !perfil.data?.household_id) { setError('No se pudo recuperar tu perfil. Inténtalo de nuevo.'); return }
    setError('')
    try {
      const valores = { ...vals, name: vals.name.trim(), description: vals.description.trim(), budget: parseMontoNoNegativo(vals.budget)!, target_date: vals.target_date || null, start_date: vals.start_date || null, is_template: plantilla, currency: 'PEN' }
      const id = clonar && source ? await mut.copiar.mutateAsync({ source: source.id, values: valores, key: clave }) : await mut.guardar.mutateAsync({
        ...valores, id: source?.id ?? clave, household_id: perfil.data.household_id, user_id: user.id,
        archived_at: source?.archived_at ?? null, created_at: source?.created_at ?? creado, updated_at: source?.updated_at ?? creado,
      })
      toast.success(plantilla ? 'Plantilla guardada.' : 'Evento guardado.')
      onSaved(id)
    } catch (e) { setError(mensajeDeError(e)) }
  })
  return <Modal open onOpenChange={(o) => !o && !guardando && onClose()} title={plantilla ? source && !clonar ? 'Editar plantilla de evento' : 'Nueva plantilla de evento' : source && !clonar ? 'Editar evento' : clonar ? 'Crear evento desde configuración' : 'Nuevo evento'} size="lg" ayuda={<p>El presupuesto es una referencia y no reserva fondos. Las plantillas copian conceptos y contratos sin pagos.</p>} sucio={form.formState.isDirty}
    footer={(cerrar) => <><Button variant="secondary" onClick={cerrar} disabled={guardando}>Cancelar</Button><Button type="submit" form={idForm} loading={guardando}>{plantilla ? 'Guardar plantilla' : 'Guardar evento'}</Button></>}>
    <form id={idForm} onSubmit={enviar} noValidate className="flex min-w-0 flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Nombre del evento" error={form.formState.errors.name?.message}>{(p) => <Input {...p} {...form.register('name')} autoFocus maxLength={100} className="text-base" placeholder="Por ejemplo, primer cumpleaños" />}</Field>
      <Field label="Descripción (opcional)" error={form.formState.errors.description?.message}>{(p) => <textarea {...p} {...form.register('description')} rows={2} maxLength={1000} className={estiloSelect} placeholder="Qué te gustaría preparar y lograr" />}</Field>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="Tipo de evento">{(p) => <select {...p} {...form.register('event_type')} className={estiloSelect}>{TIPOS_EVENTO.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>}</Field>
        <Field label="Estado">{(p) => <select {...p} {...form.register('status')} className={estiloSelect}>{ESTADOS_EVENTO.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>}</Field>
        <Field label={plantilla ? 'Fecha objetivo (opcional)' : 'Fecha objetivo'} error={form.formState.errors.target_date?.message}>{(p) => <Controller control={form.control} name="target_date" render={({ field }) => <div className="flex min-w-0 flex-col gap-1"><DatePicker {...p} invalid={Boolean(form.formState.errors.target_date)} value={field.value} onChange={field.onChange} />{plantilla && field.value && <button type="button" className="min-h-9 self-start rounded px-1 text-xs font-semibold text-pri" onClick={() => field.onChange('')}>Quitar fecha objetivo</button>}</div>} />}</Field>
        <Field label="Inicio de planificación (opcional)" error={form.formState.errors.start_date?.message}>{(p) => <Controller control={form.control} name="start_date" render={({ field }) => <div className="flex min-w-0 flex-col gap-1"><DatePicker {...p} invalid={Boolean(form.formState.errors.start_date)} value={field.value} onChange={field.onChange} />{field.value && <button type="button" className="min-h-9 self-start rounded px-1 text-xs font-semibold text-pri" onClick={() => { field.onChange(''); form.clearErrors('start_date') }}>Quitar fecha inicial</button>}</div>} />}</Field>
        <Field label="Presupuesto estimado (S/)" error={form.formState.errors.budget?.message}>{(p) => <Controller control={form.control} name="budget" render={({ field }) => <MoneyInput {...p} value={field.value} onChange={field.onChange} invalid={Boolean(form.formState.errors.budget)} />} />}</Field>
        <Field label="Moneda">{(p) => <Input {...p} value="Soles (PEN)" readOnly />}</Field>
      </div>
      <div className="flex min-w-0 flex-col gap-3 border-t border-line pt-4"><p className="text-sm font-semibold">Apariencia</p>
        <Controller control={form.control} name="icon_key" render={({ field }) => <SelectorIcono value={field.value} onChange={field.onChange} color={v.color_token} sugerencias={sugerirIconos(v.name ?? '')} />} />
        <Controller control={form.control} name="color_token" render={({ field }) => <ColorCompacto valor={field.value} onChange={field.onChange} />} />
      </div>
    </form>
  </Modal>
}
