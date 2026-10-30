import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Pill } from '@/components/ui/States'
import { payloadDePlantilla } from '@/domain/registroPlantillas'
import { cn } from '@/lib/cn'
import { leerRpc, reporteGasto } from '@/lib/contratos'
import { esErrorDeRed, mensajeDeError } from '@/lib/errors'
import { formatFecha, formatMes, formatSoles, parseImporte, sumarImportes } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { Plantilla } from '@/lib/tipos'
import type { Catalogo } from '@/features/catalogo/useCatalogo'
import { MOTIVOS } from './GastoForm'
import { useGastoMutaciones, type PayloadGasto, type ReporteGasto } from './useGastos'

/* ------------------------------ Revisión y registro ------------------------------ */

export interface FilaRegistro { plantilla: Plantilla; amount: string; date: string; method: string; confirmado: boolean }
type Revision = { estado: 'cargando' } | { estado: 'listo'; reporte: ReporteGasto } | { estado: 'error'; mensaje: string }
type ResultadoFila = { estado: 'ok' } | { estado: 'error'; mensaje: string; ambiguo: boolean }

const payloadDe = (f: FilaRegistro): PayloadGasto => payloadDePlantilla(f.plantilla, f)

/**
 * Resumen previo al registro: valida cada fila con el motor (simulación exacta, sin guardar), avisa de fondos en sobregasto y de posibles duplicados, y registra
 * una por una con su propia clave de idempotencia. Si alguna falla se informa fila por fila y se puede reintentar solo lo pendiente sin duplicar lo ya creado.
 */
