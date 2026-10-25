import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { IconPicker } from '@/components/ui/IconPicker'
import { PALETA } from '@/domain/color'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { EditorColor, type ValorColor } from './EditorColor'
import { VistaPreviaColor, type ElementoPrevia } from './VistaPreviaColor'
import { useCatalogoMutaciones, type CatalogoKind, type CatalogoValores } from './useCatalogo'

export interface ItemCatalogo {
  id: string
  name: string
  icon_key: string
  color_token?: string | null
  color_hex?: string | null
  color_mode?: string | null
  color_css?: string
  is_active: boolean
  ambito_id?: string
  categoria_id?: string
}

const CONFIG: Record<CatalogoKind, { singular: string; color: boolean; genero: 'm' | 'f' }> = {
  ambitos: { singular: 'ámbito', color: true, genero: 'm' },
  categorias: { singular: 'categoría', color: true, genero: 'f' },
  subcategorias: { singular: 'subcategoría', color: false, genero: 'f' },
  medios_pago: { singular: 'medio de pago', color: true, genero: 'm' },
}

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre.').max(60, 'Máximo 60 caracteres.'),
  icon_key: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

interface Props {
  kind: CatalogoKind
  item: ItemCatalogo | null
  /** Elementos de la lista actual (para la vista previa y para ordenar «Otros» al final). */
  hermanos: ItemCatalogo[]
  ambitoId: string | null
  categoriaId: string | null
  /** Ámbito de la categoría (herencia de color) o, en subcategorías, color de su categoría. */
  contexto: { nombre: string; hex: string } | null
  modo: 'panel' | 'modal'
  onClose?: () => void
  /** Cambia cada vez que se pide editar: lleva el foco al nombre. */
  focoTick?: number
}

const colorInicial = (kind: CatalogoKind, item: ItemCatalogo | null, hermanos: ItemCatalogo[], contexto: Props['contexto']): ValorColor => {
  if (item) return { hex: item.color_css ?? PALETA[0].hex, modo: item.color_mode === 'inherit' ? 'inherit' : 'own' }
  if (kind === 'categorias' && contexto) return { hex: contexto.hex, modo: 'inherit' }
  return { hex: PALETA[(hermanos.length * 3) % PALETA.length].hex, modo: 'own' }
}

