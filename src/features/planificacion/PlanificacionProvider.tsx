import { useMemo, useState, type ReactNode } from 'react'
import { fromIso } from '@/lib/format'
import { mesDeFecha } from '@/domain/periodo'
import { useHoy } from '@/features/fondos/useHoy'
import { AsistentePlanificacion } from './AsistentePlanificacion'
import { PlanificacionCtx } from './contexto'
import { EstadoPlanificacion } from './EstadoPlanificacion'

/** Un único punto para abrir la ventana de estado o el asistente de planificación desde cualquier pantalla (no cambia de ruta ni de filtros). */
export function PlanificacionProvider({ children }: { children: ReactNode }) {
  const hoy = useHoy()
  const [estado, setEstado] = useState<string | null>(null)
  const [asistente, setAsistente] = useState<string | null>(null)

  const valor = useMemo(
    () => ({
      abrirEstado: (mes?: string) => setEstado(mes ?? mesDeFecha(fromIso(hoy))),
      abrirAsistente: (mes: string) => { setEstado(null); setAsistente(mes) },
    }),
    [hoy],
  )

  return (
    <PlanificacionCtx.Provider value={valor}>
      {children}
      {estado && <EstadoPlanificacion mesInicial={estado} onClose={() => setEstado(null)} onAbrirAsistente={(m) => setAsistente(m)} />}
      {asistente && <AsistentePlanificacion mes={asistente} onClose={() => setAsistente(null)} />}
    </PlanificacionCtx.Provider>
  )
}
