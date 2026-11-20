import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { expect, test } from '../e2e/fixtures'
import { email, iniciarSesion, password } from '../e2e/helpers'

/**
 * La política de seguridad de contenido de producción (netlify.toml) debe permitir que la app funcione. `vite preview` no aplica las cabeceras de Netlify,
 * así que la prueba la sirve como cabecera desde un proxy local delante de la build y comprueba que no hay violaciones durante un recorrido con sesión. Solo se añade el origen de Supabase local.
 */
const toml = readFileSync('netlify.toml', 'utf8')
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)?.[1] ?? ''
const sinSesion = !email || !password

const PUERTO_PROXY = 4174
let proxy: Server
let politicaActiva = ''

test.describe('Cabeceras de seguridad (netlify.toml)', () => {
  test.beforeAll(async () => {
    proxy = createServer(async (req, res) => {
      const r = await fetch(`http://127.0.0.1:4173${req.url}`, { headers: { accept: String(req.headers.accept ?? '*/*') } })
      const cabeceras: Record<string, string> = { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'no-cache' }
      if (politicaActiva) cabeceras['content-security-policy'] = politicaActiva
      res.writeHead(r.status, cabeceras)
      res.end(Buffer.from(await r.arrayBuffer()))
    })
    await new Promise<void>((ok) => proxy.listen(PUERTO_PROXY, '127.0.0.1', ok))
  })
  test.afterAll(() => { proxy?.close() })
  // Playwright no intercepta de forma fiable las peticiones de páginas controladas por un Service Worker; este recorrido valida la CSP, no la PWA.
  test.use({ serviceWorkers: 'block', baseURL: `http://127.0.0.1:${PUERTO_PROXY}` })
  test('declara CSP restrictiva, HSTS, nosniff, frame-ancestors y política de referencia', () => {
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(toml).toMatch(/Strict-Transport-Security = "max-age=\d{7,}/)
    expect(toml).toContain('X-Content-Type-Options = "nosniff"')
    expect(toml).toContain('Referrer-Policy')
  })

  test('la app funciona con la CSP aplicada: sin violaciones al iniciar sesión y recorrer los módulos', async ({ page }) => {
    test.skip(sinSesion, 'requiere el usuario E2E de .env.local')
    const local = new URL(process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321').origin
    const politica = csp.replace("connect-src 'self'", `connect-src 'self' ${local}`).replace("img-src 'self'", `img-src 'self' ${local}`).replace('; upgrade-insecure-requests', '')
    politicaActiva = politica
    const violaciones: string[] = []
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violaciones.push(m.text()) })
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`Refused to: ${e.violatedDirective} ${e.blockedURI}`)))
    // Control positivo: la política está activa de verdad (un script en línea debe ser rechazado y detectado).
    await page.goto('/acceso')
    await page.evaluate(() => { const el = document.createElement('script'); el.textContent = 'window.__x = 1'; document.body.appendChild(el) })
    await expect.poll(() => violaciones.length).toBeGreaterThan(0)
    violaciones.length = 0
    await iniciarSesion(page)
    for (const ruta of ['/gastos', '/fondos', '/configuracion', '/']) {
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
    }
    expect(violaciones).toEqual([])
  })
})
