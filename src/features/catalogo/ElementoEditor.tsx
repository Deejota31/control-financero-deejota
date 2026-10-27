import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { SelectorIcono } from '@/components/ui/SelectorIcono'
import { PALETA } from '@/domain/color'
import { sugerirIconos } from '@/domain/iconos'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { EditorColor, type ValorColor } from './EditorColor'
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
  subcategorias: { singular: 'subcategoría', color: true, genero: 'f' },
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

const colorInicial = (_kind: CatalogoKind, item: ItemCatalogo | null, hermanos: ItemCatalogo[], contexto: Props['contexto']): ValorColor => {
  if (item) return { hex: item.color_css ?? PALETA[0].hex, modo: item.color_mode === 'inherit' ? 'inherit' : 'own' }
  if (_kind === 'subcategorias' && contexto) return { hex: contexto.hex, modo: 'inherit' }
  // Una categoría nueva nace con color propio (distinto del ámbito y de sus hermanas); heredar del ámbito es una opción explícita.
  const usados = new Set([...hermanos.map((h) => h.color_css?.toLowerCase()), contexto?.hex?.toLowerCase()])
  const libre = PALETA.find((c) => !usados.has(c.hex.toLowerCase()))
  return { hex: (libre ?? PALETA[(hermanos.length * 3) % PALETA.length]).hex, modo: 'own' }
}

/** Editor de un elemento del catálogo: nombre, ícono y color con vista previa en vivo (claro y oscuro). */
export function ElementoEditor({ kind, item, hermanos, ambitoId, categoriaId, contexto, modo, onClose, focoTick }: Props) {
  const cfg = CONFIG[kind]
  const mut = useCatalogoMutaciones(kind)
  const inicial = useMemo(() => colorInicial(kind, item, hermanos, contexto), [kind, item, hermanos, contexto])
  const [color, setColor] = useState<ValorColor>(inicial)
  const [guardado, setGuardado] = useState<ValorColor>(inicial)
  const [ok, setOk] = useState(false)
  /** Una elección manual de ícono siempre gana sobre la sugerencia automática. */
  const [iconoManual, setIconoManual] = useState(false)
  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: item?.name ?? '', icon_key: item?.icon_key ?? 'tag' },
  })
  const nombre = useWatch({ control, name: 'name' })
  const iconoForm = useWatch({ control, name: 'icon_key' })
  const refNombre = useRef<HTMLInputElement | null>(null)
  const idForm = useId()
  const { ref: refRhf, ...regNombre } = register('name')

  useEffect(() => { if (focoTick) refNombre.current?.focus() }, [focoTick])

  const sugeridos = useMemo(() => sugerirIconos(nombre ?? '', contexto?.nombre), [nombre, contexto?.nombre])
  // En un elemento nuevo, mientras el usuario no elija, se usa la mejor sugerencia; al editar se conserva el ícono guardado.
  const autoSugerido = !item && !iconoManual && sugeridos[0]?.puntaje > 0
  const icono = autoSugerido ? sugeridos[0].id : iconoForm

  const sucio = isDirty || color.hex !== guardado.hex || color.modo !== guardado.modo
  const hexEfectivo = color.modo === 'inherit' && contexto ? contexto.hex : color.hex

  const onSubmit = handleSubmit((v) => {
    const colorValues: Partial<CatalogoValores> = !cfg.color ? {} : kind === 'categorias' || kind === 'subcategorias'
      ? { color_mode: color.modo, color_hex: color.modo === 'inherit' ? null : color.hex }
      : { color_hex: color.hex }
    const values: CatalogoValores = {
      name: v.name, icon_key: icono, ...colorValues,
      ...(!item && kind === 'categorias' ? { ambito_id: ambitoId! } : {}),
      ...(!item && kind === 'subcategorias' ? { categoria_id: categoriaId! } : {}),
    }
    mut.guardar.mutate(
      { id: item?.id, values, hermanos: hermanos.map((h) => ({ id: h.id, name: h.name })) },
      {
        onSuccess: () => {
          toast.success(item ? 'Cambios guardados.' : `${cfg.singular.charAt(0).toUpperCase()}${cfg.singular.slice(1)} ${cfg.genero === 'f' ? 'creada' : 'creado'}.`)
          reset(v)
          setGuardado(color)
          setOk(true)
          onClose?.()
        },
        onError: (e) => { setOk(false); toast.error(mensajeDeError(e)) },
      },
    )
  })

  const descartar = () => { reset({ name: item?.name ?? '', icon_key: item?.icon_key ?? 'tag' }); setColor(guardado); setIconoManual(false); setOk(false) }

  const formulario = (
    <form id={idForm} onSubmit={onSubmit} noValidate className={cn('flex min-w-0 flex-col gap-3.5', modo === 'panel' && 'max-w-3xl rounded-xl border border-line bg-surface p-4')} aria-label={item ? `Editar ${cfg.singular}` : `Nuevo ${cfg.singular}`}>
      <Field label="Nombre" error={errors.name?.message}>
        {(p) => <Input {...p} {...regNombre} ref={(el) => { refRhf(el); refNombre.current = el }} autoFocus={modo === 'modal'} onChange={(e) => { setOk(false); void regNombre.onChange(e) }} />}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Icono</span>
        <Controller control={control} name="icon_key" render={({ field }) => <SelectorIcono value={icono} onChange={(v) => { setOk(false); setIconoManual(true); field.onChange(v) }} sugerencias={sugeridos} color={hexEfectivo} nota={autoSugerido ? 'Sugerido por el nombre; puedes cambiarlo.' : undefined} />} />
      </div>
      {cfg.color && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Color</span>
          <EditorColor valor={color} onChange={(v) => { setOk(false); setColor(v) }} padre={kind === 'categorias' && contexto ? { ...contexto, tipo: 'ámbito' } : kind === 'subcategorias' && contexto ? { ...contexto, tipo: 'categoría' } : null} />
        </div>
      )}
      {modo === 'panel' && (
      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-b-xl border-t border-line bg-surface px-4 py-3">
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
      </div>
      )}
    </form>
  )

  if (modo === 'modal') {
    return (
      <Modal open onOpenChange={(o) => !o && onClose?.()} title={`${cfg.genero === 'f' ? 'Nueva' : 'Nuevo'} ${cfg.singular}`} size="md" sucio={sucio}
        footer={(cerrar) => (
          <>
            <Button variant="secondary" onClick={cerrar} disabled={mut.guardar.isPending}>Cancelar</Button>
            <Button type="submit" form={idForm} loading={mut.guardar.isPending}>{mut.guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </>
        )}>
        {formulario}
      </Modal>
    )
  }
  return formulario
}
