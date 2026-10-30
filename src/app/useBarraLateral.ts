import { useCallback, useEffect, useState } from 'react'

type Modo = 'expandida' | 'compacta'

/** Ancho desde el que la barra expandida cabe sin quitarle espacio útil al contenido (escritorio). */
const ANCHO_ESCRITORIO = '(min-width: 1280px)'
const CLAVE = { escritorio: 'gd:barra-lateral:escritorio', tablet: 'gd:barra-lateral:tablet' } as const

function leer(clave: string, defecto: Modo): Modo {
  try {
    const v = localStorage.getItem(clave)
    return v === 'compacta' || v === 'expandida' ? v : defecto
  } catch {
    return defecto
  }
}
function guardar(clave: string, v: Modo) {
  try { localStorage.setItem(clave, v) } catch { /* sin almacenamiento: la preferencia vale solo para esta sesión */ }
}

/**
 * Estado de la barra lateral. Hay dos preferencias independientes: la de escritorio (por defecto expandida) y la de pantallas
 * medianas (por defecto compacta, porque el espacio no alcanza). Cambiar una nunca sobrescribe la otra.
 */
export function useBarraLateral() {
  const [escritorio, setEscritorio] = useState(() => (typeof matchMedia === 'undefined' ? true : matchMedia(ANCHO_ESCRITORIO).matches))
  const [prefEscritorio, setPrefEscritorio] = useState<Modo>(() => leer(CLAVE.escritorio, 'expandida'))
  const [prefTablet, setPrefTablet] = useState<Modo>(() => leer(CLAVE.tablet, 'compacta'))

  useEffect(() => {
    const mq = matchMedia(ANCHO_ESCRITORIO)
    const alCambiar = () => setEscritorio(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  const modo = escritorio ? prefEscritorio : prefTablet
  const alternar = useCallback(() => {
    const siguiente: Modo = modo === 'compacta' ? 'expandida' : 'compacta'
    if (escritorio) { setPrefEscritorio(siguiente); guardar(CLAVE.escritorio, siguiente) }
    else { setPrefTablet(siguiente); guardar(CLAVE.tablet, siguiente) }
  }, [modo, escritorio])

  return { compacta: modo === 'compacta', alternar }
}
