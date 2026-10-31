import { type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '../e2e/fixtures'
import { email, iniciarSesion, password } from '../e2e/helpers'

/**
 * PWA de Control Financiero sobre la build de producción. Se prueba lo que se puede automatizar de verdad (instalabilidad según Chrome, manifiesto,
 * iconos, Service Worker, sin conexión, actualización y cachés). NO se prueba en dispositivos físicos: ver docs/pwa.md.
 */
const conSesion = !email || !password

/** Espera a que el Service Worker esté activo y controlando la página (se recarga una vez, como en la primera visita real). */
async function esperarWorker(page: Page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
}

const versionDelWorker = (page: Page) => page.evaluate(() => new Promise<string>((resolver) => {
  const canal = new MessageChannel()
  canal.port1.onmessage = (e) => resolver(e.data)
  navigator.serviceWorker.controller!.postMessage({ tipo: 'VERSION' }, [canal.port2])
}))

const urlsEnCachés = (page: Page) => page.evaluate(async () => {
  const out: Record<string, string[]> = {}
  for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).map((r) => r.url)
  return out
})

test.describe('Instalabilidad y recursos', () => {
  test('Chrome considera la app instalable: manifiesto sin errores y ningún motivo de rechazo', async ({ page }) => {
    await page.goto('/acceso')
    await esperarWorker(page)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Page.enable')
    const manifiesto = await cdp.send('Page.getAppManifest')
    expect(manifiesto.errors.map((e) => e.message)).toEqual([])
    expect(manifiesto.url).toMatch(/\/manifest\.webmanifest/)
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    expect(installabilityErrors).toEqual([])
  })

  test('el manifiesto declara nombre, modo independiente, alcance, colores e iconos (any y maskable)', async ({ request }) => {
    const m = await (await request.get('/manifest.webmanifest?v=4')).json()
    expect(m).toMatchObject({ name: 'Control Financiero', short_name: 'Control Financiero', start_url: '/', scope: '/', display: 'standalone', lang: 'es', theme_color: '#f1f0fd' })
    expect(m.description).toMatch(/Organiza tus gastos/)
    const propositos = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)
    expect(propositos).toEqual(['192x192:any', '512x512:any', '192x192:maskable', '512x512:maskable'])
    expect(m.shortcuts.map((s: { url: string }) => s.url)).toEqual(['/gastos', '/fondos'])
    expect(JSON.stringify(m)).not.toMatch(/deejota/i)
  })

  test('los iconos existen con el tamaño declarado y los maskable respetan la zona segura (contenido dentro del 80 % central)', async ({ page, request }) => {
    for (const [ruta, lado] of [['/icon-192.png', 192], ['/icon-512.png', 512], ['/icon-maskable-192.png', 192], ['/icon-maskable-512.png', 512], ['/apple-touch-icon.png', 180], ['/favicon-32.png', 32]] as const) {
      const r = await request.get(ruta)
      expect(r.status(), ruta).toBe(200)
      expect(r.headers()['content-type'], ruta).toContain('image/png')
      const b = await r.body()
      expect([b.readUInt32BE(16), b.readUInt32BE(20)], ruta).toEqual([lado, lado]) // cabecera IHDR del PNG
    }
    await page.goto('/acceso')
    const fueraDeZona = await page.evaluate(async () => {
      const img = new Image(); img.src = '/icon-maskable-512.png'; await img.decode()
      const c = document.createElement('canvas'); c.width = c.height = 512
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0)
      const fondo = Array.from(g.getImageData(2, 2, 1, 1).data) // esquina: el fondo degradado de la marca (debe ser opaco)
      const d = g.getImageData(0, 0, 512, 512).data
      let fuera = 0
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const dentro = Math.hypot(x - 256, y - 256) <= 512 * 0.4 // círculo de seguridad de los iconos maskable
        const i = (y * 512 + x) * 4
        if (!dentro && d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) fuera++ // el trazo del logo es blanco; el degradado violeta nunca llega a ese brillo
      }
      return { fuera, fondo, esquinaOpaca: fondo[3] === 255 }
    })
    expect(fueraDeZona.esquinaOpaca).toBe(true) // maskable = sin transparencia
    expect(fueraDeZona.fuera).toBe(0)
  })

  test('cabeceras de despliegue: se sirve el manifiesto correcto y el Service Worker es de la raíz', async ({ request }) => {
    const sw = await request.get('/sw.js')
    expect(sw.status()).toBe(200)
    expect(sw.headers()['content-type']).toMatch(/javascript/)
    const cuerpo = await sw.text()
    expect(cuerpo).not.toContain("'__BUILD_ID__'") // el build selló la versión…
    expect(cuerpo).not.toContain('/*__PRECACHE__*/ []') // …y la lista de precarga
    expect(cuerpo).toMatch(/const VERSION = "[0-9a-f]{10}"/)
    expect(cuerpo).toContain('/index.html')
    expect((await request.get('/offline.html')).status()).toBe(200)
    // netlify.toml fuerza revalidar sw.js, manifiesto y cáscara (cada despliegue llega a la app instalada)
    const toml = readFileSync('netlify.toml', 'utf8')
    for (const ruta of ['/sw.js', '/manifest.webmanifest', '/index.html']) expect(toml).toContain(`for = "${ruta}"`)
    expect(toml).toMatch(/for = "\/sw\.js"[\s\S]*?no-cache, no-store, must-revalidate/)
  })
})

