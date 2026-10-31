/* Service Worker de Control Financiero.
 *
 * QUÉ CACHEA: solo recursos ESTÁTICOS del propio sitio (la «cáscara» de la aplicación): index.html, /assets/* (con hash en el nombre, inmutables),
 * iconos y manifiesto. Con eso la app abre rápido y, sin conexión, muestra su pantalla y un aviso claro.
 *
 * QUÉ NO TOCA NUNCA: nada de otro origen (Supabase: API, Auth y Storage; fuentes), nada que no sea GET, nada con cabecera Authorization y ninguna ruta
 * de API. Los datos financieros y los tokens viajan siempre por la red directa y jamás se guardan en estas cachés.
 *
 * ACTUALIZACIONES: un despliegue nuevo trae un sw.js distinto (VERSION cambia en cada build). El worker nuevo queda «en espera»: NO se activa solo.
 * La aplicación avisa y, cuando la persona acepta (y no hay formularios sin guardar), le envía SKIP_WAITING y recarga.
 * Como los archivos de /assets llevan hash, un index.html nuevo nunca mezcla archivos de versiones distintas.
 *
 * __BUILD_ID__ y __PRECACHE__ los sustituye el build (vite.config.ts); en desarrollo este archivo no se registra.
 */
const VERSION = '__BUILD_ID__'
const PRECACHE = /*__PRECACHE__*/ []
const PREFIJO = 'cf-estatico-'
const CACHE = PREFIJO + VERSION
const SHELL = '/index.html'
const OFFLINE = '/offline.html'
/** Rutas estáticas de la raíz que se revalidan en segundo plano (iconos, manifiesto). */
const RECURSOS = ['/manifest.webmanifest', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']
/** Rutas que, aunque fueran del mismo origen, jamás se cachean. */
const PRIVADAS = ['/rest/', '/auth/', '/storage/', '/functions/', '/realtime/']
const ESPERA_RED_MS = 5000

/** Decide qué estrategia aplica a una petición; `null` = no interceptar (red directa, sin caché). */
function clasificar(request, origen) {
  if (request.method !== 'GET') return null
  const url = new URL(request.url)
  if (url.origin !== origen) return null
  if (request.headers.has('authorization')) return null
  if (PRIVADAS.some((p) => url.pathname.startsWith(p))) return null
  if (request.mode === 'navigate') return 'navegacion'
  if (url.pathname.startsWith('/assets/')) return 'inmutable'
  if (RECURSOS.includes(url.pathname)) return 'revalidar'
  return null
}

const guardable = (respuesta) => respuesta && respuesta.ok && respuesta.type === 'basic'

/** Navegación: red primero (siempre el HTML más nuevo); sin red o con red muy lenta, la cáscara guardada o la página sin conexión. */
async function navegacion(request) {
  try {
    const respuesta = await Promise.race([
      fetch(request),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('lenta')), ESPERA_RED_MS)),
    ])
    if (guardable(respuesta) && (respuesta.headers.get('content-type') || '').includes('text/html')) {
      const cache = await caches.open(CACHE)
      await cache.put(SHELL, respuesta.clone())
    }
    return respuesta
  } catch {
    return (await caches.match(SHELL)) || (await caches.match(OFFLINE)) || Response.error()
  }
}

/** Archivos con hash: la caché manda; si faltan se piden y se guardan. */
async function inmutable(request) {
  const guardado = await caches.match(request)
  if (guardado) return guardado
  const respuesta = await fetch(request)
  if (guardable(respuesta)) (await caches.open(CACHE)).put(request, respuesta.clone())
  return respuesta
}

/** Iconos y manifiesto: se sirve lo guardado y se refresca en segundo plano. */
async function revalidar(request) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(request)
  const red = fetch(request).then((r) => { if (guardable(r)) cache.put(request, r.clone()); return r }).catch(() => null)
  return guardado || (await red) || Response.error()
}

self.addEventListener('install', (evento) => {
  // Sin skipWaiting: la actualización la decide la persona.
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...PRECACHE, OFFLINE])))
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre.startsWith(PREFIJO) && nombre !== CACHE) await caches.delete(nombre)
    await self.clients.claim()
  })())
})

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'SKIP_WAITING') self.skipWaiting()
  if (evento.data && evento.data.tipo === 'VERSION' && evento.ports[0]) evento.ports[0].postMessage(VERSION)
})

self.addEventListener('fetch', (evento) => {
  const estrategia = clasificar(evento.request, self.location.origin)
  if (estrategia === 'navegacion') evento.respondWith(navegacion(evento.request))
  else if (estrategia === 'inmutable') evento.respondWith(inmutable(evento.request))
  else if (estrategia === 'revalidar') evento.respondWith(revalidar(evento.request))
})
