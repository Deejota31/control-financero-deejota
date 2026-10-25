import { expect, test, type Page } from '@playwright/test'
import { email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

/** Si el cambio recalcula gastos, la app pide confirmación; si no, guarda directamente. */
async function confirmarSiPide(page: Page, exito: string) {
  const confirmacion = page.getByRole('alertdialog')
  await expect(confirmacion.or(page.getByText(exito))).toBeVisible()
  if (await confirmacion.isVisible()) {
    await expect(confirmacion).toContainText('recalcula los períodos abiertos')
    await confirmacion.getByRole('button', { name: 'Aplicar cambios' }).click()
  }
  await expect(page.getByText(exito)).toBeVisible()
}

test.describe('Fondos presupuestales', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('muestra resumen, fondos, estados y el excedente transferido al Fondo General', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await expect(page.getByText('Período abierto')).toBeVisible()
    for (const t of ['Presupuesto asignado', 'Consumido', 'Disponible', 'Fondos en sobregasto']) await expect(page.getByText(t, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fondo General' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hogar' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alimentos Sodexo' })).toBeVisible()

    // detalle del Fondo General con excedentes de fondos específicos
    const general = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Fondo General' }) })
    await general.getByRole('button', { name: 'Ver gastos' }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByText(/Excedente de /).first()).toBeVisible()
    await dialogo.getByRole('button', { name: 'Cerrar' }).click()
    expect(errores).toEqual([])
  })

  test('el período cerrado muestra el histórico sin acciones de edición', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await expect(page.getByText('Período cerrado').first()).toBeVisible()
    await expect(page.getByText(/resultado histórico/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nuevo fondo' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Editar / })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Fondo General' })).toBeVisible()
  })

  test('un cambio que recalcula gastos explica su efecto y no se aplica hasta confirmar', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    const hogar = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Hogar', exact: true }) })
    await expect(hogar.getByText('Agotado').or(hogar.getByText('Sobregasto')).first()).toBeVisible()

    await hogar.getByRole('button', { name: 'Presupuesto del período' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Importe asignado (S/)').fill('600')
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    const confirmacion = page.getByRole('alertdialog')
    await expect(confirmacion).toContainText('recalcula los períodos abiertos')
    await expect(confirmacion).toContainText('Consumo antes')

    // Cancelar: nada cambia
    await confirmacion.getByRole('button', { name: 'Cancelar' }).click()
    await page.reload()
    await expect(hogar.getByText('Asignado S/ 700.00')).toBeVisible()

    // Confirmar y luego restaurar
    await hogar.getByRole('button', { name: 'Presupuesto del período' }).click()
    await page.getByRole('dialog').getByLabel('Importe asignado (S/)').fill('600')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(page.getByText('Presupuesto actualizado.')).toBeVisible()
    await expect(hogar.getByText('Asignado S/ 600.00')).toBeVisible()
    await hogar.getByRole('button', { name: 'Presupuesto del período' }).click()
    await page.getByRole('dialog').getByLabel('Importe asignado (S/)').fill('700')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(hogar.getByText('Asignado S/ 700.00')).toBeVisible()
  })

  test('crea un fondo específico con reglas, valida y lo desactiva', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await page.getByRole('button', { name: 'Nuevo fondo' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Nombre').fill(`Fondo ${sufijo()}`)

    // sin reglas de inclusión no se puede guardar un específico
    await dialogo.getByRole('button', { name: 'Guardar fondo' }).click()
    await expect(dialogo.getByText('Un fondo específico necesita al menos un ámbito, categoría o subcategoría incluido.')).toBeVisible()

    await dialogo.getByRole('radiogroup', { name: 'Regla para Trabajo' }).getByRole('radio', { name: 'Incluir' }).click()
    await dialogo.getByRole('radiogroup', { name: 'Regla para Efectivo' }).getByRole('radio', { name: 'Excluir' }).click()
    await dialogo.getByLabel('Importe por defecto (S/)').fill('150')
    await dialogo.getByRole('button', { name: 'Guardar fondo' }).click()
    await confirmarSiPide(page, 'Fondo guardado.')

    const nuevo = page.getByRole('listitem').filter({ hasText: 'Asignado S/ 150.00' })
    await expect(nuevo).toHaveCount(1)
    await nuevo.getByRole('button', { name: /^Clonar / }).click()
    await expect(page.getByRole('dialog').getByLabel('Nombre')).toHaveValue(/\(copia\)$/)
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

    await nuevo.getByRole('button', { name: /^Desactivar / }).click()
    await confirmarSiPide(page, 'Fondo desactivado.')
    await expect(page.getByRole('region', { name: 'Fondos inactivos' }).or(page.getByLabel('Fondos inactivos'))).toBeVisible()
  })
})
