import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Identidad «Control Financiero»: nombre, logo, favicon, metadatos, pantalla de acceso rediseñada y botones sociales (solo visuales).
 * No modifica datos: solo lee pantallas. Las comprobaciones sin sesión no requieren credenciales.
 */
// El nombre anterior como marca (con separador). Un correo técnico como e2e@gastodeejota.local es un identificador, no el nombre del producto.
const ANTIGUO = /gasto[ -]deejota|deejota[ -]gastos|gasto[ -]dj\b|\bdj[ -]gastos/i

const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const caja = async (l: ReturnType<Page['locator']>) => (await l.boundingBox())!
const tema = (page: Page, t: 'claro' | 'oscuro') => page.addInitScript((v) => localStorage.setItem('gd-tema', v), t)

test.describe('Acceso: identidad y rediseño', () => {
  test('muestra Control Financiero, el logo nuevo y la pestaña «Iniciar sesión | Control Financiero» sin rastro del nombre anterior', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/acceso')
    await expect(page.getByRole('heading', { level: 1, name: 'Bienvenido de nuevo' })).toBeVisible()
    await expect(page.getByText('Ingresa a tu cuenta para continuar.')).toBeVisible()
    await expect(page).toHaveTitle('Iniciar sesión | Control Financiero')
    await expect(page.locator('h2').filter({ hasText: /Tus finanzas,\s*bajo control\./ })).toBeVisible()
    await expect(page.getByText(/Organiza tus gastos, planifica tus presupuestos/)).toBeVisible()
    await expect(page.getByText('Control Financiero', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(ANTIGUO)
    // El logo anterior (un cuadro con la letra «G») ya no existe
    await expect(page.getByText('G', { exact: true })).toHaveCount(0)
    await expect(page.locator('svg[viewBox="0 0 32 32"] >> visible=true').first()).toBeVisible()
  })

  test('el campo de contraseña se muestra y oculta sin perder el valor; Enter envía; el botón no envía', async ({ page }) => {
    await page.goto('/acceso')
    const campo = page.getByLabel('Contraseña', { exact: true })
    await expect(campo).toHaveAttribute('type', 'password')
    await campo.fill('clave-de-prueba')
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
    await expect(campo).toHaveAttribute('type', 'text')
    await expect(campo).toHaveValue('clave-de-prueba')
    await expect(page).toHaveURL(/\/acceso$/) // mostrar no envía el formulario
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
    await expect(campo).toHaveAttribute('type', 'password')
    await page.getByLabel('Correo electrónico').fill('nadie@ejemplo.com')
    const peticion = page.waitForRequest((r) => r.url().includes('/auth/v1/token'))
    await campo.press('Enter')
    await peticion // Enter envía por el flujo de siempre (Supabase Auth)
    await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos.')
  })

  test('el botón «Iniciar sesión» muestra su estado de carga y no permite un segundo envío', async ({ page }) => {
    await page.route('**/auth/v1/token**', async (ruta) => { await new Promise((r) => setTimeout(r, 700)); await ruta.abort('connectionrefused') })
    await page.goto('/acceso')
    await page.getByLabel('Correo electrónico').fill('a@b.co')
    await page.getByLabel('Contraseña', { exact: true }).fill('cualquiera123')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    const enCurso = page.getByRole('button', { name: 'Iniciando sesión…' })
    await expect(enCurso).toBeDisabled()
    await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servidor.')
  })

  test('Google y Facebook son solo visuales: deshabilitados, sin etiqueta «Próximamente», sin peticiones ni navegación ni sesión', async ({ page }) => {
    const peticiones: string[] = []
    page.on('request', (r) => { if (/\/auth\/v1\//.test(r.url()) || /google|facebook|accounts\./.test(new URL(r.url()).hostname)) peticiones.push(r.url()) })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/acceso')
    const g = page.getByRole('button', { name: 'Continuar con Google (no disponible por ahora)' })
    const f = page.getByRole('button', { name: 'Continuar con Facebook (no disponible por ahora)' })
    await expect(g).toBeDisabled()
    await expect(f).toBeDisabled()
    await expect(page.getByText('o continúa con')).toBeVisible()
    await expect(page.getByText(/pr[óo]ximamente/i)).toHaveCount(0)
    expect(await page.content()).not.toMatch(/pr[óo]ximamente/i) // ni en etiquetas, ni en atributos, ni en tooltips
    await g.click({ force: true })
    await f.click({ force: true })
    await expect(page).toHaveURL(/\/acceso$/)
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /auth-token/.test(k)))).toEqual([])
    expect(peticiones.filter((u) => !/fonts\./.test(u))).toEqual([])
    // Alineación en escritorio: misma fila, mismo ancho y misma altura; logotipos cuadrados de 20 px
    const [a, b] = [await caja(g), await caja(f)]
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1)
    for (const btn of [g, f]) {
      const l = await caja(btn.locator('svg'))
      expect(Math.abs(l.width - l.height)).toBeLessThanOrEqual(0.5)
      expect(Math.round(l.width)).toBe(22)
    }
  })

  test('los botones sociales no compiten con «Iniciar sesión»: van debajo y el principal es el único relleno', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/acceso')
    const principal = await caja(page.getByRole('button', { name: 'Iniciar sesión' }))
    const social = await caja(page.getByRole('button', { name: /Google/ }))
    expect(social.y).toBeGreaterThan(principal.y + principal.height)
    const fondos = await page.evaluate(() => ['Iniciar sesión', 'Google'].map((t) => getComputedStyle([...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(t))!).backgroundColor))
    expect(fondos[0]).not.toBe(fondos[1])
  })

  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [430, 932], [390, 844], [375, 812], [320, 640], [844, 390]] as const) {
    for (const t of ['claro', 'oscuro'] as const) {
      test(`responsive ${w}×${h} (${t}): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos`, async ({ page }) => {
        await tema(page, t)
        await page.setViewportSize({ width: w, height: h })
        await page.goto('/acceso')
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        expect(await sinDesborde(page)).toBeLessThanOrEqual(1)
        for (const n of ['Iniciar sesión', /Google/, /Facebook/]) {
          const b = page.getByRole('button', { name: n })
          await b.scrollIntoViewIfNeeded()
          await expect(b).toBeInViewport()
        }
        await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeVisible()
        const g = await caja(page.getByRole('button', { name: /Google/ }))
        const f = await caja(page.getByRole('button', { name: /Facebook/ }))
        expect(Math.abs(g.height - f.height)).toBeLessThanOrEqual(1)
        expect(Math.abs(g.width - f.width)).toBeLessThanOrEqual(1)
        if (w >= 360) expect(Math.abs(g.y - f.y)).toBeLessThanOrEqual(1) // caben en una fila
        else expect(f.y).toBeGreaterThan(g.y + g.height - 1) // a 320 px se apilan
        // Ninguna tarjeta decorativa se sale de su panel y el logo no se deforma
        const iso = page.locator('svg[viewBox="0 0 32 32"] >> visible=true').first()
        const ib = await caja(iso)
        expect(Math.abs(ib.width - ib.height)).toBeLessThanOrEqual(0.5)
        // Dos columnas desde 1024 px; una sola por debajo
        const texto = page.locator('h2').filter({ hasText: /Tus finanzas,\s*bajo control\./ })
        const cabecera = page.locator('header')
        const presupuesto = page.getByText('Presupuesto del mes').filter({ visible: true })
        if (w >= 1024) { await expect(texto).toBeVisible(); await expect(cabecera).toBeHidden() }
        else { await expect(texto).toBeHidden(); await expect(cabecera).toBeVisible(); await expect(cabecera.getByText('Control Financiero', { exact: true })).toBeVisible() }
        // Tarjetas decorativas: clúster completo desde 1280, ninguna entre 1024 y 1279, y UNA sola tarjeta compacta en móvil/tablet
        await expect(presupuesto).toHaveCount(w >= 1280 || w < 1024 ? 1 : 0)
      })
    }
  }

  for (const t of ['claro', 'oscuro'] as const) {
    test(`accesibilidad (${t}): pantalla de acceso sin violaciones graves`, async ({ page }) => {
      await tema(page, t)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/acceso')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
  }

  test('la composición del panel es decorativa: oculta a lectores de pantalla y sin datos reales ni peticiones de datos', async ({ page }) => {
    const datos: string[] = []
    page.on('request', (rq) => { if (/\/rest\/v1\//.test(rq.url())) datos.push(rq.url()) })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/acceso')
    await expect(page.getByText('Presupuesto del mes').filter({ visible: true })).toBeVisible()
    for (const t of ['Presupuesto del mes', 'Fondos activos', 'Tendencia de gastos', 'Gastos por categoría']) {
      expect(await page.getByText(t, { exact: true }).first().evaluate((e) => !!e.closest('[aria-hidden="true"]')), t).toBe(true)
    }
    expect(datos).toEqual([]) // sin sesión no se consulta nada de nadie
    expect(await page.locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(['', '']) // ningún correo ni dato precargado
    expect(await page.locator('body').innerText()).not.toMatch(/@gastodeejota|demo@/i)
  })

  test('a 1280×720 la escena completa cabe sin scroll y nada se corta', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/acceso')
    await expect(page.getByText('Presupuesto del mes').filter({ visible: true })).toBeVisible()
    expect(await sinDesborde(page)).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(724) // a 1280×720 todo cabe sin scroll
  })

  test('el botón principal usa el degradado de la marca y los sociales no compiten (borde, sin relleno)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/acceso')
    const imagen = await page.getByRole('button', { name: 'Iniciar sesión' }).evaluate((b) => getComputedStyle(b).backgroundImage)
    expect(imagen).toMatch(/linear-gradient/)
    const social = await page.getByRole('button', { name: /Google/ }).evaluate((b) => getComputedStyle(b).backgroundImage)
    expect(social).toBe('none')
    await expect(page.getByRole('button', { name: /Google/ })).toHaveCSS('cursor', 'not-allowed')
  })

  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [430, 932], [390, 844], [375, 812], [320, 640], [844, 390]] as const) {
    for (const t of ['claro', 'oscuro'] as const) {
      test(`el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (${w}×${h}, ${t})`, async ({ page }) => {
        await tema(page, t)
        await page.setViewportSize({ width: w, height: h })
        await page.goto('/acceso')
        const sw = page.getByRole('switch').filter({ visible: true })
        await expect(sw).toHaveCount(1) // un único interruptor visible
        const b = await caja(sw)
        expect(b.x).toBeGreaterThanOrEqual(12) // nunca pegado al borde
        expect(b.y).toBeGreaterThanOrEqual(12)
        expect(b.x + b.width).toBeLessThanOrEqual(w - 12)
        expect(b.width).toBe(60) // medidas fijas: no crece ni se encoge
        expect(b.height).toBe(32)
        expect(await sinDesborde(page)).toBeLessThanOrEqual(0) // ni scroll horizontal por su culpa
        // El área táctil llega a 44 px de alto (la zona clicable se amplía sin agrandar lo que se ve)
        const toque = await sw.evaluate((e) => { const r = getComputedStyle(e, '::after'); return [parseFloat(r.height), parseFloat(r.width)] })
        expect(toque[0]).toBeGreaterThanOrEqual(43.5)
        // La perilla siempre queda dentro de la pista, con holgura, en ambos estados
        const perilla = await caja(sw.locator('.theme-switch-perilla'))
        expect(perilla.x).toBeGreaterThanOrEqual(b.x + 1)
        expect(perilla.x + perilla.width).toBeLessThanOrEqual(b.x + b.width - 1)
        expect(perilla.y).toBeGreaterThanOrEqual(b.y + 1)
        expect(perilla.y + perilla.height).toBeLessThanOrEqual(b.y + b.height - 1)
        // No tapa contenido: no se solapa con la tarjeta de acceso ni con la marca de la cabecera
        const tarjeta = await caja(page.locator('.esc-tarjeta').first())
        const solapa = !(b.x + b.width <= tarjeta.x || tarjeta.x + tarjeta.width <= b.x || b.y + b.height <= tarjeta.y || tarjeta.y + tarjeta.height <= b.y)
        expect(solapa).toBe(false)
        for (const marca of await page.locator('header svg[viewBox="0 0 32 32"], header .truncate').all()) {
          if (!(await marca.isVisible())) continue
          const m = await caja(marca)
          expect(!(b.x + b.width <= m.x || m.x + m.width <= b.x || b.y + b.height <= m.y || m.y + m.height <= b.y)).toBe(false)
        }
      })
    }
  }

  test('el interruptor funciona con el teclado (Espacio e Intro) y anuncia su estado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await tema(page, 'claro')
    await page.goto('/acceso')
    const sw = page.getByRole('switch').filter({ visible: true })
    await sw.focus()
    await expect(sw).toBeFocused()
    await page.keyboard.press('Space')
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.keyboard.press('Enter')
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  for (const t of ['claro', 'oscuro'] as const) {
    test(`las tarjetas financieras se renderizan nítidas: el contenido no recibe transform, filter, perspective ni animación (${t})`, async ({ page }) => {
      await tema(page, t)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/acceso')
      await expect(page.locator('[data-escena="cluster"]')).toBeVisible()
      const culpables = await page.evaluate(() => {
        const malos: string[] = []
        for (const raiz of document.querySelectorAll('[data-escena]')) {
          for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
            if (el.closest('[data-decorativo]') || el.closest('svg')) continue // capas decorativas y gráficos vectoriales internos
            const cs = getComputedStyle(el)
            const propiedades = { transform: cs.transform, filter: cs.filter, backdropFilter: cs.backdropFilter, perspective: cs.perspective, rotate: cs.rotate, scale: cs.scale, animationName: cs.animationName, willChange: cs.willChange }
            const sinValor = { transform: 'none', filter: 'none', backdropFilter: 'none', perspective: 'none', rotate: 'none', scale: 'none', animationName: 'none', willChange: 'auto' }
            for (const [k, v] of Object.entries(propiedades)) if (v !== (sinValor as Record<string, string>)[k]) malos.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ')[0]} ${k}=${v}`)
          }
        }
        return malos
      })
      expect(culpables.filter((c) => !/esc-barra/.test(c))).toEqual([]) // la barra de progreso (decorativa) anima su entrada con scaleX; no contiene texto
    })
  }

  test('cifras con números tabulares, tipografía del proyecto y clúster sin solaparse con la tarjeta de acceso (1280–1920 px)', async ({ page }) => {
    for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto('/acceso')
      const cluster = await caja(page.locator('[data-escena="cluster"]'))
      const tarjeta = await caja(page.locator('.esc-tarjeta').first())
      const texto = await caja(page.locator('h2').filter({ hasText: /Tus finanzas/ }))
      expect(cluster.x + cluster.width, `${w}: clúster vs tarjeta de acceso`).toBeLessThanOrEqual(tarjeta.x - 8)
      expect(cluster.x, `${w}: texto vs clúster`).toBeGreaterThanOrEqual(texto.x + texto.width - 1)
      expect(cluster.x).toBeGreaterThanOrEqual(0)
      const importe = page.locator('[data-escena="cluster"]').getByText('S/ 1,250', { exact: true })
      expect(await importe.evaluate((e) => getComputedStyle(e).fontVariantNumeric)).toContain('tabular-nums')
      expect(await importe.evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Bricolage Grotesque') // la tipografía de los títulos del proyecto
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
      // El tamaño del texto sigue el ancho disponible con tipografía real (no con scale): ≥ 13 px en todos los anchos
      const px = await page.locator('[data-escena="cluster"]').getByText('Presupuesto del mes').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
      expect(px).toBeGreaterThanOrEqual(10)
    }
  })

  test('el interruptor de tema cambia claro/oscuro, es un switch accesible y la preferencia se conserva al recargar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await tema(page, 'claro')
    await page.goto('/acceso')
    const interruptor = page.getByRole('switch', { name: 'Cambiar a tema oscuro' }).filter({ visible: true })
    await expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await interruptor.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('switch', { name: 'Cambiar a tema claro' }).filter({ visible: true })).toHaveAttribute('aria-checked', 'true')
    // Modo oscuro: nada de negro puro dominante (azul noche e índigo)
    const fondo = await page.locator('.login-escena').evaluate((e) => getComputedStyle(e).backgroundImage)
    expect(fondo).toMatch(/radial-gradient/)
    expect(fondo).not.toMatch(/rgb\(0, 0, 0\)/)
    await page.addInitScript(() => localStorage.setItem('gd-tema', 'oscuro')) // lo que el propio interruptor ya guardó
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('el movimiento es sutil y con «reducir movimiento» las tarjetas dejan de animarse', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/acceso')
    const flota = page.locator('.esc-flota').first()
    expect(await flota.evaluate((e) => getComputedStyle(e).animationName)).toBe('esc-flota')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const sel of ['.esc-flota', '.esc-barra', '.esc-entrada']) expect(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).animationName), sel).toBe('none')
  })

  test('el teclado recorre el formulario en orden lógico (correo, contraseña, mostrar, olvidé, enviar)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/acceso')
    await page.getByLabel('Correo electrónico').focus()
    const orden: string[] = []
    for (let i = 0; i < 5; i++) {
      orden.push(await page.evaluate(() => { const a = document.activeElement as HTMLElement; return a.getAttribute('aria-label') ?? (a.textContent?.trim() || a.getAttribute('type') || a.tagName) }))
      await page.keyboard.press('Tab')
    }
    expect(orden).toEqual(['email', 'password', 'Mostrar contraseña', '¿Olvidaste tu contraseña?', 'Iniciar sesión'])
  })

  test('recuperar contraseña y sesión vencida usan la misma identidad y su título de pestaña', async ({ page }) => {
    await page.goto('/recuperar')
    await expect(page).toHaveTitle('Recuperar contraseña | Control Financiero')
    expect(await page.locator('body').innerText()).not.toMatch(ANTIGUO)
    await page.goto('/sesion-expirada')
    await expect(page).toHaveTitle('Tu sesión venció | Control Financiero')
    expect(await page.locator('body').innerText()).not.toMatch(ANTIGUO)
  })
})

