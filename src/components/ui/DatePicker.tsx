import * as Popover from '@radix-ui/react-popover'
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subDays,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { formatFecha, fromIso, toIso } from '@/lib/format'

interface DatePickerProps {
  id?: string
  value: string
  onChange: (iso: string) => void
  /** Formato de la cuenta (profiles.date_format). */
  formato?: string
  placeholder?: string
  min?: string
  max?: string
  invalid?: boolean
  disabled?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
}

const DIAS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

/** Calendario con navegación mensual, accesos rápidos y control completo por teclado. */
export function DatePicker({ id, value, onChange, formato = 'dd/MM/yyyy', placeholder = 'Elegir fecha', min, max, invalid, disabled, ...aria }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? fromIso(value) : null
  const [view, setView] = useState<Date>(() => selected ?? new Date())
  const [focus, setFocus] = useState<Date>(() => selected ?? new Date())
  const gridRef = useRef<HTMLDivElement>(null)
  const [today] = useState(() => new Date())

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(view), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(view), { weekStartsOn: 1 }),
  })

  const semanas = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))

  const disabledDay = (d: Date) => Boolean((min && toIso(d) < min) || (max && toIso(d) > max))

  function pick(d: Date) {
    if (disabledDay(d)) return
    onChange(toIso(d))
    setOpen(false)
  }

  function moveFocus(next: Date) {
    setFocus(next)
    if (!isSameMonth(next, view)) setView(next)
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${toIso(next)}"]`)?.focus())
  }

  function onGridKey(e: React.KeyboardEvent) {
    const map: Record<string, Date> = {
      ArrowLeft: subDays(focus, 1),
      ArrowRight: addDays(focus, 1),
      ArrowUp: subDays(focus, 7),
      ArrowDown: addDays(focus, 7),
      PageUp: addMonths(focus, -1),
      PageDown: addMonths(focus, 1),
    }
    if (map[e.key]) {
      e.preventDefault()
      moveFocus(map[e.key])
    }
  }

  const title = format(view, 'MMMM yyyy', { locale: es })

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          const base = selected ?? new Date()
          setView(base)
          setFocus(base)
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={aria['aria-describedby']}
          aria-label={aria['aria-label'] ? `${aria['aria-label']}: ${value ? formatFecha(value, formato) : placeholder}` : undefined}
          aria-haspopup="dialog"
          className="flex w-full items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-left text-sm disabled:opacity-60 aria-[invalid=true]:border-bad"
        >
          <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span className={cn('flex-1 num', !value && 'text-muted')}>{value ? formatFecha(value, formato) : placeholder}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => {
            // El foco entra directamente en el día seleccionado (o el de hoy) para operar con flechas.
            e.preventDefault()
            requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>('[role="gridcell"][tabindex="0"]')?.focus())
          }}
          className="anim-pop z-[80] w-72 rounded-lg border border-line bg-surface p-3 shadow-pop" aria-label="Calendario">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Mes anterior" onClick={() => setView(addMonths(view, -1))} className="grid size-8 place-items-center rounded-md hover:bg-surface-2">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold capitalize" aria-live="polite">{title}</span>
            <button type="button" aria-label="Mes siguiente" onClick={() => setView(addMonths(view, 1))} className="grid size-8 place-items-center rounded-md hover:bg-surface-2">
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          {/* Estructura ARIA completa: grid > row > columnheader/gridcell */}
          <div ref={gridRef} role="grid" aria-label={title} onKeyDown={onGridKey} className="flex flex-col gap-y-0.5">
            <div role="row" className="grid grid-cols-7 text-center text-xs uppercase text-muted">
              {DIAS.map((d) => (
                <span key={d} role="columnheader" className="py-1">{d}</span>
              ))}
            </div>
            {semanas.map((semana) => (
              <div key={toIso(semana[0])} role="row" className="grid grid-cols-7">
                {semana.map((d) => {
                  const sel = selected && isSameDay(d, selected)
                  const out = !isSameMonth(d, view)
                  const isFocus = isSameDay(d, focus)
                  return (
                    <button
                      key={toIso(d)}
                      type="button"
                      role="gridcell"
                      data-date={toIso(d)}
                      tabIndex={isFocus ? 0 : -1}
                      aria-selected={Boolean(sel)}
                      aria-label={format(d, "d 'de' MMMM yyyy", { locale: es })}
                      disabled={disabledDay(d)}
                      onClick={() => pick(d)}
                      className={cn(
                        'mx-auto grid size-9 place-items-center rounded-md text-sm num disabled:opacity-30',
                        out && 'text-muted',
                        isSameDay(d, today) && !sel && 'border border-pri',
                        sel ? 'bg-pri font-semibold text-pri-fg' : 'hover:bg-surface-2',
                      )}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 border-t border-line pt-3">
            <button type="button" onClick={() => pick(today)} className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm font-medium hover:bg-surface-2">
              Hoy
            </button>
            <button type="button" onClick={() => pick(subDays(today, 1))} className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm font-medium hover:bg-surface-2">
              Ayer
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
