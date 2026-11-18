import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/Field'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { cn } from '@/lib/cn'
import { formatFecha, toIso } from '@/lib/format'
import {
  convertirPen, formatOriginal, formatTasa, importeATexto, SIMBOLO, tasaATexto, tasaEfectiva,
  type Conversion, type MetodoConversion, type Moneda,
} from '@/domain/moneda'
import { consultarCotizacion, olvidarCotizaciones } from './cotizaciones'

export interface ImporteMonedaProps {
  currency: Moneda
  onCurrencyChange: (c: Moneda) => void
  amount: string
  onAmountChange: (a: string) => void
  /** Fecha del gasto (yyyy-MM-dd): la cotización automática corresponde a ese día o al último publicado antes. */
  date: string
  /** Conversión ya congelada de un gasto guardado: se conserva hasta que el usuario pida otra. */
  initial?: Conversion
  /** Emite la conversión lista para guardar, o null mientras falte algo (nunca una conversión ficticia). */
  onConversionChange: (c: Conversion | null) => void
  /** Encabezado de la tarjeta («Importe del gasto»); sin él solo se muestra el selector de moneda. */
  titulo?: string
  /** Plantillas: solo guardan moneda e importe de referencia; la tasa se obtiene al registrar. */
  template?: boolean
  disabled?: boolean
  id?: string
  invalid?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
}

const METODOS: { valor: Exclude<MetodoConversion, 'none'>; etiqueta: string }[] = [
  { valor: 'automatic', etiqueta: 'Automático' },
  { valor: 'manual', etiqueta: 'Personalizado' },
  { valor: 'exact', etiqueta: 'Cargo exacto' },
]
const MONEDAS_UI: { valor: Moneda; etiqueta: string }[] = [{ valor: 'USD', etiqueta: 'US$ USD' }, { valor: 'PEN', etiqueta: 'S/ PEN' }]
/** Fuente abreviada para la línea de tipo de cambio. */
const tc = (fuente?: string | null) => (!fuente || fuente === 'Usuario' ? '' : fuente.replace('BCRP:PD04640PD', 'BCRP'))
  + (fuente && fuente !== 'Usuario' ? ' ·' : '')
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

function conversionPen(importe: string): Conversion {
  return { original_currency: 'PEN', original_amount: importe, amount: importe, exchange_rate: '1', exchange_rate_source: null, exchange_rate_reference_date: null, conversion_method: 'none', exchange_rate_fetched_at: null, conversion_snapshot_version: 1 }
}

/**
 * Importe con selector de moneda. En PEN no muestra nada más. En USD ofrece tres modos —cotización automática, tipo de cambio
 * personalizado y cargo exacto en soles— y emite el equivalente contable en PEN calculado con decimales exactos.
 */
