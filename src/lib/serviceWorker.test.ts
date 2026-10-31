// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

/**
 * Pruebas del comportamiento REAL de public/sw.js: se ejecuta el archivo en un contexto aislado con un `self`, `caches` y `fetch` simulados.
 * Lo importante de seguridad: nada de otro origen (Supabase), nada que no sea GET y nada con Authorization pasa por las cachés.
 */
const ORIGEN = 'https://control.example'
const codigo = readFileSync('public/sw.js', 'utf8').replace("'__BUILD_ID__'", "'v-test'").replace('/*__PRECACHE__*/ []', "['/index.html', '/assets/app-abc123.js']")

type Manejador = (e: unknown) => void
/** Una respuesta de mismo origen como las del navegador (type «basic»): las `Response` creadas a mano son «default». */
const basica = (cuerpo: string, init: ResponseInit = {}) => Object.defineProperty(new Response(cuerpo, init), 'type', { value: 'basic' })
const esperar = () => new Promise((r) => setTimeout(r, 0))
function cargar(red: (req: Request) => Promise<Response>) {
  const manejadores: Record<string, Manejador> = {}
  const almacenes = new Map<string, Map<string, Response>>()
  const abrir = (n: string) => { if (!almacenes.has(n)) almacenes.set(n, new Map()); return almacenes.get(n)! }
  const clave = (r: Request | string) => new URL(typeof r === 'string' ? r : r.url, ORIGEN).pathname
  const caches = {
    open: async (n: string) => { const a = abrir(n); return { put: async (r: Request | string, v: Response) => void a.set(clave(r), v), match: async (r: Request | string) => a.get(clave(r)), addAll: async (l: string[]) => { for (const u of l) a.set(clave(u), new Response('guardado ' + u, { headers: { 'content-type': u.endsWith('.html') ? 'text/html' : 'text/plain' } })) } } },
    match: async (r: Request | string) => { for (const a of almacenes.values()) if (a.has(clave(r))) return a.get(clave(r)) },
    keys: async () => [...almacenes.keys()],
    delete: async (n: string) => almacenes.delete(n),
  }
  const self = { location: { origin: ORIGEN }, addEventListener: (t: string, f: Manejador) => { manejadores[t] = f }, skipWaiting: vi.fn(), clients: { claim: vi.fn(async () => {}) } }
  const contexto = { self, caches, fetch: (r: Request) => red(r), Response, Request, URL, Promise, setTimeout, console }
  runInNewContext(codigo, contexto)
  const peticion = (url: string, init: RequestInit & { modo?: string } = {}) => {
    const r = new Request(url, init)
    return Object.defineProperty(r, 'mode', { value: init.modo ?? 'cors' })
  }
  /** Simula un `fetch` del navegador: devuelve la respuesta si el worker la interceptó, o `undefined` si la dejó pasar. */
  const despachar = async (r: Request) => {
    let respuesta: Promise<Response> | undefined
    manejadores.fetch({ request: r, respondWith: (p: Promise<Response>) => { respuesta = p } })
    return respuesta ? await respuesta : undefined
  }
  return { contexto, manejadores, almacenes, caches, peticion, despachar, self }
}

describe('clasificar (qué se intercepta)', () => {
  const { contexto, peticion } = cargar(async () => new Response('x'))
  const clasificar = (contexto as unknown as { clasificar: (r: Request, o: string) => string | null }).clasificar
  it('intercepta solo recursos estáticos del propio sitio', () => {
    expect(clasificar(peticion(ORIGEN + '/', { modo: 'navigate' }), ORIGEN)).toBe('navegacion')
    expect(clasificar(peticion(ORIGEN + '/assets/app-abc123.js'), ORIGEN)).toBe('inmutable')
    expect(clasificar(peticion(ORIGEN + '/icon-192.png'), ORIGEN)).toBe('revalidar')
    expect(clasificar(peticion(ORIGEN + '/manifest.webmanifest'), ORIGEN)).toBe('revalidar')
  })
  it('NUNCA intercepta Supabase ni ningún otro origen (datos y tokens van por la red directa)', () => {
    expect(clasificar(peticion('https://abc.supabase.co/rest/v1/expenses?select=*'), ORIGEN)).toBeNull()
    expect(clasificar(peticion('https://abc.supabase.co/auth/v1/token?grant_type=password', { method: 'POST' }), ORIGEN)).toBeNull()
    expect(clasificar(peticion('https://abc.supabase.co/storage/v1/object/sign/comprobantes/x.pdf'), ORIGEN)).toBeNull()
    expect(clasificar(peticion('https://fonts.googleapis.com/css2?family=Figtree'), ORIGEN)).toBeNull()
  })
  it('no intercepta escrituras, peticiones con Authorization ni rutas de API aunque fueran del mismo origen', () => {
    expect(clasificar(peticion(ORIGEN + '/assets/x.js', { method: 'POST' }), ORIGEN)).toBeNull()
    expect(clasificar(peticion(ORIGEN + '/assets/x.js', { headers: { Authorization: 'Bearer secreto' } }), ORIGEN)).toBeNull()
    expect(clasificar(peticion(ORIGEN + '/rest/v1/expenses'), ORIGEN)).toBeNull()
    expect(clasificar(peticion(ORIGEN + '/auth/v1/user'), ORIGEN)).toBeNull()
    expect(clasificar(peticion(ORIGEN + '/datos-privados.json'), ORIGEN)).toBeNull()
  })
})

