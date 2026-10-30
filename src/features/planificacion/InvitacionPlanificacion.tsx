import { CalendarCheck, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { formatMes, fromIso } from '@/lib/format'
import { mesDeFecha } from '@/domain/periodo'
import { useHoy } from '@/features/fondos/useHoy'
import { usePerfil } from '@/features/perfil/usePerfil'
import { usePlanificacionUI } from './contexto'
import { debeInvitar, mananaDe, useGuardarPlan, useResumenPlan } from './usePlanificacion'

const clave = (mes: string) => `planificacion-cerrada-${mes}`
const leerCerrada = (mes: string) => { try { return sessionStorage.getItem(clave(mes)) === '1' } catch { return false } }
const guardarCerrada = (mes: string) => { try { sessionStorage.setItem(clave(mes), '1') } catch { /* sin almacenamiento: solo se vuelve a mostrar */ } }

/**
 * Invitación a preparar el mes en curso. Aparece al ingresar mientras el mes no tenga su planificación completada, usando la zona horaria de la
 * persona; no bloquea nada. «Cerrar» solo la oculta en esta sesión (no marca nada como completado) y «Recordarme después» la pospone hasta mañana.
 * Si el mes ya tiene fondos y no hay un proceso empezado, no se insiste: ya está preparado a mano.
 */
export function InvitacionPlanificacion() {
  const hoy = useHoy()
  const mes = mesDeFecha(fromIso(hoy))
  const perfil = usePerfil()
  const resumen = useResumenPlan(mes)
  const guardar = useGuardarPlan()
  const { abrirAsistente } = usePlanificacionUI()
  const [, forzar] = useState(0)

  const plan = resumen.data?.plan
  if (!resumen.data || !debeInvitar({ recordatorios: perfil.data?.planning_reminders !== false, fondos: resumen.data.funds_count, plan: plan ?? null, hoy }) || leerCerrada(mes)) return null

  return (
    <section aria-label="Planificación mensual" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-pri/40 bg-pri-soft p-3 sm:p-4">
      <CalendarCheck className="size-5 shrink-0 text-pri" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-display text-base font-bold">Prepara {formatMes(mes).toLowerCase()}</p>
        <p className="text-sm text-muted">{plan?.status === 'in_progress' ? 'Dejaste la planificación a medias. Retómala cuando quieras.' : 'Comienza un nuevo mes. Configura tus fondos y organiza tus gastos habituales.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => abrirAsistente(mes)}>{plan?.status === 'in_progress' ? 'Continuar planificación' : 'Comenzar planificación'}</Button>
        <Button variant="secondary" loading={guardar.isPending} onClick={async () => {
          try { await guardar.mutateAsync({ mes, patch: { remind_after: mananaDe(hoy) } }); toast.success('Te lo recordaremos mañana.') } catch { toast.error('No se pudo guardar el recordatorio.') }
        }}>Recordarme después</Button>
        <button type="button" aria-label="Cerrar aviso" onClick={() => { guardarCerrada(mes); forzar((n) => n + 1) }} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface"><X className="size-4" aria-hidden="true" /></button>
      </div>
    </section>
  )
}