test.describe('Service Worker, caché y sin conexión', () => {
  test('se registra, precachea la cáscara y su versión coincide con su caché', async ({ page }) => {
    await page.goto('/acceso')
    await esperarWorker(page)
    const version = await versionDelWorker(page)
    expect(version).toMatch(/^[0-9a-f]{10}$/)
    const cachés = await urlsEnCachés(page)
    expect(Object.keys(cachés)).toEqual([`cf-estatico-${version}`])
    const rutas = cachés[`cf-estatico-${version}`].map((u) => new URL(u).pathname)
    expect(rutas).toContain('/index.html')
    expect(rutas).toContain('/offline.html')
    expect(rutas.some((r) => /^\/assets\/index-.*\.js$/.test(r))).toBe(true)
    expect(rutas.some((r) => /^\/assets\/index-.*\.css$/.test(r))).toBe(true)
  })

  test.skip(conSesion, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test('nunca se cachean datos de Supabase, tokens ni respuestas autenticadas (solo recursos estáticos del propio sitio)', async ({ page }) => {
    await page.goto('/acceso')
    await esperarWorker(page)
    await iniciarSesion(page)
    for (const ruta of ['/gastos', '/fondos', '/catalogo']) { await page.goto(ruta); await expect(page.getByRole('heading', { level: 1 })).toBeVisible() }
    const cachés = await urlsEnCachés(page)
    const todas = Object.values(cachés).flat()
    expect(todas.length).toBeGreaterThan(3)
    for (const u of todas) {
      const url = new URL(u)
      expect(url.origin, u).toBe(new URL(page.url()).origin) // solo el propio sitio
      expect(url.pathname, u).not.toMatch(/^\/(rest|auth|storage|functions|realtime)\//)
      expect(u, u).not.toMatch(/supabase|54321|token|apikey|access_token/i)
    }
    // y los tokens de sesión no están en ninguna caché del Service Worker
    const claves = await page.evaluate(async () => {
      const hallazgos: string[] = []
      for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) { const resp = await (await caches.open(n)).match(r); const t = resp ? await resp.clone().text() : ''; if (/eyJ[\w-]{20,}\.[\w-]{20,}\./.test(t)) hallazgos.push(r.url) }
      return hallazgos
    })
    expect(claves).toEqual([])
  })

  test('sin conexión la app abre desde la caché, avisa con claridad y al volver la conexión el aviso desaparece', async ({ page, context }) => {
    await page.goto('/acceso')
    await esperarWorker(page)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Bienvenido de nuevo' })).toBeVisible() // la cáscara salió de la caché
    const aviso = page.getByRole('status').filter({ hasText: 'Sin conexión' })
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('guardar cambios requiere Internet')
    // Iniciar sesión sin red informa el problema (no simula nada)
    await page.getByLabel('Correo electrónico').fill('a@b.co')
    await page.getByLabel('Contraseña', { exact: true }).fill('cualquiera123')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servidor.')
    await context.setOffline(false)
    await expect(aviso).toBeHidden()
  })

  test('con sesión iniciada y sin conexión se restaura la app, se avisa y no se aparenta ningún guardado', async ({ page, context }) => {
    test.skip(conSesion, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
    await page.goto('/acceso')
    await esperarWorker(page)
    await iniciarSesion(page)
    await page.goto('/gastos')
    await expect(page.getByRole('heading', { level: 1, name: 'Gastos' })).toBeVisible()
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Gastos' })).toBeVisible() // sesión restaurada desde el navegador, no desde la caché del worker
    // Intentar guardar sin red falla con su aviso habitual: nada queda «en cola» para enviarse solo después
    await page.getByRole('button', { name: /Registrar gasto/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeHidden()
  })
})

test.describe('Actualización de versión', () => {
  test.skip(conSesion, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  /**
   * Un despliegue nuevo = el servidor entrega un sw.js distinto. Se simula reemplazando dist/sw.js (lo que sirve `vite preview`) por el mismo código con
   * OTRA versión, y se restaura al terminar cada prueba. (page.route no intercepta la descarga del script del worker.)
   */
  const RUTA_SW = 'dist/sw.js'
  let swOriginal = ''
  test.beforeEach(() => { swOriginal = readFileSync(RUTA_SW, 'utf8') })
  test.afterEach(() => { writeFileSync(RUTA_SW, swOriginal) })
  const simularDespliegue = (version: string) => writeFileSync(RUTA_SW, swOriginal.replace(/const VERSION = "[0-9a-f]{10}"/, `const VERSION = "${version}"`))

  test('una versión nueva se ofrece (no se impone), se instala al aceptar y la sesión sigue abierta', async ({ page }) => {
    await page.goto('/acceso')
    await esperarWorker(page)
    await iniciarSesion(page)
    const antes = await versionDelWorker(page)
    simularDespliegue('abcdef1234')
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
    const aviso = page.getByText('Hay una nueva versión de Control Financiero')
    await expect(aviso).toBeVisible()
    expect(await versionDelWorker(page)).toBe(antes) // sigue la versión anterior hasta que la persona acepta
    await page.evaluate(() => { (window as unknown as { __marca: number }).__marca = 1 })
    await page.getByRole('button', { name: 'Actualizar' }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __marca?: number }).__marca).catch(() => 'recargando')).toBeUndefined() // la página se recargó
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toHaveAttribute('aria-current', 'page') // y la sesión se conserva
    expect(await versionDelWorker(page)).toBe('abcdef1234')
    // Las cachés de la versión anterior se borraron (sin recursos obsoletos)
    expect(Object.keys(await urlsEnCachés(page))).toEqual(['cf-estatico-abcdef1234'])
  })

  test('con un formulario a medias la actualización no se puede aplicar (nada se recarga ni se pierde); al descartarlo, sí', async ({ page }) => {
    await page.goto('/acceso')
    await esperarWorker(page)
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: /Registrar gasto/ }).first().click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()
    await dialogo.getByLabel('Descripción').fill('Compra a medias')
    simularDespliegue('ffff000011')
    await page.evaluate(async () => { (window as unknown as { __marca: number }).__marca = 1; await (await navigator.serviceWorker.getRegistration())!.update() })
    await expect(page.getByText('Hay una nueva versión de Control Financiero')).toBeVisible()
    // Con el formulario abierto el aviso queda bloqueado por el diálogo: no se puede pulsar, no se recarga y no se activa la versión nueva
    const alcanzable = () => page.getByRole('button', { name: 'Actualizar' }).evaluate((b) => { const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b })
    expect(await alcanzable()).toBe(false)
    expect(await page.evaluate(() => (window as unknown as { __marca?: number }).__marca)).toBe(1)
    await expect(dialogo.getByLabel('Descripción')).toHaveValue('Compra a medias')
    expect(await versionDelWorker(page)).not.toBe('ffff000011')
    // Descartar el formulario (con su confirmación) libera la actualización
    await page.keyboard.press('Escape')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar cambios' }).click()
    await expect(dialogo).toBeHidden()
    await page.getByRole('button', { name: 'Actualizar' }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __marca?: number }).__marca).catch(() => 'recargando')).toBeUndefined()
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible() // sesión conservada
    expect(await versionDelWorker(page)).toBe('ffff000011')
  })
})

