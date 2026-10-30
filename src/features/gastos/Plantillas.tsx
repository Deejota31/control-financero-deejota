import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ChipK, TinteK } from '@/components/ui/ChipK'
import { Combobox } from '@/components/ui/Combobox'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Hint } from '@/components/ui/Hint'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MesSelector } from '@/components/ui/MesSelector'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { esErrorDeRed, mensajeDeError } from '@/lib/errors'
import { fechaEfectiva } from '@/domain/plantillas'
import { errorImporte, formatFecha, formatMes, formatSoles, parseImporte, sumarImportes } from '@/lib/format'
import type { Plantilla } from '@/lib/tipos'
import { opciones, useCatalogo, type Catalogo } from '@/features/catalogo/useCatalogo'
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
    day_of_month: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 31), 'Escribe un día entre 1 y 31.'),
  })
  .superRefine((v, ctx) => { const e = v.default_amount === '' ? null : errorImporte(v.default_amount); if (e) ctx.addIssue({ code: 'custom', path: ['default_amount'], message: e }) })
  .refine((v) => v.is_amount_variable || parseImporte(v.default_amount) !== null, { path: ['default_amount'], message: 'Ingresa el importe sugerido o marca que el importe cambia cada mes.' })
type Values = z.infer<typeof schema>

/** Icono y color de la clasificación de una plantilla (el color efectivo del catálogo: categoría o, si no hay, ámbito). */
function claseDe(cat: Catalogo, p: { ambito_id: string | null; categoria_id: string | null; subcategoria_id: string | null }) {
  const a = cat.ambitos.find((x) => x.id === p.ambito_id), c = cat.categorias.find((x) => x.id === p.categoria_id), s = cat.subcategorias.find((x) => x.id === p.subcategoria_id)
  return { a, c, s, icono: (s ?? c ?? a)?.icon_key, color: (s ?? c ?? a)?.color_css }
}

function BotonIcono({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Hint contenido={label} side="top">
      <button type="button" aria-label={label} onClick={onClick} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">{children}</button>
    </Hint>
  )
}

/* ----------------------------- Administrar ----------------------------- */

