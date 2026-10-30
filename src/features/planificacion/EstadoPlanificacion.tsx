import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { MesSelector } from '@/components/ui/MesSelector'
import { Pill, Skeleton } from '@/components/ui/States'
import { mensajeDeError } from '@/lib/errors'
import { formatFecha, formatMes, formatSoles, toIso } from '@/lib/format'
import { useHoy } from '@/features/fondos/useHoy'
import { useActualizarPerfil, usePerfil } from '@/features/perfil/usePerfil'
import { ETIQUETA_ESTADO, mananaDe, useGuardarPlan, useResumenPlan } from './usePlanificacion'

const TONO = { pending: 'neutral', in_progress: 'pri', completed: 'ok' } as const

/** Ventana inicial de la planificación de un mes: estado, cifras reales, recordatorios y acceso al asistente. */
export function EstadoPlanificacion({ mesInicial, onClose, onAbrirAsistente }: { mesInicial: string; onClose: () => void; onAbrirAsistente: (mes: string) => void }) {
  const [mes, setMes] = useState(mesInicial)
  const [recordatorios, setRecordatorios] = useState(false)
  const resumen = useResumenPlan(mes)
  const guardar = useGuardarPlan()
  const perfil = usePerfil()
  const actualizarPerfil = useActualizarPerfil()
  const hoy = useHoy()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const avisos = perfil.data?.planning_reminders !== false

  const plan = resumen.data?.plan ?? null
  const estado = plan?.status ?? 'pending'
  const proximo = plan?.remind_after ? formatFecha(plan.remind_after, formato) : avisos ? (estado === 'completed' ? 'No aplica' : 'Al ingresar al mes') : 'Desactivados'
  const actualizado = plan ? formatFecha(toIso(new Date(plan.updated_at)), formato) : 'Sin cambios'

  async function posponer(valor: string | null) {
    try {
      await guardar.mutateAsync({ mes, patch: { remind_after: valor } })
      toast.success(valor ? `Te lo recordaremos desde el ${formatFecha(valor, formato)}.` : 'Aplazamiento quitado.')
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo guardar el recordatorio.'))
    }
  }

  async function alternarAvisos(v: boolean) {
    try {
      await actualizarPerfil.mutateAsync({ planning_reminders: v })
      toast.success(v ? 'Recordatorios activados.' : 'Recordatorios desactivados.')
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo guardar la preferencia.'))
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Planificación mensual" size="md"
      description="Prepara los fondos y los gastos habituales de cada mes."
      footer={(cerrar) => (
        <>
          <Button variant="secondary" onClick={cerrar}>Cerrar</Button>
          <Button onClick={() => { onAbrirAsistente(mes); onClose() }}>{estado === 'completed' ? 'Ver planificación' : estado === 'in_progress' ? 'Continuar planificación' : 'Comenzar planificación'}</Button>
        </>
      )}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MesSelector mes={mes} onChange={setMes} />
          {resumen.data && <Pill tone={TONO[estado]}>{ETIQUETA_ESTADO[estado]}</Pill>}
        </div>

        {resumen.isPending ? <Skeleton className="h-40" /> : resumen.isError ? (
          <Alert tone="error">No se pudo cargar la planificación de {formatMes(mes)}.</Alert>
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm" aria-label={`Planificación de ${formatMes(mes)}`}>
            <dt className="text-muted">Mes</dt><dd className="text-right font-semibold">{formatMes(mes)}</dd>
            <dt className="text-muted">Fondos configurados</dt><dd className="num text-right font-semibold">{resumen.data.funds_count}</dd>
            <dt className="text-muted">Presupuesto total</dt><dd className="num text-right font-semibold">{formatSoles(resumen.data.budget_total)}</dd>
            <dt className="text-muted">Gastos reales registrados</dt><dd className="num text-right font-semibold">{formatSoles(resumen.data.expenses_total)} · {resumen.data.expenses_count} mov.</dd>
            <dt className="text-muted">Última actualización</dt><dd className="text-right font-semibold">{actualizado}</dd>
            <dt className="text-muted">Próximo recordatorio</dt><dd className="text-right font-semibold">{proximo}</dd>
          </dl>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <Button variant="secondary" aria-expanded={recordatorios} onClick={() => setRecordatorios((v) => !v)} className="self-start"><BellRing className="size-4" aria-hidden="true" /> Configurar recordatorios</Button>
          {recordatorios && (
            <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={avisos} disabled={actualizarPerfil.isPending} onChange={(e) => alternarAvisos(e.target.checked)} /> Avisarme al comenzar cada mes</label>
              <p className="text-xs text-muted">El aviso aparece dentro de la aplicación y no bloquea nada. No se envían correos ni notificaciones.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => posponer(mananaDe(hoy))} disabled={guardar.isPending || estado === 'completed'}>Posponer hasta mañana</Button>
                {plan?.remind_after && <Button variant="secondary" onClick={() => posponer(null)} disabled={guardar.isPending}>Quitar aplazamiento</Button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
