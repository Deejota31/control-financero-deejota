import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

async function irACatalogo(page: Page, tab?: string) {
  await page.getByRole('link', { name: 'Catálogo' }).first().click()
  if (tab) await page.getByRole('tab', { name: tab, exact: true }).click()
}
const bloque = (page: Page) => page.getByRole('group', { name: 'Explorador de íconos' })
const abrir = async (page: Page) => {
  await page.getByRole('button', { name: 'Cambiar icono' }).click()
  await expect(bloque(page)).toBeVisible()
}
const buscar = (page: Page, q: string) => bloque(page).getByRole('textbox', { name: 'Buscar ícono' }).fill(q)
const iconoSel = (page: Page) => page.getByText(/^Ícono seleccionado:/).last() // con un diálogo abierto, el del diálogo va al final

test.describe('Selector de íconos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('contraído muestra el ícono y su nombre; sugiere según el nombre y preselecciona en elementos nuevos', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await irACatalogo(page)
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    const d = page.getByRole('dialog')
    await expect(d.getByRole('button', { name: 'Cambiar icono' })).toHaveAttribute('aria-expanded', 'false')
    await expect(iconoSel(page)).toBeVisible()
    await expect(bloque(page)).toHaveCount(0) // contraído
    await d.getByLabel('Nombre').fill('Gasolina')
    await expect(iconoSel(page)).toContainText('Combustible') // preselección automática
    await expect(d.getByText('Sugerido por el nombre')).toBeVisible()
    const sugeridos = d.getByRole('group', { name: 'Íconos sugeridos' })
    await expect(sugeridos.getByRole('button', { name: /Combustible/ })).toBeVisible()
    expect(await sugeridos.getByRole('button').count()).toBeLessThanOrEqual(5)
    await d.getByLabel('Nombre').fill('Seguro vehicular')
    await expect(iconoSel(page)).toContainText('Seguro')
    await d.getByLabel('Nombre').fill('Viaje a Ica')
    await expect(iconoSel(page)).toContainText('Equipaje')
    expect(errores).toEqual([])
  })

  test('la elección manual gana sobre la sugerencia y no se pierde al cambiar el nombre', async ({ page }) => {
    await iniciarSesion(page)
    await irACatalogo(page)
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Nombre').fill('Gasolina')
    await abrir(page)
    await buscar(page, 'banco')
    await bloque(page).getByRole('radio', { name: 'Banco' }).click()
    await expect(iconoSel(page)).toContainText('Banco')
    await d.getByLabel('Nombre').fill('Estacionamiento') // la sugerencia sería «parking»
    await expect(iconoSel(page)).toContainText('Banco')
    await expect(d.getByText('Sugerido por el nombre')).toHaveCount(0)
  })

  test('la cuadrícula se ajusta a los resultados (máx. ~240 px con scroll interno) y el diálogo nunca crece más que la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await irACatalogo(page)
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Nombre').fill('Algo')
    await abrir(page)
    const b = bloque(page)
    const rejilla = b.getByRole('radiogroup')
    const altoRejilla = async () => Math.round((await rejilla.boundingBox())!.height)
    const sec = b.getByRole('combobox', { name: 'Sección de íconos' })
    await sec.selectOption('sugeridos')
    const pocos = await altoRejilla()
    expect(pocos, 'con pocos resultados no se reservan cientos de píxeles vacíos').toBeLessThan(140)
    await sec.selectOption('todos')
    const muchos = await altoRejilla()
    expect(muchos).toBeLessThanOrEqual(241)
    expect(muchos).toBeGreaterThan(pocos)
    expect(await rejilla.evaluate((e) => e.scrollHeight > e.clientHeight), 'hay scroll interno cuando no caben').toBe(true)
    for (const v of ['alimentacion', 'transporte', 'sugeridos', 'ocio']) {
      await sec.selectOption(v)
      expect(Math.round((await d.boundingBox())!.height)).toBeLessThanOrEqual(900 * 0.92 + 1)
    }
    await buscar(page, 'a')
    expect(await altoRejilla()).toBeLessThanOrEqual(241)
    await buscar(page, 'xyzqw')
    await expect(b.getByText(/No hay íconos para/)).toBeVisible()
    // «Todos» desborda dentro de su propia rejilla (scroll interno), no del formulario
    await buscar(page, '')
    await sec.selectOption('todos')
    const { sh, ch, ow } = await rejilla.evaluate((e) => ({ sh: e.scrollHeight, ch: e.clientHeight, ow: e.scrollWidth - e.clientWidth }))
    expect(sh).toBeGreaterThan(ch)
    expect(ow).toBeLessThanOrEqual(1) // sin scroll horizontal
    expect(await rejilla.getByRole('radio').count()).toBeGreaterThanOrEqual(115)
  })

  test('busca ignorando tildes y mayúsculas, por sinónimos, y muestra resultados vacíos', async ({ page }) => {
    await iniciarSesion(page)
    await irACatalogo(page)
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    await page.getByRole('dialog').getByLabel('Nombre').fill('Algo')
    await abrir(page)
    const b = bloque(page)
    await buscar(page, 'BARBERÍA')
    await expect(b.getByRole('radio', { name: 'Barbería y peluquería' })).toBeVisible()
    await buscar(page, '  barberia ')
    await expect(b.getByRole('radio', { name: 'Barbería y peluquería' })).toBeVisible()
    await buscar(page, 'uber')
    await expect(b.getByRole('radio', { name: 'Taxi' })).toBeVisible()
    await buscar(page, 'gasolina')
    await expect(b.getByRole('radio', { name: 'Combustible' })).toBeVisible()
    await buscar(page, 'netflix')
    await expect(b.getByRole('radio', { name: 'Películas y streaming' })).toBeVisible()
    await buscar(page, 'qqqq')
    await expect(b.getByText(/No hay íconos para «qqqq»/)).toBeVisible()
    await b.getByRole('button', { name: 'Borrar búsqueda' }).click()
    await expect(b.getByRole('radio').first()).toBeVisible()
  })

  test('teclado: Enter abre y enfoca la búsqueda, flechas recorren los íconos y Escape contrae sin cerrar el diálogo', async ({ page }) => {
    await iniciarSesion(page)
    await irACatalogo(page)
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Nombre').fill('Algo')
    const toggle = d.getByRole('button', { name: 'Cambiar icono' })
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(bloque(page).getByRole('textbox', { name: 'Buscar ícono' })).toBeFocused()
    await bloque(page).getByRole('combobox', { name: 'Sección de íconos' }).selectOption('todos')
    const primero = bloque(page).getByRole('radio').first()
    await primero.focus()
    await page.keyboard.press('ArrowRight')
    await expect(bloque(page).getByRole('radio').nth(1)).toBeFocused()
    await page.keyboard.press('ArrowDown')
    const activo = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    expect(activo).toBeTruthy()
    await page.keyboard.press('Enter') // selecciona el ícono enfocado (no envía el formulario)
    await expect(d).toBeVisible()
    await expect(iconoSel(page)).toContainText(activo!)
    await page.keyboard.press('Escape')
    await expect(bloque(page)).toHaveCount(0)
    await expect(d).toBeVisible() // el diálogo sigue abierto
    await expect(toggle).toBeFocused() // el foco vuelve a un lugar predecible
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('seleccionar un ícono, abrir/cerrar o cambiar de sección no envía el formulario ni borra cambios; Descartar restaura', async ({ page }) => {
    await iniciarSesion(page)
    await irACatalogo(page)
    await page.getByRole('button', { name: 'Editar Trabajo' }).click()
    const panel = page.getByRole('form', { name: 'Editar ámbito' })
    const original = (await iconoSel(page).textContent())!
    await panel.getByLabel('Nombre').fill('Trabajo editado')
    await abrir(page)
    await bloque(page).getByRole('combobox', { name: 'Sección de íconos' }).selectOption('dinero')
    await bloque(page).getByRole('radio', { name: 'Ahorro' }).click()
    await bloque(page).getByRole('button', { name: 'Listo' }).click()
    await expect(page.getByText('Cambios guardados', { exact: true })).toHaveCount(0) // no se envió
    await expect(page.getByText('Hay cambios sin guardar')).toBeVisible()
    await expect(panel.getByLabel('Nombre')).toHaveValue('Trabajo editado') // el nombre se conserva
    await expect(iconoSel(page)).toContainText('Ahorro')
    expect(sqlLocal(`select icon_key from public.ambitos where household_id = ${HID} and name = 'Trabajo'`)).not.toBe('piggy-bank') // solo el borrador cambió
    await page.getByRole('button', { name: 'Descartar' }).click()
    await expect(iconoSel(page)).toHaveText(original)
    await expect(panel.getByLabel('Nombre')).toHaveValue('Trabajo')
  })

  test('al editar se conserva el ícono guardado (incluida una clave antigua) y compatibilidad con íconos previos', async ({ page }) => {
    await iniciarSesion(page)
    await irACatalogo(page)
    // «Hogar» usa la clave antigua «home»: se muestra como «Casa» y no se reemplaza al editar el nombre
    expect(sqlLocal(`select icon_key from public.ambitos where household_id = ${HID} and name = 'Hogar'`)).toBe('home')
    await page.getByRole('button', { name: 'Editar Hogar' }).click()
    await expect(iconoSel(page)).toContainText('Casa')
    await page.getByRole('form', { name: 'Editar ámbito' }).getByLabel('Nombre').fill('Hogar y más')
    await expect(iconoSel(page)).toContainText('Casa') // no se sugiere otro ícono al escribir
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios guardados', { exact: true }).first()).toBeVisible()
    expect(sqlLocal(`select icon_key from public.ambitos where household_id = ${HID} and name = 'Hogar y más'`)).toBe('home')
    // las listas muestran los íconos antiguos sin romperse
    await expect(page.getByRole('list', { name: 'Lista de ámbitos' }).locator('svg').first()).toBeVisible()
  })

  test('crea y edita con íconos nuevos en ámbitos, categorías, subcategorías y medios de pago; persisten tras recargar', async ({ page }) => {
    await iniciarSesion(page)
    const s = sufijo()
    // Ámbito
    await irACatalogo(page)
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    let d = page.getByRole('dialog')
    await d.getByLabel('Nombre').fill(`Barbería ${s}`)
    await expect(iconoSel(page)).toContainText('Barbería')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Ámbito creado.')).toBeVisible()
    expect(sqlLocal(`select icon_key from public.ambitos where household_id = ${HID} and name = 'Barbería ${s}'`)).toBe('scissors')

    // Categoría (contexto: ámbito Hogar)
    await irACatalogo(page, 'Categorías')
    await page.getByRole('combobox', { name: 'Ámbito' }).click()
    await page.getByRole('option', { name: 'Hogar', exact: true }).click()
    await page.getByRole('button', { name: 'Nueva categoría' }).click()
    d = page.getByRole('dialog')
    await d.getByLabel('Nombre').fill(`Internet ${s}`)
    await expect(iconoSel(page)).toContainText('Internet')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Categoría creado.').or(page.getByText('Categoría creada.'))).toBeVisible()
    expect(sqlLocal(`select icon_key from public.categorias where household_id = ${HID} and name = 'Internet ${s}'`)).toBe('wifi')

    // Subcategoría
    await irACatalogo(page, 'Subcategorías')
    await page.getByRole('button', { name: 'Nueva subcategoría' }).click()
    d = page.getByRole('dialog')
    await d.getByLabel('Nombre').fill(`Estacionamiento ${s}`)
    await expect(iconoSel(page)).toContainText('Estacionamiento')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(/Subcategoría creada\./)).toBeVisible()
    expect(sqlLocal(`select icon_key from public.subcategorias where household_id = ${HID} and name = 'Estacionamiento ${s}'`)).toBe('parking')

    // Medio de pago
    await irACatalogo(page, 'Medios de pago')
    await page.getByRole('button', { name: 'Nuevo medio de pago' }).click()
    d = page.getByRole('dialog')
    await d.getByLabel('Nombre').fill(`Sodexo ${s}`)
    await expect(iconoSel(page)).toContainText('Tarjeta')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Medio de pago creado.')).toBeVisible()
    expect(sqlLocal(`select icon_key from public.medios_pago where household_id = ${HID} and name = 'Sodexo ${s}'`)).toBe('credit-card')

    // Edición: cambiar el ícono del medio y comprobar la persistencia tras recargar
    await page.getByRole('button', { name: `Editar Sodexo ${s}` }).click()
    await abrir(page)
    await buscar(page, 'yape')
    await bloque(page).getByRole('radio', { name: 'Celular y línea móvil' }).click()
    await bloque(page).getByRole('button', { name: 'Listo' }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios guardados', { exact: true }).first()).toBeVisible()
    expect(sqlLocal(`select icon_key from public.medios_pago where household_id = ${HID} and name = 'Sodexo ${s}'`)).toBe('smartphone')
    await page.reload()
    await page.getByRole('tab', { name: 'Medios de pago', exact: true }).click()
    await page.getByRole('button', { name: `Editar Sodexo ${s}` }).click()
    await expect(iconoSel(page)).toContainText('Celular')
  })

  test('sin desborde horizontal ni bloque fuera de pantalla en 1366×768, 1440×900, 1920×1080 y móvil', async ({ page }) => {
    await iniciarSesion(page)
    for (const [w, h] of [[1366, 768], [1440, 900], [1920, 1080], [390, 844]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await irACatalogo(page)
      await page.getByRole('button', { name: 'Editar Trabajo' }).click()
      await abrir(page)
      await bloque(page).getByRole('combobox', { name: 'Sección de íconos' }).selectOption('todos')
      const caja = (await bloque(page).boundingBox())!
      expect(caja.height, `${w}x${h}`).toBeLessThanOrEqual(Math.min(352, h * 0.7) + 1)
      expect(caja.x + caja.width, `${w}x${h}`).toBeLessThanOrEqual(w + 1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${w}x${h}`).toBeLessThanOrEqual(1)
      const rejilla = bloque(page).getByRole('radiogroup')
      expect(await rejilla.evaluate((e) => e.scrollWidth - e.clientWidth), `${w}x${h}`).toBeLessThanOrEqual(1)
      await page.getByRole('button', { name: 'Contraer', exact: true }).click()
    }
  })
})
