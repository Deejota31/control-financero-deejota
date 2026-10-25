import { expect, test, type Page } from '@playwright/test'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

const monto = (t: string | null) => Number((t ?? '').replace(/[^\d.-]/g, ''))

async function kpi(page: Page, etiqueta: string) {
  const caja = page.getByLabel('Indicadores').locator('div').filter({ has: page.getByText(etiqueta, { exact: true }) }).first()
  return caja
}

test.describe('Dashboard', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('muestra KPIs, gráficos y paneles del período con datos demo', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await expect(page.getByText('Datos DEMO')).toBeVisible()
    for (const t of ['Presupuesto asignado', 'Gasto del período', 'Disponible', 'Variación vs período anterior']) await expect(page.getByText(t, { exact: true })).toBeVisible()
    await expect(page.getByText(/Cierre proyectado \(estimación\)/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gasto acumulado' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Distribución por ámbito' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Top 5 categorías' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Consumo de fondos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gastos recientes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gastos mensuales' })).toBeVisible()
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    // Los cinco ámbitos del catálogo aparecen si tienen gasto en el período
    await expect(page.getByLabel('Distribución por ámbito').getByRole('button').first()).toBeVisible()
    expect(errores).toEqual([])
  })

  test('alterna el Top 5 entre categorías y subcategorías', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('button', { name: 'Subcategorías', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Top 5 subcategorías' })).toBeVisible()
    await page.getByRole('button', { name: 'Categorías', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Top 5 categorías' })).toBeVisible()
  })

  test('seleccionar un punto del gráfico muestra los movimientos del día y permite filtrar Gastos', async ({ page }) => {
    await iniciarSesion(page)
    const grafico = page.getByRole('img', { name: /^Gasto acumulado de/ })
    await expect(grafico).toBeVisible()
    const caja = (await grafico.boundingBox())!
    await page.mouse.click(caja.x + caja.width * 0.4, caja.y + caja.height * 0.5)
    const panel = page.getByRole('status').filter({ hasText: 'Ver en Gastos' })
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: 'Ver en Gastos' }).click()
    await expect(page).toHaveURL(/\/gastos\?desde=(\d{4}-\d{2}-\d{2})&hasta=\1/)
    await expect(page.getByRole('heading', { name: 'Gastos', level: 1 })).toBeVisible()
  })

  test('seleccionar un ámbito o categoría lleva a Gastos con ese filtro', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByLabel('Distribución por ámbito').getByRole('button').first().click()
    await expect(page).toHaveURL(/\/gastos\?.*ambito=/)
    await expect(page.getByRole('table')).toBeVisible()
    await page.goBack()
    await page.getByLabel(/^Top 5/).getByRole('button', { name: /mov\./ }).first().click()
    await expect(page).toHaveURL(/\/gastos\?.*categoria=/)
  })

  test('cambiar el período actualiza todo y compara con el anterior', async ({ page }) => {
    await iniciarSesion(page)
    const gastoActual = monto(await (await kpi(page, 'Gasto del período')).locator('span').nth(1).textContent())
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await expect(page).toHaveURL(/desde=/)
    await expect(page.getByText(/Cierre proyectado/)).toHaveCount(0)
    await expect.poll(async () => monto(await (await kpi(page, 'Gasto del período')).locator('span').nth(1).textContent())).not.toBe(gastoActual)
    await expect(page.getByText('Variación vs período anterior')).toBeVisible()
    await page.getByRole('button', { name: 'Este mes' }).click()
    await expect(page.getByText(/Cierre proyectado/)).toBeVisible()
  })

  test('un rango sin gastos muestra un estado vacío y uno inválido explica el problema', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/?desde=2020-01-01&hasta=2020-01-31')
    await expect(page.getByText('No hay gastos en este período')).toBeVisible()
    await page.goto('/?desde=2026-10-20&hasta=2026-10-01')
    await expect(page.getByText('La fecha inicial es posterior a la final. Ajusta el rango.')).toBeVisible()
  })

  test('accesos rápidos: registrar gasto y registrar mensuales', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('button', { name: 'Registrar gasto' }).click()
    await expect(page).toHaveURL(/\/gastos/)
    await expect(page.getByRole('dialog', { name: 'Nuevo gasto' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await page.getByRole('button', { name: 'Registrar mensuales' }).click()
    await expect(page.getByRole('dialog', { name: 'Registrar gastos mensuales' })).toBeVisible()
  })

  test('un gasto nuevo en Gastos se refleja en los KPIs del Dashboard y al anularlo vuelve', async ({ page }) => {
    await iniciarSesion(page)
    const leer = async () => monto(await (await kpi(page, 'Gasto del período')).locator('span').nth(1).textContent())
    await expect(await kpi(page, 'Gasto del período')).toBeVisible()
    const antes = await leer()

    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Importe', { exact: true }).fill('10')
    for (const [nombre, opcion] of [['Ámbito', 'Personal'], ['Categoría', 'Ocio'], ['Medio de pago', 'Yape']] as const) {
      await d.getByRole('combobox', { name: nombre, exact: true }).click()
      await page.getByRole('option', { name: opcion, exact: true }).click()
    }
    await d.getByLabel('Descripción', { exact: true }).fill('E2E dashboard')
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()

    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect.poll(leer).toBeCloseTo(antes + 10, 2)

    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await page.getByLabel('Buscar', { exact: true }).fill('E2E dashboard')
    await page.getByRole('button', { name: 'Anular E2E dashboard' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect.poll(leer).toBeCloseTo(antes, 2)
  })

  test('si Supabase falla, el dashboard muestra un error con opción de reintentar', async ({ page }) => {
    await iniciarSesion(page)
    await page.route('**/rest/v1/expenses**', (r) => r.abort('connectionrefused'))
    await page.goto('/?desde=2026-09-01&hasta=2026-09-30')
    await expect(page.getByText('No se pudieron cargar los datos del dashboard.')).toBeVisible({ timeout: 20_000 })
    await page.unroute('**/rest/v1/expenses**')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByLabel('Indicadores')).toBeVisible()
  })

  test('el tema oscuro mantiene gráficos legibles', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    await page.getByRole('button', { name: 'Cambiar a tema claro' }).click()
  })
})
