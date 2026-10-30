import { mkdirSync } from 'node:fs'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const DIR = 'capturas'

const gasto = (n: number, cmp: '=' | '>=') =>
  sqlLocal(`select e.description from public.expenses e where e.household_id = ${HID} and e.status = 'active' and e.expense_date >= date_trunc('month', current_date)
    and (select count(*) from public.expense_fund_allocations a where a.expense_id = e.id) ${cmp} ${n} order by e.amount desc limit 1`)

/** Capturas de revisión visual de Gastos (tabla, selección múltiple y detalle con uno y varios fondos) en claro y oscuro. */
test.describe('Capturas de diseño: Gastos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))

  for (const tema of ['claro', 'oscuro'] as const) {
    test(`tabla, selección y detalle a 1440 px, tema ${tema}`, async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width: 1440, height: 900 })
      await iniciarSesion(page)
      const actual = await page.locator('html').getAttribute('data-theme')
      if ((tema === 'oscuro') !== (actual === 'dark')) await page.getByRole('button', { name: /Cambiar a tema/ }).click()
      await page.getByRole('link', { name: 'Gastos' }).first().click()
      await expect(page.getByRole('table')).toBeVisible()
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `${DIR}/gastos-tabla-${tema}.png`, fullPage: true })

      await page.getByRole('checkbox', { name: /^Seleccionar / }).nth(1).check()
      await page.getByRole('checkbox', { name: /^Seleccionar / }).nth(3).check()
      await page.screenshot({ path: `${DIR}/gastos-seleccion-${tema}.png`, fullPage: false })
      await page.getByRole('button', { name: 'Quitar selección' }).click()

      for (const [nombre, d] of [['un-fondo', gasto(1, '=')], ['varios-fondos', gasto(2, '>=')]] as const) {
        await page.getByRole('button', { name: `Ver detalle de ${d}` }).first().click()
        await expect(page.getByRole('dialog', { name: d })).toBeVisible()
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
        await page.screenshot({ path: `${DIR}/gastos-detalle-${nombre}-${tema}.png` })
        await page.keyboard.press('Escape')
      }
      if (tema === 'oscuro') {
        await Promise.all([
          page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH'),
          page.getByRole('button', { name: 'Cambiar a tema claro' }).click(),
        ])
      }
    })
  }
})
