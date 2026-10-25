import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMes } from '@/lib/format'
import { sumarMeses } from '@/features/fondos/useFondos'

/** Navegación entre meses con flechas. `mes` es el primer día del mes en ISO. */
export function MesSelector({ mes, onChange, maximo }: { mes: string; onChange: (m: string) => void; maximo?: string }) {
  const siguiente = sumarMeses(mes, 1)
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-line bg-surface p-1">
      <button type="button" aria-label="Mes anterior" onClick={() => onChange(sumarMeses(mes, -1))} className="grid size-8 place-items-center rounded-md hover:bg-surface-2">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-36 text-center text-sm font-semibold" aria-live="polite">{formatMes(mes)}</span>
      <button
        type="button"
        aria-label="Mes siguiente"
        disabled={Boolean(maximo && siguiente > maximo)}
        onClick={() => onChange(siguiente)}
        className="grid size-8 place-items-center rounded-md hover:bg-surface-2 disabled:opacity-40"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
