import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { ItemIcon } from './ItemIcon'

export interface ComboOption {
  value: string
  label: string
  icon?: string | null
  color?: string | null
  hint?: string
  disabled?: boolean
  /** Texto breve para el disparador cuando está elegida; el menú muestra `label`. */
  corto?: string
}

interface ComboboxProps {
  id?: string
  value: string | null | undefined
  onChange: (value: string | null) => void
  options: ComboOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  clearable?: boolean
  disabled?: boolean
  searchable?: boolean
  invalid?: boolean
  'aria-describedby'?: string
  /** Nombre accesible cuando no hay una etiqueta <label> asociada. */
  'aria-label'?: string
  className?: string
  /** Altura reducida (para barras de herramientas y paginadores). */
  compacto?: boolean
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Selector con icono, búsqueda, estado seleccionado y navegación por teclado. */
export function Combobox({
  id, value, onChange, options, placeholder = 'Seleccionar…', searchPlaceholder = 'Buscar…', emptyText = 'Sin resultados.',
  clearable, disabled, searchable = true, invalid, className, compacto, ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    const q = norm(query.trim())
    return q ? options.filter((o) => norm(o.label).includes(q)) : options
  }, [options, query])

  function choose(o: ComboOption) {
    if (o.disabled) return
    onChange(o.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) choose(filtered[active])
    }
  }

  return (
    <div className={cn('relative flex', className)}>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) {
            setQuery('')
            setActive(Math.max(0, options.findIndex((x) => x.value === value)))
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={aria['aria-describedby']}
            aria-label={aria['aria-label']}
            disabled={disabled}
            className={cn(
              'flex w-full items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-bad',
              compacto && 'h-8 gap-1.5 px-2 py-0 text-xs',
              clearable && selected && 'pr-9',
            )}
          >
            {selected && (selected.icon || !compacto) && <ItemIcon name={selected.icon} color={selected.color} className="size-4 shrink-0" />}
            <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-muted')}>{selected ? (selected.corto ?? selected.label) : placeholder}</span>
            <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            aria-label={`Opciones: ${placeholder}`}
            className="anim-pop z-[80] w-[var(--radix-popover-trigger-width)] min-w-56 rounded-lg border border-line bg-surface p-1.5 shadow-pop"
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-line px-2 pb-1.5 pt-1">
                <Search className="size-4 text-muted" aria-hidden="true" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].value}` : undefined}
                  className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted"
                />
              </div>
            )}
            <ul id={listId} ref={listRef} role="listbox" tabIndex={searchable ? -1 : 0} aria-activedescendant={!searchable && filtered[active] ? `${listId}-${filtered[active].value}` : undefined} aria-label={placeholder} onKeyDown={searchable ? undefined : onKeyDown} className="max-h-64 overflow-y-auto pt-1">
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>}
              {filtered.map((o, i) => {
                const isSel = o.value === value
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${o.value}`}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm',
                      i === active && 'bg-surface-2',
                      isSel && 'font-semibold text-pri',
                      o.disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <ItemIcon name={o.icon} color={o.color} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
                    {isSel && <Check className="size-4 shrink-0" aria-hidden="true" />}
                  </li>
                )
              })}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {clearable && selected && !disabled && (
        <button
          type="button"
          aria-label="Limpiar selección"
          onClick={() => onChange(null)}
          className="absolute right-8 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted hover:bg-surface-2"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
