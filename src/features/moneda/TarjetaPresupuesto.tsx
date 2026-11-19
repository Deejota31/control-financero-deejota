import { useState } from 'react'
import { formatOriginal, formatTasa, importeATexto, convertirPen, SIMBOLO, type Moneda } from '@/domain/moneda'
import { cn } from '@/lib/cn'
import { formatFecha, toIso } from '@/lib/format'
import { useCotizaciones } from './useCotizaciones'

const MONEDAS_UI: { valor: Moneda; etiqueta: string }[] = [{ valor: 'USD', etiqueta: 'US$ USD' }, { valor: 'PEN', etiqueta: 'S/ PEN' }]

/**
 * Presupuesto de un fondo: importe grande y centrado con selector PEN/USD dentro de la tarjeta (mismo lenguaje visual que el importe de un gasto).
 * En USD el presupuesto sigue siendo en dólares: el equivalente en soles es solo una referencia con la última cotización disponible y no se guarda.
 */
export function TarjetaPresupuesto({ titulo, currency, onCurrencyChange, amount, onAmountChange, invalid, monedaBloqueada, motivoBloqueo, disabled, 'aria-describedby': describedby, 'aria-label': ariaLabel }: {
  titulo: string
  currency: Moneda
  onCurrencyChange: (m: Moneda) => void
  amount: string
  onAmountChange: (a: string) => void
  invalid?: boolean
  /** El fondo ya tiene gastos imputados: su moneda no puede cambiar (reinterpretaría su historial). */
  monedaBloqueada?: boolean
  motivoBloqueo?: string
  disabled?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
}) {
  const [hoy] = useState(() => toIso(new Date()))
  const cot = useCotizaciones(currency === 'USD' ? [hoy] : []).get(hoy)
  const importe = importeATexto(amount)
  const tam = amount.length > 13 ? 'text-xl' : amount.length > 9 ? 'text-2xl' : 'text-3xl'
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-line bg-surface p-3" data-presupuesto>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-muted">{titulo}</span>
        <div role="radiogroup" aria-label="Moneda del presupuesto" title={monedaBloqueada ? motivoBloqueo : undefined} className="inline-flex shrink-0 rounded-md bg-surface-2 p-0.5 text-xs font-semibold">
          {MONEDAS_UI.map((m) => (
            <button key={m.valor} type="button" role="radio" aria-checked={currency === m.valor} disabled={disabled || (monedaBloqueada && currency !== m.valor)} onClick={() => onCurrencyChange(m.valor)}
              className={cn('min-h-8 rounded px-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50', currency === m.valor ? 'bg-pri-soft text-pri shadow-sm' : 'text-muted hover:text-fg')}>{m.etiqueta}</button>
          ))}
        </div>
      </div>
      <div className={cn('flex min-w-0 items-baseline justify-center gap-1.5 rounded-lg px-2 py-1 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-pri', invalid && 'outline outline-2 outline-bad')}>
        <span aria-hidden="true" className="select-none text-lg font-semibold text-muted">{SIMBOLO[currency]}</span>
        <input value={amount} inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={disabled} aria-label={ariaLabel} aria-describedby={describedby} aria-invalid={invalid || undefined}
          onChange={(e) => onAmountChange(e.target.value)} onBlur={() => { const n = importeATexto(amount); if (n) onAmountChange(n) }}
          style={{ width: `${Math.max(amount.length, 4) + 1}ch` }}
          className={cn('sin-anillo num min-w-0 max-w-full bg-transparent text-center font-bold tracking-tight outline-none placeholder:text-muted/60', tam)} />
      </div>
      {monedaBloqueada && <p className="text-center text-xs text-muted">{motivoBloqueo}</p>}
      {currency === 'USD' && (
        <p role="status" className="num border-t border-line pt-2 text-center text-xs text-muted">
          {!importe ? 'Equivalente referencial en soles' : !cot || cot.estado === 'cargando' ? 'Consultando cotización…'
            : cot.estado === 'error' ? 'Sin cotización disponible: el presupuesto sigue en dólares.'
            : <>Equivalente referencial: <b className="text-fg">{formatOriginal(convertirPen(importe, cot.cotizacion.rate))}</b> · T.C. 1 USD = S/ {formatTasa(cot.cotizacion.rate)} del {formatFecha(cot.cotizacion.reference_date)}</>}
        </p>
      )}
    </div>
  )
}
