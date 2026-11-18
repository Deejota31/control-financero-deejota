import { mkdirSync } from 'node:fs'
import { test, expect } from './fixtures'
import { iniciarSesion, vigilarConsola } from './helpers'
import AxeBuilder from '@axe-core/playwright'
import { devices } from '@playwright/test'

const rutas = ['/', '/gastos', '/fondos', '/eventos', '/catalogo', '/configuracion']
const anchos = [320, 360, 375, 390, 414, 428, 600, 768, 1024, 1280, 1440, 1920]
const fase = process.env.QA_LIMPIEZA_FASE ?? 'despues'

test('limpieza visual: módulos, temas y tamaños', async ({ page }, info) => {
  test.setTimeout(240_000)
  const errores = vigilarConsola(page)
  const carpeta = `qa/limpieza/${fase}/${info.project.name || 'chromium'}`
  mkdirSync(carpeta, { recursive: true })
  await iniciarSesion(page)
  await expect(page.getByRole('region', { name: 'Filtros del dashboard' })).toBeVisible()
  for (const ruta of rutas.filter(ruta => !process.env.QA_LIMPIEZA_RUTA || ruta === process.env.QA_LIMPIEZA_RUTA)) {
    if (new URL(page.url()).pathname !== ruta) await page.goto(ruta)
    await expect(page.locator('main')).toBeVisible()
    if (ruta === '/') await expect(page.getByRole('region', { name: 'Indicadores', exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    for (const tema of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
      for (const width of fase === 'antes' ? [390, 1440] : anchos) {
        await page.setViewportSize({ width, height: 900 })
        // Esperar un documento estable: un contexto reemplazado durante la medición
        // se reevalúa; un desborde persistente o una ruta incorrecta siguen fallando.
        await expect(async () => {
          await expect(page).toHaveURL(url => url.pathname === ruta)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${ruta} ${tema} ${width}: sin desbordamiento horizontal`).toBe(true)
        }).toPass({ timeout: 10_000 })
        if ([390, 1440].includes(width)) await page.screenshot({ path: `${carpeta}/${ruta.slice(1) || 'dashboard'}-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
  }
  expect(errores).toEqual([])
})

test('formularios: acciones visibles, ayuda accesible y alturas reducidas', async ({ page }, info) => {
  test.setTimeout(150_000)
  const carpeta = `qa/limpieza/despues/${info.project.name || 'chromium'}`
  mkdirSync(carpeta, { recursive: true })
  await iniciarSesion(page)
  await expect(page.getByRole('region', { name: 'Filtros del dashboard' })).toBeVisible()
  for (const [ruta, abrir, guardar] of [
    ['/gastos', 'Registrar gasto', 'Guardar gasto'],
    ['/fondos', 'Nuevo fondo', 'Guardar fondo'],
    ['/eventos', 'Nuevo evento', 'Guardar evento'],
  ]) {
    await page.goto(ruta)
    await page.getByRole('button', { name: abrir, exact: true }).click()
    const d = page.getByRole('dialog', { name: /^(Nuevo gasto|Nuevo fondo|Nuevo evento)$/ })
    if (ruta === '/fondos') {
      await d.getByRole('textbox', { name: 'Buscar en la clasificación' }).fill('a')
      await expect(d.getByRole('radiogroup').first()).toBeVisible()
    }
    for (const tema of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
      for (const [width, height] of [[320, 568], [360, 640], [390, 480], [428, 800], [600, 800], [768, 1024], [1024, 600], [1440, 900], [844, 390], [667, 320]]) {
        await page.setViewportSize({ width, height })
        await expect(d.getByRole('button', { name: guardar, exact: true })).toBeInViewport()
        await expect(d.getByRole('button', { name: 'Cancelar', exact: true })).toBeInViewport()
        expect(await d.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${ruta} ${width}x${height}`).toBe(true)
        expect(await d.locator('form').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `Formulario ${ruta} ${width}x${height}`).toBe(true)
        if (width === 390) await page.screenshot({ path: `${carpeta}/formulario-${ruta.slice(1)}-${tema}.png`, animations: 'disabled' })
      }
    }
    await page.setViewportSize({ width: 390, height: 480 })
    if (ruta !== '/gastos') {
      const ayuda = d.getByRole('button', { name: 'Ayuda: cómo funciona' })
      await ayuda.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: 'Ayuda: cómo funciona' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(d).toBeVisible()
      await expect(ayuda).toBeFocused()
      await ayuda.click()
      await expect(page.getByRole('dialog', { name: 'Ayuda: cómo funciona' })).toBeVisible()
      await page.keyboard.press('Escape')
    }
    const r = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
    await d.getByRole('button', { name: 'Cerrar', exact: true }).click()
  }
})

test('planificación: tres etapas con navegación visible en móvil y horizontal', async ({ page }) => {
  test.setTimeout(120_000)
  await iniciarSesion(page)
  await expect(page.getByRole('region', { name: 'Filtros del dashboard' })).toBeVisible()
  const siguiente = new Date()
  siguiente.setMonth(siguiente.getMonth() + 1, 1)
  const mes = `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, '0')}-01`
  await page.goto(`/fondos?mes=${mes}`)
  await page.getByRole('button', { name: 'Abrir planificación mensual', exact: true }).click()
  const d = page.getByRole('dialog', { name: /^Planificación · / })
  for (let paso = 0; paso < 3; paso++) {
    await d.locator('ol[aria-label="Etapas de la planificación"] button').nth(paso).click()
    const accion = d.getByRole('button', { name: paso === 2 ? 'Finalizar planificación' : 'Continuar', exact: true })
    for (const [width, height] of [[320, 568], [390, 480], [600, 800], [768, 1024], [844, 390], [1440, 900]]) {
      await page.setViewportSize({ width, height })
      await expect(accion).toBeInViewport()
      expect(await d.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
  }
})

test('ayuda por toque conserva el formulario al cerrar con Escape', async ({ browser, browserName }) => {
  const dispositivo = browserName === 'webkit' ? devices['iPhone 13'] : browserName === 'chromium' ? devices['Pixel 7'] : { hasTouch: true, viewport: { width: 390, height: 600 } }
  const context = await browser.newContext({ ...dispositivo, baseURL: 'http://127.0.0.1:5173' })
  const page = await context.newPage()
  try {
    await iniciarSesion(page)
    await expect(page.getByRole('region', { name: 'Filtros del dashboard' })).toBeVisible()
    await page.goto('/fondos')
    await page.getByRole('button', { name: 'Nuevo fondo', exact: true }).tap()
    const d = page.getByRole('dialog', { name: 'Nuevo fondo', exact: true })
    const ayuda = d.getByRole('button', { name: 'Ayuda: cómo funciona' })
    await ayuda.tap()
    await expect(page.getByRole('dialog', { name: 'Ayuda: cómo funciona' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(d).toBeVisible()
    await expect(ayuda).toBeFocused()
  } finally { await context.close() }
})

test('configuración completa, movimiento reducido y reflujo al 200 %', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await iniciarSesion(page)
  await expect(page.getByRole('region', { name: 'Filtros del dashboard' })).toBeVisible()
  for (const seccion of ['perfil', 'hogar', 'exportar', 'cuenta', 'actividad']) {
    await page.goto(`/configuracion?seccion=${seccion}`)
    await expect(page.getByRole('tabpanel')).toBeVisible()
    for (const width of anchos) {
      await page.setViewportSize({ width, height: 720 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${seccion} ${width}`).toBe(true)
    }
  }
  // 1280×900 píxeles físicos a escala 2: viewport de 640×450 CSS px.
  // El viewport reducido también activa los breakpoints, como el zoom del navegador.
  // CSS zoom conserva media queries de 1280 px y no reproduce esa condición.
  const contexto = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 640, height: 450 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const ampliada = await contexto.newPage()
  try {
    await iniciarSesion(ampliada)
    await expect(ampliada.getByRole('region', { name: 'Filtros del dashboard' })).toBeVisible()
    for (const ruta of rutas) {
      await ampliada.goto(ruta)
      await ampliada.waitForLoadState('networkidle')
      expect(await ampliada.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${ruta} reflujo equivalente al 200 %`).toBe(true)
    }
  } finally { await contexto.close() }
})
