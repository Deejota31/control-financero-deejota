import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

test.describe('Configuración', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('muestra cuenta, hogar, exportación, actividad y seguridad', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    for (const h of ['Perfil', 'Hogar', 'Exportar mis datos', 'Actividad reciente', 'Cuenta', 'Cambiar contraseña']) await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible()
    // el correo de acceso es solo lectura (texto, no campo editable)
    await expect(page.getByText('Correo de acceso')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /correo/i })).toHaveCount(0)
    await expect(page.getByLabel('Moneda de visualización')).toHaveAttribute('readonly', '')
    await expect(page.getByText(/datos de demostración/i)).toBeVisible()
    await expect(page.getByLabel('Actividad reciente').getByRole('listitem').first()).toBeVisible()
    expect(errores).toEqual([])
  })

  test('renombra el hogar y restaura el nombre', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    const campo = page.getByLabel('Nombre del hogar')
    const guardar = page.locator('form').filter({ has: campo }).getByRole('button', { name: 'Guardar' })
    const original = await campo.inputValue()
    await campo.fill('Hogar Prueba E2E')
    await guardar.click()
    await expect(page.getByText('Nombre del hogar guardado.')).toBeVisible()
    await campo.fill(original)
    await guardar.click()
    await expect(page.getByText('Nombre del hogar guardado.').first()).toBeVisible()
  })

  test('exporta los datos en JSON sin credenciales ni tokens', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar datos (JSON)' }).click()])
    expect(descarga.suggestedFilename()).toMatch(/^gasto-deejota_\d{4}-\d{2}-\d{2}\.json$/)
    const ruta = await descarga.path()
    const texto = await readFile(ruta, 'utf8')
    const json = JSON.parse(texto)
    expect(json.aplicacion).toBe('Gasto Deejota')
    expect(json.expenses.length).toBeGreaterThan(10)
    expect(json.funds.length).toBeGreaterThan(3)
    expect(Object.keys(json)).toEqual(expect.arrayContaining(['ambitos', 'categorias', 'subcategorias', 'medios_pago', 'budget_periods', 'expense_templates']))
    expect(texto).not.toMatch(/access_token|refresh_token|service_role|encrypted_password/)
  })

  test('el formato de fecha de la cuenta se aplica en las tablas', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    await page.getByLabel('Formato de fecha').selectOption('yyyy-MM-dd')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Perfil guardado.')).toBeVisible()
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await expect(page.getByRole('row').nth(1).getByRole('cell').nth(1)).toHaveText(/^\d{4}-\d{2}-\d{2}$/)

    await page.getByRole('link', { name: 'Configuración' }).first().click()
    await page.getByLabel('Formato de fecha').selectOption('dd/MM/yyyy')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Perfil guardado.').first()).toBeVisible()
  })
})
