import { zodResolver } from '@hookform/resolvers/zod'
import { Paperclip, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { SelectorChips } from '@/components/ui/SelectorChips'
import { Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { esErrorDeRed, mensajeDeError } from '@/lib/errors'
import { errorImporte, formatFecha, formatMes, formatSoles, parseImporte, toIso } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import type { Gasto } from '@/lib/tipos'
import { useDebounced } from '@/lib/useDebounced'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { usePerfil } from '@/features/perfil/usePerfil'
import { borrarArchivo, registrarLimpieza } from './comprobantes'
import { useGastoMutaciones, usePrevisualizacion, type PayloadGasto } from './useGastos'

const HOY = toIso(new Date())

function rutaComprobante(hogar: string, gastoId: string, f: File): string {
  const ext = f.name.includes('.') ? f.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  return `${hogar}/${gastoId}/${Date.now()}.${ext}`
}

export type ModoGasto = 'nuevo' | 'editar' | 'clonar'

const schema = z.object({
  expense_date: z.string().min(1, 'Elige una fecha.'),
  amount: z.string().superRefine((v, ctx) => { const e = errorImporte(v); if (e) ctx.addIssue({ code: 'custom', message: e }) }),
  ambito_id: z.string().min(1, 'Elige un ámbito.'),
  categoria_id: z.string().min(1, 'Elige una categoría.'),
  subcategoria_id: z.string(),
  payment_method_id: z.string().min(1, 'Elige un medio de pago.'),
  description: z.string().trim().min(1, 'Escribe una descripción.').max(200, 'Máximo 200 caracteres.'),
  expense_type: z.enum(['fixed', 'variable']),
  is_recurring: z.boolean(),
  notes: z.string().max(500, 'Máximo 500 caracteres.'),
})
type Values = z.infer<typeof schema>

const TIPOS_ARCHIVO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

const MOTIVOS: Record<string, string> = {
  classification: 'Ningún fondo cubre esta clasificación. Elige otra o ajusta las reglas en Fondos.',
  payment_method: 'Ningún fondo admite este medio de pago. Elige otro medio o ajusta las reglas en Fondos.',
  rules: 'Ningún fondo admite a la vez esta clasificación y este medio de pago. Ajusta las reglas en Fondos o cambia uno de los dos.',
}

/** Etiqueta + selector de chips: el grupo se nombra a sí mismo (aria-label) y el mensaje de error lo describe. */
function CampoChips({ etiqueta, contexto, error, children }: { etiqueta: string; contexto?: string; error?: string; children: (descritoPor: string | undefined) => ReactNode }) {
  const msg = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{etiqueta}</span>
        {contexto && <span className="truncate text-xs text-muted">de {contexto}</span>}
      </div>
      {children(error ? msg : undefined)}
      {error && <p id={msg} className="text-sm text-bad">{error}</p>}
    </div>
  )
}

export function GastoForm({ modo, gasto, inicial, onClose }: { modo: ModoGasto; gasto?: Gasto; inicial?: Partial<Values>; onClose: () => void }) {
  const catalogo = useCatalogo()
  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const mut = useGastoMutaciones()
  const [clave] = useState(() => crypto.randomUUID())
  const [idNuevo] = useState(() => crypto.randomUUID())
  const [descripcionTocada, setTocada] = useState(modo !== 'nuevo' || Boolean(inicial?.description))
  const [archivo, setArchivo] = useState<File | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [recibo, setRecibo] = useState<string | null>(modo === 'editar' ? (gasto?.receipt_path ?? null) : null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const subidoRef = useRef<string | null>(null)
  const formId = useId()

  const { register, handleSubmit, control, setValue, formState: { errors, isDirty } } = useForm<Values>({
    shouldFocusError: false, // el foco al primer error lo decide enfocarPrimerError: el orden lógico del formulario, no el del registro de campos
    resolver: zodResolver(schema),
    defaultValues: {
      expense_date: gasto?.expense_date ?? inicial?.expense_date ?? HOY,
      amount: gasto ? Number(gasto.amount).toFixed(2) : (inicial?.amount ?? ''),
      ambito_id: gasto?.ambito_id ?? inicial?.ambito_id ?? '',
      categoria_id: gasto?.categoria_id ?? inicial?.categoria_id ?? '',
      subcategoria_id: gasto?.subcategoria_id ?? inicial?.subcategoria_id ?? '',
      payment_method_id: gasto?.payment_method_id ?? inicial?.payment_method_id ?? '',
      description: gasto?.description ?? inicial?.description ?? '',
      expense_type: (gasto?.expense_type as 'fixed' | 'variable') ?? inicial?.expense_type ?? 'variable',
      is_recurring: gasto?.is_recurring ?? inicial?.is_recurring ?? false,
      notes: gasto?.notes ?? inicial?.notes ?? '',
    },
  })
  const v = useWatch({ control })

  const ambitoSel = catalogo.ambitos.find((x) => x.id === v.ambito_id)
  const categoriaSel = catalogo.categorias.find((x) => x.id === v.categoria_id)
  const medioSel = catalogo.medios.find((x) => x.id === v.payment_method_id)
  const categorias = useMemo(() => catalogo.categorias.filter((c) => c.ambito_id === v.ambito_id), [catalogo.categorias, v.ambito_id])
  const subcategorias = useMemo(() => catalogo.subcategorias.filter((s) => s.categoria_id === v.categoria_id), [catalogo.subcategorias, v.categoria_id])

  // Previsualización de fondos: solo con datos completos y válidos; con retraso para no saturar al servidor.
  const payloadPrevio = useMemo(() => {
    const monto = parseImporte(v.amount ?? '')
    if (!v.expense_date || monto === null || !v.ambito_id || !v.categoria_id || !v.payment_method_id) return null
    return JSON.stringify({
      editing_id: modo === 'editar' ? gasto?.id : undefined,
      expense_date: v.expense_date, amount: monto, description: (v.description || 'x').trim() || 'x',
      ambito_id: v.ambito_id, categoria_id: v.categoria_id, subcategoria_id: v.subcategoria_id || null,
      payment_method_id: v.payment_method_id, expense_type: v.expense_type ?? 'variable', is_recurring: Boolean(v.is_recurring),
    })
  }, [v.amount, v.expense_date, v.ambito_id, v.categoria_id, v.subcategoria_id, v.payment_method_id, v.description, v.expense_type, v.is_recurring, modo, gasto?.id])
  const payloadDebounced = useDebounced(payloadPrevio, 400)
  const previo = usePrevisualizacion(useMemo(() => (payloadDebounced ? (JSON.parse(payloadDebounced) as PayloadGasto) : null), [payloadDebounced]))
  const previoActualizando = payloadPrevio !== payloadDebounced || previo.isFetching
  const bloqueado = Boolean(previo.data?.blocked) && payloadPrevio === payloadDebounced

  function elegirArchivo(f: File | null) {
    setErrorArchivo(null)
    if (!f) return setArchivo(null)
    if (!TIPOS_ARCHIVO.includes(f.type)) return setErrorArchivo('Usa una imagen JPG, PNG o WebP, o un PDF.')
    if (f.size > MAX_BYTES) return setErrorArchivo('El archivo supera los 5 MB.')
    setArchivo(f)
  }

  /** Enfoca un control del formulario; un grupo de chips (radiogroup) enfoca su opción elegida o la primera. */
  function enfocarControl(el: Element | null | undefined) {
    if (!el) return
    const objetivo = el.getAttribute('role') === 'radiogroup' ? (el.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? el.querySelector<HTMLElement>('[role="radio"]')) : (el as HTMLElement)
    objetivo?.focus()
  }

  // Foco inicial: el primer dato (Ámbito), no el botón Cerrar. Se difiere para que el diálogo termine de montarse y pausar la trampa de foco inferior.
  useEffect(() => {
    const id = window.setTimeout(() => enfocarControl(document.getElementById(formId)?.querySelector('[role="radiogroup"]')), 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Al guardar con errores, el foco va al primero en el orden de lectura (Ámbito antes que Descripción), tras pintarse sus marcas de error. */
  function enfocarPrimerError() {
    window.setTimeout(() => enfocarControl(document.getElementById(formId)?.querySelector('[aria-invalid="true"]')), 0)
  }

  const enviar = (ev: React.FormEvent<HTMLFormElement>) => handleSubmit(async (vals) => {
    if (bloqueado) return
    setErrorEnvio(null)
    setEnviando(true)
    const expenseId = modo === 'editar' ? gasto!.id : idNuevo
    const anterior = modo === 'editar' ? (gasto?.receipt_path ?? null) : null
    try {
      let receipt: string | null = recibo
      if (archivo) {
        if (!subidoRef.current) {
          const hid = perfil.data?.household_id
          if (!hid) throw new Error('Perfil sin hogar')
          const ruta = rutaComprobante(hid, expenseId, archivo)
          // Intención previa: si el navegador se cierra tras subir el archivo, el servidor podrá limpiarlo más tarde.
          await registrarLimpieza([ruta], 'intencion', 10)
          const { error } = await supabase.storage.from('comprobantes').upload(ruta, archivo, { contentType: archivo.type, upsert: false })
          if (error) throw error
          subidoRef.current = ruta
        }
        receipt = subidoRef.current
      }
      const payload: PayloadGasto = {
        expense_date: vals.expense_date,
        amount: parseImporte(vals.amount)!,
        description: vals.description.trim(),
        ambito_id: vals.ambito_id,
        categoria_id: vals.categoria_id,
        subcategoria_id: vals.subcategoria_id || null,
        payment_method_id: vals.payment_method_id,
        expense_type: vals.expense_type,
        is_recurring: vals.is_recurring,
        notes: vals.notes.trim(),
        receipt_path: receipt,
      }
      const reporte =
        modo === 'editar'
          ? await mut.actualizar.mutateAsync({ id: gasto!.id, payload })
          : await mut.crear.mutateAsync({ payload: { ...payload, id: expenseId }, clave })
      subidoRef.current = null
      // Solo tras guardar con éxito se elimina el comprobante reemplazado o quitado (nunca antes).
      if (anterior && anterior !== receipt) await borrarArchivo(anterior, 'reemplazo')
      toast.success(modo === 'editar' ? 'Gasto actualizado.' : 'Gasto guardado.')
      for (const w of reporte.warnings ?? []) {
        toast.warning(w.code === 'general_negative' ? `El Fondo General queda en ${formatSoles(w.remaining_after)}.` : `${w.fund_name} queda en sobregasto: ${formatSoles(w.remaining_after)}.`)
      }
      onClose()
    } catch (e) {
      if (esErrorDeRed(e)) {
        // Resultado ambiguo: puede que el gasto sí se haya guardado y apunte al archivo. Se conserva y se reintenta con la misma ruta y clave.
        setErrorEnvio('No se pudo confirmar si el gasto se guardó. Es seguro reintentar: se usa la misma clave y no se duplicará.')
      } else {
        // Fallo definitivo: el archivo recién subido sobra. El comprobante que ya tenía el gasto no se toca.
        if (subidoRef.current) {
          await borrarArchivo(subidoRef.current)
          subidoRef.current = null
        }
        setErrorEnvio(mensajeDeError(e, 'No se pudo guardar el gasto. Revisa los datos e inténtalo de nuevo.'))
      }
    } finally {
      setEnviando(false)
    }
  }, enfocarPrimerError)(ev)

  const resumenValido = parseImporte(v.amount ?? '') !== null && Boolean(v.expense_date)
  const titulo = modo === 'editar' ? 'Editar gasto' : modo === 'clonar' ? 'Clonar gasto' : 'Nuevo gasto'
  const pendiente = enviando || mut.crear.isPending || mut.actualizar.isPending

  return (
    <Modal open onOpenChange={(o) => !o && !pendiente && onClose()} title={titulo} size="xl"
      sucio={isDirty || Boolean(archivo) || (modo === 'editar' && recibo !== (gasto?.receipt_path ?? null))}
      footer={(cerrar) => (
        <>
          {resumenValido && <p className="mr-auto min-w-0 truncate text-sm text-muted" aria-live="polite">Se guardará <b className="num text-fg">{formatSoles(parseImporte(v.amount ?? '') ?? 0)}</b> · {formatFecha(v.expense_date ?? HOY, formato)}{medioSel ? ` · ${medioSel.name}` : ''}</p>}
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>Cancelar</Button>
          <Button type="submit" form={formId} loading={pendiente} disabled={bloqueado}>{pendiente ? 'Guardando…' : modo === 'editar' ? 'Guardar cambios' : 'Guardar gasto'}</Button>
        </>
      )}
      description={modo === 'clonar' ? 'Copia de un gasto existente: conserva su fecha, y puedes cambiar cualquier dato antes de guardar.' : undefined}>
      <form id={formId} onSubmit={enviar} noValidate className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {errorEnvio && <Alert tone="error">{errorEnvio}</Alert>}

          {/* Cascada: cada paso aparece al elegir el anterior, con el icono, el color y el orden del Catálogo. */}
          <div className="flex min-w-0 flex-col gap-3">
            <CampoChips etiqueta="Ámbito" error={errors.ambito_id?.message}>
              {(id) => (
                <Controller control={control} name="ambito_id" render={({ field }) => (
                  <SelectorChips etiqueta="Ámbito" items={catalogo.ambitos} value={field.value} invalido={Boolean(errors.ambito_id)} descritoPor={id}
                    onChange={(x) => { field.onChange(x); setValue('categoria_id', ''); setValue('subcategoria_id', '') }} />
                )} />
              )}
            </CampoChips>

            {v.ambito_id ? (
              <div className="paso-cascada">
                <CampoChips etiqueta="Categoría" contexto={ambitoSel?.name} error={errors.categoria_id?.message}>
                  {(id) => (
                    <Controller control={control} name="categoria_id" render={({ field }) => (
                      <SelectorChips etiqueta="Categoría" items={categorias} value={field.value} invalido={Boolean(errors.categoria_id)} descritoPor={id}
                        onChange={(x) => { field.onChange(x); setValue('subcategoria_id', '') }} />
                    )} />
                  )}
                </CampoChips>
              </div>
            ) : <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">Elige un ámbito y aparecen sus categorías.</p>}

            {v.categoria_id && (
              <div className="paso-cascada">
                {subcategorias.length === 0 ? (
                  <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">Esta categoría no tiene subcategorías.</p>
                ) : (
                  <CampoChips etiqueta="Subcategoría (opcional)" contexto={categoriaSel?.name}>
                    {() => (
                      <Controller control={control} name="subcategoria_id" render={({ field }) => (
                        <SelectorChips etiqueta="Subcategoría (opcional)" items={subcategorias} value={field.value} limpiable
                          onChange={(x) => {
                            field.onChange(x)
                            const sub = catalogo.subcategorias.find((s) => s.id === x)
                            if (sub && !descripcionTocada) setValue('description', sub.name, { shouldValidate: true })
                          }} />
                      )} />
                    )}
                  </CampoChips>
                )}
              </div>
            )}
          </div>

          <Field label="Descripción" error={errors.description?.message} hint="Qué compraste o pagaste. Se propone desde la subcategoría; puedes editarla.">
            {(p) => <Input {...p} {...register('description', { onChange: () => setTocada(true) })} />}
          </Field>

          <Field label="Notas (opcional)" error={errors.notes?.message}>
            {(p) => <textarea {...p} rows={2} {...register('notes')} className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted" placeholder="Detalles que no caben en el concepto" />}
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Comprobante (opcional)</span>
            {recibo && !archivo ? (
              <div className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm">
                <Paperclip className="size-4 text-muted" aria-hidden="true" />
                <span className="flex-1 truncate">{recibo.split('/').pop()}</span>
                <button type="button" aria-label="Quitar comprobante" onClick={() => setRecibo(null)} className="grid size-6 place-items-center rounded hover:bg-surface-2"><X className="size-4" aria-hidden="true" /></button>
              </div>
            ) : (
              <input type="file" accept={TIPOS_ARCHIVO.join(',')} aria-label="Comprobante" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:font-medium" />
            )}
            <p className="text-xs text-muted">Imagen JPG, PNG o WebP, o PDF. Máximo 5 MB. Se guarda en un espacio privado.</p>
            {errorArchivo && <p className="text-sm text-bad">{errorArchivo}</p>}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Field label="Importe" error={errors.amount?.message}>
            {(p) => <Controller control={control} name="amount" render={({ field }) => <MoneyInput grande id={p.id} aria-describedby={p['aria-describedby']} invalid={p['aria-invalid']} value={field.value} onChange={field.onChange} />} />}
          </Field>

          <div className="grid gap-4 min-[420px]:grid-cols-2">
            <Field label="Fecha" error={errors.expense_date?.message} hint={v.expense_date ? `Se registra en ${formatMes(v.expense_date)}${v.expense_date !== HOY ? ` (no es hoy: ${formatFecha(HOY, formato)})` : ''}.` : undefined}>
              {(p) => <Controller control={control} name="expense_date" render={({ field }) => <DatePicker id={p.id} aria-describedby={p['aria-describedby']} invalid={p['aria-invalid']} value={field.value} onChange={field.onChange} formato={formato} />} />}
            </Field>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span id="tipo-label" className="text-sm font-medium">Tipo de gasto</span>
              <Controller control={control} name="expense_type" render={({ field }) => (
                <div role="radiogroup" aria-labelledby="tipo-label" className="inline-flex self-start rounded-md bg-surface-2 p-0.5 text-sm font-semibold">
                  {([['variable', 'Variable'], ['fixed', 'Fijo']] as const).map(([val, label]) => (
                    <button key={val} type="button" role="radio" aria-checked={field.value === val} onClick={() => field.onChange(val)}
                      className={cn('rounded px-3 py-1.5', field.value === val ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{label}</button>
                  ))}
                </div>
              )} />
            </div>
          </div>

          <CampoChips etiqueta="Medio de pago" error={errors.payment_method_id?.message}>
            {(id) => (
              <Controller control={control} name="payment_method_id" render={({ field }) => (
                <SelectorChips etiqueta="Medio de pago" variante="ficha" items={catalogo.medios} value={field.value} invalido={Boolean(errors.payment_method_id)} descritoPor={id}
                  onChange={(x) => field.onChange(x)} />
              )} />
            )}
          </CampoChips>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_recurring')} /> Es un gasto recurrente</label>

          <aside aria-label="Imputación a fondos" className="flex min-w-0 flex-col gap-3 border-t border-line pt-4 lg:sticky lg:top-0">
            <div>
              <h3 className="font-display text-base font-bold">Cobertura estimada por fondos</h3>
              <p className="text-xs text-muted">Estimación del motor con los datos de hoy. La imputación definitiva se calcula al guardar.</p>
            </div>
            <PanelPrevio payload={payloadPrevio} actualizando={previoActualizando} error={previo.isError} reporte={payloadPrevio === payloadDebounced ? previo.data : undefined} />
          </aside>
        </div>
      </form>
    </Modal>
  )
}

function PanelPrevio({ payload, actualizando, error, reporte }: { payload: string | null; actualizando: boolean; error: boolean; reporte?: import('./useGastos').ReporteGasto }) {
  if (!payload) return <p className="rounded-md border border-dashed border-line p-4 text-sm text-muted">Completa importe, fecha, clasificación y medio de pago para ver qué fondos cubrirán este gasto.</p>
  if (error) return <Alert tone="error">No se pudo calcular la cobertura. Puedes guardar igualmente: el servidor valida y asigna los fondos.</Alert>
  if (!reporte) return <div role="status" aria-label="Calculando cobertura" className="flex flex-col gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
  if (reporte.blocked) {
    return (
      <Alert tone="error">
        <p className="font-semibold">No se puede guardar con esta combinación.</p>
        <p className="mt-1">{(reporte.reason && MOTIVOS[reporte.reason]) || reporte.message}</p>
      </Alert>
    )
  }
  return (
    <div className={cn('flex flex-col gap-2', actualizando && 'opacity-60')} aria-live="polite">
      <ul className="flex flex-col gap-2">
        {reporte.allocations.map((a) => (
          <li key={a.fund_id} className="rounded-md border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.fund_name}</span>
              <span className="num font-semibold">{formatSoles(a.amount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
              <Pill tone={a.is_general ? 'warn' : 'pri'}>{a.is_general ? 'Excedente al General' : 'Fondo específico'}</Pill>
              <span className={cn('num', a.remaining_after < 0 && 'font-semibold text-bad')}>Saldo después: {formatSoles(a.remaining_after)}</span>
            </div>
          </li>
        ))}
      </ul>
      {reporte.warnings.map((w) => (
        <Alert key={`${w.fund_id}-${w.code}`} tone="info">
          {w.code === 'general_negative'
            ? `El Fondo General quedará en ${formatSoles(w.remaining_after)}. Un saldo negativo no impide guardar.`
            : `${w.fund_name} quedará en sobregasto (${formatSoles(w.remaining_after)}). Se registra el importe completo.`}
        </Alert>
      ))}
    </div>
  )
}
