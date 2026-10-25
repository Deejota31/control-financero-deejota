import { zodResolver } from '@hookform/resolvers/zod'
import { endOfMonth, getDate } from 'date-fns'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { DatePicker } from '@/components/ui/DatePicker'
import { Field, Input } from '@/components/ui/Field'
import { MesSelector } from '@/components/ui/MesSelector'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { esErrorDeRed, mensajeDeError } from '@/lib/errors'
import { formatSoles, fromIso, parseImporte, toIso } from '@/lib/format'
import type { Plantilla } from '@/lib/tipos'
import { opciones, useCatalogo } from '@/features/catalogo/useCatalogo'
import { finDeMes, mesDeFecha, useFondos, usePeriodo } from '@/features/fondos/useFondos'
import { usePerfil } from '@/features/perfil/usePerfil'
import { useEstadoLote, usePlantillaMutaciones, usePlantillas, type PlantillaValores } from './usePlantillas'

const MES_ACTUAL = mesDeFecha(new Date())

const schema = z
  .object({
    name: z.string().trim().min(1, 'Escribe un nombre.').max(80, 'Máximo 80 caracteres.'),
    description: z.string().trim().min(1, 'Escribe la descripción que tendrán los gastos.').max(200, 'Máximo 200 caracteres.'),
    default_amount: z.string(),
    is_amount_variable: z.boolean(),
    ambito_id: z.string().min(1, 'Elige un ámbito.'),
    categoria_id: z.string().min(1, 'Elige una categoría.'),
    subcategoria_id: z.string(),
    payment_method_id: z.string(),
    default_fund_id: z.string(),
    expense_type: z.enum(['fixed', 'variable']),
    day_of_month: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 31), 'Un día entre 1 y 31.'),
  })
  .refine((v) => v.default_amount === '' || parseImporte(v.default_amount) !== null, { path: ['default_amount'], message: 'Ingresa un importe mayor que 0.' })
  .refine((v) => v.is_amount_variable || parseImporte(v.default_amount) !== null, { path: ['default_amount'], message: 'Ingresa el importe sugerido o márcala como importe variable.' })
type Values = z.infer<typeof schema>

/* ----------------------------- Administrar ----------------------------- */

