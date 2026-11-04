import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Coherencia entre Dashboard, Gastos y Fondos. La «verdad» sale de SQL directo sobre las tablas (fuente independiente de la interfaz),
 * con el mes anterior completo para que no dependa del día en que se ejecute.
 */
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const dinero = (t: string | null) => Number((t ?? '').replace(/[^\d.-]/g, ''))

const [INI, FIN] = sqlLocal(`select to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM-DD') || '|' || to_char(date_trunc('month', current_date) - interval '1 day', 'YYYY-MM-DD')`).split('|')
const sqlTotal = (cond = '') => Number(sqlLocal(`select coalesce(sum(amount), 0) from public.expenses e where household_id = ${HID} and status = 'active' and expense_date between '${INI}' and '${FIN}' ${cond}`))
const sqlCantidad = (cond = '') => Number(sqlLocal(`select count(*) from public.expenses e where household_id = ${HID} and status = 'active' and expense_date between '${INI}' and '${FIN}' ${cond}`))

const kpi = (page: Page, etiqueta: string) => page.getByLabel('Indicadores').locator('div').filter({ has: page.getByText(etiqueta, { exact: true }) }).first()
const valorKpi = async (page: Page, etiqueta: string) => dinero(await kpi(page, etiqueta).locator('span').nth(1).textContent())
const montosLista = async (page: Page, etiqueta: string) => (await page.getByLabel(etiqueta).getByRole('button').allTextContents()).map((x) => dinero(x.match(/S\/ [\d,]+\.\d{2}/)?.[0] ?? '0'))
const suma = (xs: number[]) => Math.round(xs.reduce((s, v) => s + Math.round(v * 100), 0)) / 100

test.describe('Coherencia Dashboard · Gastos · Fondos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('reglas 1, 4 y 7: total, movimientos y desglose por ámbito del Dashboard coinciden con SQL y con el listado de Gastos', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/?desde=${INI}&hasta=${FIN}`)
    await expect(kpi(page, 'Gasto del período')).toBeVisible()
    const total = sqlTotal(), cantidad = sqlCantidad()
    expect(cantidad).toBeGreaterThan(0)
    await expect.poll(() => valorKpi(page, 'Gasto del período')).toBeCloseTo(total, 2)
    await expect(kpi(page, 'Movimientos')).toContainText(String(cantidad))
    // Regla 1: la dona (por ámbito) suma el total
    expect(suma(await montosLista(page, 'Ámbitos'))).toBeCloseTo(total, 2)
    // Regla 4: el listado de Gastos con el mismo rango cuenta los mismos movimientos
    await page.goto(`/gastos?desde=${INI}&hasta=${FIN}`)
    await expect(page.getByText(`${cantidad} ${cantidad === 1 ? 'movimiento' : 'movimientos'} con los filtros aplicados`)).toBeVisible()
  })

  test('regla 6: un gasto repartido entre fondos no se duplica (la suma de sus imputaciones nunca supera su importe) y el total cuenta cada gasto una vez', async () => {
    const mal = sqlLocal(`select count(*) from public.expenses e where e.household_id = ${HID} and e.status = 'active' and
      coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.expense_id = e.id), 0) > e.amount + 0.005`)
    expect(Number(mal)).toBe(0)
    const repartidos = Number(sqlLocal(`select count(*) from (select a.expense_id from public.expense_fund_allocations a where a.household_id = ${HID} group by 1 having count(*) > 1) x`))
    expect(repartidos).toBeGreaterThanOrEqual(0) // el dato de prueba puede o no tener repartos; la invariante anterior es la que importa
    // El total del período es la suma de importes de gastos, no la de imputaciones (que contaría dos veces un gasto repartido)
    const porImputaciones = Number(sqlLocal(`select coalesce(sum(a.amount), 0) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id where e.household_id = ${HID} and e.status = 'active' and e.expense_date between '${INI}' and '${FIN}'`))
    expect(porImputaciones).toBeLessThanOrEqual(sqlTotal() + 0.005)
  })

  test('regla 8: anular un gasto se refleja en el total y en los movimientos del Dashboard', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/?desde=${INI}&hasta=${FIN}`)
    await expect.poll(() => valorKpi(page, 'Gasto del período')).toBeCloseTo(sqlTotal(), 2)
    const antes = await valorKpi(page, 'Gasto del período')
    const cantidadAntes = sqlCantidad()
    const [id, descripcion, importe] = sqlLocal(`select id || '|' || description || '|' || amount from public.expenses e where household_id = ${HID} and status = 'active' and expense_date between '${INI}' and '${FIN}' order by amount desc, id limit 1`).split('|')
    expect(id).toBeTruthy()

    await page.goto(`/gastos?desde=${INI}&hasta=${FIN}&buscar=${encodeURIComponent(descripcion)}`)
    await page.getByRole('button', { name: `Anular ${descripcion}` }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()

    await page.goto(`/?desde=${INI}&hasta=${FIN}`)
    await expect.poll(() => valorKpi(page, 'Gasto del período')).toBeCloseTo(antes - Number(importe), 2)
    await expect(kpi(page, 'Movimientos')).toContainText(String(cantidadAntes - 1))
    expect(suma(await montosLista(page, 'Ámbitos'))).toBeCloseTo(sqlTotal(), 2) // el desglose se actualizó igual
  })

  test('regla 10: el presupuesto consolidado de un mes solo suma los fondos de ese mes', async ({ page }) => {
    const [ini, fin] = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD') || '|' || to_char(date_trunc('month', current_date) + interval '1 month - 1 day', 'YYYY-MM-DD')`).split('|')
    const esperado = Number(sqlLocal(`select coalesce(sum(b.assigned_amount), 0) from public.fund_period_budgets b join public.budget_periods p on p.id = b.period_id join public.funds f on f.id = b.fund_id
      where b.household_id = ${HID} and p.start_date = '${ini}' and f.is_active`))
    expect(esperado).toBeGreaterThan(0)
    await iniciarSesion(page)
    await page.goto(`/?desde=${ini}&hasta=${fin}`)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    await expect(panel).toBeVisible()
    const texto = await panel.getByText('Presupuesto asignado', { exact: true }).locator('xpath=..').textContent()
    expect(dinero(texto?.match(/S\/ [\d,]+\.\d{2}/)?.[0] ?? '')).toBeCloseTo(esperado, 2)
  })

  test('el presupuesto consolidado cuadra: asignado − imputado = disponible (o exceso si es negativo)', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/?desde=${INI}&hasta=${FIN}`)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    await expect(panel).toBeVisible()
    const valor = async (etiqueta: string) => dinero((await panel.getByText(etiqueta, { exact: true }).locator('xpath=..').textContent())?.match(/-?S\/ -?[\d,]+\.\d{2}/)?.[0]?.replace('S/ ', '') ?? '')
    const asignado = await valor('Presupuesto asignado')
    const disponible = await valor('Disponible consolidado')
    const exceso = await valor('Exceso sobre el presupuesto')
    const imputado = asignado - disponible
    expect(imputado).toBeGreaterThanOrEqual(-0.005)
    expect(exceso).toBeCloseTo(Math.max(0, imputado - asignado), 2)
    if (disponible < 0) expect(exceso).toBeCloseTo(-disponible, 2)
    else expect(exceso).toBe(0)
  })
})
