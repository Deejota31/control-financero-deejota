import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { ColorPicker, IconPicker } from '@/components/ui/IconPicker'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { cn } from '@/lib/cn'
import { parseMontoNoNegativo } from '@/lib/format'
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
  default_amount: z.string().refine((v) => parseMontoNoNegativo(v) !== null, 'Ingresa un importe válido (por ejemplo 250.00).'),
  period_amount: z.string().refine((v) => v === '' || parseMontoNoNegativo(v) !== null, 'Ingresa un importe válido.'),
})
type Values = z.infer<typeof schema>

function SelectorRegla({ nombre, value, onChange }: { nombre: string; value: Regla; onChange: (v: Regla) => void }) {
  const opts: { v: Regla; label: string }[] = [
    { v: 'none', label: 'Sin regla' },
    { v: 'include', label: 'Incluir' },
    { v: 'exclude', label: 'Excluir' },
  ]
  return (
    <div role="radiogroup" aria-label={`Regla para ${nombre}`} className="inline-flex shrink-0 rounded-md bg-surface-2 p-0.5 text-xs font-semibold">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded px-2 py-1',
            value === o.v && o.v === 'include' && 'bg-pri text-pri-fg',
            value === o.v && o.v === 'exclude' && 'bg-bad text-pri-fg',
            value === o.v && o.v === 'none' && 'bg-surface text-fg',
            value !== o.v && 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
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
  const [alcance, setAlcance] = useState<Record<string, Regla>>(() => {
    const m: Record<string, Regla> = {}
    for (const r of inicial.alcance) {
      const k = r.ambito_id ? `ambito:${r.ambito_id}` : r.categoria_id ? `categoria:${r.categoria_id}` : `subcategoria:${r.subcategoria_id}`
      m[k] = r.effect === 'exclude' ? 'exclude' : 'include'
    }
    return m
  })
  const [medios, setMedios] = useState<Record<string, Regla>>(() => Object.fromEntries(inicial.medios.map((r) => [r.payment_method_id, r.effect === 'exclude' ? 'exclude' : 'include'])))
  const [errorReglas, setErrorReglas] = useState<string | null>(null)

  const { register, handleSubmit, control, formState: { errors } } = useForm<Values>({
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

  const setRegla = (key: string, v: Regla) => setAlcance((m) => ({ ...m, [key]: v }))

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
      description="Un fondo es presupuesto asignado, no dinero ingresado ni una cuenta.">
      <form onSubmit={enviar} noValidate className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field label="Nombre" error={errors.name?.message}>{(p) => <Input {...p} autoFocus {...register('name')} />}</Field>
          <Field label="Descripción (opcional)" error={errors.description?.message}>{(p) => <Input {...p} {...register('description')} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Importe por defecto (S/)" error={errors.default_amount?.message} hint="Se usa en los períodos nuevos.">
              {(p) => <Controller control={control} name="default_amount" render={({ field }) => <MoneyInput {...p} value={field.value} onChange={field.onChange} invalid={Boolean(errors.default_amount)} />} />}
            </Field>
            {editando && periodoAbierto && (
              <Field label="Importe de este período (S/)" error={errors.period_amount?.message} hint="Solo cambia el período abierto que estás viendo.">
                {(p) => <Controller control={control} name="period_amount" render={({ field }) => <MoneyInput {...p} value={field.value} onChange={field.onChange} invalid={Boolean(errors.period_amount)} />} />}
              </Field>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Icono</span>
            <Controller control={control} name="icon_key" render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} color={color} />} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Color</span>
            <Controller control={control} name="color_token" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" disabled={editando && fondo?.is_general ? true : hayGeneralActivo && !fondo?.is_general} {...register('is_general')} />
            <span>
              <b>Fondo General</b> (cobertura general; absorbe el excedente de los fondos específicos y puede quedar en negativo).
              {hayGeneralActivo && !fondo?.is_general && <span className="block text-muted">Ya existe un Fondo General activo.</span>}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('is_active')} /> Fondo activo
          </label>
        </div>

        <div className="flex flex-col gap-4">
          <Alert tone="info">
            <b>Cómo se aplican las reglas:</b> si incluyes elementos, el fondo solo admite esos; lo que excluyas nunca se admite (la exclusión gana). Sin reglas de un tipo, el fondo admite todo en ese tipo.
            {esGeneral && ' Un Fondo General suele quedar sin reglas de clasificación.'}
          </Alert>
          {errorReglas && <Alert tone="error">{errorReglas}</Alert>}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Clasificación que cubre</legend>
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border border-line p-2">
              {arbol.map(({ a, cats }) => (
                <details key={a.id} className="rounded-md" open={Boolean(alcance[`ambito:${a.id}`] && alcance[`ambito:${a.id}`] !== 'none') || cats.some((x) => alcance[`categoria:${x.c.id}`] && alcance[`categoria:${x.c.id}`] !== 'none')}>
                  <summary className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
                    <ItemIcon name={a.icon_key} color={a.color_token} />
                    <span className="flex-1 text-sm font-semibold">{a.name}</span>
                    <SelectorRegla nombre={a.name} value={alcance[`ambito:${a.id}`] ?? 'none'} onChange={(v) => setRegla(`ambito:${a.id}`, v)} />
                  </summary>
                  <div className="ml-6 flex flex-col gap-1 border-l border-line pl-3">
                    {cats.map(({ c, subs }) => (
                      <details key={c.id} open={subs.some((s) => alcance[`subcategoria:${s.id}`] && alcance[`subcategoria:${s.id}`] !== 'none')}>
                        <summary className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-2">
                          <ItemIcon name={c.icon_key} color={c.color_token} />
                          <span className="flex-1 text-sm">{c.name}</span>
                          <SelectorRegla nombre={`${a.name} › ${c.name}`} value={alcance[`categoria:${c.id}`] ?? 'none'} onChange={(v) => setRegla(`categoria:${c.id}`, v)} />
                        </summary>
                        <div className="ml-6 flex flex-col gap-1 border-l border-line pl-3">
                          {subs.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 px-2 py-0.5">
                              <span className="flex-1 text-sm text-muted">{s.name}</span>
                              <SelectorRegla nombre={`${a.name} › ${c.name} › ${s.name}`} value={alcance[`subcategoria:${s.id}`] ?? 'none'} onChange={(v) => setRegla(`subcategoria:${s.id}`, v)} />
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Medios de pago</legend>
            <div className="flex flex-col gap-1 rounded-md border border-line p-2">
              {catalogo.medios.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1">
                  <ItemIcon name={m.icon_key} color={m.color_token} />
                  <span className="flex-1 text-sm">{m.name}</span>
                  <SelectorRegla nombre={m.name} value={medios[m.id] ?? 'none'} onChange={(v) => setMedios((x) => ({ ...x, [m.id]: v }))} />
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 lg:col-span-2">
          <Button variant="secondary" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button type="submit" loading={cargando}>{cargando ? 'Revisando…' : 'Guardar fondo'}</Button>
        </div>
      </form>
    </Modal>
  )
}
