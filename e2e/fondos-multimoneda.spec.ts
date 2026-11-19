import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { elegirEnGasto, email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

/** Fondos multimoneda (etapa 2): formulario (Diseño A + tarjeta USD/PEN), cobertura cruzada, bloqueo de moneda, plantillas y vista previa del gasto. */
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const MES = `(select id from public.budget_periods where household_id = ${HID} and start_date = date_trunc('month', current_date)::date)`
const fondoSql = (nombre: string) => sqlLocal(`select concat_ws('|', f.currency, b.assigned_amount, f.allow_cross_currency) from public.funds f join public.fund_period_budgets b on b.fund_id = f.id where f.household_id = ${HID} and f.name = '${nombre}'`)

/** Tras guardar, la app pide confirmación si el cambio recalcula gastos; si no, cierra el formulario. Se espera a una de las dos cosas (un aviso anterior en pantalla no cuenta). */
async function confirmarSiPide(page: Page, exito: string) {
  const confirmacion = page.getByRole('alertdialog')
  const formulario = page.getByRole('dialog')
  await expect.poll(async () => ((await confirmacion.isVisible()) ? 'confirmar' : (await formulario.count()) === 0 ? 'cerrado' : 'pendiente'), { timeout: 15_000 }).not.toBe('pendiente')
  if (await confirmacion.isVisible()) await confirmacion.getByRole('button', { name: 'Aplicar cambios' }).click()
  await expect(formulario).toHaveCount(0)
  await expect(page.getByText(exito).first()).toBeVisible()
}
async function irAFondos(page: Page) {
  await page.getByRole('link', { name: 'Fondos' }).first().click()
  await expect(page.getByText('Período abierto')).toBeVisible()
}
async function nuevoFondoUsd(page: Page, nombre: string, importe: string, cruzada = false) {
  await page.getByRole('button', { name: 'Nuevo fondo' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Nombre').fill(nombre)
  await d.getByRole('radiogroup', { name: 'Regla para Personal' }).getByRole('radio', { name: 'Incluir' }).click()
  await d.getByRole('radio', { name: 'US$ USD' }).click()
  await d.getByLabel('Importe de este mes').fill(importe)
  if (cruzada) await d.getByLabel('Permitir cobertura en otra moneda').check()
  await d.getByRole('button', { name: 'Guardar fondo' }).click()
  await confirmarSiPide(page, 'Fondo guardado.')
}

test.describe('Fondos multimoneda', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(async ({ page }) => {
    // Sin cotización real: estas pruebas no dependen de ella (la tarjeta muestra «sin cotización» y el presupuesto sigue en dólares).
    await page.route('**/functions/v1/exchange-rate', (route) => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 503, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: 'application/json', body: '{}' }))
  })

  test('Diseño A: nombre arriba, tarjeta de presupuesto USD/PEN y cobertura cruzada apagada por defecto', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await irAFondos(page)
    await page.getByRole('button', { name: 'Nuevo fondo' }).click()
    const d = page.getByRole('dialog', { name: 'Nuevo fondo' })
    const y = (sel: string) => d.locator(sel).first().evaluate((e) => e.getBoundingClientRect().y)
    const nombre = d.getByLabel('Nombre')
    await expect(d.getByText('PRESUPUESTO MENSUAL', { exact: false })).toBeVisible()
    await expect(d.getByRole('radio', { name: 'S/ PEN' })).toHaveAttribute('aria-checked', 'true')
    expect(await nombre.evaluate((e) => e.getBoundingClientRect().y)).toBeLessThan(await y('[data-presupuesto]')) // el nombre va arriba, una sola vez
    expect(await d.getByLabel('Nombre').count()).toBe(1)
    const cruzada = d.getByLabel('Permitir cobertura en otra moneda')
    await expect(cruzada).not.toBeChecked() // por defecto desactivada
    await d.getByRole('button', { name: 'Cómo funciona la cobertura en otra moneda' }).click()
    await expect(page.getByRole('dialog', { name: 'Cómo funciona la cobertura en otra moneda' })).toContainText('nunca descuenta gastos de otra moneda')
    await page.keyboard.press('Escape')
    // En USD: símbolo, importe nominal y equivalente referencial (sin cotización: se dice, el presupuesto no se convierte).
    await d.getByRole('radio', { name: 'US$ USD' }).click()
    await d.getByLabel('Importe de este mes').fill('50')
    await expect(d.locator('[data-presupuesto]')).toContainText('US$')
    await expect(d.locator('[data-presupuesto]')).toContainText('Sin cotización disponible')
    expect(errores).toEqual([])
  })

  test('crea un fondo USD: conserva US$ 50 sin convertir, los totales no mezclan monedas y la tabla muestra dólares', async ({ page }) => {
    const nombre = `Suscripciones ${sufijo()}`
    await iniciarSesion(page)
    await irAFondos(page)
    await nuevoFondoUsd(page, nombre, '50')
    expect(fondoSql(nombre)).toBe('USD|50.00|f')
    const fila = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
    await expect(fila).toContainText('US$ 50.00')
    await expect(fila).not.toContainText('S/ 50.00')
    // El resumen separa las monedas (nunca «S/ 3,330» como suma de soles y dólares).
    await expect(page.getByLabel('Resumen del período')).toContainText(/S\/ [\d,.]+ \+ US\$ 50\.00/)
    // Editar sin tocar la moneda la conserva; habilitar la cobertura cruzada es solo configuración.
    await page.getByRole('button', { name: `Más acciones de ${nombre}` }).click()
    await page.getByRole('menuitem', { name: /Editar/ }).click()
    const d = page.getByRole('dialog', { name: 'Editar fondo' })
    await expect(d.getByRole('radio', { name: 'US$ USD' })).toHaveAttribute('aria-checked', 'true')
    await expect(d.getByLabel('Importe de este mes')).toHaveValue('50.00')
    await d.getByLabel('Permitir cobertura en otra moneda').check()
    await d.getByRole('button', { name: 'Guardar fondo' }).click()
    await confirmarSiPide(page, 'Fondo guardado.')
    await expect.poll(() => fondoSql(nombre)).toBe('USD|50.00|t')
  })

  test('con gastos imputados la moneda del fondo queda fija; sin ellos se puede cambiar', async ({ page }) => {
    const nombre = `Fijo ${sufijo()}`
    await iniciarSesion(page)
    await irAFondos(page)
    await nuevoFondoUsd(page, nombre, '40')
    // Sin gastos: la moneda es editable.
    await page.getByRole('button', { name: `Más acciones de ${nombre}` }).click()
    await page.getByRole('menuitem', { name: /Editar/ }).click()
    let d = page.getByRole('dialog', { name: 'Editar fondo' })
    await expect(d.getByRole('radio', { name: 'S/ PEN' })).toBeEnabled()
    await page.keyboard.press('Escape')
    // Un gasto USD del mes (como lo registraría el servidor) se imputa a ese fondo.
    sqlLocal(`insert into public.expenses(household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id, original_currency, original_amount, exchange_rate, exchange_rate_source, exchange_rate_reference_date, conversion_method, created_by)
      select ${HID}, current_date, 35, 'Gasto USD fijo', a.id, c.id, (select id from public.medios_pago where household_id = ${HID} limit 1), 'USD', 10, 3.5, 'Usuario', current_date, 'manual', '${E2E_UID}'
      from public.ambitos a join public.categorias c on c.ambito_id = a.id where a.household_id = ${HID} and a.name = 'Personal' limit 1;
      select public.recalc_period(${MES});`) // el alta y el cálculo van en una sola transacción, como en el servidor
    expect(Number(sqlLocal(`select coalesce(sum(a.fund_amount), 0) from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.name = '${nombre}' and f.household_id = ${HID}`))).toBe(10)
    await page.reload()
    await page.getByRole('button', { name: `Más acciones de ${nombre}` }).click()
    await page.getByRole('menuitem', { name: /Editar/ }).click()
    d = page.getByRole('dialog', { name: 'Editar fondo' })
    await expect(d.getByRole('radio', { name: 'S/ PEN' })).toBeDisabled()
    await expect(d.getByText(/Con gastos imputados no se cambia la moneda/)).toBeVisible()
    // El consumo se muestra en dólares y el saldo es US$ 30.
    await page.keyboard.press('Escape')
    const fila = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
    await expect(fila).toContainText('US$ 30.00')
    expect(sqlLocal(`select currency from public.funds where name = '${nombre}' and household_id = ${HID}`)).toBe('USD')
  })

  test('guardar un fondo USD como plantilla conserva moneda, importe nominal y cobertura cruzada', async ({ page }) => {
    const nombre = `Plantilla USD ${sufijo()}`
    await iniciarSesion(page)
    await irAFondos(page)
    await nuevoFondoUsd(page, nombre, '60', true)
    await page.getByRole('button', { name: `Más acciones de ${nombre}` }).click()
    await page.getByRole('menuitem', { name: 'Guardar como plantilla' }).click()
    const d = page.getByRole('dialog', { name: 'Nueva plantilla de fondo' })
    await expect(d.getByRole('radio', { name: 'US$ USD' })).toHaveAttribute('aria-checked', 'true')
    await expect(d.getByLabel('Importe sugerido')).toHaveValue('60.00')
    await expect(d.getByLabel('Permitir cobertura en otra moneda')).toBeChecked()
    await d.getByRole('button', { name: 'Guardar plantilla' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    expect(sqlLocal(`select concat_ws('|', currency, suggested_amount, allow_cross_currency) from public.fund_templates where household_id = ${HID} and name = '${nombre}'`)).toBe('USD|60.00|t')
  })

  test('vista previa del gasto: lo que ningún fondo cubre por moneda se avisa y no descuenta otro fondo', async ({ page }) => {
    const nombre = `Cobertura ${sufijo()}`
    await iniciarSesion(page)
    // Fondo USD de US$ 5 que admite «Personal»; el General del hogar (PEN) no tiene cobertura cruzada.
    await irAFondos(page)
    await nuevoFondoUsd(page, nombre, '5')
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const g = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await g.getByRole('radio', { name: 'US$ USD' }).click()
    await g.getByLabel('Importe', { exact: true }).fill('12')
    await g.getByRole('radio', { name: 'Personalizado' }).click()
    await g.getByLabel('Tipo de cambio USD/PEN').fill('3.5')
    await elegirEnGasto(g, 'Ámbito', 'Personal')
    await elegirEnGasto(g, 'Categoría', 'Alimentación')
    await elegirEnGasto(g, 'Medio de pago', 'Yape')
    await g.getByLabel('Descripción', { exact: true }).fill(`Gasto ${nombre}`)
    await expect(g.getByText(/Sin fondo para US\$ 7\.00/)).toBeVisible()
    await expect(g.getByText(/US\$ 5\.00/).first()).toBeVisible() // el fondo USD aporta solo su saldo, en dólares
    await g.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(sqlLocal(`select uncovered_original || '|' || uncovered_amount from public.expense_uncovered u join public.expenses e on e.id = u.expense_id where e.household_id = ${HID} and e.description = 'Gasto ${nombre}'`)).toBe('7.00|24.50')
    expect(sqlLocal(`select coalesce(sum(a.amount), 0) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id join public.funds f on f.id = a.fund_id where e.description = 'Gasto ${nombre}' and f.is_general`)).toBe('0')
    expect(sqlLocal(`select amount from public.expenses where household_id = ${HID} and description = 'Gasto ${nombre}'`)).toBe('42.00') // el gasto se conserva completo
  })

  test('responsive y accesible: el formulario de fondo en USD no desborda de 320 a 1440 px (claro y oscuro)', async ({ page }) => {
    await iniciarSesion(page)
    await irAFondos(page)
    for (const [w, h] of [[320, 640], [375, 812], [428, 926], [768, 1024], [1280, 720], [1440, 900]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await page.getByRole('button', { name: 'Nuevo fondo' }).click()
      const d = page.getByRole('dialog', { name: 'Nuevo fondo' })
      await d.getByRole('radio', { name: 'US$ USD' }).click()
      await d.getByLabel('Importe de este mes').fill('1234567.89')
      const m = await page.evaluate(() => { const e = document.querySelector('[role="dialog"]') as HTMLElement; const c = document.querySelector('[data-presupuesto]') as HTMLElement; const r = c.getBoundingClientRect(); return { pagina: document.documentElement.scrollWidth - innerWidth, dialogo: e.scrollWidth - e.clientWidth, izq: r.left, der: r.right, ancho: innerWidth } })
      expect(m.pagina, `página a ${w}px`).toBeLessThanOrEqual(0)
      expect(m.dialogo, `diálogo a ${w}px`).toBeLessThanOrEqual(0)
      expect(m.izq).toBeGreaterThanOrEqual(0)
      expect(m.der).toBeLessThanOrEqual(m.ancho)
      await expect(d.getByRole('button', { name: 'Guardar fondo' })).toBeInViewport()
      await page.keyboard.press('Escape')
      const descartar = page.getByRole('button', { name: 'Descartar cambios' })
      if (await descartar.isVisible().catch(() => false)) await descartar.click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
      await page.getByRole('button', { name: 'Nuevo fondo' }).click()
      const d = page.getByRole('dialog', { name: 'Nuevo fondo' })
      await d.getByRole('radio', { name: 'US$ USD' }).click()
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))
      const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze()
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe en tema ${tema}`).toEqual([])
      await page.keyboard.press('Escape')
      const descartar = page.getByRole('button', { name: 'Descartar cambios' })
      if (await descartar.isVisible().catch(() => false)) await descartar.click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })
})
