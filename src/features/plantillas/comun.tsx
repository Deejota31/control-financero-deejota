import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { cn } from '@/lib/cn'
import { formatSoles } from '@/lib/format'
import type { EstadoSeleccion } from '@/domain/agrupacion'

/** Casilla con estado indeterminado (algunas hijas marcadas). */
export function CasillaTriestado({ estado, onChange, etiqueta, disabled, className }: { estado: EstadoSeleccion; onChange: (marcar: boolean) => void; etiqueta: string; disabled?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = estado === 'some' }, [estado])
  return (
    // El área pulsable llega a 44 × 44 px (pseudo-elemento de la etiqueta) sin agrandar la casilla ni la fila.
    <label className="relative inline-grid size-5 shrink-0 place-items-center after:absolute after:-inset-3 after:content-['']">
      <input ref={ref} type="checkbox" className={cn('relative z-[1] size-5', className)} aria-label={etiqueta} checked={estado === 'all'} disabled={disabled}
        onChange={(e) => onChange(estado === 'some' ? true : e.target.checked)} />
    </label>
  )
}

/**
 * Sección expandible de un gestor de plantillas: casilla de la sección (con estado indeterminado), título con icono, conteos y subtotal
 * seleccionado, y botones para subir/bajar la sección cuando el modo lo permite. El contenido (las filas) se oculta al contraer, pero la selección se conserva.
 */
export function SeccionPlantillas({ titulo, icono, color, total, seleccionadas, subtotal, estado, abierta, onAbrir, onSeleccionar, onMover, children }: {
  titulo: string; icono?: string | null; color?: string | null; total: number; seleccionadas: number; subtotal: number
  estado: EstadoSeleccion; abierta: boolean; onAbrir: () => void; onSeleccionar: (marcar: boolean) => void
  /** Presente solo cuando el modo permite reordenar secciones. */
  onMover?: (delta: -1 | 1) => void
  children: ReactNode
}) {
  return (
    <section aria-label={titulo} className="rounded-xl border border-line">
      <div className="flex min-w-0 items-center gap-2 rounded-t-xl bg-surface-2/60 px-3 py-1.5">
        <CasillaTriestado estado={estado} onChange={onSeleccionar} etiqueta={`Seleccionar sección ${titulo}`} />
        <button type="button" aria-expanded={abierta} onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight className={cn('size-4 shrink-0 transition-transform', abierta && 'rotate-90')} aria-hidden="true" />
          <ItemIcon name={icono} color={color} />
          <span className="min-w-0 truncate text-sm font-semibold">{titulo}</span>
          <span className="ml-auto min-w-0 text-right text-xs text-muted">
            {total} {total === 1 ? 'plantilla' : 'plantillas'}
            {seleccionadas > 0 && <> · <b className="text-fg">{seleccionadas} {seleccionadas === 1 ? 'seleccionada' : 'seleccionadas'}</b> · <b className="num text-fg">{formatSoles(subtotal)}</b></>}
          </span>
        </button>
        {onMover && (
          <span className="flex shrink-0">
            <button type="button" aria-label={`Subir sección ${titulo}`} onClick={() => onMover(-1)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg max-sm:size-11"><ArrowUp className="size-4" aria-hidden="true" /></button>
            <button type="button" aria-label={`Bajar sección ${titulo}`} onClick={() => onMover(1)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg max-sm:size-11"><ArrowDown className="size-4" aria-hidden="true" /></button>
          </span>
        )}
      </div>
      {abierta && <div className="flex flex-col gap-1.5 p-2">{children}</div>}
    </section>
  )
}