test.describe('Recursos de identidad', () => {
  test('favicon, icono de la app y manifiesto existen, con versión, y los metadatos usan el nombre nuevo', async ({ page, request }) => {
    await page.goto('/acceso')
    const enlaces = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map((l) => ({ rel: l.getAttribute('rel'), href: l.getAttribute('href')! })))
    expect(enlaces.map((e) => e.rel)).toEqual(['icon', 'icon', 'apple-touch-icon', 'manifest'])
    for (const e of enlaces) {
      expect(e.href).toMatch(/\?v=\d+$/) // versionado: evita ver el icono anterior en caché
      const r = await request.get(e.href)
      expect(r.status(), e.href).toBe(200)
    }
    const meta = await page.evaluate(() => ({
      descripcion: document.querySelector('meta[name="description"]')?.getAttribute('content'),
      app: document.querySelector('meta[name="application-name"]')?.getAttribute('content'),
      ogTitulo: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      ogSitio: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content'),
      color: [...document.querySelectorAll('meta[name="theme-color"]')].length,
    }))
    expect(meta.app).toBe('Control Financiero')
    expect(meta.ogTitulo).toBe('Control Financiero')
    expect(meta.ogSitio).toBe('Control Financiero')
    expect(meta.descripcion).toMatch(/Organiza tus gastos/)
    expect(meta.color).toBe(2)
    const manifiesto = await (await request.get('/manifest.webmanifest?v=4')).json()
    expect(manifiesto.name).toBe('Control Financiero')
    expect(manifiesto.short_name).toBe('Control Financiero')
    expect(manifiesto.icons.map((i: { purpose: string }) => i.purpose)).toEqual(['any', 'any', 'maskable', 'maskable'])
    for (const i of manifiesto.icons as { src: string }[]) expect((await request.get(i.src)).status(), i.src).toBe(200)
    expect(JSON.stringify([meta, manifiesto])).not.toMatch(ANTIGUO)
  })
})