export function PlantillasDialog({ onClose }: { onClose: () => void }) {
  const q = usePlantillas()
  const mut = usePlantillaMutaciones()
  const [editando, setEditando] = useState<Plantilla | 'nueva' | null>(null)
  const [borrar, setBorrar] = useState<Plantilla | null>(null)

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Plantillas de gastos mensuales" description="Gastos que se repiten cada mes. Al registrarlos, el importe sugerido se puede editar." size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={() => setEditando('nueva')}><Plus className="size-4" aria-hidden="true" /> Nueva plantilla</Button>
        </div>
        {q.isPending ? <Skeleton className="h-32" /> : q.isError ? <ErrorState message="No se pudieron cargar las plantillas." onRetry={() => q.refetch()} /> : q.data.length === 0 ? (
          <EmptyState title="Aún no tienes plantillas" description="Crea una para gastos fijos como alquiler, internet o suscripciones." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {q.data.map((p) => (
              <li key={p.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !p.is_active && 'opacity-60')}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.is_amount_variable ? 'Importe variable' : formatSoles(Number(p.default_amount))}{p.day_of_month ? ` · día ${p.day_of_month}` : ''}</p>
                </div>
                {!p.is_active && <Pill>Inactiva</Pill>}
                <div className="flex gap-1">
                  <button type="button" aria-label={`Editar ${p.name}`} onClick={() => setEditando(p)} className="grid size-8 place-items-center rounded-md hover:bg-surface-2"><Pencil className="size-4" aria-hidden="true" /></button>
                  <button type="button" aria-label={p.is_active ? `Desactivar ${p.name}` : `Activar ${p.name}`} onClick={() => mut.activar.mutate({ id: p.id, is_active: !p.is_active }, { onError: (e) => toast.error(mensajeDeError(e)) })} className="grid size-8 place-items-center rounded-md hover:bg-surface-2"><Power className="size-4" aria-hidden="true" /></button>
                  <button type="button" aria-label={`Eliminar ${p.name}`} onClick={() => setBorrar(p)} className="grid size-8 place-items-center rounded-md hover:bg-surface-2"><Trash2 className="size-4" aria-hidden="true" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editando && <PlantillaForm plantilla={editando === 'nueva' ? null : editando} orden={(q.data?.length ?? 0) + 1} onClose={() => setEditando(null)} />}
      <ConfirmDialog open={Boolean(borrar)} onOpenChange={(o) => !o && setBorrar(null)} title={`¿Eliminar "${borrar?.name ?? ''}"?`}
        description="Los gastos ya registrados con esta plantilla se conservan; solo se desvincula la plantilla." confirmLabel="Eliminar" danger loading={mut.eliminar.isPending}
        onConfirm={() => borrar && mut.eliminar.mutate(borrar.id, { onSuccess: () => { toast.success('Plantilla eliminada.'); setBorrar(null) }, onError: (e) => { toast.error(mensajeDeError(e)); setBorrar(null) } })} />
    </Modal>
  )
}

function PlantillaForm({ plantilla, orden, onClose }: { plantilla: Plantilla | null; orden: number; onClose: () => void }) {
  const catalogo = useCatalogo()
  const fondos = useFondos()
  const mut = usePlantillaMutaciones()
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: plantilla?.name ?? '', description: plantilla?.description ?? '',
      default_amount: plantilla?.default_amount ? Number(plantilla.default_amount).toFixed(2) : '',
      is_amount_variable: plantilla?.is_amount_variable ?? false,
      ambito_id: plantilla?.ambito_id ?? '', categoria_id: plantilla?.categoria_id ?? '', subcategoria_id: plantilla?.subcategoria_id ?? '',
      payment_method_id: plantilla?.payment_method_id ?? '', default_fund_id: plantilla?.default_fund_id ?? '',
      expense_type: (plantilla?.expense_type as 'fixed' | 'variable') ?? 'fixed', day_of_month: plantilla?.day_of_month ? String(plantilla.day_of_month) : '',
    },
  })
  const v = useWatch({ control })
  const categorias = useMemo(() => catalogo.categorias.filter((c) => c.ambito_id === v.ambito_id), [catalogo.categorias, v.ambito_id])
  const subs = useMemo(() => catalogo.subcategorias.filter((s) => s.categoria_id === v.categoria_id), [catalogo.subcategorias, v.categoria_id])

  const enviar = handleSubmit((x) => {
    const valores: PlantillaValores = {
      name: x.name.trim(), description: x.description.trim(),
      default_amount: parseImporte(x.default_amount), is_amount_variable: x.is_amount_variable,
      ambito_id: x.ambito_id, categoria_id: x.categoria_id, subcategoria_id: x.subcategoria_id || null,
      payment_method_id: x.payment_method_id || null, default_fund_id: x.default_fund_id || null,
      expense_type: x.expense_type, day_of_month: x.day_of_month ? Number(x.day_of_month) : null,
    }
    mut.guardar.mutate({ id: plantilla?.id, valores, orden }, {
      onSuccess: () => { toast.success('Plantilla guardada.'); onClose() },
      onError: (e) => toast.error(mensajeDeError(e)),
    })
  })

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={plantilla ? 'Editar plantilla' : 'Nueva plantilla'} size="lg">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" error={errors.name?.message}>{(p) => <Input {...p} autoFocus {...register('name')} />}</Field>
          <Field label="Descripción del gasto" error={errors.description?.message}>{(p) => <Input {...p} {...register('description')} />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Importe sugerido" error={errors.default_amount?.message}>
            {(p) => <Controller control={control} name="default_amount" render={({ field }) => <MoneyInput id={p.id} aria-describedby={p['aria-describedby']} invalid={p['aria-invalid']} value={field.value} onChange={field.onChange} />} />}
          </Field>
          <Field label="Día del mes (opcional)" error={errors.day_of_month?.message}>{(p) => <Input {...p} inputMode="numeric" {...register('day_of_month')} />}</Field>
          <div className="flex flex-col justify-end gap-2 pb-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" {...register('is_amount_variable')} /> Importe variable</label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ámbito" error={errors.ambito_id?.message}>
            {(p) => <Controller control={control} name="ambito_id" render={({ field }) => (
              <Combobox id={p.id} aria-describedby={p['aria-describedby']} invalid={p['aria-invalid']} value={field.value} searchable={false} options={opciones(catalogo.ambitos, field.value)} placeholder="Elegir ámbito"
                onChange={(x) => { field.onChange(x ?? ''); setValue('categoria_id', ''); setValue('subcategoria_id', '') }} />)} />}
          </Field>
          <Field label="Categoría" error={errors.categoria_id?.message}>
            {(p) => <Controller control={control} name="categoria_id" render={({ field }) => (
              <Combobox id={p.id} aria-describedby={p['aria-describedby']} invalid={p['aria-invalid']} value={field.value} disabled={!v.ambito_id} options={opciones(categorias, field.value)} placeholder="Elegir categoría"
                onChange={(x) => { field.onChange(x ?? ''); setValue('subcategoria_id', '') }} />)} />}
          </Field>
          <Field label="Subcategoría (opcional)">
            {(p) => <Controller control={control} name="subcategoria_id" render={({ field }) => (
              <Combobox id={p.id} value={field.value} clearable disabled={!v.categoria_id || subs.length === 0} options={opciones(subs, field.value)} placeholder="Sin subcategoría" onChange={(x) => field.onChange(x ?? '')} />)} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Medio de pago (opcional)">
            {(p) => <Controller control={control} name="payment_method_id" render={({ field }) => (
              <Combobox id={p.id} value={field.value} clearable searchable={false} options={opciones(catalogo.medios, field.value)} placeholder="Elegir al registrar" onChange={(x) => field.onChange(x ?? '')} />)} />}
          </Field>
          <Field label="Fondo sugerido (opcional)" hint="Solo informativo: el motor decide la imputación.">
            {(p) => <Controller control={control} name="default_fund_id" render={({ field }) => (
              <Combobox id={p.id} value={field.value} clearable searchable={false} options={(fondos.data?.fondos ?? []).map((f) => ({ value: f.id, label: f.name, icon: f.icon_key, color: f.color_token }))} placeholder="Sin sugerencia" onChange={(x) => field.onChange(x ?? '')} />)} />}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span id="tipo-pl" className="text-sm font-medium">Tipo</span>
            <Controller control={control} name="expense_type" render={({ field }) => (
              <div role="radiogroup" aria-labelledby="tipo-pl" className="inline-flex w-fit rounded-md bg-surface-2 p-0.5 text-sm font-semibold">
                {([['fixed', 'Fijo'], ['variable', 'Variable']] as const).map(([val, label]) => (
                  <button key={val} type="button" role="radio" aria-checked={field.value === val} onClick={() => field.onChange(val)} className={cn('rounded px-3 py-1.5', field.value === val ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{label}</button>
                ))}
              </div>)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mut.guardar.isPending}>Cancelar</Button>
          <Button type="submit" loading={mut.guardar.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

/* --------------------------- Registro por lote --------------------------- */

type Decision = 'include' | 'skip' | 'na'
interface Fila { decision: Decision; amount: string; date: string; method: string }

export function LoteDialog({ onClose }: { onClose: () => void }) {
  const [mes, setMes] = useState(MES_ACTUAL)
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Registrar gastos mensuales" description="Revisa y ajusta cada plantilla antes de registrar. No se crea nada sin tu confirmación." size="xl">
      <div className="flex flex-col gap-4">
        <MesSelector mes={mes} onChange={setMes} maximo={MES_ACTUAL} />
        <LoteMes key={mes} mes={mes} onClose={onClose} />
      </div>
    </Modal>
  )
}

function LoteMes({ mes, onClose }: { mes: string; onClose: () => void }) {
  const plantillas = usePlantillas()
  const catalogo = useCatalogo()
  const periodo = usePeriodo(mes)
  const estado = useEstadoLote(periodo.data?.id, mes, finDeMes(mes))
  const perfil = usePerfil()
  const mut = usePlantillaMutaciones()
  const [clave] = useState(() => crypto.randomUUID())
  const [filas, setFilas] = useState<Record<string, Partial<Fila>>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargando = plantillas.isPending || periodo.isPending || estado.isPending || catalogo.isPending
  if (cargando) return <Skeleton className="h-48" />
  if (plantillas.isError || periodo.isError || estado.isError) return <ErrorState message="No se pudieron cargar las plantillas del período." onRetry={() => { plantillas.refetch(); periodo.refetch(); estado.refetch() }} />

  const activas = plantillas.data!.filter((p) => p.is_active)
  const cerrado = periodo.data!.status === 'closed'
  if (activas.length === 0) return <EmptyState title="No hay plantillas activas" description="Crea plantillas desde el botón “Plantillas” para registrar tus gastos mensuales en un paso." />

  const base = (p: Plantilla): Fila => {
    const dia = Math.min(p.day_of_month ?? 1, getDate(endOfMonth(fromIso(mes))))
    const fecha = toIso(new Date(fromIso(mes).getFullYear(), fromIso(mes).getMonth(), dia))
    return { decision: estado.data!.noAplica.has(p.id) ? 'na' : 'include', amount: p.default_amount ? Number(p.default_amount).toFixed(2) : '', date: fecha, method: p.payment_method_id ?? '' }
  }
  const fila = (p: Plantilla): Fila => ({ ...base(p), ...filas[p.id] })
  const set = (id: string, patch: Partial<Fila>) => setFilas((f) => ({ ...f, [id]: { ...f[id], ...patch } }))

  const items = activas.filter((p) => !estado.data!.registradas.has(p.id))
  const incluidas = items.filter((p) => fila(p).decision === 'include')
  const errorFila = (p: Plantilla) => {
    const f = fila(p)
    if (f.decision !== 'include') return null
    if (parseImporte(f.amount) === null) return 'Ingresa el importe.'
    if (!f.method) return 'Elige el medio de pago.'
    return null
  }
  const total = incluidas.reduce((s, p) => s + (parseImporte(fila(p).amount) ?? 0), 0)
  const invalido = incluidas.some((p) => errorFila(p))
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'

  async function registrar() {
    setError(null)
    try {
      const payload = items.map((p) => {
        const f = fila(p)
        return f.decision === 'include'
          ? { template_id: p.id, outcome: 'include', amount: parseImporte(f.amount), expense_date: f.date, payment_method_id: f.method }
          : { template_id: p.id, outcome: f.decision === 'na' ? 'not_applicable' : 'exclude' }
      })
      const r = await mut.aplicarLote.mutateAsync({ fecha: mes, items: payload, clave })
      toast.success(r.count > 0 ? `Se registraron ${r.count} ${r.count === 1 ? 'gasto' : 'gastos'} por ${formatSoles(Number(r.total))}.` : 'Decisiones del mes guardadas.')
      onClose()
    } catch (e) {
      setConfirmando(false)
      setError(esErrorDeRed(e) ? 'No se pudo confirmar el registro. Es seguro reintentar: no se duplicará.' : mensajeDeError(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {cerrado && <Alert tone="info">Este período está cerrado: no se pueden registrar gastos en él.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr><th className="p-3">Plantilla</th><th className="p-3">Decisión</th><th className="p-3">Importe</th><th className="p-3">Fecha</th><th className="p-3">Medio de pago</th></tr>
          </thead>
          <tbody>
            {activas.map((p) => {
              const ya = estado.data!.registradas.has(p.id)
              const f = fila(p)
              const err = errorFila(p)
              return (
                <tr key={p.id} className="border-t border-line align-top">
                  <td className="p-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted">{p.description}</p></td>
                  {ya ? (
                    <td colSpan={4} className="p-3"><Pill tone="ok">Ya registrada este mes</Pill></td>
                  ) : (
                    <>
                      <td className="p-3">
                        <div role="radiogroup" aria-label={`Decisión para ${p.name}`} className="inline-flex flex-col gap-1 text-xs font-semibold sm:flex-row">
                          {([['include', 'Registrar'], ['na', 'No aplica este mes'], ['skip', 'Omitir']] as const).map(([d, label]) => (
                            <button key={d} type="button" role="radio" aria-checked={f.decision === d} onClick={() => set(p.id, { decision: d })}
                              className={cn('rounded-md border px-2 py-1.5', f.decision === d ? 'border-pri bg-pri-soft text-pri' : 'border-line text-muted')}>{label}</button>
                          ))}
                        </div>
                      </td>
                      <td className="min-w-36 p-3">
                        {f.decision === 'include' && (
                          <>
                            <MoneyInput aria-label={`Importe de ${p.name}`} value={f.amount} onChange={(x) => set(p.id, { amount: x })} invalid={Boolean(err && parseImporte(f.amount) === null)} />
                            {p.is_amount_variable && <p className="mt-1 text-xs text-muted">Importe variable: confírmalo.</p>}
                            {err && <p className="mt-1 text-xs text-bad">{err}</p>}
                          </>
                        )}
                      </td>
                      <td className="min-w-40 p-3">{f.decision === 'include' && <DatePicker aria-label={`Fecha de ${p.name}`} value={f.date} onChange={(x) => set(p.id, { date: x })} min={mes} max={finDeMes(mes)} formato={formato} />}</td>
                      <td className="min-w-44 p-3">
                        {f.decision === 'include' && <Combobox aria-label={`Medio de pago de ${p.name}`} value={f.method} searchable={false} options={opciones(catalogo.medios, f.method)} onChange={(x) => set(p.id, { method: x ?? '' })} placeholder="Elegir medio" />}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
        <p className="text-sm" aria-live="polite">Se registrarán <b>{incluidas.length}</b> {incluidas.length === 1 ? 'gasto' : 'gastos'} por <b className="num">{formatSoles(total)}</b>.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={invalido || cerrado || items.length === 0} onClick={() => setConfirmando(true)}>{incluidas.length ? 'Revisar y registrar' : 'Guardar decisiones'}</Button>
        </div>
      </div>
      <ConfirmDialog open={confirmando} onOpenChange={setConfirmando} title="Confirmar registro mensual" confirmLabel="Registrar" loading={mut.aplicarLote.isPending} onConfirm={registrar}
        description={<span>Se crearán <b>{incluidas.length}</b> gastos por <b className="num">{formatSoles(total)}</b> y se imputarán a tus fondos. {items.length - incluidas.length > 0 && 'Las plantillas marcadas “No aplica” u omitidas no generan gastos.'}</span>} />
    </div>
  )
}

