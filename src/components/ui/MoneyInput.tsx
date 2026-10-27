import { cn } from '@/lib/cn'
import { parseImporte } from '@/lib/format'

interface MoneyInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  disabled?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
  placeholder?: string
}

/** Importe con prefijo S/ fijo dentro del mismo contorno, de modo que nunca se separe del número. */
export function MoneyInput({ id, value, onChange, onBlur, invalid, disabled, placeholder = '0.00', ...aria }: MoneyInputProps) {
  return (
    <div
      className={cn(
        'flex items-center rounded-md border border-line bg-surface focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-pri',
        invalid && 'border-bad',
        disabled && 'opacity-60',
      )}
    >
      <span aria-hidden="true" className="select-none whitespace-nowrap pl-3 pr-1 text-sm text-muted">S/</span>
      <input
        id={id}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={aria['aria-describedby']}
        aria-label={aria['aria-label']}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const n = parseImporte(value)
          if (n !== null) onChange(n.toFixed(2))
          onBlur?.()
        }}
        className="sin-anillo num w-full bg-transparent py-2 pl-1 pr-3 text-sm outline-none placeholder:text-muted"
      />
    </div>
  )
}
