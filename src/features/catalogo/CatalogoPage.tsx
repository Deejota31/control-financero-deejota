import { zodResolver } from '@hookform/resolvers/zod'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowDown, ArrowUp, Pencil, Plus, Power, Tags, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { ColorPicker, IconPicker } from '@/components/ui/IconPicker'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { codigoDeError, mensajeDeError } from '@/lib/errors'
import { colorVar } from '@/lib/icons'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { opciones, useCatalogo, useCatalogoMutaciones, type Catalogo, type CatalogoKind } from './useCatalogo'

interface Item {
  id: string
  name: string
  icon_key: string
  color_token?: string | null
  is_active: boolean
  ambito_id?: string
  categoria_id?: string
}

const CONFIG: Record<CatalogoKind, { label: string; singular: string; color: boolean; genero: 'm' | 'f' }> = {
  ambitos: { label: 'Ámbitos', singular: 'ámbito', color: true, genero: 'm' },
  categorias: { label: 'Categorías', singular: 'categoría', color: true, genero: 'f' },
  subcategorias: { label: 'Subcategorías', singular: 'subcategoría', color: false, genero: 'f' },
  medios_pago: { label: 'Medios de pago', singular: 'medio de pago', color: true, genero: 'm' },
}

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre.').max(60, 'Máximo 60 caracteres.'),
  icon_key: z.string().min(1),
  color_token: z.string(),
})
type FormValues = z.infer<typeof schema>

