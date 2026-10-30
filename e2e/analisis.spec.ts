import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

test.describe('Análisis conectado del Dashboard', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('perfil y ranking van en una fila al final, tras Distribución y Top 5, y no queda ni el flujo ni las tarjetas anteriores', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const an = page.getByRole('region', { name: 'Análisis conectado' })
    const per = an.getByRole('region', { name: 'Perfil de gasto' }), ran = an.getByRole('region', { name: 'Ranking con tendencia' })
    for (const c of [per, ran]) await expect(c).toBeVisible()
    await expect(an.getByRole('region', { name: /^Calendario · / })).toHaveCount(0) // el mapa de calor se retiró
    await expect(page.getByRole('img', { name: /^Gasto por día/ })).toBeVisible() // el gráfico de barras diario se conserva
    const [b, c] = await Promise.all([per.boundingBox(), ran.boundingBox()])
    expect(Math.abs(b!.y - c!.y)).toBeLessThanOrEqual(2) // misma fila
    expect(b!.x).toBeLessThan(c!.x)
    const top5 = await page.getByRole('region', { name: 'Top 5 categorías' }).boundingBox()
    expect(b!.y).toBeGreaterThan(top5!.y + top5!.height - 2) // al final, debajo de Distribución / Top 5
    await expect(page.getByRole('region', { name: 'Flujo del dinero' })).toHaveCount(0)
    for (const t of ['Consumo de fondos', 'Gastos recientes', 'Gastos mensuales']) await expect(page.getByRole('heading', { name: t })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })

  test('el cursor inspecciona con detalle y el clic filtra todo el panel sin abrir modales; Limpiar filtros lo quita', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const an = page.getByRole('region', { name: 'Análisis conectado' })
    // Perfil: cada eje muestra su detalle con la referencia histórica (antes de filtrar, con todos los ejes)
    const eje = an.getByRole('img', { name: /: \d+(\.\d)? %$/ }).first()
    if (await eje.count()) {
      await eje.scrollIntoViewIfNeeded()
      await eje.hover({ force: true })
      await expect(page.getByRole('tooltip')).toContainText('Referencia histórica')
    }
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
    // Un día elegido en las barras se combina con la categoría; su popup trae movimientos y el porcentaje del mes
    const barras = page.getByRole('img', { name: /^Gasto por día/ })
    await barras.scrollIntoViewIfNeeded()
    const caja = (await barras.boundingBox())!
    await page.mouse.move(caja.x + caja.width * 0.12, caja.y + caja.height * 0.5, { steps: 6 })
    await expect(page.getByText(/^% de /).first()).toBeVisible()
    await page.mouse.down()
    await page.mouse.up()
    await expect(page).toHaveURL(/categoria=.*dia=|dia=.*categoria=/)
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
