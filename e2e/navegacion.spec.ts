import { expect, test } from './fixtures'
import { elegirEnGasto, email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

const RUTAS = ['/', '/gastos', '/fondos', '/catalogo', '/configuracion']

test.describe('Navegación y registro global de gastos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('escritorio: botón flotante «Registrar gasto» en todas las páginas, sin cambiar de ruta y oculto con un diálogo abierto', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    for (const r of RUTAS) {
      await page.goto(r)
      const fab = page.getByRole('button', { name: 'Registrar gasto' }).and(page.locator('.fab-gasto'))
      await expect(fab.first()).toBeVisible()
    }
    await page.goto('/fondos')
    const url = page.url()
    await page.locator('button.fab-gasto:visible').click()
    const d = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await expect(d).toBeVisible()
    await expect(page.locator('button.fab-gasto:visible')).toHaveCount(0)
    await expect(page).toHaveURL(url)
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
    await expect(page.locator('button.fab-gasto:visible')).toHaveCount(1)
    // El foco vuelve al disparador
    await expect(page.locator('button.fab-gasto:visible')).toBeFocused()
    expect(errores).toEqual([])
  })

  test('guardar desde Fondos conserva ruta y filtros, refresca los datos y confirma', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.goto('/gastos?q=zzz-sin-resultados')
    await page.locator('button.fab-gasto:visible').click()
    const d = page.getByRole('dialog', { name: 'Nuevo gasto' })
    const desc = `E2E global ${sufijo()}`
    await d.getByLabel('Importe', { exact: true }).fill('12,50')
    await elegirEnGasto(d, 'Ámbito', 'Personal')
    await elegirEnGasto(d, 'Categoría', 'Alimentación')
    await elegirEnGasto(d, 'Medio de pago', 'Yape')
    await d.getByLabel('Descripción', { exact: true }).fill(desc)
    // Doble clic rápido: un solo gasto
    await d.getByRole('button', { name: 'Guardar gasto' }).dblclick()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    await expect(page).toHaveURL(/\/gastos\?q=zzz-sin-resultados/)
    await page.getByLabel('Buscar', { exact: true }).fill(desc)
    const filas = page.getByRole('row').filter({ hasText: desc })
    await expect(filas).toHaveCount(1)
    await expect(filas).toContainText('S/ 12.50')
  })

  test('«Salud financiera» ya no existe: ni en la navegación ni como ruta (/salud vuelve al Dashboard, como cualquier ruta desconocida)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await expect(page.getByRole('link', { name: /Salud financiera/ })).toHaveCount(0)
    for (const ruta of ['/salud', '/salud?mes=2026-01-01']) {
      await page.goto(ruta)
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
      await expect(page.getByText('¿Cuánto presupuesto queda?')).toHaveCount(0)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('navigation', { name: 'Módulos' }).getByRole('link')).toHaveCount(5)
  })

  test('tablet y escritorio estrecho: barra inferior a 768 px y barra lateral compacta a 1024 px', async ({ page }) => {
    await iniciarSesion(page)
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('aside')).toBeHidden()
    await page.setViewportSize({ width: 1024, height: 768 })
    const lado = page.locator('aside')
    await expect(lado).toBeVisible()
    expect((await lado.boundingBox())!.width).toBeLessThan(100)
    await expect(lado.getByRole('link', { name: 'Fondos' })).toBeVisible()
  })
})
