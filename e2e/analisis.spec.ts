import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

test.describe('Análisis conectado del Dashboard', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('ranking, calendario, perfil y flujo responden a los mismos filtros y se quitan con Limpiar filtros', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const an = page.getByRole('region', { name: 'Análisis conectado' })
    await expect(an).toBeVisible()
    await expect(an.getByRole('region', { name: /^Calendario · / })).toBeVisible()
    await expect(an.getByRole('region', { name: 'Perfil de gasto' })).toBeVisible()
    await expect(an.getByRole('region', { name: 'Flujo del dinero' })).toBeVisible()
    // Ranking por categoría: seleccionar filtra el panel (KPIs) sin abrir ninguna modal
    const ranking = an.getByRole('list', { name: 'Ranking' })
    await expect(ranking.getByRole('listitem').first()).toBeVisible()
    const kpiAntes = await page.getByText(/Gasto (del período|con filtros actuales)/).first().textContent()
    await ranking.getByRole('button').first().click()
    await expect(ranking.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/categoria=/)
    await expect(page.getByText('Gasto con filtros actuales').first()).toBeVisible()
    expect(kpiAntes).toBeTruthy()
    // El día elegido en el calendario se combina con la categoría sin perderla
    const dia = an.getByRole('gridcell', { name: /: S\/ / }).first()
    await dia.click()
    await expect(dia).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/categoria=.*dia=|dia=.*categoria=/)
    // Flujo: resaltar un fondo no abre modales y se puede quitar
    const nodo = an.getByRole('button', { name: /Resaltar sus recorridos/ }).first()
    await nodo.click()
    await expect(an.getByText(/Resaltando solo los recorridos que pasan por/)).toBeVisible()
    await an.getByRole('button', { name: 'Quitar resaltado', exact: true }).click()
    await expect(an.getByText(/Resaltando solo/)).toHaveCount(0)
    // Limpiar filtros
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page).not.toHaveURL(/categoria=|dia=/)
    expect(errores).toEqual([])
  })

  test('en móvil el flujo se muestra por fondo y el perfil como barras, sin desborde', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    const an = page.getByRole('region', { name: 'Análisis conectado' })
    await expect(an.getByRole('list', { name: 'Flujo por fondo' })).toBeVisible()
    await expect(an.getByRole('list', { name: 'Perfil en barras' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })
})
