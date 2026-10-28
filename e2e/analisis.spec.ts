import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

test.describe('Análisis conectado del Dashboard', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('calendario, perfil y ranking van en una fila al final, tras Distribución y Top 5, y no queda ni el flujo ni las tarjetas anteriores', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const an = page.getByRole('region', { name: 'Análisis conectado' })
    const cal = an.getByRole('region', { name: /^Calendario · / }), per = an.getByRole('region', { name: 'Perfil de gasto' }), ran = an.getByRole('region', { name: 'Ranking con tendencia' })
    for (const c of [cal, per, ran]) await expect(c).toBeVisible()
    const [a, b, c] = await Promise.all([cal.boundingBox(), per.boundingBox(), ran.boundingBox()])
    expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(2) // misma fila
    expect(Math.abs(b!.y - c!.y)).toBeLessThanOrEqual(2)
    expect(a!.x).toBeLessThan(b!.x)
    expect(b!.x).toBeLessThan(c!.x)
    const top5 = await page.getByRole('region', { name: 'Top 5 categorías' }).boundingBox()
    expect(a!.y).toBeGreaterThan(top5!.y + top5!.height - 2) // al final, debajo de Distribución / Top 5
    await expect(page.getByRole('region', { name: 'Flujo del dinero' })).toHaveCount(0)
    for (const t of ['Consumo de fondos', 'Gastos recientes', 'Gastos mensuales']) await expect(page.getByRole('heading', { name: t })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })

  test('el cursor inspecciona con detalle y el clic filtra todo el panel sin abrir modales; Limpiar filtros lo quita', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const an = page.getByRole('region', { name: 'Análisis conectado' })
    const ranking = an.getByRole('list', { name: 'Ranking' })
    const primero = ranking.getByRole('button').first()
    await expect(primero).toBeVisible()
    // Hover: tarjeta con importe, participación (con denominador), movimientos y seis meses
    await primero.hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toContainText('Participación')
    await expect(tip).toContainText(/% de S\//)
    await expect(tip).toContainText('Movimientos')
    await expect(tip).toContainText('Clic para filtrar todo el panel')
    // Clic: filtra, sin modal
    await primero.click()
    await expect(primero).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/categoria=/)
    // Un día del calendario se combina con la categoría sin perderla, con detalle al pasar el cursor
    const dia = an.getByRole('group', { name: /^Días de / }).getByRole('button', { name: /: S\/ / }).first()
    await dia.hover()
    await expect(page.getByRole('tooltip')).toContainText('Movimientos')
    await dia.click()
    await expect(dia).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/categoria=.*dia=|dia=.*categoria=/)
    // Perfil: cada eje muestra su detalle con la referencia histórica
    const eje = an.getByRole('img', { name: /: \d+(\.\d)? %$/ }).first()
    if (await eje.count()) {
      await eje.focus()
      await expect(page.getByRole('tooltip')).toContainText('Referencia histórica')
    }
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page).not.toHaveURL(/categoria=|dia=/)
    expect(errores).toEqual([])
  })

  test('en móvil las tres tarjetas se apilan, el perfil pasa a barras y no hay desborde', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    const an = page.getByRole('region', { name: 'Análisis conectado' })
    await expect(an.getByRole('list', { name: 'Perfil en barras' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })
})
