import { expect, test } from '@playwright/test'
import { email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

test.describe('Catálogo', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('administra ámbitos: crear, editar, ordenar, desactivar y eliminar', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await expect(page.getByRole('tab', { name: 'Ámbitos' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Personal', { exact: true })).toBeVisible()

    const nombre = `Prueba ${sufijo()}`
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Nombre').fill(nombre)
    await dialogo.getByRole('radio', { name: 'Avión' }).click()
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Ámbito creado.')).toBeVisible()
    await expect(page.getByText(nombre, { exact: true })).toBeVisible()

    // editar
    const editado = `${nombre} B`
    await page.getByRole('button', { name: `Editar ${nombre}` }).click()
    await page.getByRole('dialog').getByLabel('Nombre').fill(editado)
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(editado, { exact: true })).toBeVisible()

    // ordenar: subir un puesto
    const filas = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Subir / }) })
    const antes = await filas.allTextContents()
    expect(antes.at(-1)).toContain(editado)
    await page.getByRole('button', { name: `Subir ${editado}` }).click()
    await expect.poll(async () => (await filas.allTextContents()).at(-2)).toContain(editado)
    await page.reload()
    await expect.poll(async () => (await filas.allTextContents()).at(-2)).toContain(editado)

    // desactivar
    await page.getByRole('button', { name: `Desactivar ${editado}` }).click()
    await expect(page.getByRole('listitem').filter({ hasText: editado }).getByText('Inactivo')).toBeVisible()

    // eliminar (sin uso)
    await page.getByRole('button', { name: `Eliminar ${editado}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText(`${editado} eliminado.`)).toBeVisible()
    await expect(page.getByText(editado, { exact: true })).toHaveCount(0)
    expect(errores).toEqual([])
  })

  test('un ámbito con gastos no se elimina: se conserva el histórico', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('button', { name: 'Eliminar Hogar' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText(/está en uso/)).toBeVisible()
    await expect(page.getByText('Hogar', { exact: true })).toBeVisible()
  })

  test('los medios de pago nuevos quedan antes de "Otro"', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('tab', { name: 'Medios de pago' }).click()
    const nombre = `Medio ${sufijo()}`
    await page.getByRole('button', { name: 'Nuevo medio de pago' }).click()
    await page.getByRole('dialog').getByLabel('Nombre').fill(nombre)
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(nombre, { exact: true })).toBeVisible()
    const filas = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Subir / }) })
    await expect.poll(async () => (await filas.allTextContents()).at(-1)).toContain('Otro')
    await expect.poll(async () => (await filas.allTextContents()).at(-2)).toContain(nombre)
    await page.getByRole('button', { name: `Eliminar ${nombre}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText(`${nombre} eliminado.`)).toBeVisible()
  })

  test('rechaza una categoría duplicada dentro del mismo ámbito y valida el nombre', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('tab', { name: 'Categorías', exact: true }).click()
    await page.getByRole('button', { name: 'Nueva categoría' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Escribe un nombre.')).toBeVisible()
    await page.getByRole('dialog').getByLabel('Nombre').fill(' alimentación ')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Ya existe un registro con ese nombre.')).toBeVisible()
  })

  test('subcategorías: se filtran por ámbito y categoría', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('tab', { name: 'Subcategorías' }).click()
    await expect(page.getByRole('combobox', { name: 'Ámbito' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Categoría' })).toBeVisible()
    await expect(page.getByText('Comidas fuera')).toBeVisible()
  })
})
