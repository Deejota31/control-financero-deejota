import { useEffect } from 'react'
import { tituloPagina } from './marca'

/** Pone el título de la pestaña: «Sección | Control Financiero». */
export function useTituloPagina(seccion?: string | null) {
  useEffect(() => {
    document.title = tituloPagina(seccion)
  }, [seccion])
}
