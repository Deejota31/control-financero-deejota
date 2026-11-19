import AxeBuilder from '@axe-core/playwright'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/** Fondos multimoneda (etapa 3): el Dashboard no suma dólares como soles y valora los fondos USD de forma referencial, con fuente y fecha. */
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const MES = `(select id from public.budget_periods where household_id = ${HID} and start_date = date_trunc('month', current_date)::date)`
const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

/** Fondo USD de US$ 50 que admite «Personal» y un gasto de US$ 20 (tasa 3.40) imputado a él, creados como los crearía el servidor. */
function prepararFondoUsd() {
  sqlLocal(`update public.funds set allow_cross_currency = true where household_id = ${HID} and is_general`)
  sqlLocal(`with f as (insert into public.funds(household_id, period_id, name, description, is_general, default_amount, priority, icon_key, color_token, currency)
      values (${HID}, ${MES}, 'Suscripciones USD', '', false, 50, 1, 'wallet', 'pri', 'USD') returning id, household_id, period_id),
    b as (insert into public.fund_period_budgets(household_id, fund_id, period_id, assigned_amount) select household_id, id, period_id, 50 from f returning fund_id)
    insert into public.fund_scope_rules(household_id, fund_id, ambito_id, effect) select ${HID}, b.fund_id, a.id, 'include' from b, public.ambitos a where a.household_id = ${HID} and a.name = 'Personal'`)
  sqlLocal(`insert into public.expenses(household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id, original_currency, original_amount, exchange_rate, exchange_rate_source, exchange_rate_reference_date, conversion_method, created_by)
      select ${HID}, current_date, 68, 'Gasto USD dashboard', a.id, c.id, (select id from public.medios_pago where household_id = ${HID} limit 1), 'USD', 20, 3.4, 'Usuario', current_date, 'manual', '${E2E_UID}'
      from public.ambitos a join public.categorias c on c.ambito_id = a.id where a.household_id = ${HID} and a.name = 'Personal' limit 1;
    select public.recalc_period(${MES});`)
}
const sinCaches = () => {
  const respaldo = sqlLocal(`select coalesce(json_agg(q), '[]') from public.exchange_rate_quotes q where date_requested >= date_trunc('month', current_date)::date - 14`)
  sqlLocal(`delete from public.exchange_rate_quotes where date_requested >= date_trunc('month', current_date)::date - 14`)
  return respaldo
}
const restaurar = (json: string) => sqlLocal(`insert into public.exchange_rate_quotes select * from json_populate_recordset(null::public.exchange_rate_quotes, '${json.replace(/'/g, "''")}') on conflict (date_requested) do nothing`)

test.describe('Dashboard con fondos en dólares', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('valoración referencial con la última cotización del período: nominal en dólares, total en soles, tasa, fuente y fecha', async ({ page }) => {
    prepararFondoUsd()
    sqlLocal(`insert into public.exchange_rate_quotes(date_requested, rate, reference_date, source, fetched_at) values (current_date, 3.5, current_date - 1, 'E2E:SIMULADA', now())
      on conflict (date_requested) do update set rate = 3.5, reference_date = current_date - 1, source = 'E2E:SIMULADA'`)
    try {
      await iniciarSesion(page)
      const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
      const usd = panel.locator('[data-usd]')
      await expect(usd).toBeVisible()
      await expect(usd).toContainText('fondos en dólares US$ 50.00')
      await expect(usd).toContainText('consumido US$ 20.00')
      await expect(usd).toContainText('disponible US$ 30.00') // saldo nominal: no se convierte
      await expect(usd).toContainText('S/ 3.5000 por US$')
      await expect(usd).toContainText('E2E:SIMULADA') // fuente
      // El presupuesto consolidado = presupuesto de los fondos en soles + 50 × 3.50 (referencial), nunca 50 sumado como soles.
      const pen = Number(sqlLocal(`select coalesce(sum(b.assigned_amount), 0) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where b.period_id = ${MES} and f.is_active and f.currency = 'PEN'`))
      await expect(panel.getByText('Presupuesto asignado').locator('..')).toContainText(`S/ ${fmt(pen + 175)}`)
      // «Por moneda» muestra los fondos en soles aparte.
      await expect(usd).toContainText(`fondos en soles S/ ${fmt(pen)}`)
      // El gasto en dólares cuenta en soles contables (68) en el gasto del período.
      await expect(panel.getByText('Gastado del período').locator('..')).toContainText('S/')
    } finally {
      sqlLocal(`delete from public.exchange_rate_quotes where source = 'E2E:SIMULADA'`)
    }
  })

  test('sin cotización no se inventa una tasa: se avisa, el total en soles excluye los USD y no se insiste en bucle', async ({ page }) => {
    prepararFondoUsd()
    const respaldo = sinCaches()
    let pedidas = 0
    await page.route('**/functions/v1/exchange-rate', (route) => {
      if (route.request().method() !== 'OPTIONS') pedidas += 1
      return route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 503, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: 'application/json', body: '{}' })
    })
    try {
      await iniciarSesion(page)
      const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
      const usd = panel.locator('[data-usd]')
      await expect(usd).toContainText('Sin cotización disponible para valorar los fondos en dólares')
      await expect(usd).toContainText('fondos en dólares US$ 50.00') // el presupuesto nominal sigue visible
      const pen = Number(sqlLocal(`select coalesce(sum(b.assigned_amount), 0) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where b.period_id = ${MES} and f.is_active and f.currency = 'PEN'`))
      await expect(panel.getByText('Presupuesto asignado').locator('..')).toContainText(`S/ ${fmt(pen)}`)
      await page.waitForTimeout(1500)
      expect(pedidas).toBeLessThanOrEqual(2) // un intento por mes del rango, no un bucle
    } finally {
      restaurar(respaldo)
    }
  })

  test('responsive y accesible: el desglose por moneda no desborda de 320 a 1440 px (claro y oscuro)', async ({ page }) => {
    prepararFondoUsd()
    sqlLocal(`insert into public.exchange_rate_quotes(date_requested, rate, reference_date, source, fetched_at) values (current_date, 3.5, current_date - 1, 'E2E:SIMULADA', now())
      on conflict (date_requested) do update set rate = 3.5, reference_date = current_date - 1, source = 'E2E:SIMULADA'`)
    try {
      await iniciarSesion(page)
      for (const [w, h] of [[320, 700], [390, 844], [768, 1024], [1440, 900]] as const) {
        await page.setViewportSize({ width: w, height: h })
        const bloque = page.locator('[data-usd]')
        await bloque.scrollIntoViewIfNeeded()
        const m = await page.evaluate(() => { const b = document.querySelector('[data-usd]') as HTMLElement; const r = b.getBoundingClientRect(); return { pagina: document.documentElement.scrollWidth - innerWidth, izq: r.left, der: r.right, ancho: innerWidth, interno: b.scrollWidth - b.clientWidth } })
        expect(m.pagina, `página a ${w}px`).toBeLessThanOrEqual(0)
        expect(m.interno, `bloque a ${w}px`).toBeLessThanOrEqual(0)
        expect(m.izq).toBeGreaterThanOrEqual(0)
        expect(m.der).toBeLessThanOrEqual(m.ancho)
      }
      await page.setViewportSize({ width: 1440, height: 900 })
      for (const tema of ['light', 'dark']) {
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
        await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))
        const r = await new AxeBuilder({ page }).include('[aria-label="Presupuesto consolidado"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze()
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe en tema ${tema}`).toEqual([])
      }
    } finally {
      sqlLocal(`delete from public.exchange_rate_quotes where source = 'E2E:SIMULADA'`)
    }
  })
})
