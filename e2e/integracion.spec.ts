import { readFile } from 'node:fs/promises'
import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, sufijo } from './helpers'

const dinero = (t: string | null) => Number((t ?? '').replace(/[^\d.-]/g, ''))
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

/** Suma de la columna "Importe (PEN)" del CSV exportado por la pantalla Gastos con los filtros de la URL. */
async function sumaExportada(page: Page, query: string): Promise<{ filas: number; total: number }> {
  await page.goto(`/gastos?${query}`)
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible()
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()])
  const texto = (await readFile((await d.path())!, 'utf8')).replace(String.fromCharCode(0xfeff), '')
  const lineas = texto.split(String.fromCharCode(13, 10)).filter(Boolean)
  const importes = lineas.slice(1).map((l) => Number(l.match(/,(\d+\.\d{2}),(?:"[^"]*"|[^,]*),/)?.[1] ?? NaN))
  return { filas: lineas.length - 1, total: importes.reduce((s, v) => s + v, 0) }
}

test.describe('Integración entre módulos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('los catálogos administrables se reflejan, con icono, en los selectores del formulario de gastos', async ({ page }) => {
    await iniciarSesion(page)
    const s = sufijo()
    const medio = `E2E Medio ${s}`
    const ambito = `E2E Ámbito ${s}`

    // Medio de pago nuevo con icono de avión
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('tab', { name: 'Medios de pago' }).click()
    await page.getByRole('button', { name: 'Nuevo medio de pago' }).click()
    await page.getByRole('dialog').getByLabel('Nombre').fill(medio)
    await page.getByRole('dialog').getByRole('radio', { name: 'Avión' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(medio, { exact: true })).toBeVisible()

    // Ámbito nuevo con una categoría
    await page.getByRole('tab', { name: 'Ámbitos' }).click()
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    await page.getByRole('dialog').getByLabel('Nombre').fill(ambito)
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(ambito, { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Categorías', exact: true }).click()
    await page.getByRole('combobox', { name: 'Ámbito', exact: true }).click()
    await page.getByRole('option', { name: ambito, exact: true }).click()
    await page.getByRole('button', { name: 'Nueva categoría' }).click()
    await page.getByRole('dialog').getByLabel('Nombre').fill('E2E Categoría')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('E2E Categoría', { exact: true })).toBeVisible()

    // El formulario de gastos los ofrece, con su icono y encadenados
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const d = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await d.getByRole('combobox', { name: 'Medio de pago', exact: true }).click()
    const opcionMedio = page.getByRole('option', { name: medio, exact: true })
    await expect(opcionMedio).toBeVisible()
    await expect(opcionMedio.locator('svg.lucide-plane')).toBeVisible()
    await opcionMedio.click()
    await expect(d.getByRole('combobox', { name: 'Medio de pago', exact: true }).locator('svg.lucide-plane')).toBeVisible()

    await d.getByRole('combobox', { name: 'Ámbito', exact: true }).click()
    await page.getByRole('option', { name: ambito, exact: true }).click()
    await d.getByRole('combobox', { name: 'Categoría', exact: true }).click()
    await expect(page.getByRole('option', { name: 'E2E Categoría', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Alimentación' })).toHaveCount(0) // las de otros ámbitos no aparecen
    await page.keyboard.press('Escape')
    await d.getByRole('button', { name: 'Cancelar' }).click()

    // Desactivar el medio lo oculta de los formularios nuevos
    await page.goto('/catalogo')
    await page.getByRole('tab', { name: 'Medios de pago' }).click()
    await page.getByRole('button', { name: `Desactivar ${medio}` }).click()
    await expect(page.getByRole('listitem').filter({ hasText: medio }).getByText('Inactivo')).toBeVisible()
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    await page.getByRole('dialog', { name: 'Nuevo gasto' }).getByRole('combobox', { name: 'Medio de pago', exact: true }).click()
    await expect(page.getByRole('option', { name: medio, exact: true })).toHaveCount(0)
  })

  test('los gráficos del Dashboard corresponden al período y a los filtros que llevan a Gastos', async ({ page }) => {
    await iniciarSesion(page)
    const kpiGasto = () => page.getByLabel('Indicadores').locator('div').filter({ has: page.getByText('Gasto del período', { exact: true }) }).first().locator('span').nth(1)

    // Mes actual: KPI = SQL = exportación de Gastos del mismo rango
    const mes = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD') || '|' || to_char(date_trunc('month', current_date) + interval '1 month - 1 day', 'YYYY-MM-DD')`).split('|')
    const sqlActual = Number(sqlLocal(`select coalesce(sum(amount), 0) from public.expenses where household_id = ${HID} and status = 'active' and expense_date between '${mes[0]}' and '${mes[1]}'`))
    expect(dinero(await kpiGasto().textContent())).toBeCloseTo(sqlActual, 2)
    expect((await sumaExportada(page, `desde=${mes[0]}&hasta=${mes[1]}`)).total).toBeCloseTo(sqlActual, 1)

    // Mes anterior: el KPI cambia al valor SQL de ese período
    await page.goto('/')
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    const ant = sqlLocal(`select to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM-DD') || '|' || to_char(date_trunc('month', current_date) - interval '1 day', 'YYYY-MM-DD')`).split('|')
    const sqlAnterior = Number(sqlLocal(`select coalesce(sum(amount), 0) from public.expenses where household_id = ${HID} and status = 'active' and expense_date between '${ant[0]}' and '${ant[1]}'`))
    await expect.poll(async () => dinero(await kpiGasto().textContent())).toBeCloseTo(sqlAnterior, 2)
    expect(sqlAnterior).not.toBeCloseTo(sqlActual, 0)

    // Un ámbito del gráfico de distribución lleva a Gastos con ese filtro y suma lo mismo que mostraba el gráfico
    const fila = page.getByLabel('Distribución por ámbito').getByRole('button').first()
    const textoFila = (await fila.textContent())!
    const montoAmbito = dinero(textoFila.match(/S\/ [\d,]+\.\d{2}/)?.[0] ?? '0')
    await fila.click()
    await expect(page).toHaveURL(/ambito=/)
    const url = new URL(page.url())
    const exportado = await sumaExportada(page, url.searchParams.toString())
    expect(exportado.total).toBeCloseTo(montoAmbito, 1)
  })
})
