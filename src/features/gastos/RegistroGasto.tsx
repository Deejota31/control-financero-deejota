import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { GastoForm } from './GastoForm'

interface Registro {
  /** Abre el formulario global de nuevo gasto sobre la pantalla actual (no cambia de ruta, filtros ni desplazamiento). */
  abrir: () => void
  abierto: boolean
}

const Ctx = createContext<Registro | null>(null)

/**
 * Un único formulario de gasto para toda la app autenticada. Guardar invalida gastos, fondos, dashboard y salud (ver `useGastoMutaciones`),
 * así que la pantalla de origen se actualiza sin navegar.
 */
export function RegistroGastoProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const abrir = useCallback(() => setAbierto(true), []) // idempotente: abrir dos veces no monta dos formularios

  const valor = useMemo(() => ({ abrir, abierto }), [abrir, abierto])
  return (
    <Ctx.Provider value={valor}>
      {children}
      {abierto && <GastoForm modo="nuevo" onClose={() => setAbierto(false)} />}
    </Ctx.Provider>
  )
}

export function useRegistroGasto(): Registro {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRegistroGasto debe usarse dentro de RegistroGastoProvider')
  return c
}
