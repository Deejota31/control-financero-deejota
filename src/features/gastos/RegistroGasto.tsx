import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { GastoForm } from './GastoForm'

interface Registro {
  /** Abre el formulario global de nuevo gasto sobre la pantalla actual (no cambia de ruta, filtros ni desplazamiento). */
  abrir: () => void
  abrirConEvento: (inicial: { event_id: string; event_item_id?: string; event_commitment_id?: string }) => void
  abierto: boolean
}

const Ctx = createContext<Registro | null>(null)

/**
 * Un único formulario de gasto para toda la app autenticada. Guardar invalida gastos, fondos y dashboard (ver `useGastoMutaciones`),
 * así que la pantalla de origen se actualiza sin navegar.
 */
export function RegistroGastoProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const [inicial, setInicial] = useState<{ event_id: string; event_item_id?: string; event_commitment_id?: string }>()
  const abrir = useCallback(() => { setInicial(undefined); setAbierto(true) }, []) // idempotente: abrir dos veces no monta dos formularios
  const abrirConEvento = useCallback((v: { event_id: string; event_item_id?: string; event_commitment_id?: string }) => { setInicial(v); setAbierto(true) }, [])

  const valor = useMemo(() => ({ abrir, abrirConEvento, abierto }), [abrir, abrirConEvento, abierto])
  return (
    <Ctx.Provider value={valor}>
      {children}
      {abierto && <GastoForm modo="nuevo" inicial={inicial} onClose={() => setAbierto(false)} />}
    </Ctx.Provider>
  )
}

export function useRegistroGasto(): Registro {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRegistroGasto debe usarse dentro de RegistroGastoProvider')
  return c
}
