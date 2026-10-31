import { useSyncExternalStore } from 'react'

/**
 * PWA: instalación, estado de conexión y actualización de versión.
 * Este módulo no guarda ningún dato de la persona: solo estado del navegador (evento de instalación, worker en espera, conexión).
 */

/* ------------------------------ Funciones puras (probadas) ------------------------------ */

/** iPhone, iPad e iPadOS (que se anuncia como Mac pero tiene pantalla táctil). */
export const esIOS = (ua: string, plataforma: string, puntosTactiles: number): boolean =>
  /iPad|iPhone|iPod/.test(ua) || (plataforma === 'MacIntel' && puntosTactiles > 1)

export type ModoInstalacion = 'instalada' | 'nativa' | 'ios' | 'ninguna'

/**
 * Cómo se puede ofrecer la instalación: `instalada` (ya se usa como app: no ofrecer nada), `nativa` (el navegador dio el evento de instalación),
 * `ios` (sin evento programático: se muestran instrucciones) o `ninguna` (el navegador no lo permite: no se muestra un botón que no haría nada).
 */
export function modoInstalacion(e: { instalada: boolean; promptDisponible: boolean; ios: boolean }): ModoInstalacion {
  if (e.instalada) return 'instalada'
  if (e.promptDisponible) return 'nativa'
  if (e.ios) return 'ios'
  return 'ninguna'
}

export const DIAS_POSPONER = 14
export const CLAVE_POSPONER = 'cf-instalar-hasta'
export const posponidaHasta = (ahora: number, dias = DIAS_POSPONER) => ahora + dias * 86_400_000
/** ¿La invitación sigue pospuesta? `hasta` es una marca de tiempo (ms) o null. */
export const invitacionPosponida = (hasta: number | null, ahora: number) => hasta !== null && Number.isFinite(hasta) && ahora < hasta

/* ------------------------------ Estado del navegador ------------------------------ */

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())
const suscribir = (f: () => void) => { oyentes.add(f); return () => void oyentes.delete(f) }

let eventoInstalacion: EventoInstalacion | null = null
let instaladaAhora = false
let actualizacionEnEspera: ServiceWorker | null = null
let recargando = false
/** Solo se recarga tras una actualización que la persona aceptó: nunca por sorpresa (podría tener un formulario a medias). */
let actualizacionAceptada = false

/** ¿Se está ejecutando como aplicación instalada (ventana independiente)? */
export function estaInstalada(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return instaladaAhora || standalone || window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: minimal-ui)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || false
}

function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return // en desarrollo no se registra: evitaría ver cambios al instante
  const marcar = (r: ServiceWorkerRegistration) => { if (r.waiting && navigator.serviceWorker.controller) { actualizacionEnEspera = r.waiting; avisar() } }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return
    recargando = true // una sola recarga, solo cuando la persona aceptó la actualización
    if (actualizacionAceptada) window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((r) => {
      marcar(r)
      r.addEventListener('updatefound', () => {
        const nuevo = r.installing
        nuevo?.addEventListener('statechange', () => { if (nuevo.state === 'installed') marcar(r) })
      })
      // Busca versiones nuevas al volver a la app y cada hora (la app instalada puede pasar días abierta en segundo plano)
      const buscar = () => void r.update().catch(() => {})
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar() })
      window.setInterval(buscar, 60 * 60_000)
    }).catch(() => { /* sin worker la app funciona igual, solo sin caché */ })
  })
}

/** Activa la versión nueva y recarga. El llamador debe haber comprobado antes que no hay formularios sin guardar. */
export function aplicarActualizacion() {
  if (!actualizacionEnEspera) return
  actualizacionAceptada = true
  actualizacionEnEspera.postMessage({ tipo: 'SKIP_WAITING' })
}

/** Ofrece el diálogo nativo de instalación (solo si el navegador entregó el evento). */
export async function lanzarInstalacion(): Promise<'accepted' | 'dismissed' | 'no-disponible'> {
  const e = eventoInstalacion
  if (!e) return 'no-disponible'
  eventoInstalacion = null // el evento solo se puede usar una vez
  avisar()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome
}

/** Se llama una vez al arrancar la aplicación. */
export function iniciarPwa() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalacion = e as EventoInstalacion; avisar() })
  window.addEventListener('appinstalled', () => { eventoInstalacion = null; instaladaAhora = true; avisar() })
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  registrarServiceWorker()
}

/* ------------------------------ Hooks ------------------------------ */

export function useModoInstalacion(): ModoInstalacion {
  return useSyncExternalStore(suscribir, () => {
    const n = window.navigator
    return modoInstalacion({ instalada: estaInstalada(), promptDisponible: eventoInstalacion !== null, ios: esIOS(n.userAgent, n.platform, n.maxTouchPoints) })
  }, () => 'ninguna')
}

export const useActualizacionDisponible = () => useSyncExternalStore(suscribir, () => actualizacionEnEspera !== null, () => false)
export const useEnLinea = () => useSyncExternalStore(suscribir, () => navigator.onLine, () => true)