export function ImporteMoneda(p: ImporteMonedaProps) {
  const grupo = useId()
  const inicial = p.initial
  const [method, setMethod] = useState<Exclude<MetodoConversion, 'none'>>(inicial && inicial.conversion_method !== 'none' ? inicial.conversion_method : 'automatic')
  const [rate, setRate] = useState(inicial && inicial.conversion_method === 'manual' ? inicial.exchange_rate : '')
  const [charge, setCharge] = useState(inicial?.conversion_method === 'exact' ? inicial.amount : '')
  const [conservada, setConservada] = useState(Boolean(inicial))
  const [hoy] = useState(() => toIso(new Date()))

  const enLinea = typeof navigator === 'undefined' || navigator.onLine
  const fechaValida = FECHA_ISO.test(p.date)
  const futura = fechaValida && p.date > hoy
  const consulta = p.currency === 'USD' && !p.template && method === 'automatic' && !conservada && fechaValida && !futura

  const consultaQ = useQuery({ queryKey: ['cotizacion', p.date], queryFn: () => consultarCotizacion(p.date), enabled: consulta, retry: false, staleTime: 5 * 60_000 })
  const loading = consulta && consultaQ.isFetching
  const error = consulta && consultaQ.isError ? (consultaQ.error instanceof Error ? consultaQ.error.message : 'No se pudo consultar la cotización.') : ''
  const cotizacion = consulta ? consultaQ.data ?? null : null

  const importe = importeATexto(p.amount)
  let conversion: Conversion | null = null
  try {
    if (importe) {
      if (p.currency === 'PEN') conversion = conversionPen(importe)
      else if (!p.template) {
        const base = { original_currency: 'USD' as const, original_amount: importe, conversion_snapshot_version: 1 }
        if (method === 'exact') {
          const cargo = importeATexto(charge)
          if (cargo) conversion = { ...base, amount: cargo, exchange_rate: tasaEfectiva(importe, cargo), exchange_rate_source: 'Usuario', exchange_rate_reference_date: p.date, conversion_method: 'exact', exchange_rate_fetched_at: null }
        } else if (method === 'manual') {
          const tasa = tasaATexto(rate)
          if (tasa) conversion = { ...base, amount: convertirPen(importe, tasa), exchange_rate: tasa, exchange_rate_source: 'Usuario', exchange_rate_reference_date: p.date, conversion_method: 'manual', exchange_rate_fetched_at: null }
        } else if (conservada && inicial?.conversion_method === 'automatic') {
          conversion = { ...base, amount: convertirPen(importe, inicial.exchange_rate), exchange_rate: inicial.exchange_rate, exchange_rate_source: inicial.exchange_rate_source, exchange_rate_reference_date: inicial.exchange_rate_reference_date, conversion_method: 'automatic', exchange_rate_fetched_at: inicial.exchange_rate_fetched_at }
        } else if (cotizacion && !loading) {
          conversion = { ...base, amount: convertirPen(importe, cotizacion.rate), exchange_rate: cotizacion.rate, exchange_rate_source: cotizacion.source, exchange_rate_reference_date: cotizacion.reference_date, conversion_method: 'automatic', exchange_rate_fetched_at: cotizacion.fetched_at }
        }
      }
    }
  } catch { /* entrada incompleta: no hay conversión guardable */ }

  // El padre recibe la conversión solo cuando cambia su contenido (no en cada render).
  const serializada = JSON.stringify(conversion)
  const callback = useRef(p.onConversionChange)
  useEffect(() => { callback.current = p.onConversionChange })
  useEffect(() => { callback.current(JSON.parse(serializada) as Conversion | null) }, [serializada])

  function elegirMetodo(m: Exclude<MetodoConversion, 'none'>) {
    if (m === method) return
    // Al pasar a «Personalizado» se parte de la tasa que se estaba viendo; nunca se pisa lo escrito por el usuario.
    if (m === 'manual' && !rate) setRate(conversion?.exchange_rate ? formatTasa(conversion.exchange_rate) : '')
    if (m === 'exact' && !charge && conversion) setCharge(conversion.amount)
    setMethod(m)
  }

  const referencia = cotizacion ?? (conservada && inicial?.conversion_method === 'automatic' ? { rate: inicial.exchange_rate, reference_date: inicial.exchange_rate_reference_date ?? p.date, source: inicial.exchange_rate_source ?? 'BCRP' } : null)
  const estado = (() => {
    if (method === 'manual') return 'Tasa personalizada.'
    if (method === 'exact') return 'Tipo de cambio efectivo calculado con el cargo.'
    if (futura) return 'Fecha futura: aún no hay cotización oficial. Usa «Personalizado» o «Cargo exacto».'
    if (!fechaValida) return 'Elige la fecha del gasto.'
    if (loading) return 'Consultando cotización…'
    if (error) return enLinea ? error : 'Sin conexión: usa «Personalizado» o «Cargo exacto».'
    if (!referencia) return 'Cotización pendiente.'
    const anterior = referencia.reference_date !== p.date
    return `${anterior ? `referencia del ${formatFecha(referencia.reference_date)}` : 'cotización del día'}${conservada ? ' · conservada' : ''}`
  })()
  const mostrarTasa = conversion ? formatTasa(conversion.exchange_rate) : null

  const simbolo = SIMBOLO[p.currency]
  const tam = p.amount.length > 13 ? 'text-xl' : p.amount.length > 9 ? 'text-2xl' : 'text-3xl'
  const usd = p.currency === 'USD' && !p.template
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-line bg-surface p-3" data-importe>
      <div className={cn('flex items-center gap-2', p.titulo ? 'justify-between' : 'justify-end')}>
        {p.titulo && <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-muted">{p.titulo}</span>}
        <div role="radiogroup" aria-label="Moneda del importe" className="inline-flex shrink-0 rounded-md bg-surface-2 p-0.5 text-xs font-semibold">
          {MONEDAS_UI.map((m) => (
            <button key={m.valor} type="button" role="radio" aria-checked={p.currency === m.valor} disabled={p.disabled} onClick={() => p.onCurrencyChange(m.valor)}
              className={cn('min-h-8 rounded px-2.5 transition-colors', p.currency === m.valor ? 'bg-pri-soft text-pri shadow-sm' : 'text-muted hover:text-fg')}>{m.etiqueta}</button>
          ))}
        </div>
      </div>
      <div className={cn('flex min-w-0 items-baseline justify-center gap-1.5 rounded-lg px-2 py-1 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-pri', p.invalid && 'outline outline-2 outline-bad')}>
        <span aria-hidden="true" className="select-none text-lg font-semibold text-muted">{simbolo}</span>
        <input id={p.id} value={p.amount} inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={p.disabled}
          aria-label={p['aria-label']} aria-describedby={p['aria-describedby']} aria-invalid={p.invalid || undefined}
          onChange={(e) => p.onAmountChange(e.target.value)}
          onBlur={() => { const n = importeATexto(p.amount); if (n) p.onAmountChange(n) }}
          style={{ width: `${Math.max(p.amount.length, 4) + 1}ch` }}
          className={cn('sin-anillo num min-w-0 max-w-full bg-transparent text-center font-bold tracking-tight outline-none placeholder:text-muted/60', tam)} />
      </div>
      {p.currency === 'USD' && p.template && <p className="text-center text-xs text-muted">Se convierte a soles al registrar el gasto.</p>}
      {usd && (
        <div className="flex min-w-0 flex-col gap-2 border-t border-line pt-2.5" data-conversion>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted">Equivalente en soles:</span>
            <span data-equivalente aria-live="polite" className="num text-base font-bold">{conversion ? formatOriginal(conversion.amount) : '—'}</span>
          </div>
          <p role="status" className="min-w-0 break-words text-xs text-muted">
            {mostrarTasa && method !== 'manual' && !loading ? <span className="num">T.C. {tc(conversion?.exchange_rate_source)} 1 USD = S/ {mostrarTasa} · </span> : null}
            {estado}
            {method === 'automatic' && (conservada || error) && !loading && (
              <button type="button" className="ml-2 min-h-9 font-semibold text-pri" onClick={() => { olvidarCotizaciones(); setConservada(false); void consultaQ.refetch() }}>Consultar de nuevo</button>
            )}
          </p>
          <div role="radiogroup" aria-label="Método de conversión" className="grid grid-cols-3 gap-0.5 rounded-md bg-surface-2 p-0.5 text-xs font-semibold">
            {METODOS.map((m) => (
              <button key={m.valor} type="button" role="radio" aria-checked={method === m.valor} id={`${grupo}-${m.valor}`} disabled={p.disabled} onClick={() => elegirMetodo(m.valor)}
                className={cn('min-h-9 rounded px-1 transition-colors', method === m.valor ? 'bg-surface text-pri shadow-sm' : 'text-muted hover:text-fg')}>{m.etiqueta}</button>
            ))}
          </div>
          {method === 'manual' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">Tipo de cambio (S/ por US$)
              <Input aria-label="Tipo de cambio USD/PEN" inputMode="decimal" autoComplete="off" placeholder="3.4500" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
          )}
          {method === 'exact' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">Cargo exacto en soles
              <MoneyInput aria-label="Cargo exacto en soles" value={charge} onChange={setCharge} />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
