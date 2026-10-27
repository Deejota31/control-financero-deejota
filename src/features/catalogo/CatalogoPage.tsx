import * as Tabs from '@radix-ui/react-tabs'
import { ArrowDown, ArrowUp, Pencil, Plus, Power, Sparkles, Tags, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { cn } from '@/lib/cn'
import { codigoDeError, mensajeDeError } from '@/lib/errors'
import { ArmonizarDialog, type CambioArmonia } from './ArmonizarDialog'
import { ElementoEditor, type ItemCatalogo } from './ElementoEditor'
import { opciones, useCatalogo, useCatalogoMutaciones, type Catalogo, type CatalogoKind } from './useCatalogo'

const CONFIG: Record<CatalogoKind, { label: string; singular: string; color: boolean; genero: 'm' | 'f' }> = {
  ambitos: { label: 'Ámbitos', singular: 'ámbito', color: true, genero: 'm' },
  categorias: { label: 'Categorías', singular: 'categoría', color: true, genero: 'f' },
  subcategorias: { label: 'Subcategorías', singular: 'subcategoría', color: true, genero: 'f' },
  medios_pago: { label: 'Medios de pago', singular: 'medio de pago', color: true, genero: 'm' },
}

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
    <div className="mx-auto flex max-w-[1760px] flex-col gap-4">
      <p className="text-sm text-muted">
        Las opciones usadas por gastos anteriores no se eliminan: se desactivan y conservan su significado en el histórico. Cambiar un color solo cambia cómo se ve, nunca los importes.
      </p>
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as CatalogoKind)}>
        <Tabs.List aria-label="Tipo de catálogo" className="flex flex-wrap gap-1 rounded-md bg-surface-2 p-1">
          {(Object.keys(CONFIG) as CatalogoKind[]).map((k) => (
            <Tabs.Trigger key={k} value={k} className="rounded-md px-4 py-2 text-sm font-semibold text-muted data-[state=active]:bg-surface data-[state=active]:text-pri">
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
  const [elegido, setElegido] = useState<string | null>(null)
  const [focoTick, setFocoTick] = useState(0)
  const [creando, setCreando] = useState(false)
  const [borrar, setBorrar] = useState<ItemCatalogo | null>(null)
  const [armonizando, setArmonizando] = useState(false)

  // Los filtros por padre arrancan en el primer elemento disponible (valor derivado, sin efectos).
  const ambitoId = catalogo.ambitos.some((a) => a.id === ambitoElegido) ? ambitoElegido : (catalogo.ambitos[0]?.id ?? null)
  const categoriasDelAmbito = useMemo(() => catalogo.categorias.filter((c) => c.ambito_id === ambitoId), [catalogo.categorias, ambitoId])
  const categoriaId = categoriasDelAmbito.some((c) => c.id === categoriaElegida) ? categoriaElegida : (categoriasDelAmbito[0]?.id ?? null)

  const items: ItemCatalogo[] = useMemo(() => {
    if (kind === 'ambitos') return catalogo.ambitos
    if (kind === 'medios_pago') return catalogo.medios
    if (kind === 'categorias') return categoriasDelAmbito
    return catalogo.subcategorias.filter((s) => s.categoria_id === categoriaId)
  }, [kind, catalogo, categoriasDelAmbito, categoriaId])

  const seleccionado = items.find((i) => i.id === elegido) ?? items[0] ?? null
  const necesitaPadre = kind === 'categorias' ? !ambitoId : kind === 'subcategorias' ? !categoriaId : false
  const ambitoActual = catalogo.ambitos.find((a) => a.id === ambitoId)
  const categoriaActual = catalogo.categorias.find((c) => c.id === categoriaId)
  const contexto = kind === 'categorias' ? (ambitoActual ? { nombre: ambitoActual.name, hex: ambitoActual.color_css } : null)
    : kind === 'subcategorias' ? (categoriaActual ? { nombre: categoriaActual.name, hex: categoriaActual.color_css } : null) : null

  function mover(i: number, delta: -1 | 1) {
    const ids = items.map((x) => x.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    mut.ordenar.mutate(ids, { onError: (e) => toast.error(mensajeDeError(e, 'No se pudo guardar el orden.')) })
  }

  function alternar(it: ItemCatalogo) {
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

  /** Aplica los cambios elegidos en el diálogo de armonía y permite deshacerlos (restaura modo y color previos). */
  function aplicarArmonia(cambios: CambioArmonia[]) {
    const conHerencia = kind === 'categorias' || kind === 'subcategorias'
    const previos = cambios.map((c) => {
      const it = items.find((i) => i.id === c.id)!
      return { id: c.id, values: conHerencia && it.color_mode === 'inherit' ? { color_hex: null, color_mode: 'inherit' as const } : { color_hex: it.color_hex ?? null, ...(conHerencia ? { color_mode: 'own' as const } : {}) } }
    })
    const nuevos = cambios.map((c) => ({ id: c.id, values: { color_hex: c.hex, ...(conHerencia ? { color_mode: 'own' as const } : {}) } }))
    setArmonizando(false)
    mut.colorear.mutate(nuevos, {
      onSuccess: () => toast.success(`Paleta armonizada en ${cambios.length} ${cambios.length === 1 ? 'elemento' : 'elementos'}.`, {
        action: { label: 'Deshacer', onClick: () => mut.colorear.mutate(previos, { onError: (e) => toast.error(mensajeDeError(e)) }) },
      }),
      onError: (e) => toast.error(mensajeDeError(e)),
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
        <div className="flex flex-wrap gap-2">
          {cfg.color && items.length > 1 && (
            <Button variant="secondary" onClick={() => setArmonizando(true)} loading={mut.colorear.isPending}>
              <Sparkles className="size-4" aria-hidden="true" /> Armonizar paleta
            </Button>
          )}
          <Button onClick={() => setCreando(true)} disabled={necesitaPadre}>
            <Plus className="size-4" aria-hidden="true" />
            {cfg.genero === 'f' ? 'Nueva' : 'Nuevo'} {cfg.singular}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={`Aún no hay ${cfg.label.toLowerCase()}${kind === 'categorias' ? ' en este ámbito' : kind === 'subcategorias' ? ' en esta categoría' : ''}`}
          description={necesitaPadre ? 'Primero crea el elemento superior.' : `Crea ${cfg.genero === 'f' ? 'la primera' : 'el primero'} para poder usarl${cfg.genero === 'f' ? 'a' : 'o'} en tus gastos.`}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <ul aria-label={`Lista de ${cfg.label.toLowerCase()}`} className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {items.map((it, i) => {
              const activo = seleccionado?.id === it.id
              return (
                <li key={it.id} className={cn('flex flex-wrap items-center gap-2 px-3 py-2', activo && 'bg-pri-soft', !it.is_active && 'opacity-70')}>
                  <button type="button" aria-pressed={activo} aria-label={`Ver ${it.name}`} onClick={() => setElegido(it.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border" style={{ background: `color-mix(in srgb, ${it.color_css} 12%, transparent)`, borderColor: `color-mix(in srgb, ${it.color_css} 40%, transparent)` }}>
                      <ItemIcon name={it.icon_key} color={it.color_css} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{it.name}</span>
                  </button>
                  {!it.is_active && <Pill tone="neutral">Inactivo</Pill>}
                  <div className="flex items-center gap-0.5">
                    <IconBtn label={`Subir ${it.name}`} disabled={i === 0 || mut.ordenar.isPending} onClick={() => mover(i, -1)}><ArrowUp className="size-4" aria-hidden="true" /></IconBtn>
                    <IconBtn label={`Bajar ${it.name}`} disabled={i === items.length - 1 || mut.ordenar.isPending} onClick={() => mover(i, 1)}><ArrowDown className="size-4" aria-hidden="true" /></IconBtn>
                    <IconBtn label={`Editar ${it.name}`} onClick={() => { setElegido(it.id); setFocoTick((t) => t + 1) }}><Pencil className="size-4" aria-hidden="true" /></IconBtn>
                    <IconBtn label={it.is_active ? `Desactivar ${it.name}` : `Activar ${it.name}`} onClick={() => alternar(it)}><Power className="size-4" aria-hidden="true" /></IconBtn>
                    <IconBtn label={`Eliminar ${it.name}`} onClick={() => setBorrar(it)}><Trash2 className="size-4" aria-hidden="true" /></IconBtn>
                  </div>
                </li>
              )
            })}
          </ul>
          {seleccionado && (
            <div className="contents">
              <ElementoEditor
                key={seleccionado.id}
                kind={kind}
                item={seleccionado}
                hermanos={items}
                ambitoId={ambitoId}
                categoriaId={categoriaId}
                contexto={contexto}
                modo="panel"
                focoTick={focoTick}
              />
            </div>
          )}
        </div>
      )}

      {creando && (
        <ElementoEditor kind={kind} item={null} hermanos={items} ambitoId={ambitoId} categoriaId={categoriaId} contexto={contexto} modo="modal" onClose={() => setCreando(false)} />
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
      {armonizando && <ArmonizarDialog items={items} hereda={kind === 'categorias' ? 'ámbito' : kind === 'subcategorias' ? 'categoría' : null} onConfirmar={aplicarArmonia} onClose={() => setArmonizando(false)} />}
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
