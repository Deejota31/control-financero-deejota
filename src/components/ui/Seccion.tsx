import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  titulo: string
  /** Resumen del estado actual, visible aunque la sección esté contraída (p. ej. «Variable · con nota»). */
  resumen?: ReactNode
  /** Abierta al montar. Después manda la decisión de la persona. */
  inicial?: boolean
  children: ReactNode
}

/** Sección contraíble para opciones secundarias de un formulario: no alarga el formulario hasta que se abre. */
export function Seccion({ titulo, resumen, inicial = false, children }: Props) {
  const id = useId()
  const [abierta, setAbierta] = useState(inicial)
  return (
    <div className="rounded-lg border border-line">
      <button type="button" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((a) => !a)}
        className="flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-surface-2">
        <span className="shrink-0 text-sm font-semibold">{titulo}</span>
        {resumen && <span className="min-w-0 flex-1 truncate text-xs text-muted">{resumen}</span>}
        <ChevronDown className={cn('ml-auto size-4 shrink-0 text-muted transition-transform', abierta && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id={id} hidden={!abierta} className="flex min-w-0 flex-col gap-4 border-t border-line p-3">{children}</div>
    </div>
  )
}
