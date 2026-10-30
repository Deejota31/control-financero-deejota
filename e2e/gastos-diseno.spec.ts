import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const dinero = (t: string | null) => Number((t ?? '').replace(/[^\d.-]/g, ''))

/** Un gasto activo del mes actual con el número de fondos pedido (consulta SQL independiente). */
const gastoConFondos = (n: number, cmp: '=' | '>=' = '=') =>
  sqlLocal(`select e.description || '|' || e.id from public.expenses e where e.household_id = ${HID} and e.status = 'active' and e.expense_date >= date_trunc('month', current_date)
    and (select count(*) from public.expense_fund_allocations a where a.expense_id = e.id) ${cmp} ${n} order by e.amount desc limit 1`).split('|')

test.describe('Gastos: tabla y detalle', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('la columna de selección es angosta y centrada, con estado indeterminado y barra contextual', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    const todos = page.getByRole('checkbox', { name: 'Seleccionar todos los de esta página' })
    await expect(todos).toBeVisible()
    const th = todos.locator('xpath=ancestor::th')
    const caja = (await th.boundingBox())!
    expect(caja.width).toBeLessThanOrEqual(56) // solo el espacio necesario
    const c = (await todos.boundingBox())!
    expect(Math.abs(c.x + c.width / 2 - (caja.x + caja.width / 2))).toBeLessThanOrEqual(2) // centrado
    const fila = page.getByRole('checkbox', { name: /^Seleccionar / }).nth(1)
    const f = (await fila.boundingBox())!
    expect(Math.abs(f.x + f.width / 2 - (caja.x + caja.width / 2))).toBeLessThanOrEqual(2) // misma columna, misma vertical

    await fila.check()
    expect(await todos.evaluate((e: HTMLInputElement) => e.indeterminate)).toBe(true)
    await expect(page.getByRole('region', { name: 'Selección' })).toContainText('1 seleccionado')
    await expect(fila.locator('xpath=ancestor::tr')).toHaveClass(/bg-pri-soft/)
    await todos.check()
    expect(await todos.evaluate((e: HTMLInputElement) => e.indeterminate)).toBe(false)
    await expect(todos).toBeChecked()
    await todos.uncheck()
    await expect(page.getByRole('region', { name: 'Selección' })).toHaveCount(0)
    expect(errores).toEqual([])
  })

  test('los chips de fondos muestran nombre e importe imputado de cada fondo', async ({ page }) => {
    const [desc, id] = gastoConFondos(2, '>=')
    const filas = sqlLocal(`select f.name || ':' || a.amount from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = '${id}' order by a.amount desc`).split('\n')
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    const fila = page.getByRole('row').filter({ hasText: desc }).first()
    for (const x of filas.slice(0, 2)) {
      const [nombre, monto] = x.split(':')
      await expect(fila).toContainText(nombre)
      await expect(fila).toContainText(`S/ ${Number(monto).toFixed(2)}`)
    }
  })

  test('el detalle de un gasto con varios fondos reparte el importe sin alterarlo', async ({ page }) => {
    const [desc, id] = gastoConFondos(2, '>=')
    const importe = Number(sqlLocal(`select amount from public.expenses where id = '${id}'`))
    const asignado = sqlLocal(`select f.name || ':' || a.amount from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = '${id}'`).split('\n').map((l) => ({ n: l.split(':')[0], m: Number(l.split(':')[1]) }))
    expect(asignado.length).toBeGreaterThanOrEqual(2)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    const abrir = page.getByRole('button', { name: `Ver detalle de ${desc}` }).first()
    await abrir.click()
    const d = page.getByRole('dialog', { name: desc })
    for (const s of ['Información general', 'Clasificación', 'Fondos que lo cubren', 'Comprobante y notas']) await expect(d.getByRole('region', { name: s })).toBeVisible()
    await expect(d.getByText(`S/ ${importe.toFixed(2)}`).first()).toBeVisible()
    const fondos = d.getByRole('region', { name: 'Fondos que lo cubren' })
    const barra = fondos.getByRole('img', { name: /^Reparto entre fondos/ })
    for (const a of asignado) {
      await expect(barra).toHaveAttribute('aria-label', new RegExp(`${a.n} S/ ${a.m.toFixed(2).replace('.', '\\.')}`))
      await expect(fondos.getByRole('listitem').filter({ hasText: a.n })).toContainText(`S/ ${a.m.toFixed(2)}`)
    }
    // el total imputado coincide con el importe (sin fondo asignable = 0)
    await expect(fondos).toContainText(`Total imputado: S/ ${importe.toFixed(2)}`)
    await expect(fondos.getByText(/Sin fondo asignable/)).toHaveCount(0)
    // los segmentos suman el 100 %
    const anchos = await barra.locator('span').evaluateAll((els) => els.map((e) => parseFloat((e as HTMLElement).style.width)))
    expect(anchos.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 0)
    // acciones del pie
    await expect(d.getByRole('button', { name: 'Editar gasto' })).toBeVisible()
    await expect(d.getByRole('button', { name: 'Duplicar gasto' })).toBeVisible()
    // Escape cierra y el foco vuelve al botón de origen
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
    await expect(abrir).toBeFocused()
  })

  test('el detalle de un gasto con un solo fondo y sin comprobante', async ({ page }) => {
    const [desc, id] = gastoConFondos(1)
    const fondo = sqlLocal(`select f.name from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where a.expense_id = '${id}'`)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await page.getByRole('button', { name: `Ver detalle de ${desc}` }).first().click()
    const d = page.getByRole('dialog', { name: desc })
    const fondos = d.getByRole('region', { name: 'Fondos que lo cubren' })
    await expect(fondos.getByRole('listitem')).toHaveCount(1)
    await expect(fondos).toContainText(fondo)
    await expect(fondos).toContainText('100.0 %')
    await expect(d.getByText('Sin comprobante adjunto')).toBeVisible()
    await expect(d.getByText('Sin notas')).toBeVisible()
  })

  test('el detalle de un gasto anulado lo identifica y no ofrece editar; Editar y Duplicar abren el formulario', async ({ page }) => {
    const [desc] = gastoConFondos(1)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    // Duplicar desde el detalle
    await page.getByRole('button', { name: `Ver detalle de ${desc}` }).first().click()
    await page.getByRole('dialog', { name: desc }).getByRole('button', { name: 'Duplicar gasto' }).click()
    await expect(page.getByRole('dialog').getByLabel('Descripción', { exact: true })).toHaveValue(desc)
    await page.keyboard.press('Escape')
    // Editar desde el detalle
    await page.getByRole('button', { name: `Ver detalle de ${desc}` }).first().click()
    await page.getByRole('dialog', { name: desc }).getByRole('button', { name: 'Editar gasto' }).click()
    await expect(page.getByRole('dialog').getByLabel('Descripción', { exact: true })).toHaveValue(desc)
    await page.keyboard.press('Escape')
    // Anular y revisar el detalle
    await page.getByRole('button', { name: `Anular ${desc}` }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    await page.goto('/gastos?estado=annulled')
    await page.getByRole('button', { name: `Ver detalle de ${desc}` }).first().click()
    const d = page.getByRole('dialog', { name: desc })
    await expect(d.getByText('Anulado').first()).toBeVisible()
    await expect(d.getByText(/no consume presupuesto/)).toBeVisible()
    await expect(d.getByRole('button', { name: 'Editar gasto' })).toHaveCount(0)
    await expect(d.getByRole('button', { name: 'Duplicar gasto' })).toBeVisible()
    // el importe anulado se ve tachado en la tabla
    await page.keyboard.press('Escape')
    const importe = page.getByRole('row').filter({ hasText: desc }).first().locator('td').nth(7)
    await expect(importe).toHaveClass(/line-through/)
    expect(dinero(await importe.textContent())).toBeGreaterThan(0)
  })

  test('las acciones de fila son botones con nombre, foco visible y la anulación pide confirmación', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    const fila = page.getByRole('row').nth(1)
    const botones = fila.getByRole('button')
    await expect(botones).toHaveCount(5)
    for (const b of await botones.all()) {
      expect(await b.getAttribute('aria-label')).toBeTruthy()
      expect(await b.getAttribute('title')).toBeTruthy()
      const caja = (await b.boundingBox())!
      expect(caja.width).toBeGreaterThanOrEqual(32) // área clicable accesible
    }
    await botones.last().focus()
    await expect(botones.last()).toBeFocused()
    await botones.last().press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('alertdialog')).toBeHidden()
  })
})