export function RevisionRegistro({ filas, mes, formato, registradas, catalogo, onClose, onRegistrados }: {
  filas: FilaRegistro[]; mes: string; formato: string; registradas: Set<string>; catalogo: Catalogo; onClose: () => void; onRegistrados: (ids: string[]) => void
}) {
  const mut = useGastoMutaciones()
  const claves = useRef(new Map<string, string>())
  const [previas, setPrevias] = useState<Record<string, Revision>>({})
  const [resultados, setResultados] = useState<Record<string, ResultadoFila>>({})
  const [registrando, setRegistrando] = useState(false)
  const claveDe = (id: string) => { if (!claves.current.has(id)) claves.current.set(id, crypto.randomUUID()); return claves.current.get(id)! }

  useEffect(() => {
    let vivo = true
    setPrevias(Object.fromEntries(filas.map((f) => [f.plantilla.id, { estado: 'cargando' } as Revision])))
    for (const f of filas) {
      void supabase.rpc('preview_expense', { p: payloadDe(f) as unknown as Json }).then(({ data, error }) => {
        if (!vivo) return
        setPrevias((p) => ({ ...p, [f.plantilla.id]: error ? { estado: 'error', mensaje: mensajeDeError(error, 'No se pudo calcular la cobertura.') } : { estado: 'listo', reporte: leerRpc(reporteGasto, data, 'preview_expense') } }))
      })
    }
    return () => { vivo = false }
    // La revisión se calcula una vez con las filas con que se abrió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendientes = filas.filter((f) => resultados[f.plantilla.id]?.estado !== 'ok')
  const bloqueada = (f: FilaRegistro) => { const r = previas[f.plantilla.id]; return r?.estado === 'listo' && Boolean(r.reporte.blocked) }
  const calculando = pendientes.some((f) => previas[f.plantilla.id]?.estado === 'cargando')
  const total = sumarImportes(pendientes.map((f) => parseImporte(f.amount) ?? 0))
  const hechas = filas.length - pendientes.length
  const validas = pendientes.filter((f) => !bloqueada(f))

  async function registrar() {
    if (registrando) return
    setRegistrando(true)
    const creados: string[] = []
    for (const f of validas) {
      const id = f.plantilla.id
      try {
        await mut.crear.mutateAsync({ payload: payloadDe(f), clave: claveDe(id) })
        setResultados((r) => ({ ...r, [id]: { estado: 'ok' } }))
        creados.push(id)
      } catch (e) {
        // En un fallo de red el resultado es ambiguo: se reintenta con la misma clave y no se duplica.
        setResultados((r) => ({ ...r, [id]: { estado: 'error', ambiguo: esErrorDeRed(e), mensaje: esErrorDeRed(e) ? 'No se pudo confirmar si se guardó. Es seguro reintentar: no se duplicará.' : mensajeDeError(e, 'No se pudo registrar.') } }))
      }
    }
    setRegistrando(false)
    if (creados.length) onRegistrados(creados)
    const fallidas = validas.length - creados.length
    if (fallidas === 0 && bloqueadas(filas, previas, resultados) === 0) {
      toast.success(`Se ${creados.length === 1 ? 'registró 1 gasto' : `registraron ${creados.length} gastos`} por ${formatSoles(sumarImportes(validas.map((f) => parseImporte(f.amount) ?? 0)))}.`)
      onClose()
    } else if (creados.length) toast.warning(`Se registraron ${creados.length}; ${fallidas} quedaron pendientes.`)
  }

  return (
    <Modal open onOpenChange={(o) => !o && !registrando && onClose()} title="Confirmar registro de gastos" size="lg"
      description={`Revisa cada gasto antes de crearlo en ${formatMes(mes)}. No se crea nada sin tu confirmación y las plantillas no cambian.`}
      footer={(cerrar) => (
        <>
          <p className="mr-auto min-w-0 text-sm" aria-live="polite">
            <b>{pendientes.length}</b> por registrar · <b className="num">{formatSoles(total)}</b>{hechas > 0 && <span className="text-muted"> · {hechas} ya registrados</span>}
          </p>
          <Button variant="secondary" onClick={cerrar} disabled={registrando}>{hechas > 0 ? 'Cerrar' : 'Volver'}</Button>
          <Button onClick={registrar} loading={registrando} disabled={calculando || validas.length === 0}>
            {registrando ? 'Registrando…' : Object.values(resultados).some((r) => r.estado === 'error') ? `Reintentar ${validas.length} pendientes` : `Registrar ${validas.length} ${validas.length === 1 ? 'gasto' : 'gastos'}`}
          </Button>
        </>
      )}>
      <div className="flex min-w-0 flex-col gap-2">
        {pendientes.some(bloqueada) && <Alert tone="error">Hay gastos que ningún fondo admite con esa combinación. Vuelve, corrígelos y revisa de nuevo; los demás se pueden registrar.</Alert>}
        <ul aria-label="Gastos por registrar" className="flex flex-col gap-2">
          {filas.map((f) => {
            const id = f.plantilla.id
            const r = previas[id]
            const res = resultados[id]
            const medio = catalogo.medios.find((m) => m.id === f.method)
            const reporte = r?.estado === 'listo' ? r.reporte : null
            return (
              <li key={id} className={cn('rounded-lg border p-2.5 text-sm', res?.estado === 'ok' ? 'border-ok bg-ok-soft/40' : res?.estado === 'error' || reporte?.blocked ? 'border-bad/50' : 'border-line')}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 font-semibold">{f.plantilla.name}</span>
                  <span className="num shrink-0 font-semibold">{formatSoles(parseImporte(f.amount) ?? 0)}</span>
                </div>
                <p className="text-xs text-muted">{formatFecha(f.date, formato)} · {medio?.name ?? 'sin medio'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  {res?.estado === 'ok' && <Pill tone="ok">Registrado</Pill>}
                  {res?.estado === 'error' && <Pill tone="bad">Falló</Pill>}
                  {!res && r?.estado === 'cargando' && <span className="text-muted">Calculando fondos…</span>}
                  {!res && r?.estado === 'error' && <Pill tone="warn">Sin cálculo previo</Pill>}
                  {!res && reporte && !reporte.blocked && <Pill tone="ok">Válido</Pill>}
                  {!res && reporte?.blocked && <Pill tone="bad">Con errores</Pill>}
                  {!res && registradas.has(id) && <Pill tone="warn">Posible duplicado: ya hay un gasto de esta plantilla este mes</Pill>}
                </div>
                {res?.estado === 'error' && <p role="alert" className="mt-1 text-xs text-bad">{res.mensaje}</p>}
                {!res && reporte?.blocked && <p role="alert" className="mt-1 text-xs text-bad">{(reporte.reason && MOTIVOS[reporte.reason]) || reporte.message}</p>}
                {!res && reporte && !reporte.blocked && (
                  <p className="mt-1 text-xs text-muted">
                    Fondos: {reporte.allocations.map((a) => `${a.fund_name} ${formatSoles(a.amount)}`).join(' · ') || '—'}
                    {reporte.warnings.map((w) => (
                      <span key={`${w.fund_id}-${w.code}`} className="ml-2 font-medium text-warn">
                        {w.code === 'general_negative' ? `El Fondo General quedará en ${formatSoles(w.remaining_after)}.` : `${w.fund_name} quedará en sobregasto (${formatSoles(w.remaining_after)}).`}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}

/** Cuántas filas no registradas siguen bloqueadas por el motor (para decidir si se puede cerrar tras registrar). */
function bloqueadas(filas: FilaRegistro[], previas: Record<string, Revision>, resultados: Record<string, ResultadoFila>) {
  return filas.filter((f) => resultados[f.plantilla.id]?.estado !== 'ok' && previas[f.plantilla.id]?.estado === 'listo' && (previas[f.plantilla.id] as { reporte: ReporteGasto }).reporte.blocked).length
}

