import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Pipette } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { FAMILIAS_COLOR, PALETA, TOKEN_HEX, contraste, hexARgb, hsvARgb, nombreDeColor, normalizarHex, rgbAHex, rgbAHsv, tonos, type Rgb } from '@/domain/color'
import { cn } from '@/lib/cn'
import { Button } from './Button'

/** HEX de un valor guardado: un #RRGGBB o uno de los tokens heredados de antes. */
export const hexDeValor = (v: string | null | undefined): string => (v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : (TOKEN_HEX[v ?? ''] ?? TOKEN_HEX.muted))

interface Props {
  /** #RRGGBB o token heredado. */
  valor: string
  onChange: (hex: string) => void
  /** Texto del grupo para lectores de pantalla. */
  etiqueta?: string
}

/**
 * Selector de color compartido por Fondos y Catálogo: 36 muestras en seis familias con nombre accesible y marca de selección, y un color
 * personalizado en un popover compacto (selector visual, HEX y RGB opcional) con Aplicar y Cancelar. No alarga la tarjeta que lo contiene.
 */
export function SelectorColor({ valor, onChange, etiqueta = 'Color' }: Props) {
  const hex = hexDeValor(valor)
  const enPaleta = PALETA.some((c) => c.hex.toLowerCase() === hex.toLowerCase())
  const rejilla = useRef<HTMLDivElement>(null)
  const [personalizado, setPersonalizado] = useState(false)

  /** Flechas: mueven por la cuadrícula (12 columnas) y seleccionan, como un grupo de radios. */
  function teclas(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const paso: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 12, ArrowUp: -12 }
    const d = e.key === 'Home' ? -i : e.key === 'End' ? PALETA.length - 1 - i : paso[e.key]
    if (d === undefined) return
    e.preventDefault()
    const n = Math.min(PALETA.length - 1, Math.max(0, i + d))
    onChange(PALETA[n].hex)
    rejilla.current?.querySelectorAll<HTMLButtonElement>('button[role=radio]')[n]?.focus()
  }
  const iActual = PALETA.findIndex((c) => c.hex.toLowerCase() === hex.toLowerCase())

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div ref={rejilla} role="radiogroup" aria-label={etiqueta} className="grid grid-cols-6 gap-1.5 sm:grid-cols-9 lg:grid-cols-12">
        {PALETA.map((c, i) => {
          const on = c.hex.toLowerCase() === hex.toLowerCase()
          return (
            <button key={c.hex} type="button" role="radio" aria-checked={on} aria-label={`${c.nombre}, familia ${c.familia.toLowerCase()}`} title={`${c.nombre} · ${c.hex}`}
              tabIndex={on || (iActual < 0 && i === 0) ? 0 : -1}
              onClick={() => onChange(c.hex)} onKeyDown={(e) => teclas(e, i)}
              className={cn('grid aspect-square min-w-7 place-items-center rounded-md text-white transition-transform hover:scale-110', on && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')}
              style={{ background: c.hex }}>
              {on && <Check className="size-3.5 stroke-[3]" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-4 rounded-full border border-line" style={{ background: hex }} />
          <b>{nombreDeColor(hex)}</b>
        </span>
        <Popover.Root open={personalizado} onOpenChange={setPersonalizado}>
          <Popover.Trigger className={cn('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold text-pri hover:bg-pri-soft', !enPaleta && 'bg-pri-soft')}>
            <Pipette className="size-4" aria-hidden="true" /> Color personalizado{!enPaleta && <span className="num text-xs font-normal text-muted">({hex})</span>}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="bottom" align="start" sideOffset={6} collisionPadding={12} avoidCollisions
              onEscapeKeyDown={(e) => e.stopPropagation()}
              className="anim-pop z-[80] w-[min(19.5rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-3 shadow-pop">
              <ColorPersonalizado inicial={hex} onAplicar={(h) => { onChange(h); setPersonalizado(false) }} onCancelar={() => setPersonalizado(false)} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  )
}

/**
 * Disparador compacto «muestra + nombre + Cambiar» que abre el selector en un popover acotado: para formularios donde el color es un dato
 * secundario (fondos) y no debe empujar el resto de campos.
 */
export function ColorCompacto({ valor, onChange, etiqueta = 'Color' }: Props) {
  const [abierto, setAbierto] = useState(false)
  const hex = hexDeValor(valor)
  const id = useId()
  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <span aria-hidden="true" className="size-9 shrink-0 rounded-lg border border-line" style={{ background: hex }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" id={id}>{etiqueta}: {nombreDeColor(hex)}</p>
          <p className="num text-xs text-muted">{hex}</p>
        </div>
        <Popover.Trigger asChild>
          <button type="button" aria-describedby={id} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
            Cambiar <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={6} collisionPadding={12} avoidCollisions onEscapeKeyDown={(e) => e.stopPropagation()}
          className="anim-pop z-[80] max-h-[min(70dvh,26rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-line bg-surface p-3 shadow-pop">
          <SelectorColor valor={valor} onChange={(h) => onChange(h)} etiqueta={etiqueta} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Panel de color libre: área de saturación/brillo, tono, HEX validado y RGB opcional. Trabaja sobre un borrador hasta Aplicar. */
function ColorPersonalizado({ inicial, onAplicar, onCancelar }: { inicial: string; onAplicar: (hex: string) => void; onCancelar: () => void }) {
  const [hex, setHex] = useState(inicial)
  const [texto, setTexto] = useState<string | null>(null)
  const [tono, setTono] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [rgbVisible, setRgbVisible] = useState(false)
  const rgb = hexARgb(hex) ?? [91, 91, 214]
  const [h0, s, v] = rgbAHsv(rgb)
  const h = tono ?? h0
  const claro = tonos(hex, 'claro')
  const oscuro = tonos(hex, 'oscuro')
  const cumple = Boolean(claro && oscuro && claro.contrasteTexto >= 4.5 && claro.contrasteIcono >= 3 && oscuro.contrasteTexto >= 4.5 && oscuro.contrasteIcono >= 3)

  const fijar = (r: Rgb) => { setError(''); setTexto(null); setHex(rgbAHex(r)) }
  const moverSV = (x: number, y: number) => { fijar(hsvARgb([h, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, 1 - y))])); setTono(h) }

  return (
    <div className="flex flex-col gap-2.5">
      <div role="slider" tabIndex={0} aria-label="Saturación y brillo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s * 100)}
        aria-valuetext={`Saturación ${Math.round(s * 100)}%, brillo ${Math.round(v * 100)}%`}
        className="relative h-28 cursor-crosshair touch-none rounded-lg border border-line"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
        onPointerDown={(e) => {
          const el = e.currentTarget
          el.setPointerCapture(e.pointerId)
          const ir = (ev: { clientX: number; clientY: number }) => { const r = el.getBoundingClientRect(); moverSV((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height) }
          ir(e)
          const mover = (ev: PointerEvent) => ir(ev)
          const soltar = () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar) }
          el.addEventListener('pointermove', mover); el.addEventListener('pointerup', soltar)
        }}
        onKeyDown={(e) => {
          const d: Record<string, [number, number]> = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.03], ArrowDown: [0, 0.03] }
          const m = d[e.key]
          if (!m) return
          e.preventDefault()
          moverSV(s + m[0], 1 - v + m[1])
        }}>
        <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <input type="range" min={0} max={360} value={Math.round(h)} aria-label="Tono"
        onChange={(e) => { const nh = Number(e.target.value); setTono(nh); fijar(hsvARgb([nh, s || 0.6, v || 0.8])) }}
        className="h-3 w-full cursor-pointer appearance-none rounded-full border border-line"
        style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }} />
      <div className="flex items-end gap-2">
        <span aria-hidden="true" className="size-9 shrink-0 rounded-lg border border-line" style={{ background: hex }} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="color-hex-pop" className="text-xs font-medium">HEX</label>
          <input id="color-hex-pop" spellCheck={false} maxLength={7} aria-invalid={Boolean(error)} aria-describedby="color-error-pop" value={texto ?? hex}
            onChange={(e) => {
              const t = e.target.value
              setTexto(t)
              const n = normalizarHex(t)
              if (n) { setError(''); setTono(null); setHex(n) } else setError('Usa 6 dígitos hexadecimales, por ejemplo #5B5BD6.')
            }}
            onBlur={() => { setTexto(null); setError('') }}
            className="num rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm uppercase aria-[invalid=true]:border-bad" />
        </div>
        <button type="button" aria-expanded={rgbVisible} onClick={() => setRgbVisible((x) => !x)} className="shrink-0 rounded-md px-2 py-1.5 text-xs font-semibold text-pri hover:bg-pri-soft">RGB</button>
      </div>
      {rgbVisible && (
        <div className="grid grid-cols-3 gap-2">
          {(['R', 'G', 'B'] as const).map((l, i) => (
            <label key={l} className="flex flex-col gap-1 text-xs font-medium">{l}
              <input type="number" min={0} max={255} value={rgb[i]}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (e.target.value === '' || Number.isNaN(n) || n < 0 || n > 255) { setError('Cada canal RGB va de 0 a 255.'); return }
                  const nuevo = [...rgb] as Rgb
                  nuevo[i] = Math.round(n)
                  setTono(null)
                  fijar(nuevo)
                }}
                className="num rounded-md border border-line bg-surface px-2 py-1.5 text-sm font-normal" />
            </label>
          ))}
        </div>
      )}
      <p id="color-error-pop" role="alert" className="min-h-4 text-xs text-bad">{error}</p>
      <p className={cn('rounded-md px-2 py-1 text-xs', cumple ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')} aria-live="polite">
        {cumple ? 'Cumple el contraste en tema claro y oscuro.' : `Contraste bajo; se ajusta solo (${contraste(rgb, [255, 255, 255]).toFixed(1)}:1 sobre blanco).`}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" className="px-3 py-1.5" onClick={onCancelar}>Cancelar</Button>
        <Button className="px-3 py-1.5" onClick={() => onAplicar(hex)} disabled={Boolean(error)}>Aplicar</Button>
      </div>
    </div>
  )
}

export { FAMILIAS_COLOR }
