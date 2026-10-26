import { type Locator, type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * El anillo de foco (2 px de contorno + 2 px de separación) no debe recortarse en ningún control de un diálogo:
 * se enfoca cada control y se comprueba que su área de foco cabe dentro de todos los contenedores que recortan.
 */
async function recortes(dialogo: Locator): Promise<string[]> {
  return dialogo.evaluate((raiz) => {
    const fallos: string[] = []
    const controles = raiz.querySelectorAll<HTMLElement>('input:not([type=hidden]), textarea, select, button, [role=combobox], [role=radio], [role=switch], [tabindex="0"]')
    for (const el of controles) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
      el.focus({ preventScroll: false })
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const e = el.getBoundingClientRect()
      const margen = 4
      for (let a = el.parentElement; a && a !== raiz.parentElement; a = a.parentElement) {
        const cs = getComputedStyle(a)
        const recorta = [cs.overflowX, cs.overflowY].some((o) => o !== 'visible')
        if (!recorta) continue
        const c = a.getBoundingClientRect()
        // Solo cuenta el eje horizontal y el vertical dentro del contenedor visible del diálogo
        if (e.left - margen < c.left - 0.5 || e.right + margen > c.right + 0.5) {
          fallos.push(`${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.id ?? el.textContent?.slice(0, 20)}] recortado en horizontal por <${a.tagName.toLowerCase()} class="${(a.className as string).slice(0, 40)}">`)
          break
        }
      }
    }
    return fallos
  })
}

async function revisar(page: Page, nombre: string) {
  const d = page.getByRole('dialog').last()
  await expect(d).toBeVisible()
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
  expect(await recortes(d), `foco recortado en «${nombre}»`).toEqual([])
}

test.describe('Diálogos: el borde de foco no se recorta', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('Fondos: nuevo fondo, editar fondo y presupuesto del período', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await page.getByRole('button', { name: 'Nuevo fondo' }).click()
    await revisar(page, 'Nuevo fondo')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Más acciones de Hogar' }).click()
    await page.getByRole('menuitem', { name: /Editar fondo/ }).click()
    await revisar(page, 'Editar fondo')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Más acciones de Hogar' }).click()
    await page.getByRole('menuitem', { name: /Cambiar presupuesto del período/ }).click()
    await revisar(page, 'Presupuesto del período')
  })

  test('Gastos: nuevo gasto, plantillas y registro mensual', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    await revisar(page, 'Nuevo gasto')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await revisar(page, 'Plantillas')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Registrar mensuales' }).click()
    await revisar(page, 'Registro mensual')
  })

  test('Catálogo: nuevo ámbito y nueva categoría', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    await revisar(page, 'Nuevo ámbito')
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Categorías', exact: true }).click()
    await page.getByRole('button', { name: 'Nueva categoría' }).click()
    await revisar(page, 'Nueva categoría')
  })
})
