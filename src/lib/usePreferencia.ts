import { useCallback, useState } from 'react'

/**
 * Preferencia de interfaz persistida en el navegador (por persona y dispositivo): `local` sobrevive entre visitas y `session` solo mientras
 * dura la pestaña. El almacenamiento puede no estar disponible (modo privado, bloqueado): en ese caso la preferencia vive solo en memoria.
 */
export function usePreferencia<T>(clave: string, defecto: T, tipo: 'local' | 'session' = 'local'): [T, (v: T) => void] {
  const leer = (): T => {
    try {
      const crudo = (tipo === 'local' ? window.localStorage : window.sessionStorage).getItem(clave)
      return crudo === null ? defecto : ({ ...(defecto as object), ...(JSON.parse(crudo) as object) } as T)
    } catch {
      return defecto
    }
  }
  const [valor, setValor] = useState<T>(leer)
  const guardar = useCallback((v: T) => {
    setValor(v)
    try {
      (tipo === 'local' ? window.localStorage : window.sessionStorage).setItem(clave, JSON.stringify(v))
    } catch { /* sin almacenamiento: queda en memoria */ }
  }, [clave, tipo])
  return [valor, guardar]
}