export function CatalogoPage() {
  const catalogo = useCatalogo()
  const [tab, setTab] = useState<CatalogoKind>('ambitos')

  if (catalogo.isPending) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-3" role="status" aria-label="Cargando catálogo">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }
  if (catalogo.isError) return <ErrorState message="No se pudo cargar el catálogo." onRetry={catalogo.refetch} />

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <p className="text-sm text-muted">
        Las opciones usadas por gastos anteriores no se eliminan: se desactivan y conservan su significado en el histórico.
      </p>
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as CatalogoKind)}>
        <Tabs.List aria-label="Tipo de catálogo" className="flex flex-wrap gap-1 rounded-md bg-surface-2 p-1">
          {(Object.keys(CONFIG) as CatalogoKind[]).map((k) => (
            <Tabs.Trigger
              key={k}
              value={k}
              className="rounded-md px-4 py-2 text-sm font-semibold text-muted data-[state=active]:bg-surface data-[state=active]:text-pri"
            >
              {CONFIG[k].label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {(Object.keys(CONFIG) as CatalogoKind[]).map((k) => (
          <Tabs.Content key={k} value={k} className="mt-4">
            <Seccion kind={k} catalogo={catalogo} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  )
}

function Seccion({ kind, catalogo }: { kind: CatalogoKind; catalogo: Catalogo }) {
  const cfg = CONFIG[kind]
  const mut = useCatalogoMutaciones(kind)
  const [ambitoElegido, setAmbitoId] = useState<string | null>(null)
  const [categoriaElegida, setCategoriaId] = useState<string | null>(null)
  const [editando, setEditando] = useState<Item | 'nuevo' | null>(null)
  const [borrar, setBorrar] = useState<Item | null>(null)

  // Los filtros por padre arrancan en el primer elemento disponible (valor derivado, sin efectos).
  const ambitoId = catalogo.ambitos.some((a) => a.id === ambitoElegido) ? ambitoElegido : (catalogo.ambitos[0]?.id ?? null)
  const categoriasDelAmbito = useMemo(() => catalogo.categorias.filter((c) => c.ambito_id === ambitoId), [catalogo.categorias, ambitoId])
  const categoriaId = categoriasDelAmbito.some((c) => c.id === categoriaElegida) ? categoriaElegida : (categoriasDelAmbito[0]?.id ?? null)

  const items: Item[] = useMemo(() => {
    if (kind === 'ambitos') return catalogo.ambitos
    if (kind === 'medios_pago') return catalogo.medios
    if (kind === 'categorias') return categoriasDelAmbito
    return catalogo.subcategorias.filter((s) => s.categoria_id === categoriaId)
  }, [kind, catalogo, categoriasDelAmbito, categoriaId])

  const necesitaPadre = kind === 'categorias' ? !ambitoId : kind === 'subcategorias' ? !categoriaId : false

  function mover(i: number, delta: -1 | 1) {
    const ids = items.map((x) => x.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    mut.ordenar.mutate(ids, { onError: (e) => toast.error(mensajeDeError(e, 'No se pudo guardar el orden.')) })
  }

  function alternar(it: Item) {
    mut.activar.mutate(
      { id: it.id, is_active: !it.is_active },
      {
        onSuccess: () => toast.success(it.is_active ? `${it.name} desactivado.` : `${it.name} activado.`),
        onError: (e) => toast.error(mensajeDeError(e)),
      },
    )
  }

  function confirmarBorrado() {
    if (!borrar) return
    mut.eliminar.mutate(borrar.id, {
      onSuccess: () => {
        toast.success(`${borrar.name} eliminado.`)
        setBorrar(null)
      },
      onError: (e) => {
        setBorrar(null)
        toast.error(
          codigoDeError(e) === '23503'
            ? `"${borrar.name}" está en uso (gastos, fondos u opciones hijas). Desactívalo para conservar el histórico.`
            : mensajeDeError(e),
        )
      },
    })
  }

  return (
    <section aria-label={cfg.label} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {(kind === 'categorias' || kind === 'subcategorias') && (
            <div className="flex w-56 flex-col gap-1.5">
              <label htmlFor={`ambito-${kind}`} className="text-sm font-medium">Ámbito</label>
              <Combobox id={`ambito-${kind}`} value={ambitoId} onChange={setAmbitoId} options={opciones(catalogo.ambitos, ambitoId)} searchable={false} />
            </div>
          )}
          {kind === 'subcategorias' && (
            <div className="flex w-56 flex-col gap-1.5">
              <label htmlFor="categoria-sub" className="text-sm font-medium">Categoría</label>
              <Combobox id="categoria-sub" value={categoriaId} onChange={setCategoriaId} options={opciones(categoriasDelAmbito, categoriaId)} searchable={false} placeholder="Sin categorías" />
            </div>
          )}
        </div>
        <Button onClick={() => setEditando('nuevo')} disabled={necesitaPadre}>
          <Plus className="size-4" aria-hidden="true" />
          {cfg.genero === 'f' ? 'Nueva' : 'Nuevo'} {cfg.singular}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={`Aún no hay ${cfg.label.toLowerCase()}${kind === 'categorias' ? ' en este ámbito' : kind === 'subcategorias' ? ' en esta categoría' : ''}`}
          description={necesitaPadre ? 'Primero crea el elemento superior.' : `Crea ${cfg.genero === 'f' ? 'la primera' : 'el primero'} para poder usarl${cfg.genero === 'f' ? 'a' : 'o'} en tus gastos.`}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {items.map((it, i) => {
            return (
              <li key={it.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !it.is_active && 'opacity-70')}>
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2" style={{ color: colorVar(it.color_token) }}>
                  <ItemIcon name={it.icon_key} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{it.name}</span>
                <Pill tone={it.is_active ? 'ok' : 'neutral'}>{it.is_active ? 'Activo' : 'Inactivo'}</Pill>
                <div className="flex items-center gap-1">
                  <IconBtn label={`Subir ${it.name}`} disabled={i === 0 || mut.ordenar.isPending} onClick={() => mover(i, -1)}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </IconBtn>
                  <IconBtn label={`Bajar ${it.name}`} disabled={i === items.length - 1 || mut.ordenar.isPending} onClick={() => mover(i, 1)}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </IconBtn>
                  <IconBtn label={`Editar ${it.name}`} onClick={() => setEditando(it)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconBtn>
                  <IconBtn label={it.is_active ? `Desactivar ${it.name}` : `Activar ${it.name}`} onClick={() => alternar(it)}>
                    <Power className="size-4" aria-hidden="true" />
                  </IconBtn>
                  <IconBtn label={`Eliminar ${it.name}`} onClick={() => setBorrar(it)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </IconBtn>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editando && (
        <FormularioItem
          kind={kind}
          item={editando === 'nuevo' ? null : editando}
          hermanos={items}
          ambitoId={ambitoId}
          categoriaId={categoriaId}
          onClose={() => setEditando(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(borrar)}
        onOpenChange={(o) => !o && setBorrar(null)}
        title={`¿Eliminar ${borrar?.name ?? ''}?`}
        description="Solo se puede eliminar si no tiene gastos, fondos ni opciones hijas asociadas. Si está en uso, desactívalo en su lugar."
        confirmLabel="Eliminar"
        danger
        loading={mut.eliminar.isPending}
        onConfirm={confirmarBorrado}
      />
    </section>
  )
}

function IconBtn({ label, children, ...props }: { label: string; children: React.ReactNode } & React.ComponentProps<'button'>) {
  return (
    <button type="button" aria-label={label} title={label} className="grid size-8 place-items-center rounded-md hover:bg-surface-2 disabled:opacity-40" {...props}>
      {children}
    </button>
  )
}

function FormularioItem({
  kind, item, hermanos, ambitoId, categoriaId, onClose,
}: {
  kind: CatalogoKind
  item: Item | null
  hermanos: Item[]
  ambitoId: string | null
  categoriaId: string | null
  onClose: () => void
}) {
  const cfg = CONFIG[kind]
  const mut = useCatalogoMutaciones(kind)
  const {
    register, handleSubmit, control, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: item?.name ?? '', icon_key: item?.icon_key ?? 'tag', color_token: item?.color_token ?? 'c1' },
  })
  const color = useWatch({ control, name: 'color_token' })

  const onSubmit = handleSubmit((v) => {
    const values = {
      name: v.name,
      icon_key: v.icon_key,
      ...(cfg.color ? { color_token: v.color_token } : {}),
      ...(!item && kind === 'categorias' ? { ambito_id: ambitoId! } : {}),
      ...(!item && kind === 'subcategorias' ? { categoria_id: categoriaId! } : {}),
    }
    mut.guardar.mutate(
      { id: item?.id, values, hermanos: hermanos.map((h) => ({ id: h.id, name: h.name })) },
      {
        onSuccess: () => {
          toast.success(item ? 'Cambios guardados.' : `${cfg.singular.charAt(0).toUpperCase()}${cfg.singular.slice(1)} creado.`)
          onClose()
        },
        onError: (e) => toast.error(mensajeDeError(e)),
      },
    )
  })

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item ? `Editar ${cfg.singular}` : `${cfg.genero === 'f' ? 'Nueva' : 'Nuevo'} ${cfg.singular}`} size="md">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Nombre" error={errors.name?.message}>
          {(p) => <Input {...p} autoFocus {...register('name')} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Icono</span>
          <Controller control={control} name="icon_key" render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} color={cfg.color ? color : null} />} />
        </div>
        {cfg.color && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Color</span>
            <Controller control={control} name="color_token" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mut.guardar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={mut.guardar.isPending}>
            {mut.guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
