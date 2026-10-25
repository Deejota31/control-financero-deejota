import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

test.describe('Teclado y foco', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('el foco es visible al navegar con Tab', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await expect(page.getByRole('table')).toBeVisible()
    for (const nombre of ['Nuevo gasto', 'Exportar CSV']) {
      const b = page.getByRole('button', { name: nombre })
      await b.focus()
      const estilo = await b.evaluate((el) => {
        const s = getComputedStyle(el)
        return { estilo: s.outlineStyle, ancho: parseFloat(s.outlineWidth) }
      })
      expect(estilo.estilo, `contorno de foco en ${nombre}`).not.toBe('none')
      expect(estilo.ancho).toBeGreaterThanOrEqual(2)
    }
  })

  test('un diálogo de formulario atrapa el foco, se cierra con Escape y devuelve el foco al botón que lo abrió', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    const abrir = page.getByRole('button', { name: 'Nuevo gasto' })
    await abrir.focus()
    await page.keyboard.press('Enter')
    const dialogo = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await expect(dialogo).toBeVisible()
    // Tab repetidos no sacan el foco del diálogo
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
    expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialogo).toBeHidden()
    await expect(abrir).toBeFocused()
  })

  test('el cuadro de confirmación se cierra con Escape y devuelve el foco al botón de origen', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    const anular = page.getByRole('button', { name: /^Anular / }).first()
    await anular.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toBeHidden()
    await expect(anular).toBeFocused()
  })

  test('Cancelar en una confirmación también devuelve el foco', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/catalogo')
    const eliminar = page.getByRole('button', { name: /^Eliminar / }).first()
    const nombre = await eliminar.getAttribute('aria-label')
    await eliminar.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('button', { name: nombre!, exact: true })).toBeFocused()
  })

  test('tras confirmar una acción que retira la fila, el foco no se pierde en el documento', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: /^Anular / }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('contenido')
  })

  test('el calendario se maneja con flechas, Enter y Escape', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nuevo gasto' })
    const fecha = dialogo.getByRole('button', { name: 'Fecha', exact: true })
    await fecha.focus()
    await page.keyboard.press('Enter')
    const celda = page.getByRole('gridcell', { selected: true })
    await expect(celda).toBeFocused().catch(() => undefined)
    const antes = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-date'))
    await page.keyboard.press('ArrowRight')
    const fechaFoco = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-date') ?? null)
    await expect.poll(fechaFoco).not.toBe(antes)
    expect(await fechaFoco()).not.toBeNull()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('grid')).toBeHidden()
    await expect(fecha).toContainText(/\d{2}\/\d{2}\/\d{4}/)
    // Escape cierra el calendario sin cerrar el diálogo
    await fecha.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('grid')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('grid')).toBeHidden()
    await expect(dialogo).toBeVisible()
  })

  test('los selectores se operan solo con teclado: abrir, buscar, navegar y elegir', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nuevo gasto' })
    const ambito = dialogo.getByRole('combobox', { name: 'Ámbito', exact: true })
    await ambito.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(ambito).toContainText('Hogar')
    // Selector con búsqueda: escribir filtra y Enter elige
    const categoria = dialogo.getByRole('combobox', { name: 'Categoría', exact: true })
    await categoria.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.type('serv')
    await page.keyboard.press('Enter')
    await expect(categoria).toContainText('Servicios')
    // Escape cierra el selector y el foco vuelve a él
    await categoria.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toBeHidden()
    await expect(categoria).toBeFocused()
  })
})
