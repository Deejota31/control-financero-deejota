import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Capturas «antes / después» de las acciones por elemento. Solo corre con CAPTURAS_DIR=<carpeta> (no forma parte de la suite normal).
 * Los datos son del usuario E2E aislado; las plantillas se crean con SQL y se descartan al reiniciar el hogar de pruebas.
 */
const DIR = process.env.CAPTURAS_DIR
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const TAMANOS = [[320, 640], [390, 844], [844, 390], [1440, 900]] as const

function plantillas() {
  sqlLocal(`insert into public.expense_templates (household_id, name, description, default_amount, ambito_id, categoria_id, payment_method_id, expense_type, day_of_month, sort_order)
    select ${HID}, n.nombre, 'Compras del hogar', 120.5, a.id, c.id, m.id, 'fixed', 15, 10 + n.i
    from (values (1, 'Luz'), (2, 'Internet y telefonía del hogar con un nombre bastante largo')) as n(i, nombre), public.ambitos a, public.categorias c, public.medios_pago m
    where a.household_id = ${HID} and a.name = 'Hogar' and c.ambito_id = a.id and c.household_id = ${HID} and m.household_id = ${HID} and m.name = 'Transferencia'
    and c.id = (select min(id::text)::uuid from public.categorias where ambito_id = a.id)`)
  sqlLocal(`insert into public.fund_templates (household_id, name, suggested_amount, priority, icon_key, color_token, sort_order) values (${HID}, 'Mercado', 800, 102, 'wallet', 'c1', 1), (${HID}, 'Salud y bienestar', 300, 103, 'wallet', 'c2', 2)`)
}

test.describe('Capturas de acciones por elemento', () => {
  test.skip(!DIR || !email || !password, 'Define CAPTURAS_DIR y las credenciales E2E')
  const sub = process.env.CAPTURAS_FASE ?? 'antes'

  for (const [w, h] of TAMANOS) {
    test(`capturas ${sub} ${w}x${h}`, async ({ page }) => {
      test.setTimeout(120_000)
      plantillas()
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      const foto = (n: string) => page.screenshot({ path: `${DIR}/${sub}/${n}-${w}x${h}.png` })
      const despues = sub === 'despues'
      const abrirPanel = async (ambito: import('@playwright/test').Locator, nombre: RegExp) => { if (!despues) return; const b = ambito.getByRole('button', { name: nombre }).first(); if (await b.count()) { await b.scrollIntoViewIfNeeded(); await b.click(); await page.waitForTimeout(500) } }
      await page.goto('/gastos'); await expect(page.getByRole('heading', { name: 'Gastos' }).first()).toBeVisible(); await page.waitForTimeout(600); await abrirPanel(page.locator('main'), /^Más acciones de /); await foto('gastos')
      await page.goto('/fondos'); await page.waitForTimeout(800); await abrirPanel(page.locator('main'), /^Más acciones de /); await foto('fondos')
      await page.goto('/catalogo'); await page.waitForTimeout(800); await abrirPanel(page.locator('main'), /^Más acciones de /); await foto('catalogo')
      await page.goto('/gastos')
      await page.getByRole('button', { name: 'Plantillas' }).click()
      await page.getByRole('dialog', { name: 'Plantillas mensuales' }).waitFor(); await page.waitForTimeout(500); await abrirPanel(page.getByRole('dialog'), /^Más acciones de /); await foto('plantillas-gastos')
      await page.keyboard.press('Escape')
      await page.goto('/fondos')
      await page.getByRole('button', { name: /Plantillas/ }).first().click()
      await page.getByRole('dialog', { name: 'Plantillas de fondos' }).waitFor(); await page.waitForTimeout(500); await abrirPanel(page.getByRole('dialog'), /^Más acciones de /); await foto('plantillas-fondos')
    })
  }
})
