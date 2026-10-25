import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

test.describe('Salud financiera', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('responde las cuatro preguntas con datos del historial y distingue cálculo de sugerencia', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Salud financiera' }).first().click()
    for (const h of ['¿Cuánto presupuesto queda?', '¿Qué categorías y subcategorías están aumentando?', '¿Qué gastos variables podrían reducirse?', '¿Cuánto presupuesto conviene reservar para compromisos mensuales?']) {
      await expect(page.getByRole('heading', { name: h })).toBeVisible()
    }
    await expect(page.getByText('Calculado').first()).toBeVisible()
    await expect(page.getByText('Sugerencia', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Período analizado:/).first()).toBeVisible()
    await expect(page.getByText('Disponible', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Base de comparación: \d+ /)).toBeVisible()
    await expect(page.getByText(/Reserva sugerida/)).toBeVisible()
    expect(errores).toEqual([])
  })

  test('la reducción supuesta cambia el ahorro posible y se explica el cálculo', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Salud financiera' }).first().click()
    await expect(page.getByText(/Ahorro posible al 10%/)).toBeVisible()
    await page.getByRole('radio', { name: '20%' }).click()
    await expect(page.getByText(/Ahorro posible al 20%/)).toBeVisible()
    await page.getByText('Cómo se calcula').first().click()
    await expect(page.getByText(/Presupuesto asignado a los fondos activos/)).toBeVisible()
  })

  test('un mes sin historial anterior informa datos insuficientes en vez de inventar conclusiones', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/salud?mes=2026-01-01')
    await expect(page.getByText('Aún no hay gastos para analizar')).toBeVisible()
  })

  test('el mes más antiguo con datos no tiene base de comparación suficiente', async ({ page }) => {
    await iniciarSesion(page)
    // El mes más antiguo del seed es hace 2 meses: tiene gastos propios pero ningún mes anterior con datos.
    const hoy = new Date()
    const antiguo = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
    const iso = `${antiguo.getFullYear()}-${String(antiguo.getMonth() + 1).padStart(2, '0')}-01`
    await page.goto(`/salud?mes=${iso}`)
    await expect(page.getByRole('heading', { name: '¿Qué categorías y subcategorías están aumentando?' })).toBeVisible()
    await expect(page.getByText('Datos insuficientes.').first()).toBeVisible()
    await expect(page.getByText(/Se necesita al menos un mes anterior con gastos/)).toBeVisible()
  })

  test('cambiar de mes recalcula el análisis', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Salud financiera' }).first().click()
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await expect(page).toHaveURL(/mes=/)
    await expect(page.getByText(/completo, contra el promedio/)).toBeVisible()
  })
})
