import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toIso } from '@/lib/format'
import { consultarCotizacion } from './cotizaciones'

/** Último día de cada mes del rango (recortado a `fin`): son las fechas cuya cotización valora un período. */
export function fechasDeValoracion(desde: string, fin: string): string[] {
  const out: string[] = []
  let [a, m] = [Number(desde.slice(0, 4)), Number(desde.slice(5, 7))]
  while (a * 12 + m <= Number(fin.slice(0, 4)) * 12 + Number(fin.slice(5, 7))) {
    const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
    out.push(ultimo < fin ? ultimo : fin)
    m += 1
    if (m > 12) { m = 1; a += 1 }
  }
  return out.filter((f) => f >= desde)
}

/**
 * Cuando el Dashboard informa que un período con fondos en dólares no tiene cotización, se pide la de su cierre (o la de hoy si está en curso) al
 * servicio centralizado —que la guarda en la caché verificada— y se vuelve a consultar el panel. Nunca se usa una tasa inventada: si el proveedor
 * no responde, la valoración queda sin calcular y se avisa.
 */
export function useCompletarCotizaciones(sinCotizacion: boolean | undefined, desde: string, hasta: string) {
  const qc = useQueryClient()
  const [hoy] = useState(() => toIso(new Date()))
  const intentado = useRef('')
  useEffect(() => {
    if (!sinCotizacion) return
    const fin = hasta < hoy ? hasta : hoy
    const clave = `${desde}|${fin}`
    if (intentado.current === clave) return // una sola vez por rango: si el proveedor falla no se insiste en bucle
    intentado.current = clave
    void (async () => {
      let alguna = false
      for (const f of fechasDeValoracion(desde, fin)) {
        try { await consultarCotizacion(f); alguna = true } catch { /* sin cotización: la valoración queda pendiente */ }
      }
      if (alguna) void qc.invalidateQueries({ queryKey: ['dashboard', 'panel'] })
    })()
  }, [sinCotizacion, desde, hasta, hoy, qc])
}
