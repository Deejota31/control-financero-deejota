import { Check, Droplet, Link2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PALETA, contraste, hexARgb, hsvARgb, nombreDeColor, normalizarHex, rgbAHex, rgbAHsv, tonos, type Rgb } from '@/domain/color'
import { cn } from '@/lib/cn'

export interface ValorColor {
  /** #RRGGBB; con herencia se conserva solo para la vista previa y no se guarda. */
  hex: string
  modo: 'own' | 'inherit'
}

interface Props {
  valor: ValorColor
  onChange: (v: ValorColor) => void
  /** Ámbito del que hereda una categoría. Sin él no se ofrece la herencia. */
  ambito?: { nombre: string; hex: string } | null
}

/** Selector de color: paleta de 20, herencia del ámbito y color personalizado (HEX/RGB) con indicador de contraste. */
export function EditorColor({ valor, onChange, ambito }: Props) {
  const [avanzado, setAvanzado] = useState(false)
  const hereda = valor.modo === 'inherit' && Boolean(ambito)
  const enPaleta = PALETA.some((c) => c.hex === valor.hex)

  return (
    <div className="flex flex-col gap-3">
      {ambito && (
        <div role="radiogroup" aria-label="Origen del color" className="inline-flex w-fit rounded-lg border border-line bg-surface-2 p-1">
          <button type="button" role="radio" aria-checked={hereda} onClick={() => onChange({ hex: ambito.hex, modo: 'inherit' })}
            className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium', hereda ? 'bg-surface text-pri shadow-sm' : 'text-muted hover:text-fg')}>
            <Link2 className="size-4" aria-hidden="true" /> Heredar de {ambito.nombre}
          </button>
          <button type="button" role="radio" aria-checked={!hereda} onClick={() => onChange({ hex: hereda ? ambito.hex : valor.hex, modo: 'own' })}
            className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium', !hereda ? 'bg-surface text-pri shadow-sm' : 'text-muted hover:text-fg')}>
            <Droplet className="size-4" aria-hidden="true" /> Color propio
          </button>
        </div>
      )}

      {hereda ? (
        <p className="text-sm text-muted">Usa el color de <b className="text-fg">{ambito!.nombre}</b> ({nombreDeColor(ambito!.hex)}). Si el ámbito cambia de color, esta categoría lo seguirá.</p>
      ) : avanzado ? (
        <Avanzado valor={valor} onChange={(hex) => onChange({ hex, modo: 'own' })} onVolver={() => setAvanzado(false)} />
      ) : (
        <>
          <div role="radiogroup" aria-label="Paleta de colores" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {PALETA.map((c) => {
              const on = valor.hex === c.hex
              return (
                <button key={c.hex} type="button" role="radio" aria-checked={on} aria-label={`${c.nombre} ${c.hex}`} title={`${c.nombre} · ${c.hex}`}
                  onClick={() => onChange({ hex: c.hex, modo: 'own' })}
                  className={cn('grid aspect-square place-items-center rounded-lg border-2 border-transparent text-white transition-transform hover:scale-110', on && 'outline-2 outline-offset-2 outline-fg')}
                  style={{ background: c.hex }}>
                  {on && <Check className="size-4 stroke-[3]" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setAvanzado(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-pri hover:underline">
              <Droplet className="size-4" aria-hidden="true" /> Color personalizado (HEX / RGB)…
            </button>
            {!enPaleta && <span className="text-sm text-muted">Personalizado activo: <code className="num rounded bg-surface-2 px-1.5 py-0.5 text-xs">{valor.hex}</code></span>}
          </div>
        </>
      )}
    </div>
  )
}

function Avanzado({ valor, onChange, onVolver }: { valor: ValorColor; onChange: (hex: string) => void; onVolver: () => void }) {
  const rgb = hexARgb(valor.hex) ?? [91, 91, 214]
  const [h0, s, v] = rgbAHsv(rgb)
  const [tono, setTono] = useState<number | null>(null)
  const [escribiendoHex, setEscribiendoHex] = useState<string | null>(null)
  const [error, setError] = useState('')
  const h = tono ?? h0
  const claro = tonos(valor.hex, 'claro')!
  const oscuro = tonos(valor.hex, 'oscuro')!

  const fijarRgb = (r: Rgb) => { setError(''); onChange(rgbAHex(r)) }
  const moverSV = (x: number, y: number) => { fijarRgb(hsvARgb([h, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, 1 - y))])); setTono(h) }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <div
        role="slider" tabIndex={0} aria-label="Saturación y brillo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s * 100)}
        aria-valuetext={`Saturación ${Math.round(s * 100)}%, brillo ${Math.round(v * 100)}%`}
        className="relative h-40 cursor-crosshair touch-none rounded-lg border border-line"
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
          const d: Record<string, [number, number]> = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }
          const m = d[e.key]
          if (!m) return
          e.preventDefault()
          moverSV(s + m[0], 1 - v + m[1])
        }}
      >
        <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,.5),0_2px_6px_rgba(0,0,0,.4)]" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <input type="range" min={0} max={360} value={Math.round(h)} aria-label="Tono"
        onChange={(e) => { const nh = Number(e.target.value); setTono(nh); fijarRgb(hsvARgb([nh, s || 0.6, v || 0.8])) }}
        className="h-3 w-full cursor-pointer appearance-none rounded-full border border-line"
        style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-32 flex-col gap-1">
          <label htmlFor="color-hex" className="text-sm font-medium">HEX</label>
          <input id="color-hex" spellCheck={false} maxLength={7} aria-invalid={Boolean(error)} aria-describedby="color-error"
            value={escribiendoHex ?? valor.hex}
            onChange={(e) => {
              const t = e.target.value
              setEscribiendoHex(t)
              const n = normalizarHex(t)
              if (n) { setError(''); setTono(null); onChange(n) } else setError('Usa 6 dígitos hexadecimales, por ejemplo #5B5BD6.')
            }}
            onBlur={() => { setEscribiendoHex(null); setError('') }}
            className="num rounded-md border border-line bg-surface px-3 py-2 text-sm uppercase aria-[invalid=true]:border-bad" />
        </div>
        {(['R', 'G', 'B'] as const).map((l, i) => (
          <div key={l} className="flex w-20 flex-col gap-1">
            <label htmlFor={`color-${l}`} className="text-sm font-medium">{l}</label>
            <input id={`color-${l}`} type="number" min={0} max={255} value={rgb[i]}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (e.target.value === '' || Number.isNaN(n) || n < 0 || n > 255) { setError('Cada canal RGB va de 0 a 255.'); return }
                const nuevo = [...rgb] as Rgb
                nuevo[i] = Math.round(n)
                setTono(null)
                fijarRgb(nuevo)
              }}
              className="num rounded-md border border-line bg-surface px-3 py-2 text-sm" />
          </div>
        ))}
      </div>
      <p id="color-error" role="alert" className="min-h-4 text-xs text-bad">{error}</p>
      <p className="text-xs text-muted">Ejemplo: <code className="rounded bg-surface-2 px-1">#5B5BD6</code> ↔ <code className="rounded bg-surface-2 px-1">91, 91, 214</code>. Los cuatro campos se mantienen sincronizados.</p>

      <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3 text-sm" aria-live="polite">
        {([['Tema claro', claro], ['Tema oscuro', oscuro]] as const).map(([nombre, t]) => (
          <div key={nombre} className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', t.contrasteTexto >= 4.5 && t.contrasteIcono >= 3 ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
              {t.contrasteTexto >= 4.5 && t.contrasteIcono >= 3 ? 'Cumple' : 'No cumple'}
            </span>
            <span>{nombre}: texto <b className="num">{t.contrasteTexto.toFixed(1)}:1</b> (mín. 4.5) · ícono <b className="num">{t.contrasteIcono.toFixed(1)}:1</b> (mín. 3)</span>
          </div>
        ))}
        <p className="text-xs text-muted">El texto y el ícono se ajustan solos para llegar al contraste mínimo; el color elegido se conserva en bordes y muestras. Contraste del color puro sobre blanco: <b className="num">{contraste(hexARgb(valor.hex) ?? [0, 0, 0], [255, 255, 255]).toFixed(1)}:1</b>.</p>
      </div>
      <div><Button variant="secondary" onClick={onVolver}>← Volver a la paleta</Button></div>
    </div>
  )
}
