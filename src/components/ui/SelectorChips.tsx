import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { colorVar } from '@/lib/icons'
import { ItemIcon } from './ItemIcon'

export interface ItemChip {
  id: string
  name: string
  icon_key: string
  color_css?: string
  is_active: boolean
}

/**
 * Selección visual con chips: cada opción muestra el icono y el color que tiene en el Catálogo y respeta su orden.
 * Es un grupo de radio (un valor); con `limpiable`, volver a pulsar la opción elegida la quita.
 */
export function SelectorChips({ etiqueta, items, value, onChange, limpiable, deshabilitado, invalido, descritoPor, className, variante = 'chip' }: {
  etiqueta: string
  items: ItemChip[]
  value: string
  onChange: (id: string) => void
  limpiable?: boolean
  deshabilitado?: boolean
  invalido?: boolean
  descritoPor?: string
  className?: string
  /** `chip`: píldora compacta (clasificación). `ficha`: icono sobre el nombre, en rejilla (medios de pago). */
  variante?: 'chip' | 'ficha'
}) {
  const visibles = items.filter((i) => i.is_active || i.id === value)
  return (
    <div role="radiogroup" aria-label={etiqueta} aria-invalid={invalido || undefined} aria-describedby={descritoPor} aria-disabled={deshabilitado || undefined}
      className={cn(variante === 'ficha' ? 'grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3' : 'flex flex-wrap gap-1.5', className)}>
      {visibles.map((i) => {
        const marcado = i.id === value
        return (
          <button key={i.id} type="button" role="radio" aria-checked={marcado} disabled={deshabilitado}
            onClick={() => onChange(marcado && limpiable ? '' : i.id)}
            style={{ '--k': colorVar(i.color_css) } as CSSProperties}
            className={cn(
              'selector-chip min-w-0 border text-sm transition-colors disabled:opacity-50',
              variante === 'ficha'
                ? 'flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-xs font-semibold'
                : 'inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 font-medium',
              marcado ? 'border-[var(--k)] bg-[color-mix(in_srgb,var(--k)_14%,var(--surface))] font-bold' : 'border-line bg-surface hover:bg-surface-2',
            )}>
            <ItemIcon name={i.icon_key} className={variante === 'ficha' ? 'size-4 text-[var(--k)]' : 'size-3.5 shrink-0 text-[var(--k)]'} />
            <span className={cn('min-w-0', variante === 'ficha' ? 'max-w-full truncate' : 'break-words text-left')}>{i.name}{!i.is_active && ' (inactivo)'}</span>
            {marcado && variante === 'chip' && <Check className="size-3 shrink-0 text-[var(--k)]" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
