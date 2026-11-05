import type { ReactNode } from 'react'
import { Pill } from '@/components/ui/States'
import { cn } from '@/lib/cn'

/** Tarjeta de contenido del Dashboard: título, descripción opcional, acción a la derecha y la marca «Filtrado» cuando los filtros reducen lo que muestra. */
export function Tarjeta({ titulo, descripcion, derecha, children, className, filtrada }: { titulo: string; descripcion?: string; derecha?: ReactNode; children: ReactNode; className?: string; filtrada?: boolean }) {
  return (
    <section aria-label={titulo} className={cn('flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold">{titulo}</h2>
            {filtrada && <Pill tone="pri">Filtrado</Pill>}
          </div>
          {descripcion && <p className="text-xs text-muted">{descripcion}</p>}
        </div>
        {derecha}
      </div>
      {children}
    </section>
  )
}
