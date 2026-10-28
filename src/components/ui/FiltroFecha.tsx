import * as Popover from '@radix-ui/react-popover'
import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { formatMes, fromIso, toIso } from '@/lib/format'
import { Button } from './Button'
import { DatePicker } from './DatePicker'
import { estadoDelMes, TEXTO_ESTADO, type EstadoMes } from '@/domain/periodo'

/** «01 oct – 31 oct 2026» (con año en ambos extremos si difieren). */
export function resumenPeriodo(desde: string, hasta: string): string {
  const d = fromIso(desde), h = fromIso(hasta)
  const corto = (x: Date) => format(x, 'dd MMM', { locale: es }).replace('.', '')
  const largo = (x: Date) => format(x, 'dd MMM yyyy', { locale: es }).replace('.', '')
  return d.getFullYear() === h.getFullYear() ? `${corto(d)} – ${largo(h)}` : `${largo(d)} – ${largo(h)}`
}

const primero = (iso: string) => toIso(startOfMonth(fromIso(iso)))
const ultimo = (iso: string) => toIso(endOfMonth(fromIso(iso)))
/** ¿El rango es exactamente un mes natural? */
export const esMesNatural = (desde: string, hasta: string) => desde === primero(desde) && hasta === ultimo(desde)

const COLOR_ESTADO: Record<EstadoMes, string> = { open: 'text-ok', closed: 'text-bad', future: 'text-pri' }
const FONDO_ESTADO: Record<EstadoMes, string> = { open: 'bg-ok-soft', closed: 'bg-bad-soft', future: 'bg-pri-soft' }

interface Props {
  /** «rango»: Desde/Hasta libres (Dashboard, Gastos). «mes»: solo períodos mensuales (Fondos: el presupuesto es mensual y no se prorratea). */
  modo: 'rango' | 'mes'
  desde: string
  hasta: string
  formato: string
  /** Hoy en la zona horaria del usuario (yyyy-MM-dd). */
  hoy: string
  onAplicar: (desde: string, hasta: string) => void
  /** Último mes (primer día) al que se puede avanzar. */
  maximo?: string
  className?: string
}

/**
 * Selector de período compartido: flechas para ir al período anterior o siguiente, mes y año visibles, indicador de estado del período y un
 * popover con accesos rápidos y selección de fechas con calendario. Cambiar el período solo cambia lo que se consulta; no modifica registros.
 */
