import { useEffect, useState } from 'react'

/** Devuelve `valor` con retraso; útil para búsquedas y para previsualizaciones que llaman al servidor. */
export function useDebounced<T>(valor: T, ms = 350): T {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return v
}
