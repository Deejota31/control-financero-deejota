import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { toIso } from '@/lib/format'
import { consultarCotizacion, type Cotizacion } from './cotizaciones'

export type EstadoCotizacion = { estado: 'cargando' } | { estado: 'ok'; cotizacion: Cotizacion } | { estado: 'error'; mensaje: string }

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/
const MIN_5 = 5 * 60_000

/**
 * Cotización oficial de cada fecha (una consulta por fecha distinta, compartida y en caché). Una fecha futura no tiene cotización:
 * se informa en lugar de inventarla. Sirve a las pantallas que registran varias plantillas en USD a la vez.
 */
export function useCotizaciones(fechas: string[]): Map<string, EstadoCotizacion> {
  const unicas = [...new Set(fechas.filter((f) => FECHA_ISO.test(f)))].sort()
  const [hoy] = useState(() => toIso(new Date()))
  const consultables = unicas.filter((f) => f <= hoy)
  const resultados = useQueries({
    queries: consultables.map((f) => ({ queryKey: ['cotizacion', f], queryFn: () => consultarCotizacion(f), staleTime: MIN_5, retry: false })),
  })
  const mapa = new Map<string, EstadoCotizacion>()
  for (const f of unicas) {
    if (f > hoy) { mapa.set(f, { estado: 'error', mensaje: 'Fecha futura: aún no hay cotización oficial.' }); continue }
    const r = resultados[consultables.indexOf(f)]
    if (!r || r.isPending) mapa.set(f, { estado: 'cargando' })
    else if (r.isError || !r.data) mapa.set(f, { estado: 'error', mensaje: r.error instanceof Error ? r.error.message : 'No se pudo consultar la cotización.' })
    else mapa.set(f, { estado: 'ok', cotizacion: r.data })
  }
  return mapa
}
