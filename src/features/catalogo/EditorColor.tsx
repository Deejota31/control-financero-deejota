import { Droplet, Link2 } from 'lucide-react'
import { SelectorColor } from '@/components/ui/SelectorColor'
import { nombreDeColor } from '@/domain/color'
import { cn } from '@/lib/cn'

export interface ValorColor {
  /** #RRGGBB; con herencia se conserva solo para la vista previa y no se guarda. */
  hex: string
  modo: 'own' | 'inherit'
}

interface Props {
  valor: ValorColor
  onChange: (v: ValorColor) => void
  /** Elemento del que se puede heredar (el ámbito de una categoría o la categoría de una subcategoría). Sin él no se ofrece la herencia. */
  padre?: { nombre: string; hex: string; tipo: 'ámbito' | 'categoría' } | null
}

/** Color de un elemento del catálogo: heredar del padre (con su muestra) o color propio con el selector compartido. */
export function EditorColor({ valor, onChange, padre }: Props) {
  const hereda = valor.modo === 'inherit' && Boolean(padre)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {padre && (
        <div role="radiogroup" aria-label="Origen del color" className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1">
          <button type="button" role="radio" aria-checked={hereda} onClick={() => onChange({ hex: padre.hex, modo: 'inherit' })}
            className={cn('flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium', hereda ? 'bg-surface text-pri shadow-sm' : 'text-muted hover:text-fg')}>
            <Link2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Heredar de {padre.nombre}</span>
            <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border border-line" style={{ background: padre.hex }} />
          </button>
          <button type="button" role="radio" aria-checked={!hereda} onClick={() => onChange({ hex: hereda ? padre.hex : valor.hex, modo: 'own' })}
            className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium', !hereda ? 'bg-surface text-pri shadow-sm' : 'text-muted hover:text-fg')}>
            <Droplet className="size-4 shrink-0" aria-hidden="true" /> Color propio
          </button>
        </div>
      )}
      {hereda ? (
        <p className="text-sm text-muted">
          Usa el color de <b className="text-fg">{padre!.nombre}</b> ({nombreDeColor(padre!.hex)}). Si {padre!.tipo === 'ámbito' ? 'el ámbito' : 'la categoría'} cambia de color, este elemento lo seguirá.
        </p>
      ) : (
        <SelectorColor valor={valor.hex} onChange={(hex) => onChange({ hex, modo: 'own' })} />
      )}
    </div>
  )
}
