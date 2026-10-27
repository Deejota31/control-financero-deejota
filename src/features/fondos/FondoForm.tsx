import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, Search } from 'lucide-react'
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { ColorPicker } from '@/components/ui/IconPicker'
import { Seccion } from '@/components/ui/Seccion'
import { SelectorIcono } from '@/components/ui/SelectorIcono'
import { sugerirIconos } from '@/domain/iconos'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { cn } from '@/lib/cn'
import { errorImporte, parseMontoNoNegativo } from '@/lib/format'
import { nombreIcono } from '@/lib/icons'
import type { Catalogo } from '@/features/catalogo/useCatalogo'
import type { Fila } from '@/lib/tipos'
import type { FondoPayload } from './useFondos'

type Regla = 'none' | 'include' | 'exclude'

export interface FondoInicial {
  fondo: Fila<'funds'> | null
  alcance: Fila<'fund_scope_rules'>[]
  medios: Fila<'fund_payment_rules'>[]
  /** Si se clona, el nombre lleva "(copia)" y no hay id. */
  clon?: boolean
  presupuestoPeriodo?: number
}

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre.').max(60, 'Máximo 60 caracteres.'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres.'),
  icon_key: z.string().min(1),
  color_token: z.string().min(1),
  is_general: z.boolean(),
  is_active: z.boolean(),
  default_amount: z.string().superRefine((v, ctx) => { const e = errorImporte(v, { permitirCero: true }); if (e) ctx.addIssue({ code: 'custom', message: e }) }),
  period_amount: z.string().superRefine((v, ctx) => { const e = v === '' ? null : errorImporte(v, { permitirCero: true }); if (e) ctx.addIssue({ code: 'custom', message: e }) }),
})
type Values = z.infer<typeof schema>

const OPCIONES_REGLA: { v: Regla; label: string; marca: string }[] = [
  { v: 'none', label: 'Sin regla', marca: '' },
  { v: 'include', label: 'Incluir', marca: '✓ ' },
  { v: 'exclude', label: 'Excluir', marca: '✕ ' },
]

