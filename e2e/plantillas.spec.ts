import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { elegir, email, iniciarSesion, password, sufijo } from './helpers'

async function abrirPlantillas(page: Page) {
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Plantillas' }).click()
}

async function crear(page: Page, d: { nombre: string; importe?: string; dia?: string; variable?: boolean }) {
  await page.getByRole('button', { name: 'Nueva plantilla' }).first().click()
  const f = page.getByRole('dialog', { name: 'Nueva plantilla' })
  await f.getByLabel('Nombre', { exact: true }).fill(d.nombre)
  await f.getByLabel('Descripción del gasto').fill(`Gasto ${d.nombre}`)
  if (d.importe) await f.getByLabel('Importe sugerido').fill(d.importe)
  if (d.dia) await f.getByLabel('Día del mes (opcional)').fill(d.dia)
  if (d.variable) await f.getByLabel(/El importe cambia cada mes/).check()
  await elegir(page, f.getByRole('combobox', { exact: true, name: 'Ámbito' }), 'Hogar')
  await elegir(page, f.getByRole('combobox', { exact: true, name: 'Categoría' }), 'Servicios')
  await elegir(page, f.getByRole('combobox', { exact: true, name: 'Medio de pago (opcional)' }), 'Transferencia')
  return f
}

async function eliminar(page: Page, nombre: string) {
  await page.keyboard.press('Escape').catch(() => undefined)
  await abrirPlantillas(page)
  await page.getByRole('button', { name: `Eliminar ${nombre}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByText('Plantilla eliminada.')).toBeVisible()
}

test.describe('Plantillas mensuales', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('el formulario exige importe salvo que cambie cada mes, valida el día y explica la naturaleza del gasto', async ({ page }) => {
    await iniciarSesion(page)
    await abrirPlantillas(page)
    const nombre = `Var ${sufijo()}`
    const f = await crear(page, { nombre, dia: '32' })
    await f.getByRole('button', { name: 'Guardar' }).click()
    await expect(f.getByText('Escribe un día entre 1 y 31.')).toBeVisible()
    await expect(f.getByText('Ingresa el importe sugerido o marca que el importe cambia cada mes.')).toBeVisible()
    // Dos conceptos distintos, con nombres y explicación propios
    await expect(f.getByText('Naturaleza del gasto')).toBeVisible()
    await expect(f.getByText(/No es lo mismo que «el importe cambia cada mes»/)).toBeVisible()
    await f.getByLabel('Día del mes (opcional)').fill('31')
    await expect(f.getByText(/Este mes se registraría el/)).toBeVisible()
    await f.getByLabel(/El importe cambia cada mes/).check()
    await f.getByLabel('Importe sugerido').fill('0')
    await f.getByRole('button', { name: 'Guardar' }).click()
    await expect(f.getByText('El importe debe ser mayor que 0.')).toBeVisible() // cero nunca es un importe confirmado
    await f.getByLabel('Importe sugerido').fill('')
    await f.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    // En la lista: nombre, importe variable, día, clasificación y acciones con nombre accesible
    const item = page.getByRole('listitem').filter({ hasText: nombre })
    await expect(item).toContainText('Importe variable')
    await expect(item).toContainText('Día 31')
    await expect(item).toContainText('Servicios')
    for (const a of ['Editar', 'Desactivar', 'Eliminar']) await expect(item.getByRole('button', { name: `${a} ${nombre}` })).toBeVisible()
    await item.getByRole('button', { name: `Desactivar ${nombre}` }).click()
    await expect(item).toContainText('Inactiva')
    await item.getByRole('button', { name: `Activar ${nombre}` }).click()
    await expect(item).not.toContainText('Inactiva')
    await eliminar(page, nombre)
  })

  test('registro mensual: importe variable pide revisión, los datos pendientes se señalan y un mes corto usa su último día', async ({ page }) => {
    await iniciarSesion(page)
    await abrirPlantillas(page)
    const nombre = `Mes ${sufijo()}`
    const f = await crear(page, { nombre, dia: '31', variable: true })
    await f.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Registrar mensuales' }).click()
    const lote = page.getByRole('dialog', { name: 'Registrar gastos mensuales' })
    const fila = lote.getByRole('listitem').filter({ hasText: nombre })
    await expect(fila).toContainText('Revisar importe')
    // Las demás plantillas del entorno no se registran
    const otras = lote.getByRole('combobox', { name: /^Decisión para / })
    for (let i = 0; i < (await otras.count()); i++) {
      const c = otras.nth(i)
      if ((await c.getAttribute('aria-label')) !== `Decisión para ${nombre}`) await elegir(page, c, 'Omitir')
    }
    await lote.getByRole('button', { name: 'Revisar y registrar' }).click()
    await expect(fila.getByRole('alert')).toContainText('Ingresa el importe')
    await expect(page.getByRole('alertdialog')).toHaveCount(0) // no se llega a la confirmación con datos pendientes
    await fila.getByLabel(`Importe de ${nombre}`).fill('45,5')
    await expect(fila).not.toContainText('Revisar importe')
    await expect(lote.getByText(/1 gasto por S\/ 45\.50/).first()).toBeVisible()
    // Mes anterior (30 días): el día 31 se ajusta al 30
    await lote.getByRole('button', { name: /anterior/i }).first().click()
    const confirmar = page.getByRole('alertdialog', { name: '¿Cambiar de mes?' })
    await expect(confirmar).toBeVisible() // hay ajustes sin registrar
    await confirmar.getByRole('button', { name: 'Cambiar de mes' }).click()
    const fila2 = lote.getByRole('listitem').filter({ hasText: nombre })
    await expect(fila2.getByText('30/09/2026')).toBeVisible()
    await page.keyboard.press('Escape')
    await eliminar(page, nombre)
  })
})