/** Editor de un elemento del catálogo: nombre, ícono y color con vista previa en vivo (claro y oscuro). */
export function ElementoEditor({ kind, item, hermanos, ambitoId, categoriaId, contexto, modo, onClose, focoTick }: Props) {
  const cfg = CONFIG[kind]
  const mut = useCatalogoMutaciones(kind)
  const inicial = useMemo(() => colorInicial(kind, item, hermanos, contexto), [kind, item, hermanos, contexto])
  const [color, setColor] = useState<ValorColor>(inicial)
  const [guardado, setGuardado] = useState<ValorColor>(inicial)
  const [ok, setOk] = useState(false)
  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: item?.name ?? '', icon_key: item?.icon_key ?? 'tag' },
  })
  const nombre = useWatch({ control, name: 'name' })
  const icono = useWatch({ control, name: 'icon_key' })
  const refNombre = useRef<HTMLInputElement | null>(null)
  const { ref: refRhf, ...regNombre } = register('name')

  useEffect(() => { if (focoTick) refNombre.current?.focus() }, [focoTick])

  const sucio = isDirty || color.hex !== guardado.hex || color.modo !== guardado.modo
  const hexEfectivo = cfg.color ? (color.modo === 'inherit' && contexto ? contexto.hex : color.hex) : (contexto?.hex ?? PALETA[0].hex)

  const previa: ElementoPrevia[] = useMemo(() => {
    const base = hermanos.map((h) => ({ id: h.id, nombre: h.name, icono: h.icon_key, hex: h.color_css ?? PALETA[0].hex }))
    const borrador = { id: item?.id ?? 'nuevo', nombre: nombre || (item?.name ?? 'Nuevo'), icono, hex: hexEfectivo }
    return item ? base.map((b) => (b.id === item.id ? borrador : b)) : [...base, borrador]
  }, [hermanos, item, nombre, icono, hexEfectivo])

  const onSubmit = handleSubmit((v) => {
    const colorValues: Partial<CatalogoValores> = !cfg.color ? {} : kind === 'categorias'
      ? { color_mode: color.modo, color_hex: color.modo === 'inherit' ? null : color.hex }
      : { color_hex: color.hex }
    const values: CatalogoValores = {
      name: v.name, icon_key: v.icon_key, ...colorValues,
      ...(!item && kind === 'categorias' ? { ambito_id: ambitoId! } : {}),
      ...(!item && kind === 'subcategorias' ? { categoria_id: categoriaId! } : {}),
    }
    mut.guardar.mutate(
      { id: item?.id, values, hermanos: hermanos.map((h) => ({ id: h.id, name: h.name })) },
      {
        onSuccess: () => {
          toast.success(item ? 'Cambios guardados.' : `${cfg.singular.charAt(0).toUpperCase()}${cfg.singular.slice(1)} creado.`)
          reset(v)
          setGuardado(color)
          setOk(true)
          onClose?.()
        },
        onError: (e) => { setOk(false); toast.error(mensajeDeError(e)) },
      },
    )
  })

  const descartar = () => { reset({ name: item?.name ?? '', icon_key: item?.icon_key ?? 'tag' }); setColor(guardado); setOk(false) }

  const formulario = (
    <form onSubmit={onSubmit} noValidate className={cn('flex min-w-0 flex-col gap-5', modo === 'panel' && 'rounded-xl border border-line bg-surface p-5')} aria-label={item ? `Editar ${cfg.singular}` : `Nuevo ${cfg.singular}`}>
      <Field label="Nombre" error={errors.name?.message}>
        {(p) => <Input {...p} {...regNombre} ref={(el) => { refRhf(el); refNombre.current = el }} autoFocus={modo === 'modal'} onChange={(e) => { setOk(false); void regNombre.onChange(e) }} />}
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Icono</span>
        <Controller control={control} name="icon_key" render={({ field }) => <IconPicker value={field.value} onChange={(v) => { setOk(false); field.onChange(v) }} color={hexEfectivo} />} />
      </div>
      {cfg.color && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Color</span>
          <EditorColor valor={color} onChange={(v) => { setOk(false); setColor(v) }} ambito={kind === 'categorias' ? contexto : null} />
        </div>
      )}
      {!cfg.color && contexto && <p className="text-sm text-muted">Las subcategorías usan el color de su categoría.</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {modo === 'modal' ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={mut.guardar.isPending}>Cancelar</Button>
            <Button type="submit" loading={mut.guardar.isPending}>{mut.guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </>
        ) : (
          <>
            <Button type="submit" loading={mut.guardar.isPending} disabled={!sucio}>{mut.guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</Button>
            <Button variant="ghost" disabled={!sucio || mut.guardar.isPending} onClick={descartar}>Descartar</Button>
            <p role="status" aria-live="polite" className={cn('flex items-center gap-1.5 text-sm font-medium', mut.guardar.isError && sucio ? 'text-bad' : sucio ? 'text-warn' : ok ? 'text-ok' : 'text-muted')}>
              {mut.guardar.isError && sucio ? <><AlertCircle className="size-4" aria-hidden="true" />No se pudo guardar. Inténtalo de nuevo.</>
                : mut.guardar.isPending ? 'Guardando…'
                  : sucio ? <><AlertCircle className="size-4" aria-hidden="true" />Hay cambios sin guardar</>
                    : ok ? <><CheckCircle2 className="size-4" aria-hidden="true" />Cambios guardados</> : 'Sin cambios'}
            </p>
          </>
        )}
      </div>
    </form>
  )

  const vistaPrevia = <VistaPreviaColor elementos={previa} actualId={item?.id ?? 'nuevo'} />

  if (modo === 'modal') {
    return (
      <Modal open onOpenChange={(o) => !o && onClose?.()} title={`${cfg.genero === 'f' ? 'Nueva' : 'Nuevo'} ${cfg.singular}`} size="xl">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">{formulario}<div>{vistaPrevia}</div></div>
      </Modal>
    )
  }
  return <>{formulario}<div className="min-w-0">{vistaPrevia}</div></>
}