test.describe('Aplicación con sesión', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('el inicio de sesión con correo y contraseña sigue funcionando y aterriza en «Dashboard | Control Financiero»', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await expect(page).toHaveTitle('Dashboard | Control Financiero')
    await expect(page.getByRole('navigation', { name: 'Módulos' }).first()).toBeVisible()
  })

  test('cada módulo lleva su título de pestaña y ninguna pantalla muestra el nombre anterior', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    for (const [ruta, seccion] of [['/', 'Dashboard'], ['/gastos', 'Gastos'], ['/fondos', 'Fondos'], ['/catalogo', 'Catálogo'], ['/salud', 'Salud financiera'], ['/configuracion', 'Configuración']] as const) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 1, name: seccion })).toBeVisible()
      await expect(page).toHaveTitle(`${seccion} | Control Financiero`)
      expect(await page.locator('body').innerText(), ruta).not.toMatch(ANTIGUO)
    }
    // Diálogos y formularios principales
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await expect(page.getByRole('dialog', { name: 'Plantillas mensuales' })).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(ANTIGUO)
  })

  test('barra lateral: logo y nombre completos sin cortarse; contraída conserva solo el isotipo y la transición no mueve los iconos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const barra = page.locator('#barra-lateral')
    const nombre = barra.getByText('Control Financiero', { exact: true })
    await expect(nombre).toBeVisible()
    await expect(nombre).toHaveCSS('opacity', '1')
    expect(await nombre.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true) // el nombre no se trunca
    // El botón de contraer queda al pie de la navegación (no compite con el logo) y la barra completa no desborda
    const toggle = barra.getByRole('button', { name: 'Contraer la barra lateral' })
    const ultimo = await caja(barra.getByRole('link', { name: 'Configuración' }))
    expect((await caja(toggle)).y).toBeGreaterThan(ultimo.y + ultimo.height - 1)
    expect(await barra.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
    const iconoAntes = await caja(barra.getByRole('link', { name: 'Gastos' }).locator('svg'))
    // Contraída: solo el isotipo (con su nombre accesible), el nombre se desvanece y los iconos no cambian de sitio
    await toggle.click()
    await expect(barra.getByRole('img', { name: 'Control Financiero' })).toBeVisible()
    await expect(nombre).toHaveCSS('opacity', '0')
    const iso = await caja(barra.getByRole('img', { name: 'Control Financiero' }))
    expect(Math.abs(iso.width - iso.height)).toBeLessThanOrEqual(0.5) // sin deformar
    await expect.poll(async () => Math.round((await caja(barra.getByRole('link', { name: 'Gastos' }).locator('svg'))).x)).toBe(Math.round(iconoAntes.x)) // misma posición horizontal
    await barra.getByRole('link', { name: 'Gastos' }).hover()
    await expect(page.getByRole('tooltip', { name: 'Gastos' })).toBeVisible()
    await barra.getByRole('button', { name: 'Expandir la barra lateral' }).click()
    await expect(nombre).toHaveCSS('opacity', '1')
  })

  test('el cierre de sesión vuelve al acceso renovado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.getByRole('button', { name: 'Salir (cerrar sesión)' }).click()
    await expect(page).toHaveURL(/\/acceso$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Bienvenido de nuevo' })).toBeVisible()
    await expect(page).toHaveTitle('Iniciar sesión | Control Financiero')
  })

  for (const t of ['claro', 'oscuro'] as const) {
    test(`la barra lateral y el encabezado se ven bien en tema ${t} (axe)`, async ({ page }) => {
      await tema(page, t)
      await page.setViewportSize({ width: 1440, height: 900 })
      await iniciarSesion(page)
      await page.waitForTimeout(600) // deja terminar las transiciones de color del tema: axe mediría el fondo a mitad de camino
      const r = await new AxeBuilder({ page }).include('#barra-lateral').withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
  }
})
