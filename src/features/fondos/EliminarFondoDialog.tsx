import { AlertTriangle, Power, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { round2 } from '@/domain/fondos'
import { mensajeDeError } from '@/lib/errors'
import { formatSoles } from '@/lib/format'
import { useDependenciasFondo, useFondoMutaciones, type EliminacionFondo } from './useFondos'

interface Props {
  fondo: { id: string; nombre: string }
  onClose: () => void
  /** Alternativa cuando no se puede eliminar: desactivar (nunca se presenta como eliminación). */
  onDesactivar?: () => void
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/**
 * Eliminar fondo: explica qué se elimina, muestra dependencias, exige un destino compatible cuando hay gastos
 * imputados y simula el resultado exacto antes de confirmar. La operación es atómica en la base de datos.
 */
export function EliminarFondoDialog({ fondo, onClose, onDesactivar }: Props) {
  const dep = useDependenciasFondo(fondo.id)
  const mut = useFondoMutaciones()
  const [destino, setDestino] = useState('')
  const [efecto, setEfecto] = useState<EliminacionFondo | null>(null)
  const [errorSim, setErrorSim] = useState<string | null>(null)
  const d = dep.data

  useEffect(() => {
    if (!destino) return
    let vigente = true
    mut.simularEliminar.mutate({ fund: fondo.id, destino }, {
      onSuccess: (r) => { if (vigente) { setEfecto(r); setErrorSim(null) } },
      onError: (e) => { if (vigente) { setEfecto(null); setErrorSim(mensajeDeError(e)) } },
    })
    return () => { vigente = false }
    // Se simula de nuevo SOLO al cambiar de destino o de fondo; `mut` cambia en cada render y lanzaría una simulación por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino, fondo.id])

  function confirmar() {
    mut.eliminar.mutate({ fund: fondo.id, destino: destino || null }, {
      onSuccess: () => { toast.success(`Fondo «${fondo.nombre}» eliminado.`); onClose() },
      onError: (e) => toast.error(`${mensajeDeError(e, 'No se pudo eliminar el fondo.')} No se hizo ningún cambio.`),
    })
  }

  const usado = (d?.open_allocations ?? 0) > 0
  const sinDestino = usado && (d?.destinations.length ?? 0) === 0
  const nombres = new Map<string, string>(d?.destinations.map((x) => [x.id, x.name]) ?? [])
  const filasEfecto = efecto?.consumption_before
    ? Array.from(new Set([...Object.keys(efecto.consumption_before), ...Object.keys(efecto.consumption_after ?? {})]))
        .map((id) => ({ id, antes: efecto.consumption_before?.[id] ?? 0, despues: efecto.consumption_after?.[id] ?? 0 }))
        .filter((f) => round2(f.antes) !== round2(f.despues) && f.id !== fondo.id)
    : []

  return (
    <Modal open onOpenChange={(o) => !o && !mut.eliminar.isPending && onClose()} title={`Eliminar fondo «${fondo.nombre}»`} size="md">
      <div className="flex flex-col gap-4">
        {dep.isPending ? (
          <div role="status" aria-label="Revisando dependencias" className="flex flex-col gap-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24" /></div>
        ) : dep.isError || !d ? (
          <ErrorState message="No se pudieron revisar las dependencias del fondo." onRetry={() => dep.refetch()} />
        ) : d.blocked ? (
          <>
            <Alert tone="error">
              <b>No se puede eliminar este fondo.</b>{' '}
              {d.is_general
                ? 'Es el Fondo General: absorbe el excedente de los demás fondos y garantiza que ningún gasto quede sin imputar.'
                : `Tiene historial en períodos cerrados (${plural(d.closed_snapshots, 'cierre guardado', 'cierres guardados')}${d.closed_allocations ? ` y ${plural(d.closed_allocations, 'imputación', 'imputaciones')}` : ''}). Ese histórico no se modifica ni se borra.`}
            </Alert>
            <p className="text-sm text-muted">Puedes <b>desactivarlo</b>: dejará de recibir gastos nuevos pero seguirá existiendo, con su historial intacto. Desactivar no es lo mismo que eliminar.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              {onDesactivar && <Button variant="secondary" onClick={() => { onDesactivar(); onClose() }}><Power className="size-4" aria-hidden="true" /> Desactivar en su lugar</Button>}
            </div>
          </>
        ) : !usado ? (
          <>
            <p className="text-sm">Se eliminará definitivamente el fondo <b>«{fondo.nombre}»</b>.</p>
            <Alert tone="info">
              Nunca se ha usado: no tiene gastos imputados ni cierres. Se eliminarán también sus reglas de cobertura y {plural(d.budgets, 'presupuesto de período', 'presupuestos de período')}.
              {d.templates > 0 && <> {plural(d.templates, 'plantilla', 'plantillas')} perderá su fondo sugerido.</>} No se pierde ningún importe.
            </Alert>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={mut.eliminar.isPending}>Cancelar</Button>
              <Button className="border-bad bg-bad text-white hover:bg-bad hover:brightness-110" onClick={confirmar} loading={mut.eliminar.isPending}><Trash2 className="size-4" aria-hidden="true" /> Eliminar fondo</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">El fondo <b>«{fondo.nombre}»</b> cubre gastos de períodos abiertos. Para eliminarlo, elige un fondo que <b>seguirá pudiendo cubrirlos</b>.</p>
            <ul aria-label="Dependencias" className="divide-y divide-line rounded-lg border border-line text-sm">
              <li className="flex justify-between px-3 py-2"><span>Gastos imputados (períodos abiertos)</span><b className="num">{d.open_expenses}</b></li>
              <li className="flex justify-between px-3 py-2"><span>Imputaciones a reasignar</span><b className="num">{d.open_allocations}</b></li>
              <li className="flex justify-between px-3 py-2"><span>Presupuestos de período que se eliminan</span><b className="num">{d.budgets}</b></li>
              {d.templates > 0 && <li className="flex justify-between px-3 py-2"><span>Plantillas que pierden su fondo sugerido</span><b className="num">{d.templates}</b></li>}
            </ul>
            {sinDestino ? (
              <Alert tone="error"><b>No hay un fondo de destino compatible.</b> Ningún otro fondo activo admite todos los gastos de «{fondo.nombre}». Crea o activa otro fondo, o desactiva este.</Alert>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Fondo de destino compatible
                <select value={destino} onChange={(e) => { setDestino(e.target.value); setEfecto(null) }} className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal">
                  <option value="">Elegir fondo…</option>
                  {d.destinations.map((x) => <option key={x.id} value={x.id}>{x.name}{x.is_general ? ' (General)' : ''}</option>)}
                </select>
                <span className="text-xs font-normal text-muted">Solo aparecen fondos activos que admiten todos esos gastos.</span>
              </label>
            )}
            {errorSim && <Alert tone="error">{errorSim}</Alert>}
            {efecto && (
              <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/50 p-3 text-sm" role="status">
                <p><b>Qué pasará:</b> los gastos <b>no se borran ni cambian de importe</b>. Los períodos abiertos se recalculan con las reglas y prioridades vigentes y {plural(efecto.changed_expenses ?? 0, 'gasto cambia', 'gastos cambian')} de imputación. Los períodos cerrados no se tocan.</p>
                {filasEfecto.length > 0 && (
                  <table className="w-full text-left text-sm">
                    <thead><tr className="text-xs text-muted"><th className="py-1">Fondo</th><th className="py-1 text-right">Antes</th><th className="py-1 text-right">Después</th></tr></thead>
                    <tbody>
                      {filasEfecto.map((f) => (
                        <tr key={f.id} className="border-t border-line"><td className="py-1">{nombres.get(f.id) ?? 'Otro fondo'}</td><td className="num py-1 text-right">{formatSoles(f.antes)}</td><td className="num py-1 text-right font-semibold">{formatSoles(f.despues)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="flex items-start gap-1.5 text-xs text-muted"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> Todo ocurre en una sola operación: si algo falla, el fondo y sus imputaciones quedan como estaban.</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={mut.eliminar.isPending}>Cancelar</Button>
              {sinDestino && <Button variant="secondary" onClick={() => { onDesactivar?.(); onClose() }}><Power className="size-4" aria-hidden="true" /> Desactivar en su lugar</Button>}
              {!sinDestino && (
                <Button className="border-bad bg-bad text-white hover:bg-bad hover:brightness-110" onClick={confirmar} loading={mut.eliminar.isPending} disabled={!destino || !efecto || mut.simularEliminar.isPending}>
                  <Trash2 className="size-4" aria-hidden="true" /> Reasignar y eliminar
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
