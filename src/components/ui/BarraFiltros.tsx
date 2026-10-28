import { SlidersHorizontal } from 'lucide-react'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

/**
 * Barra de filtros compartida. En escritorio (xl) todos los controles van en una sola fila y reparten el ancho según su `peso`; en pantallas
 * medianas la fila se desplaza solo dentro de la barra; en móvil se contrae tras un botón «Filtros» con contador.
 */
export function BarraFiltros({ contador = 0, children, acciones, className, etiqueta = 'Filtros' }: { contador?: number; children: ReactNode; acciones?: ReactNode; className?: string; etiqueta?: string }) {
  const [abierta, setAbierta] = useState(false)
  const id = useId()
  return (
    <section aria-label={etiqueta} className={cn('rounded-xl border border-line bg-surface p-2 shadow-sm', className)}>
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <Button variant="secondary" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((a) => !a)}>
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filtros{contador > 0 && <span className="rounded-full bg-pri px-1.5 text-xs text-pri-fg" aria-label={`${contador} filtros activos`}>{contador}</span>}
        </Button>
        {acciones}
      </div>
      <div id={id} className={cn('grid-cols-2 items-center gap-2 sm:-m-1 sm:flex sm:flex-nowrap sm:overflow-x-auto sm:p-1', abierta ? 'mt-2 grid sm:mt-0' : 'hidden sm:flex')}>
        {children}
        <span className="hidden sm:block">{acciones}</span>
      </div>
    </section>
  )
}

/**
 * Celda de la barra: `min` es su ancho mínimo legible y `peso` reparte el espacio sobrante. Si no caben todas con sus mínimos, la barra se
 * desplaza en horizontal solo dentro de sí misma (nunca la página).
 */
export function CeldaFiltro({ peso = 1, min = '9rem', completa, children }: { peso?: number; min?: string; completa?: boolean; children: ReactNode }) {
  return (
    <div className={cn('min-w-0 sm:shrink-0 sm:basis-[var(--min)] sm:grow-[var(--peso)]', completa && 'col-span-2')} style={{ '--peso': peso, '--min': min } as CSSProperties}>
      {children}
    </div>
  )
}
