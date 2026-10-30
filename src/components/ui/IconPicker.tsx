import { cn } from '@/lib/cn'
import { COLOR_TOKENS, colorVar } from '@/lib/icons'

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
