import * as Popover from '@radix-ui/react-popover'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarRange, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { fromIso, toIso } from '@/lib/format'

/** «01 oct – 31 oct 2026» (con año en ambos extremos si difieren). */
export function resumenPeriodo(desde: string, hasta: string): string {
  const d = fromIso(desde), h = fromIso(hasta)
  const mismoAnio = d.getFullYear() === h.getFullYear()
  const corto = (x: Date) => format(x, 'dd MMM', { locale: es }).replace('.', '')
  const largo = (x: Date) => format(x, 'dd MMM yyyy', { locale: es }).replace('.', '')
  return mismoAnio ? `${corto(d)} – ${largo(h)}` : `${largo(d)} – ${largo(h)}`
}

interface Props {
  desde: string
  hasta: string
  formato: string
  /** Mes en curso (referencia de «Este mes»). */
  hoy: string
  onAplicar: (desde: string, hasta: string) => void
}

/** Un solo control para el período: resumen compacto y popover con fechas personalizadas y atajos. */
export function SelectorPeriodo({ desde, hasta, formato, hoy, onAplicar }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [d, setD] = useState(desde)
  const [h, setH] = useState(hasta)
  const invalido = d > h
  const mes = (delta: number) => { const b = subMonths(fromIso(hoy), delta); setD(toIso(startOfMonth(b))); setH(toIso(endOfMonth(b))) }
  const esMesActual = desde === toIso(startOfMonth(fromIso(hoy))) && hasta === toIso(endOfMonth(fromIso(hoy)))

  return (
    <Popover.Root open={abierto} onOpenChange={(o) => { setAbierto(o); if (o) { setD(desde); setH(hasta) } }}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Período: ${resumenPeriodo(desde, hasta)}`} className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm font-medium hover:bg-surface-2 data-[state=open]:border-pri">
          <CalendarRange className="size-4 shrink-0 text-pri" aria-hidden="true" />
          <span className="num min-w-0 flex-1 truncate">{resumenPeriodo(desde, hasta)}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} aria-label="Elegir período" className="anim-pop z-[80] w-80 rounded-xl border border-line bg-surface p-4 shadow-pop">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => mes(0)}>Este mes</Button>
              <Button variant="secondary" className="flex-1" onClick={() => mes(1)}>Mes anterior</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><label htmlFor="p-desde" className="text-sm font-medium">Desde</label><DatePicker id="p-desde" value={d} onChange={(v) => { setD(v); if (v > h) setH(v) }} formato={formato} /></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="p-hasta" className="text-sm font-medium">Hasta</label><DatePicker id="p-hasta" value={h} onChange={(v) => { setH(v); if (v < d) setD(v) }} formato={formato} /></div>
            </div>
            {invalido && <p role="alert" className="text-sm text-bad">La fecha inicial es posterior a la final.</p>}
            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              {!esMesActual ? (
                <Button variant="ghost" onClick={() => { mes(0); onAplicar(toIso(startOfMonth(fromIso(hoy))), toIso(endOfMonth(fromIso(hoy)))); setAbierto(false) }}>Limpiar rango</Button>
              ) : <span />}
              <Button disabled={invalido} onClick={() => { onAplicar(d, h); setAbierto(false) }}>Aplicar</Button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
