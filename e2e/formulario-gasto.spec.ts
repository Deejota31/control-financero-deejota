import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { elegirEnGasto, email, iniciarSesion, password } from './helpers'

/** Rediseño del formulario de gasto: orden de interacción, tarjeta de importe, evento con buscador único y detalles adicionales. */
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

async function abrir(page: Page) {
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Nuevo gasto' }).click()
  return page.getByRole('dialog', { name: 'Nuevo gasto' })
}
const evento = (nombre: string) => sqlLocal(`insert into public.events(household_id, user_id, name, target_date, budget) values (${HID}, '${E2E_UID}', '${nombre}', current_date + 30, 1000) returning id`).split(/\s/)[0]

test.describe('Formulario de gasto rediseñado', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  // Estas pruebas no dependen de la cotización: el proveedor responde con error y no se consulta el servicio real.
  test.beforeEach(async ({ page }) => {
    await page.route('**/functions/v1/exchange-rate', (route) => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 503, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: 'application/json', body: '{}' }))
  })

  test('el medio de pago va antes que el importe, también en el orden de teclado', async ({ page }) => {
    await iniciarSesion(page)
    const d = await abrir(page)
    const orden = await d.evaluate((raiz) => {
      const medio = raiz.querySelector('[role="radiogroup"][aria-label="Medio de pago"]')!
      const importe = raiz.querySelector('input[aria-label="Importe"]')!
      const fecha = raiz.querySelector('[aria-label="Evento asociado (opcional)"]')!
      return { medioAntes: Boolean(medio.compareDocumentPosition(importe) & Node.DOCUMENT_POSITION_FOLLOWING), eventoAntes: Boolean(fecha.compareDocumentPosition(medio) & Node.DOCUMENT_POSITION_FOLLOWING) }
    })
    expect(orden).toEqual({ medioAntes: true, eventoAntes: true })
    await expect(d.getByText('IMPORTE DEL GASTO', { exact: false })).toBeVisible()
  })

  test('tarjeta de importe: selector segmentado con teclado, importe editable sin reformatear mientras se escribe', async ({ page }) => {
    await iniciarSesion(page)
    const d = await abrir(page)
    const usd = d.getByRole('radio', { name: 'US$ USD' })
    const pen = d.getByRole('radio', { name: 'S/ PEN' })
    await expect(pen).toHaveAttribute('aria-checked', 'true')
    await usd.focus()
    await page.keyboard.press('Enter')
    await expect(usd).toHaveAttribute('aria-checked', 'true')
    const importe = d.getByLabel('Importe', { exact: true })
    await importe.click()
    await importe.pressSequentially('12.5')
    await expect(importe).toHaveValue('12.5') // no se reformatea al escribir
    await importe.blur()
    await expect(importe).toHaveValue('12.50') // sí al salir
    expect(await importe.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16) // sin zoom en iOS
    await pen.click()
    await expect(d.locator('[data-conversion]')).toHaveCount(0)
    await expect(importe).toHaveValue('12.50') // cambiar de moneda no toca lo escrito
  })

  test('evento: buscador único con filtro, selección, quitar, y conceptos/compromisos solo cuando existen', async ({ page }) => {
    const con = evento('Boda Ana')
    evento('Viaje Cusco')
    sqlLocal(`insert into public.event_items(event_id, household_id, name, planned_amount) values ('${con}', ${HID}, 'Decoración', 100)`)
    await iniciarSesion(page)
    const d = await abrir(page)
    const campo = d.getByRole('combobox', { name: 'Evento asociado (opcional)', exact: true })
    await campo.click()
    await expect(d.getByRole('option')).toHaveCount(2)
    await campo.fill('bod')
    await expect(d.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter') // la primera coincidencia se elige con teclado
    await expect(campo).toHaveValue('Boda Ana')
    await expect(d.getByRole('combobox', { name: 'Concepto del evento (opcional)' })).toBeVisible()
    await expect(d.getByRole('combobox', { name: 'Pago de compromiso (opcional)' })).toHaveCount(0) // sin compromisos no hay desplegable vacío
    await d.getByRole('button', { name: 'Quitar evento' }).click()
    await expect(campo).toHaveValue('')
    await expect(d.getByRole('combobox', { name: 'Concepto del evento (opcional)' })).toHaveCount(0)
    await campo.click()
    await d.getByRole('option', { name: 'Viaje Cusco' }).click()
    await expect(campo).toHaveValue('Viaje Cusco')
    await expect(d.getByRole('combobox', { name: 'Concepto del evento (opcional)' })).toHaveCount(0) // evento sin conceptos
  })

  test('detalles adicionales: cerrados por defecto, conservan el archivo al plegar y se abren si hay un dato guardado', async ({ page }) => {
    await iniciarSesion(page)
    const d = await abrir(page)
    await expect(d.getByLabel('Notas (opcional)')).toBeHidden()
    await d.getByText('Detalles adicionales').click()
    await d.getByLabel('Comprobante').setInputFiles({ name: 'recibo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') })
    await d.getByText('Detalles adicionales').click()
    await expect(d.getByText('comprobante', { exact: true })).toBeVisible() // el resumen avisa que hay un archivo
    await d.getByText('Detalles adicionales').click()
    expect(await d.getByLabel('Comprobante').evaluate((i: HTMLInputElement) => i.files?.length)).toBe(1)
  })

  test('sin desborde horizontal de 320 a 1920 px y con el pie siempre visible', async ({ page }) => {
    await iniciarSesion(page)
    for (const [w, h] of [[320, 640], [360, 740], [390, 844], [428, 926], [600, 900], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h })
      const d = await abrir(page)
      await elegirEnGasto(d, 'Ámbito', 'Personal')
      await d.getByRole('radio', { name: 'US$ USD' }).click()
      const m = await page.evaluate(() => ({ pagina: document.documentElement.scrollWidth - innerWidth, dialogo: (() => { const e = document.querySelector('[role="dialog"]') as HTMLElement; return e.scrollWidth - e.clientWidth })() }))
      expect(m.pagina, `página a ${w}px`).toBeLessThanOrEqual(0)
      expect(m.dialogo, `diálogo a ${w}px`).toBeLessThanOrEqual(0)
      await expect(d.getByRole('button', { name: 'Guardar gasto' })).toBeInViewport()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Descartar cambios' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })
})
