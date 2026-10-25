import { cn } from '@/lib/cn'
import { COLOR_TOKENS, ICON_KEYS, ICONOS, colorVar } from '@/lib/icons'

export function IconPicker({ value, onChange, color }: { value: string; onChange: (k: string) => void; color?: string | null }) {
  return (
    <div role="radiogroup" aria-label="Icono" className="grid grid-cols-7 gap-1 sm:grid-cols-9">
      {ICON_KEYS.map((k) => {
        const Icon = ICONOS[k].icon
        const on = value === k
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={ICONOS[k].label}
            title={ICONOS[k].label}
            onClick={() => onChange(k)}
            className={cn('grid size-9 place-items-center rounded-md border', on ? 'border-pri bg-pri-soft' : 'border-line hover:bg-surface-2')}
          >
            <Icon className="size-4" style={{ color: on ? colorVar(color) : undefined }} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {COLOR_TOKENS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={cn('size-7 rounded-full border-2', value === c ? 'border-fg' : 'border-transparent')}
          style={{ background: colorVar(c) }}
        />
      ))}
    </div>
  )
}
