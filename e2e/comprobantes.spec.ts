import { type Page, type Route } from '@playwright/test'
import { PDF, existeComprobante, rest } from './api'
import { expect, test } from './fixtures'
import { elegirEnGasto, email, iniciarSesion, password, sufijo } from './helpers'

const RPC = (nombre: string) => `**/rest/v1/rpc/${nombre}`
const rechazo = (route: Route) =>
  route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '23514', message: 'rechazado por la prueba', details: null, hint: null }) })

async function abrirNuevoGasto(page: Page, descripcion: string) {
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Nuevo gasto' }).click()
  const d = page.getByRole('dialog', { name: 'Nuevo gasto' })
  await d.getByLabel('Importe', { exact: true }).fill('12.50')
  for (const [n, o] of [['Ámbito', 'Personal'], ['Categoría', 'Ocio'], ['Medio de pago', 'Yape']] as const) {
    await elegirEnGasto(d, n, o)
  }
  await d.getByLabel('Descripción', { exact: true }).fill(descripcion)
  return d
}

test.describe('Comprobantes: sin archivos huérfanos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('si falla el guardado tras subir el archivo, el archivo recién subido se elimina', async ({ page }) => {
    await iniciarSesion(page)
    let ruta = ''
    await page.route(RPC('create_expense'), async (route) => {
      ruta = route.request().postDataJSON().p.receipt_path
      await rechazo(route)
    })
    const d = await abrirNuevoGasto(page, `E2E fallo ${sufijo()}`)
    await d.getByLabel('Comprobante').setInputFiles(PDF('recibo.pdf'))
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(d.getByText('Algún dato no cumple las reglas de validación.')).toBeVisible()
    expect(ruta).toMatch(/\/recibo|\.pdf$/)
    // el archivo no queda en el bucket y no hay tareas pendientes
    await expect.poll(() => existeComprobante(page, ruta)).toBe(false)
    await expect.poll(async () => (await rest<unknown[]>(page, `storage_cleanup_tasks?select=path&path=eq.${encodeURIComponent(ruta)}&reason=eq.compensacion`)).length).toBe(0)
    expect((await rest<unknown[]>(page, 'expenses?select=id&description=like.E2E%20fallo*')).length).toBe(0)
  })

  test('si el borrado compensatorio también falla, queda una tarea de limpieza que se reintenta y completa', async ({ page }) => {
    await iniciarSesion(page)
    let ruta = ''
    await page.route(RPC('create_expense'), async (route) => {
      ruta = route.request().postDataJSON().p.receipt_path
      await rechazo(route)
    })
    // El almacenamiento rechaza el borrado: simula una caída justo en la compensación
    await page.route('**/storage/v1/object/comprobantes', (route) => (route.request().method() === 'DELETE' ? route.abort('connectionrefused') : route.continue()))
    const d = await abrirNuevoGasto(page, `E2E tarea ${sufijo()}`)
    await d.getByLabel('Comprobante').setInputFiles(PDF('recibo.pdf'))
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(d.getByText('Algún dato no cumple las reglas de validación.')).toBeVisible()

    // el archivo sigue ahí, pero hay una tarea de compensación registrada en el servidor
    await expect.poll(async () => (await rest<{ reason: string }[]>(page, `storage_cleanup_tasks?select=reason&path=eq.${encodeURIComponent(ruta)}`))[0]?.reason).toBe('compensacion')
    expect(await existeComprobante(page, ruta)).toBe(true)

    // al volver a abrir la aplicación con el almacenamiento disponible, la tarea se procesa
    await page.unroute('**/storage/v1/object/comprobantes')
    await page.unroute(RPC('create_expense'))
    await page.reload()
    await expect.poll(() => existeComprobante(page, ruta), { timeout: 15_000 }).toBe(false)
    await expect.poll(async () => (await rest<unknown[]>(page, `storage_cleanup_tasks?select=id&path=eq.${encodeURIComponent(ruta)}`)).length).toBe(0)
  })

  test('editar: un fallo no borra el comprobante existente; al guardar con éxito se elimina el reemplazado', async ({ page }) => {
    await iniciarSesion(page)
    const desc = `E2E edicion ${sufijo()}`
    // gasto con comprobante A
    const d = await abrirNuevoGasto(page, desc)
    await d.getByLabel('Comprobante').setInputFiles(PDF('a.pdf'))
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    const [creado] = await rest<{ id: string; receipt_path: string }[]>(page, `expenses?select=id,receipt_path&description=eq.${encodeURIComponent(desc)}`)
    const rutaA = creado.receipt_path
    expect(rutaA).toBeTruthy()
    expect(await existeComprobante(page, rutaA)).toBe(true)

    // edición que falla con un archivo nuevo B: A se conserva y B no queda huérfano
    let rutaB = ''
    await page.route(RPC('update_expense'), async (route) => {
      rutaB = route.request().postDataJSON().p.receipt_path
      await rechazo(route)
    })
    await page.getByLabel('Buscar', { exact: true }).fill(desc)
    await page.getByRole('button', { name: `Editar ${desc}` }).click()
    const e = page.getByRole('dialog', { name: 'Editar gasto' })
    await e.getByRole('button', { name: 'Quitar comprobante' }).click()
    await e.getByLabel('Comprobante').setInputFiles(PDF('b.pdf'))
    await e.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(e.getByText('Algún dato no cumple las reglas de validación.')).toBeVisible()
    expect(rutaB).not.toBe(rutaA)
    await expect.poll(() => existeComprobante(page, rutaB)).toBe(false)
    expect(await existeComprobante(page, rutaA)).toBe(true)
    expect((await rest<{ receipt_path: string }[]>(page, `expenses?select=receipt_path&id=eq.${creado.id}`))[0].receipt_path).toBe(rutaA)

    // mismo formulario, ahora sin fallo: se guarda B y A (reemplazado) se elimina
    await page.unroute(RPC('update_expense'))
    await e.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Gasto actualizado.')).toBeVisible()
    const [editado] = await rest<{ receipt_path: string }[]>(page, `expenses?select=receipt_path&id=eq.${creado.id}`)
    expect(editado.receipt_path).not.toBe(rutaA)
    expect(await existeComprobante(page, editado.receipt_path)).toBe(true)
    await expect.poll(() => existeComprobante(page, rutaA)).toBe(false)
  })

  test('quitar el comprobante de un gasto lo elimina solo después de guardar', async ({ page }) => {
    await iniciarSesion(page)
    const desc = `E2E quitar ${sufijo()}`
    const d = await abrirNuevoGasto(page, desc)
    await d.getByLabel('Comprobante').setInputFiles(PDF('c.pdf'))
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    const [g] = await rest<{ id: string; receipt_path: string }[]>(page, `expenses?select=id,receipt_path&description=eq.${encodeURIComponent(desc)}`)

    await page.getByLabel('Buscar', { exact: true }).fill(desc)
    await page.getByRole('button', { name: `Editar ${desc}` }).click()
    const e = page.getByRole('dialog', { name: 'Editar gasto' })
    await e.getByRole('button', { name: 'Quitar comprobante' }).click()
    // Cancelar sin guardar: el archivo y la referencia siguen intactos
    await e.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('alertdialog', { name: '¿Descartar los cambios?' })).toBeVisible()
    await page.getByRole('button', { name: 'Descartar cambios' }).click()
    expect(await existeComprobante(page, g.receipt_path)).toBe(true)

    await page.getByRole('button', { name: `Editar ${desc}` }).click()
    await page.getByRole('dialog', { name: 'Editar gasto' }).getByRole('button', { name: 'Quitar comprobante' }).click()
    await page.getByRole('dialog', { name: 'Editar gasto' }).getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Gasto actualizado.')).toBeVisible()
    await expect.poll(() => existeComprobante(page, g.receipt_path)).toBe(false)
    expect((await rest<{ receipt_path: string | null }[]>(page, `expenses?select=receipt_path&id=eq.${g.id}`))[0].receipt_path).toBeNull()
  })
})
