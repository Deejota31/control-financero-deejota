import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

async function opcionesDe(page: Page, nombre: string) {
  await page.getByRole('combobox', { name: nombre, exact: true }).click()
  const textos = await page.getByRole('option').allTextContents()
  await page.keyboard.press('Escape')
  return textos.map((t) => t.trim())
}

test.describe('Filtros: sin opciones repetidas', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  for (const [ruta, nombres] of [['/', ['Categoría', 'Subcategoría']], ['/gastos', ['Categoría']]] as const) {
    test(`${ruta === '/' ? 'Dashboard' : 'Gastos'}: cada nombre aparece una sola vez (las homónimas se agrupan en una opción)`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await iniciarSesion(page)
      await page.goto(ruta)
      for (const n of nombres) {
        const ops = await opcionesDe(page, n)
        expect(ops.length, n).toBeGreaterThan(0)
        expect(new Set(ops).size, `opciones repetidas en ${n}: ${ops.join(' | ')}`).toBe(ops.length)
      }
    })
  }

  test('con un ámbito elegido, las categorías siguen sin repetirse y los filtros dependientes siguen funcionando', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.getByRole('combobox', { name: 'Ámbito', exact: true }).click()
    await page.getByRole('option', { name: 'Hogar', exact: true }).click()
    const ops = await opcionesDe(page, 'Categoría')
    expect(new Set(ops).size).toBe(ops.length)
    expect(ops.every((o) => !o.includes(' · ')), 'dentro de un ámbito no hace falta el contexto').toBe(true)
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page).not.toHaveURL(/ambito=/)
  })
})
