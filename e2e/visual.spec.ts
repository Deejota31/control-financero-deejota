import { mkdirSync } from 'node:fs'
import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

const RUTAS = [
  { ruta: '/', nombre: 'dashboard', espera: 'Gasto acumulado' },
  { ruta: '/gastos', nombre: 'gastos', espera: 'Movimientos' },
  { ruta: '/fondos', nombre: 'fondos', espera: 'Presupuesto asignado' },
  { ruta: '/catalogo', nombre: 'catalogo', espera: 'Ámbitos' },
  { ruta: '/salud', nombre: 'salud', espera: '¿Cuánto presupuesto queda?' },
  { ruta: '/configuracion', nombre: 'configuracion', espera: 'Perfil y preferencias' },
] as const

const DIR = 'capturas'

async function revisar(page: Page, ancho: number, nombre = '') {
  // Sin desborde horizontal de la página
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(desborde, `desborde horizontal a ${ancho}px en ${nombre}`).toBeLessThanOrEqual(1)
  // Ningún marcador de módulo pendiente
  await expect(page.getByText(/todavía no está implementado|módulo no implementado/i)).toHaveCount(0)
  // Todo control interactivo visible tiene nombre accesible
  const sinNombre = await page.evaluate(() => {
    const visibles = (el: Element) => !!(el as HTMLElement).offsetParent || getComputedStyle(el).position === 'fixed'
    return [...document.querySelectorAll('button, a[href], [role="button"], [role="combobox"], input:not([type="hidden"]), select')]
      .filter(visibles)
      .filter((el) => {
        const e = el as HTMLElement
        const nombre = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.textContent?.trim() || (e as HTMLInputElement).placeholder || e.getAttribute('title')
        const etiquetado = (e as HTMLInputElement).labels?.length
        return !nombre && !etiquetado
      })
      .map((el) => el.outerHTML.slice(0, 120))
  })
  expect(sinNombre, 'controles sin nombre accesible').toEqual([])
}

test.describe('Revisión visual y de accesibilidad', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))

  for (const tema of ['claro', 'oscuro'] as const) {
    test(`páginas completas a 1440 px, tema ${tema}`, async ({ page }) => {
      test.setTimeout(90_000)
      const errores = vigilarConsola(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await iniciarSesion(page)
      const actual = await page.locator('html').getAttribute('data-theme')
      if ((tema === 'oscuro') !== (actual === 'dark')) await page.getByRole('button', { name: /Cambiar a tema/ }).click()
      for (const r of RUTAS) {
        await page.getByRole('link', { name: r.nombre === 'dashboard' ? 'Dashboard' : r.nombre === 'salud' ? 'Salud financiera' : new RegExp(`^${r.nombre === 'configuracion' ? 'Configuración' : r.nombre === 'catalogo' ? 'Catálogo' : r.nombre === 'gastos' ? 'Gastos' : 'Fondos'}$`) }).first().click()
        await expect(page.getByText(r.espera, { exact: false }).first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        await revisar(page, 1440, r.nombre)
        await page.screenshot({ path: `${DIR}/${r.nombre}-${tema}.png`, fullPage: true })
      }
      // Deja el perfil en tema claro para no afectar a otras pruebas
      if (tema === 'oscuro') {
        await Promise.all([
          page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH'),
          page.getByRole('button', { name: 'Cambiar a tema claro' }).click(),
        ])
      }
      expect(errores).toEqual([])
    })
  }

  test('en 390 px no hay desborde horizontal y la navegación inferior funciona', async ({ page }) => {
    test.setTimeout(90_000)
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    for (const r of RUTAS) {
      await page.goto(r.ruta)
      await expect(page.getByText(r.espera, { exact: false }).first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      await revisar(page, 390, r.nombre)
      await page.screenshot({ path: `${DIR}/movil-${r.nombre}.png`, fullPage: true })
    }
    expect(errores).toEqual([])
  })

  test('los formularios y diálogos principales se pueden recorrer con teclado', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).focus()
    await page.keyboard.press('Enter')
    const dialogo = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await expect(dialogo).toBeVisible()
    // Selector por teclado: abrir, filtrar, elegir con Enter
    await dialogo.getByRole('combobox', { name: 'Ámbito', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(dialogo.getByRole('combobox', { name: 'Ámbito', exact: true })).toContainText('Hogar')
    // El foco queda dentro del diálogo; con cambios sin guardar Escape pide confirmar y descartar lo cierra
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Descartar cambios' }).click()
    await expect(dialogo).toBeHidden()
    await expect(page.getByRole('button', { name: 'Nuevo gasto' })).toBeFocused()
  })
})
