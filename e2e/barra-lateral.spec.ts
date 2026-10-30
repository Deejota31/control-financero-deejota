import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

const RUTAS: [string, string][] = [['/', 'Dashboard'], ['/gastos', 'Gastos'], ['/fondos', 'Fondos'], ['/catalogo', 'Catálogo'], ['/salud', 'Salud financiera'], ['/configuracion', 'Configuración']]

test.describe('Barra lateral: expandida y compacta', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('alterna entre modos por clic y teclado en los seis módulos, sin dejar márgenes vacíos', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const lado = page.locator('#barra-lateral')
    const nav = lado.getByRole('navigation', { name: 'Módulos' })
    for (const [ruta, nombre] of RUTAS) {
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
      const toggle = lado.getByRole('button', { name: /barra lateral/ })
      // Expandida: etiquetas completas, sin cortes
      if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(nav.getByRole('link', { name: nombre })).toContainText(nombre)
      await expect(nav.getByRole('link', { name: nombre })).toHaveAttribute('aria-current', 'page')
      expect((await lado.boundingBox())!.width).toBeGreaterThan(220)
      const sinCortar = await nav.getByRole('link').evaluateAll((els) => els.every((e) => { const t = e.querySelector<HTMLElement>('span:not(.absolute)'); return !t || t.scrollWidth <= t.clientWidth + 1 }))
      expect(sinCortar, `etiquetas cortadas en ${nombre}`).toBe(true)
      // Compacta: solo iconos centrados, contenido ocupando el espacio liberado
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(lado).toHaveJSProperty('clientWidth', 72, { timeout: 3000 }).catch(() => undefined)
      await expect.poll(async () => Math.round((await lado.boundingBox())!.width)).toBeLessThanOrEqual(80)
      await expect(nav.getByRole('link', { name: nombre })).toHaveAttribute('aria-current', 'page')
      // Iconos centrados en la barra compacta (si los estilos del enlace se perdieran, quedarían pegados a la izquierda)
      const anchoBarra = (await lado.boundingBox())!.width
      for (const l of await nav.getByRole('link').all()) {
        const b = (await l.boundingBox())!
        expect(Math.abs(b.x + b.width / 2 - anchoBarra / 2), `icono descentrado en ${nombre}`).toBeLessThanOrEqual(2)
        expect(b.height).toBeGreaterThanOrEqual(36)
      }
      const cabecera = (await page.locator('header').first().boundingBox())!
      expect(Math.abs(cabecera.x - (await lado.boundingBox())!.width)).toBeLessThanOrEqual(2) // el contenido empieza donde acaba la barra
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
      await toggle.click()
    }
    expect(errores).toEqual([])
  })

  test('en modo compacto el nombre completo aparece al enfocar con teclado y la preferencia sobrevive a recargar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const lado = page.locator('#barra-lateral')
    const toggle = lado.getByRole('button', { name: /barra lateral/ })
    if ((await toggle.getAttribute('aria-expanded')) === 'true') {
      await toggle.focus()
      await page.keyboard.press('Enter') // por teclado, sin hover
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await page.reload()
    await expect(lado.getByRole('button', { name: /barra lateral/ })).toHaveAttribute('aria-expanded', 'false')
    const enlace = lado.getByRole('link', { name: 'Fondos' })
    await enlace.focus()
    await expect(page.getByRole('tooltip').getByText('Fondos')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    // La cuenta es un avatar accesible con su tooltip
    const cuenta = lado.getByRole('link', { name: /^Cuenta:/ })
    await expect(cuenta).toBeVisible()
    await cuenta.focus()
    await expect(page.getByRole('tooltip')).toBeVisible()
    // Volver a expandir deja la preferencia lista para la próxima visita
    await lado.getByRole('button', { name: /barra lateral/ }).click()
    await page.reload()
    await expect(lado.getByRole('button', { name: /barra lateral/ })).toHaveAttribute('aria-expanded', 'true')
  })

  test('la preferencia de tablet no sobrescribe la de escritorio', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const lado = page.locator('#barra-lateral')
    const t = () => lado.getByRole('button', { name: /barra lateral/ })
    await expect(t()).toHaveAttribute('aria-expanded', 'true') // escritorio: expandida
    await page.setViewportSize({ width: 1100, height: 800 })
    await expect(t()).toHaveAttribute('aria-expanded', 'false') // tablet: compacta de inicio
    await t().click() // en tablet la persona la expande
    await expect(t()).toHaveAttribute('aria-expanded', 'true')
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(t()).toHaveAttribute('aria-expanded', 'true')
    await t().click() // escritorio: compacta
    await page.setViewportSize({ width: 1100, height: 800 })
    await expect(t()).toHaveAttribute('aria-expanded', 'true') // la de tablet se conserva
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(t()).toHaveAttribute('aria-expanded', 'false')
    await t().click()
  })

  test('con movimiento reducido el cambio de ancho no se anima', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const p = await page.locator('#barra-lateral').evaluate((el) => getComputedStyle(el.parentElement!).transitionProperty)
    expect(p).toBe('none')
  })
})