describe('instalación y actualización', () => {
  it('precachea la cáscara y la página sin conexión, y NO se activa sola (la persona decide)', async () => {
    const w = cargar(async () => new Response('x'))
    let esperando: Promise<unknown> = Promise.resolve()
    w.manejadores.install({ waitUntil: (p: Promise<unknown>) => { esperando = p } })
    await esperando
    expect([...w.almacenes.keys()]).toEqual(['cf-estatico-v-test'])
    expect([...w.almacenes.get('cf-estatico-v-test')!.keys()].sort()).toEqual(['/assets/app-abc123.js', '/index.html', '/offline.html'])
    expect(w.self.skipWaiting).not.toHaveBeenCalled()
  })
  it('solo activa la versión nueva cuando la aplicación lo pide con SKIP_WAITING', () => {
    const w = cargar(async () => new Response('x'))
    w.manejadores.message({ data: { tipo: 'otra-cosa' }, ports: [] })
    expect(w.self.skipWaiting).not.toHaveBeenCalled()
    w.manejadores.message({ data: { tipo: 'SKIP_WAITING' }, ports: [] })
    expect(w.self.skipWaiting).toHaveBeenCalledTimes(1)
  })
  it('al activarse borra las cachés de versiones anteriores y conserva la actual (sin recursos obsoletos)', async () => {
    const w = cargar(async () => new Response('x'))
    await w.caches.open('cf-estatico-v-vieja')
    await w.caches.open('cf-estatico-v-test')
    await w.caches.open('otra-app-cache')
    let esperando: Promise<unknown> = Promise.resolve()
    w.manejadores.activate({ waitUntil: (p: Promise<unknown>) => { esperando = p } })
    await esperando
    expect([...w.almacenes.keys()].sort()).toEqual(['cf-estatico-v-test', 'otra-app-cache'])
    expect(w.self.clients.claim).toHaveBeenCalled()
  })
})

describe('estrategias', () => {
  it('archivos con hash: la caché manda y no vuelve a pedirlos a la red', async () => {
    const red = vi.fn(async () => new Response('desde la red'))
    const w = cargar(red)
    const cache = await w.caches.open('cf-estatico-v-test')
    await cache.put(ORIGEN + '/assets/app-abc123.js', new Response('desde la caché'))
    const r = await w.despachar(w.peticion(ORIGEN + '/assets/app-abc123.js'))
    expect(await r!.text()).toBe('desde la caché')
    expect(red).not.toHaveBeenCalled()
  })
  it('un archivo con hash nuevo se pide a la red y se guarda para la próxima', async () => {
    const w = cargar(async () => basica('nuevo'))
    const r = await w.despachar(w.peticion(ORIGEN + '/assets/app-nuevo.js'))
    expect(await r!.text()).toBe('nuevo')
    await esperar() // el guardado va en segundo plano
    expect(w.almacenes.get('cf-estatico-v-test')!.has('/assets/app-nuevo.js')).toBe(true)
  })
  it('navegación con red: sirve el HTML más nuevo y lo guarda como cáscara', async () => {
    const w = cargar(async () => basica('<html>nuevo</html>', { headers: { 'content-type': 'text/html' } }))
    const r = await w.despachar(w.peticion(ORIGEN + '/gastos', { modo: 'navigate' }))
    expect(await r!.text()).toBe('<html>nuevo</html>')
    expect(await (await w.caches.match('/index.html'))!.text()).toBe('<html>nuevo</html>')
  })
  it('navegación SIN red: sirve la cáscara guardada; sin cáscara, la página «Sin conexión»', async () => {
    const w = cargar(async () => { throw new TypeError('Failed to fetch') })
    const cache = await w.caches.open('cf-estatico-v-test')
    await cache.put('/offline.html', new Response('sin conexión'))
    expect(await (await w.despachar(w.peticion(ORIGEN + '/fondos', { modo: 'navigate' })))!.text()).toBe('sin conexión')
    await cache.put('/index.html', new Response('cáscara'))
    expect(await (await w.despachar(w.peticion(ORIGEN + '/fondos', { modo: 'navigate' })))!.text()).toBe('cáscara')
  })
  it('una petición a Supabase no pasa por el worker: no se responde ni se guarda nada', async () => {
    const w = cargar(async () => new Response(JSON.stringify([{ amount: 10 }])))
    const r = await w.despachar(w.peticion('https://abc.supabase.co/rest/v1/expenses'))
    expect(r).toBeUndefined()
    expect([...w.almacenes.values()].flatMap((a) => [...a.keys()]).some((k) => /rest|auth|supabase/.test(k))).toBe(false)
  })
  it('una respuesta con error no se guarda como si fuera válida', async () => {
    const w = cargar(async () => new Response('no', { status: 500 }))
    await w.despachar(w.peticion(ORIGEN + '/assets/roto.js'))
    expect(w.almacenes.get('cf-estatico-v-test')?.has('/assets/roto.js') ?? false).toBe(false)
  })
})