test.describe('Instalación', () => {
  test.skip(conSesion, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  const dispararInstalacion = (page: Page) => page.evaluate(() => {
    const w = window as unknown as { __prompts: number }
    w.__prompts = w.__prompts ?? 0
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    e.prompt = async () => { w.__prompts++ }
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(e)
  })

  test('con el evento del navegador aparece «Instalar Control Financiero», lanza el diálogo nativo una vez y la invitación se retira', async ({ page }) => {
    await iniciarSesion(page)
    await expect(page.getByRole('button', { name: 'Instalar Control Financiero' })).toHaveCount(0) // sin evento no se muestra un botón inútil
    await dispararInstalacion(page)
    const boton = page.getByRole('button', { name: 'Instalar Control Financiero' })
    await expect(boton).toBeVisible()
    await boton.click()
    expect(await page.evaluate(() => (window as unknown as { __prompts: number }).__prompts)).toBe(1)
    await expect(boton).toBeHidden()
  })

  test('«Ahora no» pospone la invitación y no vuelve a aparecer aunque el navegador la ofrezca de nuevo', async ({ page }) => {
    await iniciarSesion(page)
    await dispararInstalacion(page)
    await page.getByRole('button', { name: /Ahora no/ }).click()
    await expect(page.getByRole('button', { name: 'Instalar Control Financiero' })).toBeHidden()
    await page.reload()
    await dispararInstalacion(page)
    await expect(page.getByRole('button', { name: 'Instalar Control Financiero' })).toHaveCount(0)
  })

  test('ya instalada (modo standalone) no se ofrece instalar', async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window)
      window.matchMedia = (q: string) => (q.includes('display-mode: standalone') ? ({ ...original(q), matches: true, media: q } as MediaQueryList) : original(q))
    })
    await iniciarSesion(page)
    await dispararInstalacion(page)
    await expect(page.getByRole('button', { name: 'Instalar Control Financiero' })).toHaveCount(0)
  })

  test('el registro de gastos sigue disponible mientras se muestra la invitación (no la tapa)', async ({ page }) => {
    await iniciarSesion(page)
    await dispararInstalacion(page)
    await expect(page.getByRole('button', { name: 'Instalar Control Financiero' })).toBeVisible()
    await page.getByRole('button', { name: /Registrar gasto/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('iPhone (sin evento de instalación)', () => {
  test.skip(conSesion, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', hasTouch: true, viewport: { width: 390, height: 844 } })

  test('muestra instrucciones para «Agregar a pantalla de inicio» en lugar de un botón de instalación que no haría nada', async ({ page }) => {
    await iniciarSesion(page)
    await expect(page.getByRole('button', { name: 'Instalar Control Financiero' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Cómo instalar' }).click()
    const d = page.getByRole('dialog', { name: /Instalar Control Financiero en tu iPhone/ })
    await expect(d).toBeVisible()
    await expect(d).toContainText('Safari')
    await expect(d).toContainText('Compartir')
    await expect(d).toContainText('Agregar a pantalla de inicio')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    await d.getByRole('button', { name: 'Entendido' }).click()
    await expect(d).toBeHidden()
  })
})
