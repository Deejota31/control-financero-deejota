import { useEffect } from 'react'
import { toast } from 'sonner'
import { hayCambiosPendientes } from '@/lib/cambiosPendientes'
import { aplicarActualizacion, useActualizacionDisponible } from '@/lib/pwa'

const ID = 'actualizacion-app'

/**
 * Avisa cuando hay una versión nueva y deja actualizar de forma segura: nunca recarga sola y, si hay un formulario con cambios sin guardar,
 * pide terminar antes (la sesión no se toca: vive en el almacenamiento del navegador y sobrevive a la recarga).
 */
export function useActualizacionApp() {
  const disponible = useActualizacionDisponible()
  useEffect(() => {
    if (!disponible) return
    const actualizar = () => {
      if (hayCambiosPendientes()) {
        toast.warning('Tienes cambios sin guardar. Guárdalos o descártalos y vuelve a pulsar «Actualizar».', { id: ID + '-pendiente' })
        return false // el aviso se queda abierto
      }
      aplicarActualizacion()
    }
    toast('Hay una nueva versión de Control Financiero', { id: ID, duration: Infinity, description: 'Actualiza cuando te venga bien; no perderás tu sesión.', action: { label: 'Actualizar', onClick: (e) => { if (actualizar() === false) e.preventDefault() } } })
    return () => { toast.dismiss(ID) }
  }, [disponible])
}