export function FiltroFecha({ modo, desde, hasta, formato, hoy, onAplicar, maximo, className }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [d, setD] = useState(desde)
  const [h, setH] = useState(hasta)
  const [anio, setAnio] = useState(fromIso(desde).getFullYear())
  const [mesSel, setMesSel] = useState(primero(desde))
  const mesNatural = esMesNatural(desde, hasta)
  const etiqueta = mesNatural ? formatMes(desde) : resumenPeriodo(desde, hasta)
  const estado: EstadoMes | null = mesNatural ? estadoDelMes(desde, hoy) : null
  const mesActual = primero(hoy)
  const tope = maximo ?? (modo === 'mes' ? mesActual : undefined)

  /** Períodos consecutivos: un mes natural salta de mes; un rango personalizado salta su propia duración. */
  function mover(sentido: -1 | 1) {
    if (mesNatural) { const b = subMonths(fromIso(desde), -sentido); onAplicar(toIso(startOfMonth(b)), toIso(endOfMonth(b))); return }
    const n = differenceInCalendarDays(fromIso(hasta), fromIso(desde)) + 1
    onAplicar(toIso(addDays(fromIso(desde), sentido * n)), toIso(addDays(fromIso(hasta), sentido * n)))
  }
  const siguienteBloqueado = Boolean(tope && (mesNatural ? primero(toIso(addDays(fromIso(hasta), 1))) > tope : primero(hasta) > tope))
  const rapido = (delta: number) => { const b = subMonths(fromIso(hoy), delta); const [a, z] = [toIso(startOfMonth(b)), toIso(endOfMonth(b))]; setD(a); setH(z); setMesSel(a); setAnio(b.getFullYear()) }
  const invalido = modo === 'rango' && d > h
  const abrir = (o: boolean) => { setAbierto(o); if (o) { setD(desde); setH(hasta); setMesSel(primero(desde)); setAnio(fromIso(desde).getFullYear()) } }
  const aplicar = () => { if (modo === 'mes') onAplicar(mesSel, ultimo(mesSel)); else onAplicar(d, h); setAbierto(false) }

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <div className="flex h-12 min-w-0 flex-1 items-center rounded-lg border border-line bg-surface">
        <button type="button" aria-label={mesNatural ? 'Ir al mes anterior' : 'Ir al período anterior'} onClick={() => mover(-1)} className="grid h-full w-9 shrink-0 place-items-center rounded-l-lg text-muted hover:bg-surface-2 hover:text-fg"><ChevronLeft className="size-4" aria-hidden="true" /></button>
        <Popover.Root open={abierto} onOpenChange={abrir}>
          <Popover.Trigger asChild>
            <button type="button" className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 hover:bg-surface-2">
              <span className="num max-w-full truncate text-sm font-semibold leading-tight"><span className="sr-only">Período: </span>{etiqueta}</span>
              {estado ? <span className={cn('rounded-full px-2 text-[10.5px] font-semibold leading-4', COLOR_ESTADO[estado], FONDO_ESTADO[estado])}>{TEXTO_ESTADO[estado]}</span> : <span className="text-[10.5px] leading-4 text-muted">Rango personalizado</span>}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" side="bottom" sideOffset={6} collisionPadding={12} aria-label="Elegir período" onEscapeKeyDown={(e) => e.stopPropagation()}
              className="anim-pop z-[80] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-4 shadow-pop">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Accesos rápidos</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => rapido(0)}>Este mes</Button>
                    <Button variant="secondary" className="flex-1" onClick={() => rapido(1)}>Mes anterior</Button>
                  </div>
                </div>
                {modo === 'rango' ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Seleccionar rango</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5"><label htmlFor="ff-desde" className="text-sm font-medium">Desde</label><DatePicker id="ff-desde" value={d} onChange={(v) => setD(v)} formato={formato} /></div>
                      <div className="flex flex-col gap-1.5"><label htmlFor="ff-hasta" className="text-sm font-medium">Hasta</label><DatePicker id="ff-hasta" value={h} onChange={(v) => setH(v)} formato={formato} /></div>
                    </div>
                    {invalido && <p role="alert" className="mt-2 text-sm text-bad">La fecha inicial es posterior a la final.</p>}
                  </div>
                ) : (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Período presupuestario</p>
                    <div className="mb-2 flex items-center justify-between">
                      <button type="button" aria-label="Año anterior" onClick={() => setAnio((a) => a - 1)} className="grid size-8 place-items-center rounded-md hover:bg-surface-2"><ChevronLeft className="size-4" aria-hidden="true" /></button>
                      <b className="num text-sm">{anio}</b>
                      <button type="button" aria-label="Año siguiente" disabled={Boolean(tope && `${anio + 1}-01-01` > tope)} onClick={() => setAnio((a) => a + 1)} className="grid size-8 place-items-center rounded-md hover:bg-surface-2 disabled:opacity-40"><ChevronRight className="size-4" aria-hidden="true" /></button>
                    </div>
                    <div role="group" aria-label={`Meses de ${anio}`} className="grid grid-cols-4 gap-1.5">
                      {Array.from({ length: 12 }, (_, i) => {
                        const iso = `${anio}-${String(i + 1).padStart(2, '0')}-01`
                        const sel = iso === mesSel
                        return <button key={iso} type="button" aria-pressed={sel} disabled={Boolean(tope && iso > tope)} onClick={() => setMesSel(iso)} className={cn('rounded-md border px-1 py-1.5 text-sm font-medium capitalize disabled:opacity-35', sel ? 'border-pri bg-pri-soft text-pri' : 'border-line hover:bg-surface-2')}>{format(fromIso(iso), 'MMM', { locale: es }).replace('.', '')}</button>
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 border-t border-line pt-3">
                  <Button variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button>
                  <Button disabled={invalido} onClick={aplicar}>Aplicar</Button>
                </div>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button type="button" aria-label={mesNatural ? 'Ir al mes siguiente' : 'Ir al período siguiente'} disabled={siguienteBloqueado} onClick={() => mover(1)} className="grid h-full w-9 shrink-0 place-items-center rounded-r-lg text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"><ChevronRight className="size-4" aria-hidden="true" /></button>
      </div>
    </div>
  )
}