export function PlantillasDialog({ onClose }: { onClose: () => void }) {
  const q = usePlantillas()
  const catalogo = useCatalogo()
  const mut = usePlantillaMutaciones()
  const [editando, setEditando] = useState<Plantilla | 'nueva' | null>(null)
  const [borrar, setBorrar] = useState<Plantilla | null>(null)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'todas' | 'activas' | 'inactivas'>('todas')
  const idBusqueda = useId()

  const lista = q.data ?? []
  const visibles = lista.filter((p) => (estado === 'todas' || (estado === 'activas') === p.is_active) && (!texto.trim() || (p.name + ' ' + (p.description ?? '')).toLowerCase().includes(texto.trim().toLowerCase())))
  const muchas = lista.length > 6

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Plantillas mensuales" description="Gastos que se repiten cada mes. Al registrarlos podrás ajustar importe, fecha y medio." size="lg"
      footer={(cerrar) => <Button variant="secondary" onClick={cerrar}>Cerrar</Button>}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {muchas && (
            <>
              <label htmlFor={idBusqueda} className="sr-only">Buscar plantilla</label>
              <div className="flex min-w-0 flex-1 basis-44 items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 focus-within:border-pri">
                <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <input id={idBusqueda} type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar plantilla…" className="sin-anillo min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted" />
              </div>
              <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
                <option value="todas">Todas</option><option value="activas">Activas</option><option value="inactivas">Inactivas</option>
              </select>
            </>
          )}
          <Button className="ml-auto" onClick={() => setEditando('nueva')}><Plus className="size-4" aria-hidden="true" /> Nueva plantilla</Button>
        </div>

        {q.isPending ? <Skeleton className="h-32" /> : q.isError ? <ErrorState message="No se pudieron cargar las plantillas." onRetry={() => q.refetch()} /> : lista.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aún no tienes plantillas" description="Crea una para gastos que se repiten, como alquiler, internet o suscripciones, y regístralos todos en un paso cada mes."
            action={<Button onClick={() => setEditando('nueva')}><Plus className="size-4" aria-hidden="true" /> Crear la primera</Button>} />
        ) : visibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Ninguna plantilla coincide con la búsqueda.</p>
        ) : (
          <ul aria-label="Plantillas" className="divide-y divide-line rounded-xl border border-line">
            {visibles.map((p) => {
              const c = claseDe(catalogo, p)
              const medio = catalogo.medios.find((m) => m.id === p.payment_method_id)
              const distinta = p.description && p.description.trim().toLowerCase() !== p.name.trim().toLowerCase()
              return (
                <li key={p.id} className={cn('flex min-w-0 items-start gap-3 px-3 py-3', !p.is_active && 'bg-surface-2/40')}>
                  <TinteK color={c.color} className={cn('mt-0.5 size-10 shrink-0 rounded-xl', !p.is_active && 'opacity-60')}><ItemIcon name={c.icono} color={c.color} className="size-5" /></TinteK>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className={cn('min-w-0 break-words font-semibold', !p.is_active && 'text-muted')}>{p.name}</p>
                      <p className="num shrink-0 font-bold">{p.is_amount_variable ? <span className="text-sm font-semibold text-muted">Importe variable{p.default_amount ? ` · ref. ${formatSoles(Number(p.default_amount))}` : ''}</span> : formatSoles(Number(p.default_amount))}</p>
                    </div>
                    {distinta && <p className="break-words text-sm text-muted">{p.description}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {p.day_of_month ? <span>Día {p.day_of_month}</span> : <span>Sin día fijo</span>}
                      {c.c && <ChipK color={c.color}>{c.c.name}{c.s ? ` › ${c.s.name}` : ''}</ChipK>}
                      {medio && <span>{medio.name}</span>}
                      <span>{p.expense_type === 'fixed' ? 'Fijo' : 'Variable'}</span>
                      {!p.is_active && <Pill>Inactiva</Pill>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <BotonIcono label={`Editar ${p.name}`} onClick={() => setEditando(p)}><Pencil className="size-4" aria-hidden="true" /></BotonIcono>
                    <BotonIcono label={p.is_active ? `Desactivar ${p.name}` : `Activar ${p.name}`} onClick={() => mut.activar.mutate({ id: p.id, is_active: !p.is_active }, { onError: (e) => toast.error(mensajeDeError(e)) })}><Power className="size-4" aria-hidden="true" /></BotonIcono>
                    <BotonIcono label={`Eliminar ${p.name}`} onClick={() => setBorrar(p)}><Trash2 className="size-4" aria-hidden="true" /></BotonIcono>
                  </div>
                </li>
              )
            })}
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

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line p-3 sm:p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{titulo}</h3>
      {children}
    </section>
  )
}

function PlantillaForm({ plantilla, orden, onClose }: { plantilla: Plantilla | null; orden: number; onClose: () => void }) {
  const catalogo = useCatalogo()
  const periodoActual = usePeriodo(MES_ACTUAL)
  const fondos = useFondos(periodoActual.data?.id)
  const mut = usePlantillaMutaciones()
  const idForm = useId()
  const { register, handleSubmit, control, setValue, formState: { errors, isDirty } } = useForm<Values>({
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
  const c = claseDe(catalogo, { ambito_id: v.ambito_id ?? null, categoria_id: v.categoria_id ?? null, subcategoria_id: v.subcategoria_id ?? null })
  const dia = v.day_of_month && /^\d+$/.test(v.day_of_month) && +v.day_of_month >= 1 && +v.day_of_month <= 31 ? +v.day_of_month : null
  const formato = usePerfil().data?.date_format ?? 'dd/MM/yyyy'
  const efectiva = fechaEfectiva(dia, MES_ACTUAL)
  const importeOk = parseImporte(v.default_amount ?? '')

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
    <Modal open onOpenChange={(o) => !o && onClose()} title={plantilla ? 'Editar plantilla' : 'Nueva plantilla'} size="lg" sucio={isDirty}
      footer={(cerrar) => (
        <>
          <p className="mr-auto flex min-w-0 items-center gap-2 text-sm text-muted" aria-live="polite">
            <TinteK color={c.color} className="size-7 shrink-0 rounded-lg"><ItemIcon name={c.icono} color={c.color} className="size-4" /></TinteK>
            <span className="min-w-0 truncate"><b className="text-fg">{v.name || 'Sin nombre'}</b> · {v.is_amount_variable ? 'importe variable' : importeOk !== null ? formatSoles(importeOk) : 'sin importe'}</span>
          </p>
          <Button variant="secondary" onClick={cerrar} disabled={mut.guardar.isPending}>Cancelar</Button>
          <Button type="submit" form={idForm} loading={mut.guardar.isPending}>Guardar</Button>
        </>
      )}>
      <form id={idForm} onSubmit={enviar} noValidate className="flex min-w-0 flex-col gap-4">
        <Grupo titulo="Identificación">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" hint="Cómo la reconoces en la lista." error={errors.name?.message}>{(p) => <Input {...p} autoFocus {...register('name')} />}</Field>
            <Field label="Descripción del gasto" hint="El concepto con el que se registrará cada mes." error={errors.description?.message}>{(p) => <Input {...p} {...register('description')} />}</Field>
          </div>
        </Grupo>

        <Grupo titulo="Programación e importe">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Importe sugerido" error={errors.default_amount?.message} hint={v.is_amount_variable ? 'Opcional: solo una referencia. Se revisa al aplicar.' : undefined}>
              {(p) => <Controller control={control} name="default_amount" render={({ field }) => <MoneyInput grande id={p.id} aria-describedby={p['aria-describedby']} invalid={p['aria-invalid']} value={field.value} onChange={field.onChange} />} />}
            </Field>
            <Field label="Día del mes (opcional)" error={errors.day_of_month?.message}
              hint={dia ? `Este mes se registraría el ${formatFecha(efectiva.iso, formato)}${efectiva.ajustada ? ' (el mes es más corto: se usa su último día)' : ''}.` : 'Sin día: se propone el 1 y puedes cambiarlo al registrar.'}>
              {(p) => <Input {...p} inputMode="numeric" {...register('day_of_month')} />}
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" {...register('is_amount_variable')} />
            <span><b>El importe cambia cada mes</b> (luz, agua, tarjeta…). Al registrar el mes tendrás que confirmarlo; nunca se asume cero.</span>
          </label>
        </Grupo>

        <Grupo titulo="Clasificación y pago">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medio de pago (opcional)">
              {(p) => <Controller control={control} name="payment_method_id" render={({ field }) => (
                <Combobox id={p.id} value={field.value} clearable searchable={false} options={opciones(catalogo.medios, field.value)} placeholder="Elegir al registrar" onChange={(x) => field.onChange(x ?? '')} />)} />}
            </Field>
            <Field label="Fondo sugerido (opcional)" hint="Solo informativo: el motor decide la imputación real.">
              {(p) => <Controller control={control} name="default_fund_id" render={({ field }) => (
                <Combobox id={p.id} value={field.value} clearable searchable={false} options={(fondos.data?.fondos ?? []).map((f) => ({ value: f.id, label: f.name, icon: f.icon_key, color: f.color_token }))} placeholder="Sin sugerencia" onChange={(x) => field.onChange(x ?? '')} />)} />}
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span id="tipo-pl" className="text-sm font-medium">Naturaleza del gasto</span>
            <Controller control={control} name="expense_type" render={({ field }) => (
              <div role="radiogroup" aria-labelledby="tipo-pl" className="inline-flex w-fit rounded-md bg-surface-2 p-0.5 text-sm font-semibold">
                {([['fixed', 'Fijo'], ['variable', 'Variable']] as const).map(([val, label]) => (
                  <button key={val} type="button" role="radio" aria-checked={field.value === val} onClick={() => field.onChange(val)} className={cn('rounded px-3 py-1.5', field.value === val ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{label}</button>
                ))}
              </div>)} />
            <p className="text-xs text-muted">Cómo se clasificará el gasto creado (un compromiso fijo o uno que varía por consumo). No es lo mismo que «el importe cambia cada mes».</p>
          </div>
        </Grupo>
      </form>
    </Modal>
  )
}

/* --------------------------- Registro por lote --------------------------- */

type Decision = 'include' | 'skip' | 'na'
interface Fila { decision: Decision; amount: string; date: string; method: string; confirmado: boolean }

const DECISIONES: { value: Decision; label: string; ayuda: string }[] = [
  { value: 'include', label: 'Registrar', ayuda: 'Crea el gasto este mes con los datos de la fila.' },
  { value: 'na', label: 'No aplica este mes', ayuda: 'Queda anotado que este mes no corresponde; no se crea gasto.' },
  { value: 'skip', label: 'Omitir', ayuda: 'No se crea nada ahora; la plantilla se podrá revisar de nuevo.' },
]

/** Registro por lote de las plantillas de un mes. La planificación lo abre con el mes que se está preparando (incluso futuro). */
export function LoteDialog({ onClose, mesInicial, maximo }: { onClose: () => void; mesInicial?: string; maximo?: string }) {
  const [mes, setMes] = useState(mesInicial ?? MES_ACTUAL)
  const [pendientes, setPendientes] = useState(0)
  const [sucio, setSucio] = useState(false)
  const [cambiarA, setCambiarA] = useState<string | null>(null)
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Registrar gastos mensuales" description="Revisa cada plantilla antes de confirmar. No se crea nada sin tu confirmación." size="xl" sucio={sucio}
      footer={null}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MesSelector mes={mes} onChange={(m) => (sucio ? setCambiarA(m) : setMes(m))} maximo={maximo ?? MES_ACTUAL} />
          <p className="text-sm text-muted" aria-live="polite">{formatMes(mes)} · <b className="text-fg">{pendientes}</b> {pendientes === 1 ? 'plantilla por revisar' : 'plantillas por revisar'}</p>
        </div>
        <LoteMes key={mes} mes={mes} onClose={onClose} onPendientes={setPendientes} onSucio={setSucio} />
      </div>
      <ConfirmDialog open={Boolean(cambiarA)} onOpenChange={(o) => !o && setCambiarA(null)} title="¿Cambiar de mes?" description="Tienes ajustes sin registrar en este mes. Si cambias de mes se descartarán."
        confirmLabel="Cambiar de mes" cancelLabel="Seguir aquí" onConfirm={() => { if (cambiarA) { setSucio(false); setMes(cambiarA) } setCambiarA(null) }} />
    </Modal>
  )
}

function LoteMes({ mes, onClose, onPendientes, onSucio }: { mes: string; onClose: () => void; onPendientes: (n: number) => void; onSucio: (b: boolean) => void }) {
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
  const [intento, setIntento] = useState(false)

  const cargando = plantillas.isPending || periodo.isPending || estado.isPending || catalogo.isPending
  const activas = (plantillas.data ?? []).filter((p) => p.is_active)
  const registradas = estado.data?.registradas ?? new Set<string>()
  const items = activas.filter((p) => !registradas.has(p.id))
  const ya = activas.filter((p) => registradas.has(p.id))
  const cerrado = periodo.data?.status === 'closed'

  const base = (p: Plantilla): Fila => ({
    decision: estado.data?.noAplica.has(p.id) ? 'na' : 'include',
    amount: p.default_amount ? Number(p.default_amount).toFixed(2) : '',
    date: fechaEfectiva(p.day_of_month, mes).iso, method: p.payment_method_id ?? '', confirmado: !p.is_amount_variable,
  })
  const fila = (p: Plantilla): Fila => ({ ...base(p), ...filas[p.id] })
  const set = (id: string, patch: Partial<Fila>) => { setFilas((f) => ({ ...f, [id]: { ...f[id], ...patch } })); onSucio(true) }

  const incluidas = items.filter((p) => fila(p).decision === 'include')
  /** Datos que faltan o están mal en una fila que se va a registrar. */
  const problemas = (p: Plantilla): string[] => {
    const f = fila(p)
    if (f.decision !== 'include') return []
    const out: string[] = []
    const ei = errorImporte(f.amount)
    if (ei) out.push(ei)
    else if (!f.confirmado) out.push('Revisa y confirma el importe de este mes.')
    if (!f.method) out.push('Elige el medio de pago.')
    return out
  }
  const conProblemas = incluidas.filter((p) => problemas(p).length > 0)
  const total = sumarImportes(incluidas.map((p) => parseImporte(fila(p).amount) ?? 0))
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const nPend = items.filter((p) => fila(p).decision === 'include').length
  // Lo que la persona aún debe revisar (se informa arriba y en el pie)
  const pendientesRevision = incluidas.filter((p) => !fila(p).confirmado).length
  const nItems = items.length
  useEffect(() => { if (!cargando) onPendientes(nItems) }, [cargando, nItems, onPendientes])

  if (cargando) return <Skeleton className="h-48" />
  if (plantillas.isError || periodo.isError || estado.isError) return <ErrorState message="No se pudieron cargar las plantillas del período." onRetry={() => { plantillas.refetch(); periodo.refetch(); estado.refetch() }} />
  if (activas.length === 0) return <EmptyState icon={CalendarDays} title="No hay plantillas activas" description="Crea plantillas desde el botón “Plantillas” para registrar tus gastos mensuales en un paso." />

  async function registrar() {
    if (mut.aplicarLote.isPending) return // evita el doble envío
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
      onSucio(false)
      onClose()
    } catch (e) {
      setConfirmando(false)
      setError(esErrorDeRed(e)
        ? 'No se pudo confirmar el registro. Es seguro reintentar: se usa la misma clave y no se duplicará ningún gasto.'
        : `${mensajeDeError(e)} No se registró ningún gasto (el lote es atómico: o se crea todo o nada), así que puedes corregir y reintentar.`)
    }
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-3">
      {cerrado && <Alert tone="info">Este período está cerrado: no se pueden registrar gastos en él.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="hidden grid-cols-[minmax(0,1.5fr)_11rem_8.5rem_9.5rem_minmax(0,1fr)] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted @min-[52rem]:grid" aria-hidden="true">
        <span>Plantilla</span><span>Decisión</span><span>Importe</span><span>Fecha</span><span>Medio de pago</span>
      </div>
      <ul aria-label="Plantillas del mes" className="flex flex-col gap-2">
        {items.map((p) => {
          const f = fila(p)
          const c = claseDe(catalogo, p)
          const prob = intento ? problemas(p) : []
          const usa = f.decision === 'include'
          return (
            <li key={p.id} className={cn('grid min-w-0 grid-cols-1 items-start gap-2 rounded-xl border p-3 @min-[52rem]:grid-cols-[minmax(0,1.5fr)_11rem_8.5rem_9.5rem_minmax(0,1fr)] @min-[52rem]:gap-3', usa ? 'border-line' : 'border-line bg-surface-2/50')}>
              <div className="flex min-w-0 items-start gap-2.5">
                <TinteK color={c.color} className="size-9 shrink-0 rounded-lg"><ItemIcon name={c.icono} color={c.color} className="size-[18px]" /></TinteK>
                <div className="min-w-0">
                  <p className="break-words font-semibold">{p.name}</p>
                  <p className="break-words text-xs text-muted">{p.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    {c.c && <ChipK color={c.color}>{c.c.name}{c.s ? ` › ${c.s.name}` : ''}</ChipK>}
                    {p.is_amount_variable && usa && !f.confirmado && <Pill tone="warn">Revisar importe</Pill>}
                    {f.decision === 'na' && <Pill>No aplica</Pill>}
                    {f.decision === 'skip' && <Pill>Omitida</Pill>}
                  </p>
                </div>
              </div>
              <div className="min-w-0">
                <Combobox aria-label={`Decisión para ${p.name}`} value={f.decision} searchable={false} options={DECISIONES.map((d) => ({ value: d.value, label: d.label }))} onChange={(x) => set(p.id, { decision: (x ?? 'include') as Decision })} />
                <p className="mt-1 hidden text-[11px] leading-snug text-muted @min-[52rem]:block">{DECISIONES.find((d) => d.value === f.decision)?.ayuda}</p>
              </div>
              {usa ? (
                <>
                  <div className="min-w-0">
                    <MoneyInput aria-label={`Importe de ${p.name}`} value={f.amount} onChange={(x) => set(p.id, { amount: x, confirmado: true })} invalid={Boolean(prob.some((m) => /importe|número|decimal|signo|máximo|mayor|Usa|Formato/i.test(m)))} />
                    {p.is_amount_variable && !f.confirmado && f.amount !== '' && (
                      <button type="button" onClick={() => set(p.id, { confirmado: true })} className="mt-1 text-xs font-semibold text-pri hover:underline">Confirmar {formatSoles(parseImporte(f.amount) ?? 0)}</button>
                    )}
                  </div>
                  <div className="min-w-0"><DatePicker aria-label={`Fecha de ${p.name}`} value={f.date} onChange={(x) => set(p.id, { date: x })} min={mes} max={finDeMes(mes)} formato={formato} /></div>
                  <div className="min-w-0"><Combobox aria-label={`Medio de pago de ${p.name}`} value={f.method} searchable={false} options={opciones(catalogo.medios, f.method)} onChange={(x) => set(p.id, { method: x ?? '' })} placeholder="Elegir medio" invalid={prob.includes('Elige el medio de pago.')} /></div>
                  {prob.length > 0 && <p role="alert" className="text-xs font-medium text-bad @min-[52rem]:col-span-5">{prob.join(' ')}</p>}
                </>
              ) : (
                <p className="text-xs text-muted @min-[52rem]:col-span-4">{f.decision === 'na' ? 'No se registrará este mes; queda anotado que no corresponde.' : 'No se creará nada ahora; seguirá pendiente de revisión.'}</p>
              )}
            </li>
          )
        })}
      </ul>

      {ya.length > 0 && (
        <details className="rounded-xl border border-line px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Ya registradas este mes ({ya.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">{ya.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{p.name}</span><Pill tone="ok">Ya registrada este mes</Pill></li>)}</ul>
        </details>
      )}

      <div className="sticky -bottom-4 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 sm:-bottom-5 sm:-mx-6 sm:px-6">
        <p className="text-sm" aria-live="polite">
          <b>{incluidas.length}</b> {incluidas.length === 1 ? 'gasto' : 'gastos'} por <b className="num">{formatSoles(total)}</b>
          {conProblemas.length > 0 && <span className="text-bad"> · {conProblemas.length} con datos pendientes</span>}
          {pendientesRevision > 0 && conProblemas.length === 0 && <span className="text-muted"> · {pendientesRevision} importe(s) por confirmar</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={cerrado || items.length === 0 || mut.aplicarLote.isPending} onClick={() => { setIntento(true); if (conProblemas.length === 0) setConfirmando(true) }}>{nPend ? 'Revisar y registrar' : 'Guardar decisiones'}</Button>
        </div>
      </div>

      <ConfirmDialog open={confirmando} onOpenChange={setConfirmando} title="Confirmar registro mensual" confirmLabel="Registrar" loading={mut.aplicarLote.isPending} onConfirm={registrar}
        description={
          <div className="flex flex-col gap-2">
            <p>Se crearán <b>{incluidas.length}</b> {incluidas.length === 1 ? 'gasto' : 'gastos'} por <b className="num">{formatSoles(total)}</b> y se imputarán a tus fondos:</p>
            {incluidas.length > 0 && (
              <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                {incluidas.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-1.5"><span className="min-w-0 truncate">{p.name} · {formatFecha(fila(p).date, formato)}</span><span className="num shrink-0 font-semibold">{formatSoles(parseImporte(fila(p).amount) ?? 0)}</span></li>)}
              </ul>
            )}
            {items.length - incluidas.length > 0 && <p className="text-xs text-muted">Las demás ({items.length - incluidas.length}) solo guardan tu decisión («No aplica» u «Omitir»); no crean gastos.</p>}
          </div>
        } />
    </div>
  )
}
