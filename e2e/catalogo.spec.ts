import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const guardado = (page: import('@playwright/test').Page) => expect(page.getByText('Cambios guardados', { exact: true }).first()).toBeVisible()

test.describe('Catálogo', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('administra ámbitos: crear, editar, ordenar, desactivar y eliminar', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await expect(page.getByRole('tab', { name: 'Ámbitos' })).toHaveAttribute('aria-selected', 'true')
    const lista = page.getByRole('list', { name: 'Lista de ámbitos' })
    await expect(lista.getByText('Personal', { exact: true })).toBeVisible()

    const nombre = `Prueba ${sufijo()}`
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Nombre').fill(nombre)
    await dialogo.getByRole('button', { name: 'Cambiar icono' }).click()
    await dialogo.getByRole('textbox', { name: 'Buscar ícono' }).fill('avión')
    await dialogo.getByRole('radio', { name: 'Viajes y avión' }).click()
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Ámbito creado.')).toBeVisible()
    await expect(lista.getByText(nombre, { exact: true })).toBeVisible()

    // editar en el panel en línea
    const editado = `${nombre} B`
    await page.getByRole('button', { name: `Editar ${nombre}` }).click()
    const nombreCampo = page.getByRole('form', { name: 'Editar ámbito' }).getByLabel('Nombre')
    await expect(nombreCampo).toBeFocused()
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await nombreCampo.fill(editado)
    await expect(page.getByText('Hay cambios sin guardar')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await guardado(page)
    await expect(lista.getByText(editado, { exact: true })).toBeVisible()

    // ordenar: subir un puesto
    const filas = lista.getByRole('listitem')
    const antes = await filas.allTextContents()
    expect(antes.at(-1)).toContain(editado)
    await page.getByRole('button', { name: `Subir ${editado}` }).click()
    await expect.poll(async () => (await filas.allTextContents()).at(-2)).toContain(editado)
    await page.reload()
    await expect.poll(async () => (await filas.allTextContents()).at(-2)).toContain(editado)

    // desactivar
    await page.getByRole('button', { name: `Desactivar ${editado}` }).click()
    await expect(filas.filter({ hasText: editado }).getByText('Inactivo')).toBeVisible()

    // eliminar (sin uso)
    await page.getByRole('button', { name: `Eliminar ${editado}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText(`${editado} eliminado.`)).toBeVisible()
    await expect(lista.getByText(editado, { exact: true })).toHaveCount(0)
    expect(errores).toEqual([])
  })

  test('un ámbito con gastos no se elimina: se conserva el histórico', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('button', { name: 'Eliminar Hogar' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText(/está en uso/)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Lista de ámbitos' }).getByText('Hogar', { exact: true })).toBeVisible()
  })

  test('los medios de pago nuevos quedan antes de "Otro"', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('tab', { name: 'Medios de pago' }).click()
    const nombre = `Medio ${sufijo()}`
    await page.getByRole('button', { name: 'Nuevo medio de pago' }).click()
    await page.getByRole('dialog').getByLabel('Nombre').fill(nombre)
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    const lista = page.getByRole('list', { name: 'Lista de medios de pago' })
    await expect(lista.getByText(nombre, { exact: true })).toBeVisible()
    const filas = lista.getByRole('listitem')
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
    await expect(page.getByRole('list', { name: 'Lista de subcategorías' }).getByText('Comidas fuera')).toBeVisible()
  })

  test('elegir un color de la paleta de 36 se marca, no hay tarjetas de ejemplo y se guarda', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('button', { name: 'Editar Trabajo' }).click()
    const panel = page.getByRole('form', { name: 'Editar ámbito' })
    // Sin tarjetas laterales de «Tema claro» / «Tema oscuro»
    await expect(page.getByText('Tema claro', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Tema oscuro', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Vista previa del color')).toHaveCount(0)
    await expect(panel.getByRole('radiogroup', { name: 'Color' }).getByRole('radio')).toHaveCount(36)
    await panel.getByRole('radio', { name: /^Rojo, familia/ }).click()
    await expect(panel.getByRole('radio', { name: /^Rojo, familia/ })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await guardado(page)
    expect(sqlLocal(`select color_hex from public.ambitos where household_id = ${HID} and name = 'Trabajo'`)).toBe('#DC2626')
    await page.reload()
    await page.getByRole('button', { name: 'Editar Trabajo' }).click()
    await expect(page.getByRole('radio', { name: /^Rojo, familia/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('color personalizado en un popover compacto: HEX y RGB sincronizados, validación, Cancelar restaura y Aplicar modifica el borrador', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('tab', { name: 'Medios de pago' }).click()
    await page.getByRole('button', { name: 'Editar Efectivo' }).click()
    const panel = page.getByRole('form', { name: 'Editar medio de pago' })
    const alto = (await panel.boundingBox())!.height
    await panel.getByRole('button', { name: /Color personalizado/ }).click()
    const pop = page.getByRole('dialog')
    const caja = (await pop.boundingBox())!
    expect(caja.width).toBeGreaterThanOrEqual(270)
    expect(caja.width).toBeLessThanOrEqual(330)
    expect(Math.abs((await panel.boundingBox())!.height - alto), 'el popover no alarga la tarjeta').toBeLessThanOrEqual(1)
    const hex = pop.getByLabel('HEX', { exact: true })
    await hex.fill('5b5bd6')
    await pop.getByRole('button', { name: 'RGB' }).click()
    await expect(pop.getByLabel('R', { exact: true })).toHaveValue('91')
    await expect(pop.getByLabel('G', { exact: true })).toHaveValue('91')
    await expect(pop.getByLabel('B', { exact: true })).toHaveValue('214')
    await pop.getByLabel('B', { exact: true }).fill('200')
    await expect(hex).toHaveValue('#5B5BC8')
    await hex.fill('zzz')
    await expect(pop.getByText('Usa 6 dígitos hexadecimales')).toBeVisible()
    await expect(pop.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
    await pop.getByLabel('R', { exact: true }).fill('300')
    await expect(pop.getByText('Cada canal RGB va de 0 a 255.')).toBeVisible()
    await hex.fill('#5B5BD6')
    await expect(pop.getByText('Cumple el contraste en tema claro y oscuro.')).toBeVisible()
    // el teclado mueve el selector de saturación y brillo
    const antes = await hex.inputValue()
    await pop.getByRole('slider', { name: 'Saturación y brillo' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(hex).not.toHaveValue(antes)
    // Cancelar restaura el color anterior
    const colorAntes = sqlLocal(`select coalesce(color_hex, 'token') from public.medios_pago where household_id = ${HID} and name = 'Efectivo'`)
    await pop.getByRole('button', { name: 'Cancelar' }).click()
    await expect(pop).toBeHidden()
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    // Aplicar cambia el borrador; Guardar lo persiste
    await panel.getByRole('button', { name: /Color personalizado/ }).click()
    await page.getByRole('dialog').getByLabel('HEX', { exact: true }).fill('#5B5BD6')
    await page.getByRole('dialog').getByRole('button', { name: 'Aplicar' }).click()
    expect(sqlLocal(`select coalesce(color_hex, 'token') from public.medios_pago where household_id = ${HID} and name = 'Efectivo'`)).toBe(colorAntes)
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await guardado(page)
    expect(sqlLocal(`select color_hex from public.medios_pago where household_id = ${HID} and name = 'Efectivo'`)).toBe('#5B5BD6')
  })

  test('una categoría puede heredar el color de su ámbito y lo sigue cuando cambia', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await page.getByRole('tab', { name: 'Categorías', exact: true }).click()
    await page.getByRole('combobox', { name: 'Ámbito' }).click()
    await page.getByRole('option', { name: 'Hogar', exact: true }).click()
    await page.getByRole('button', { name: 'Editar Servicios' }).click()
    const panel = page.getByRole('form', { name: 'Editar categoría' })
    await panel.getByRole('radio', { name: /Heredar de/ }).click()
    await expect(panel.getByText(/Si el ámbito cambia de color/)).toBeVisible()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await guardado(page)
    expect(sqlLocal(`select color_mode || '|' || coalesce(color_hex, 'null') from public.categorias where household_id = ${HID} and name = 'Servicios'`)).toBe('inherit|null')
    // cambia el color del ámbito → la categoría lo sigue
    sqlLocal(`update public.ambitos set color_hex = '#DB2777' where household_id = ${HID} and name = 'Hogar'`)
    await page.reload()
    await page.getByRole('tab', { name: 'Categorías', exact: true }).click()
    await page.getByRole('combobox', { name: 'Ámbito' }).click()
    await page.getByRole('option', { name: 'Hogar', exact: true }).click()
    const fila = page.getByRole('list', { name: 'Lista de categorías' }).getByRole('listitem').filter({ hasText: 'Servicios' })
    await expect(fila.locator('span.rounded-lg').first()).toHaveAttribute('style', /rgb\(219, 39, 119\)/) // #DB2777
    // pasar a color propio guarda el HEX y quita la herencia
    await page.getByRole('button', { name: 'Editar Servicios' }).click()
    await panel.getByRole('radio', { name: 'Color propio' }).click()
    await panel.getByRole('radio', { name: /^Verde, familia/ }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await guardado(page)
    expect(sqlLocal(`select color_mode || '|' || color_hex from public.categorias where household_id = ${HID} and name = 'Servicios'`)).toBe('own|#16A34A')
  })

  test('Armonizar paleta asigna colores distintos y se puede deshacer', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    const q = `select string_agg(coalesce(color_hex, '-'), ',' order by sort_order) from public.ambitos where household_id = ${HID}`
    const antes = sqlLocal(q)
    await page.getByRole('button', { name: 'Armonizar paleta' }).click()
    const dlg = page.getByRole('dialog', { name: 'Armonizar paleta' })
    await expect(dlg).toContainText('Cancelar no cambia nada')
    await dlg.getByRole('button', { name: /^Aplicar a / }).click()
    await expect(page.getByText(/Paleta armonizada en/)).toBeVisible()
    await expect.poll(() => sqlLocal(q)).not.toBe(antes)
    const distintos = sqlLocal(`select count(distinct color_hex) from public.ambitos where household_id = ${HID} and color_hex is not null`)
    expect(Number(distintos)).toBeGreaterThanOrEqual(4)
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect.poll(() => sqlLocal(q)).toBe(antes)
  })

  test('el color nuevo se refleja en el Dashboard', async ({ page }) => {
    sqlLocal(`update public.ambitos set color_hex = '#DC2626' where household_id = ${HID} and name = 'Hogar'`)
    await iniciarSesion(page)
    const fila = page.getByLabel('Ámbitos').getByRole('button', { name: /^Hogar/ })
    await expect(fila).toBeVisible()
    await expect(fila.locator('[style*="DC2626"]').first()).toBeVisible()
  })
})
