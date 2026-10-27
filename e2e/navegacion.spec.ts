import { expect, test } from './fixtures'
import { elegir, email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

const RUTAS = ['/', '/gastos', '/fondos', '/catalogo', '/salud', '/configuracion']

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
    await elegir(page, d.getByRole('combobox', { exact: true, name: 'Ámbito' }), 'Personal')
    await elegir(page, d.getByRole('combobox', { exact: true, name: 'Categoría' }), 'Alimentación')
    await elegir(page, d.getByRole('combobox', { exact: true, name: 'Medio de pago' }), 'Yape')
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

  test('móvil: seis módulos, + central, áreas táctiles de 44 px y contenido sobre la barra', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    const nav = page.getByRole('navigation', { name: 'Módulos' }).filter({ has: page.getByRole('button', { name: 'Registrar gasto' }) })
    await expect(nav).toBeVisible()
    for (const n of ['Dashboard', 'Gastos', 'Fondos', 'Catálogo', 'Salud financiera', 'Configuración']) {
      const l = nav.getByRole('link', { name: n })
      await expect(l).toBeVisible()
      const b = (await l.boundingBox())!
      expect(b.height, n).toBeGreaterThanOrEqual(44)
      expect(b.width, n).toBeGreaterThanOrEqual(44)
    }
    const mas = nav.getByRole('button', { name: 'Registrar gasto' })
    const bm = (await mas.boundingBox())!
    expect(bm.width).toBeGreaterThanOrEqual(44)
    // Tres a un lado, tres al otro
    const xs = await Promise.all(['Dashboard', 'Gastos', 'Fondos', 'Catálogo', 'Salud financiera', 'Configuración'].map(async (n) => (await nav.getByRole('link', { name: n }).boundingBox())!.x))
    expect(Math.max(...xs.slice(0, 3))).toBeLessThan(bm.x)
    expect(Math.min(...xs.slice(3))).toBeGreaterThan(bm.x)
    // El botón flotante de escritorio no se duplica
    await expect(page.locator('button.fab-gasto:visible')).toHaveCount(1)
    for (const r of RUTAS) {
      await page.goto(r)
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(250)
      const sobra = await page.evaluate(() => {
        const nav = document.querySelector('nav.fixed')!.getBoundingClientRect()
        // Solo cuenta lo realmente visible: un elemento recortado por un contenedor (overflow) no se pinta bajo la barra.
        const ult = Array.from(document.querySelectorAll('#contenido *')).filter((e) => {
          const r = e.getBoundingClientRect()
          if (r.height === 0 || r.bottom > innerHeight) return false
          const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))
          const top = document.elementFromPoint(x, y)
          return top === e || e.contains(top)
        }).map((e) => e.getBoundingClientRect().bottom)
        return Math.max(0, ...ult) - nav.top
      })
      expect(sobra, `contenido bajo la barra en ${r}`).toBeLessThanOrEqual(1)
    }
    await mas.click()
    await expect(page.getByRole('dialog', { name: 'Nuevo gasto' })).toBeVisible()
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