/** Grupo de radios (Sin regla / Incluir / Excluir) con tabindex móvil: Tab entra en el seleccionado; flechas, Inicio y Fin cambian y seleccionan. */
function SelectorRegla({ nombre, value, onChange }: { nombre: string; value: Regla; onChange: (v: Regla) => void }) {
  const grupo = useRef<HTMLDivElement>(null)
  function teclas(e: KeyboardEvent<HTMLButtonElement>) {
    const i = OPCIONES_REGLA.findIndex((o) => o.v === value)
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % 3
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + 2) % 3
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = 2
    if (n < 0) return
    e.preventDefault()
    onChange(OPCIONES_REGLA[n].v)
    grupo.current?.querySelectorAll<HTMLButtonElement>('button')[n]?.focus()
  }
  return (
    <div ref={grupo} role="radiogroup" aria-label={`Regla para ${nombre}`} className="inline-flex shrink-0 rounded-md bg-surface-2 p-0.5 text-xs font-semibold">
      {OPCIONES_REGLA.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          tabIndex={value === o.v ? 0 : -1}
          data-label={o.label}
          onClick={() => onChange(o.v)}
          onKeyDown={teclas}
          className={cn(
            'rounded px-2 py-1',
            value === o.v && o.v === 'include' && 'bg-pri text-pri-fg',
            value === o.v && o.v === 'exclude' && 'bg-bad text-pri-fg',
            value === o.v && o.v === 'none' && 'bg-surface text-fg shadow-sm',
            value !== o.v && 'text-muted',
          )}
        >
          {value === o.v && <span aria-hidden="true">{o.marca}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ResumenRamas({ inc, exc }: { inc: number; exc: number }) {
  if (!inc && !exc) return null
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold">
      {inc > 0 && <span className="rounded bg-pri-soft px-1.5 py-0.5 text-pri">✓ {inc}</span>}
      {exc > 0 && <span className="rounded bg-bad-soft px-1.5 py-0.5 text-bad">✕ {exc}</span>}
    </span>
  )
}

export function FondoForm({
  catalogo, inicial, hayGeneralActivo, periodoAbierto, periodId, onClose, onSubmit, cargando,
}: {
  catalogo: Catalogo
  inicial: FondoInicial
  hayGeneralActivo: boolean
  periodoAbierto: boolean
  periodId?: string
  onClose: () => void
  onSubmit: (payload: FondoPayload) => void
  cargando: boolean
}) {
  const { fondo, clon } = inicial
  const [inicialAlcance] = useState<Record<string, Regla>>(() => {
    const m: Record<string, Regla> = {}
    for (const r of inicial.alcance) {
      const k = r.ambito_id ? `ambito:${r.ambito_id}` : r.categoria_id ? `categoria:${r.categoria_id}` : `subcategoria:${r.subcategoria_id}`
      m[k] = r.effect === 'exclude' ? 'exclude' : 'include'
    }
    return m
  })
  const [alcance, setAlcance] = useState<Record<string, Regla>>(inicialAlcance)
  const [inicialMedios] = useState<Record<string, Regla>>(() => Object.fromEntries(inicial.medios.map((r) => [r.payment_method_id, r.effect === 'exclude' ? 'exclude' : 'include'])))
  const [medios, setMedios] = useState<Record<string, Regla>>(inicialMedios)
  const [errorReglas, setErrorReglas] = useState<string | null>(null)

  const { register, handleSubmit, control, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: fondo ? (clon ? `${fondo.name} (copia)` : fondo.name) : '',
      description: fondo?.description ?? '',
      icon_key: fondo?.icon_key ?? 'wallet',
      color_token: fondo?.color_token ?? 'c1',
      is_general: fondo?.is_general ?? false,
      is_active: fondo?.is_active ?? true,
      default_amount: fondo ? Number(fondo.default_amount).toFixed(2) : '0.00',
      period_amount: inicial.presupuestoPeriodo !== undefined && !clon ? inicial.presupuestoPeriodo.toFixed(2) : '',
    },
  })
  const esGeneral = useWatch({ control, name: 'is_general' })
  const color = useWatch({ control, name: 'color_token' })
  const nombreFondo = useWatch({ control, name: 'name' })
  const iconKey = useWatch({ control, name: 'icon_key' })
  const activo = useWatch({ control, name: 'is_active' })
  const descripcion = useWatch({ control, name: 'description' })
  const editando = Boolean(fondo && !clon)

  const arbol = useMemo(
    () =>
      catalogo.ambitos.map((a) => ({
        a,
        cats: catalogo.categorias
          .filter((c) => c.ambito_id === a.id)
          .map((c) => ({ c, subs: catalogo.subcategorias.filter((s) => s.categoria_id === c.id) })),
      })),
    [catalogo],
  )

  // Qué ramas están desplegadas es un estado visual propio: al abrir se expanden los antecesores de las reglas existentes y después manda la persona.
  // Contraer nunca borra reglas.
  const [abiertos, setAbiertos] = useState<Set<string>>(() => {
    const n = new Set<string>()
    for (const { a, cats } of arbol) {
      for (const { c, subs } of cats) {
        if (subs.some((x) => inicialAlcance[`subcategoria:${x.id}`])) { n.add(`ambito:${a.id}`); n.add(`categoria:${c.id}`) }
        if (inicialAlcance[`categoria:${c.id}`]) n.add(`ambito:${a.id}`)
      }
    }
    return n
  })
  const [busqueda, setBusqueda] = useState('')
  const q = busqueda.trim().toLowerCase()
  const alternarAbierto = (k: string) =>
    setAbiertos((p) => {
      const n = new Set(p)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const setRegla = (key: string, v: Regla) => setAlcance((m) => ({ ...m, [key]: v }))
  const cuenta = (claves: string[]) => ({ inc: claves.filter((k) => alcance[k] === 'include').length, exc: claves.filter((k) => alcance[k] === 'exclude').length })
  const coincide = (t: string) => !q || t.toLowerCase().includes(q)
  const idForm = useId()
  const sucio = isDirty || JSON.stringify(alcance) !== JSON.stringify(inicialAlcance) || JSON.stringify(medios) !== JSON.stringify(inicialMedios)

  const enviar = handleSubmit((v) => {
    const scope_rules = Object.entries(alcance)
      .filter(([, e]) => e !== 'none')
      .map(([k, effect]) => {
        const [kind, ref] = k.split(':')
        return { kind: kind as 'ambito' | 'categoria' | 'subcategoria', ref, effect: effect as 'include' | 'exclude' }
      })
    if (!v.is_general && !scope_rules.some((r) => r.effect === 'include')) {
      setErrorReglas('Un fondo específico necesita al menos un ámbito, categoría o subcategoría incluido.')
      return
    }
    setErrorReglas(null)
    const payment_rules = Object.entries(medios)
      .filter(([, e]) => e !== 'none')
      .map(([method, effect]) => ({ method, effect: effect as 'include' | 'exclude' }))
    const payload: FondoPayload = {
      id: editando ? fondo!.id : undefined,
      name: v.name,
      description: v.description,
      icon_key: v.icon_key,
      color_token: v.color_token,
      is_general: v.is_general,
      is_active: v.is_active,
      default_amount: parseMontoNoNegativo(v.default_amount)!,
      scope_rules,
      payment_rules,
      ...(editando && periodoAbierto && periodId && v.period_amount !== '' ? { period_id: periodId, period_amount: parseMontoNoNegativo(v.period_amount)! } : {}),
    }
    onSubmit(payload)
  })

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={editando ? 'Editar fondo' : clon ? 'Clonar fondo' : 'Nuevo fondo'} size="xl"
      description="Un fondo es presupuesto asignado, no dinero ingresado ni una cuenta."
      sucio={sucio}
      footer={(cerrar) => (
        <>
          <Button variant="secondary" onClick={cerrar} disabled={cargando}>Cancelar</Button>
          <Button type="submit" form={idForm} loading={cargando}>{cargando ? 'Revisando…' : 'Guardar fondo'}</Button>
        </>
      )}
      ayuda={
        <>
          <p className="font-semibold">Cómo se aplican las reglas</p>
          <p className="mt-1 text-muted">Si incluyes elementos, el fondo solo admite esos; lo que excluyas nunca se admite (la exclusión gana). Sin reglas de un tipo, el fondo admite todo en ese tipo.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
            <li><b>Sodexo:</b> incluye Alimentación (Trabajo) y el medio Sodexo.</li>
            <li><b>Hogar sin lujos:</b> incluye todo Familia y excluye Salidas.</li>
            <li><b>General:</b> sin reglas; recibe lo que no cubra otro fondo.</li>
          </ul>
          {esGeneral && <p className="mt-2 text-muted">Un Fondo General suele quedar sin reglas de clasificación.</p>}
        </>
      }>
      <form id={idForm} onSubmit={enviar} noValidate className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Field label="Nombre" error={errors.name?.message}>{(p) => <Input {...p} autoFocus {...register('name')} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Importe por defecto (S/)" error={errors.default_amount?.message} hint="Para períodos nuevos.">
              {(p) => <Controller control={control} name="default_amount" render={({ field }) => <MoneyInput {...p} value={field.value} onChange={field.onChange} invalid={Boolean(errors.default_amount)} />} />}
            </Field>
            {editando && periodoAbierto && (
              <Field label="Importe de este período (S/)" error={errors.period_amount?.message} hint="Solo el período abierto.">
                {(p) => <Controller control={control} name="period_amount" render={({ field }) => <MoneyInput {...p} value={field.value} onChange={field.onChange} invalid={Boolean(errors.period_amount)} />} />}
              </Field>
            )}
          </div>
          <Seccion titulo="Apariencia" resumen={`Icono ${nombreIcono(iconKey)} · color ${color}`}>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium">Icono</span>
              <Controller control={control} name="icon_key" render={({ field }) => <SelectorIcono value={field.value} onChange={field.onChange} sugerencias={sugerirIconos(nombreFondo ?? '')} color={color} />} />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium">Color</span>
              <Controller control={control} name="color_token" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
            </div>
          </Seccion>
          <Seccion titulo="Más opciones" inicial={esGeneral} resumen={[esGeneral ? 'Fondo General' : null, activo ? 'Activo' : 'Inactivo', descripcion ? 'con descripción' : null].filter(Boolean).join(' · ')}>
            <Field label="Descripción (opcional)" error={errors.description?.message}>{(p) => <Input {...p} {...register('description')} />}</Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" disabled={editando && fondo?.is_general ? true : hayGeneralActivo && !fondo?.is_general} {...register('is_general')} />
              <span>
                <b>Fondo General</b> (absorbe el excedente de los fondos específicos y puede quedar en negativo).
                {hayGeneralActivo && !fondo?.is_general && <span className="block text-muted">Ya existe un Fondo General activo.</span>}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('is_active')} /> Fondo activo
            </label>
          </Seccion>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {errorReglas && <Alert tone="error">{errorReglas}</Alert>}

          <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-semibold">
              <span>Clasificación que cubre</span>
              <ResumenRamas {...cuenta(Object.keys(alcance))} />
            </legend>
            <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 focus-within:border-pri">
              <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar ámbito, categoría o subcategoría…" aria-label="Buscar en la clasificación"
                className="min-w-0 flex-1 sin-anillo bg-transparent text-sm outline-none placeholder:text-muted" />
            </label>
            <div className="flex h-[clamp(13rem,34dvh,19rem)] flex-col gap-0.5 overflow-y-auto rounded-md border border-line p-1.5">
              {arbol.map(({ a, cats }) => {
                const claveA = `ambito:${a.id}`
                const visibles = cats.map(({ c, subs }) => ({ c, subs, visSubs: subs.filter((s) => coincide(s.name)), ok: coincide(c.name) })).filter((x) => !q || coincide(a.name) || x.ok || x.visSubs.length > 0)
                if (q && !coincide(a.name) && visibles.length === 0) return null
                const abierto = q ? true : abiertos.has(claveA)
                const hijosA = cuenta(cats.flatMap(({ c, subs }) => [`categoria:${c.id}`, ...subs.map((s) => `subcategoria:${s.id}`)]))
                return (
                  <div key={a.id} className="rounded-md">
                    <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
                      <button type="button" aria-expanded={abierto} aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${a.name}`} onClick={() => alternarAbierto(claveA)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <ChevronRight className={cn('size-4 shrink-0 transition-transform', abierto && 'rotate-90')} aria-hidden="true" />
                        <ItemIcon name={a.icon_key} color={a.color_css} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.name}</span>
                        {!abierto && <ResumenRamas {...hijosA} />}
                      </button>
                      <SelectorRegla nombre={a.name} value={alcance[claveA] ?? 'none'} onChange={(v) => setRegla(claveA, v)} />
                    </div>
                    {abierto && (
                      <div className="ml-4 flex flex-col gap-1 border-l border-line pl-2 sm:ml-6 sm:pl-3">
                        {visibles.map(({ c, subs, visSubs }) => {
                          const claveC = `categoria:${c.id}`
                          const abiertoC = q ? true : abiertos.has(claveC)
                          const resumenC = cuenta(subs.map((s) => `subcategoria:${s.id}`))
                          return (
                            <div key={c.id}>
                              <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-2">
                                <button type="button" aria-expanded={abiertoC} aria-label={`${abiertoC ? 'Contraer' : 'Expandir'} ${a.name} › ${c.name}`} disabled={subs.length === 0} onClick={() => alternarAbierto(claveC)} className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60">
                                  <ChevronRight className={cn('size-4 shrink-0 transition-transform', abiertoC && 'rotate-90', subs.length === 0 && 'invisible')} aria-hidden="true" />
                                  <ItemIcon name={c.icon_key} color={c.color_css} />
                                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                                  {!abiertoC && <ResumenRamas {...resumenC} />}
                                </button>
                                <SelectorRegla nombre={`${a.name} › ${c.name}`} value={alcance[claveC] ?? 'none'} onChange={(v) => setRegla(claveC, v)} />
                              </div>
                              {abiertoC && (
                                <div className="ml-4 flex flex-col gap-1 border-l border-line pl-2 sm:ml-6 sm:pl-3">
                                  {(q ? visSubs : subs).map((s) => (
                                    <div key={s.id} className="flex min-w-0 items-center gap-2 px-2 py-0.5">
                                      <span className="min-w-0 flex-1 truncate text-sm text-muted">{s.name}</span>
                                      <SelectorRegla nombre={`${a.name} › ${c.name} › ${s.name}`} value={alcance[`subcategoria:${s.id}`] ?? 'none'} onChange={(v) => setRegla(`subcategoria:${s.id}`, v)} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {q && !arbol.some(({ a, cats }) => coincide(a.name) || cats.some(({ c, subs }) => coincide(c.name) || subs.some((s) => coincide(s.name)))) && <p className="p-3 text-center text-sm text-muted">Nada coincide con «{busqueda}».</p>}
            </div>
          </fieldset>

          <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-semibold">
              <span>Medios de pago</span>
              <ResumenRamas {...cuenta(Object.keys(medios))} />
            </legend>
            <div className="flex flex-col gap-0.5 rounded-md border border-line p-1.5">
              {catalogo.medios.map((m) => (
                <div key={m.id} className="flex min-w-0 items-center gap-2 px-1.5 py-0.5">
                  <ItemIcon name={m.icon_key} color={m.color_css} />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  <SelectorRegla nombre={m.name} value={medios[m.id] ?? 'none'} onChange={(v) => setMedios((x) => ({ ...x, [m.id]: v }))} />
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </form>
    </Modal>
  )
}
