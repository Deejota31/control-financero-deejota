import { formatOriginal, formatTasa, importeATexto, convertirPen } from '@/domain/moneda'
import { formatFecha } from '@/lib/format'
import type { EstadoCotizacion } from './useCotizaciones'

/** Equivalente en soles de un importe en dólares con la cotización de su fecha; nunca muestra una conversión inventada. */
export function EquivalenteUsd({ importe, fecha, estado }: { importe: string; fecha: string; estado: EstadoCotizacion | undefined }) {
  if (!importeATexto(importe)) return null
  if (!estado || estado.estado === 'cargando') return <p className="mt-1 text-xs text-muted" role="status">Consultando cotización…</p>
  if (estado.estado === 'error') return <p className="mt-1 text-xs font-medium text-warn" role="status">{estado.mensaje} Regístrala por separado con tipo de cambio personalizado o cargo exacto.</p>
  const c = estado.cotizacion
  const pen = convertirPen(importeATexto(importe)!, c.rate)
  return (
    <p className="num mt-1 text-xs text-muted" role="status">
      ≈ <b className="text-fg">{formatOriginal(pen)}</b> · 1 US$ = S/ {formatTasa(c.rate)}{c.reference_date !== fecha ? ` · del ${formatFecha(c.reference_date)}` : ''}
    </p>
  )
}
