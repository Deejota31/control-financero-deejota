import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/** Regresiones de la revisión de calidad: foco del formulario de gasto, acciones de Gastos y navegación inferior a 320 px. */
test.describe('Revisión de calidad: regresiones', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('1 · Nuevo gasto: el foco inicial cae en el primer dato (Ámbito), no en «Cerrar»', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const d = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await expect(d).toBeVisible()
    await expect(d.getByRole('radiogroup', { name: 'Ámbito' }).getByRole('radio').first()).toBeFocused()
    await expect(d.getByRole('button', { name: 'Cerrar' })).not.toBeFocused()
    // con teclado se llega a los demás controles en orden de lectura y Escape cierra devolviendo el foco
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
    await expect(page.getByRole('button', { name: 'Nuevo gasto' })).toBeFocused()
  })

  test('2 · Guardar vacío envía el foco al primer error lógico (Ámbito), con mensajes asociados', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const d = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await expect(d.getByRole('radiogroup', { name: 'Ámbito' })).toBeVisible()
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(d.getByText('Elige un ámbito', { exact: false }).first()).toBeVisible()
    await expect(d.getByRole('radiogroup', { name: 'Ámbito' }).getByRole('radio').first()).toBeFocused()
    // El orden lógico se mantiene aunque el primer dato ya esté elegido: el siguiente error es la categoría
    await d.getByRole('radiogroup', { name: 'Ámbito' }).getByRole('radio').first().click()
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(d.getByRole('radiogroup', { name: 'Categoría' }).getByRole('radio').first()).toBeFocused()
    // con ambos elegidos, el primer error pasa a la descripción (antes que importe y medio)
    await d.getByRole('radiogroup', { name: 'Categoría' }).getByRole('radio').first().click()
    await d.getByLabel('Descripción', { exact: true }).fill('')
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    const primero = await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid') ?? document.activeElement?.closest('[aria-invalid]')?.getAttribute('aria-invalid'))
    expect(primero).toBe('true') // el foco está en un control inválido
    // el campo inválido está relacionado con su mensaje
    const descrito = await d.getByLabel('Importe', { exact: true }).getAttribute('aria-describedby')
    expect(descrito).toBeTruthy()
  })

  test('3 · Gastos a 320 px: buscador y acciones en pocas filas, con nombres accesibles y Nuevo gasto a la vista', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await iniciarSesion(page)
    await page.goto('/gastos')
    const nuevo = page.getByRole('button', { name: 'Nuevo gasto' }).first()
    await expect(nuevo).toBeVisible()
    for (const n of ['Plantillas', 'Registrar mensuales', 'Exportar CSV']) {
      const b = page.getByRole('button', { name: n })
      await expect(b).toBeVisible()
      expect((await b.boundingBox())!.width, `${n} compacto`).toBeLessThan(60) // solo icono
    }
    // las cuatro acciones caben en una única fila bajo el buscador
    const ys = await Promise.all(['Plantillas', 'Registrar mensuales', 'Exportar CSV'].map(async (n) => Math.round((await page.getByRole('button', { name: n }).boundingBox())!.y)))
    expect(new Set(ys).size, 'misma fila').toBe(1)
    const caja = (await nuevo.boundingBox())!
    expect(caja.y, 'Nuevo gasto no queda relegado').toBeLessThan(330)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })

  test('4 · Navegación inferior a 320 px: etiquetas completas, sin cortes y con zonas táctiles suficientes', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await iniciarSesion(page)
    const nav = page.getByRole('navigation', { name: 'Módulos' })
    await expect(nav).toBeVisible()
    for (const [nombre, texto] of [['Dashboard', 'Inicio'], ['Gastos', 'Gastos'], ['Fondos', 'Fondos'], ['Catálogo', 'Catálogo'], ['Salud financiera', 'Salud'], ['Configuración', 'Ajustes']] as const) {
      const enlace = nav.getByRole('link', { name: nombre })
      const caja = (await enlace.boundingBox())!
      expect(caja.height, `${nombre}: zona táctil`).toBeGreaterThanOrEqual(44)
      const etiqueta = enlace.getByText(texto, { exact: true })
      const cortada = await etiqueta.evaluate((el) => el.scrollWidth > el.clientWidth + 0.5)
      expect(cortada, `etiqueta «${texto}» sin cortar`).toBe(false)
      const dentro = (await etiqueta.boundingBox())!
      expect(dentro.x + dentro.width, `«${texto}» dentro de su columna`).toBeLessThanOrEqual(caja.x + caja.width + 0.5)
      expect(dentro.x, `«${texto}» dentro de su columna`).toBeGreaterThanOrEqual(caja.x - 0.5)
    }
    const fab = page.getByRole('button', { name: 'Registrar gasto' })
    expect((await fab.boundingBox())!.width).toBeGreaterThanOrEqual(44)
  })
})
