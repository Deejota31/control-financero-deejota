import AxeBuilder from '@axe-core/playwright'
import { type Locator, type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { accionPlantilla, elegirEnGasto, email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

/**
 * Multimoneda USD/PEN. La función de borde se simula en el navegador, pero escribe en la caché real de la base (igual que la verdadera),
 * de modo que la validación del servidor —que solo acepta cotizaciones automáticas coincidentes— se ejerce de verdad.
 */
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const FUENTE = 'E2E:SIMULADA'
const TASA_INICIAL = '3.45'

let consultas: string[] = []
let proveedor: 'ok' | 'caido' = 'ok'
let tasa = TASA_INICIAL // lo que «publica» el proveedor simulado

async function simularProveedor(page: Page) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }
  await page.route('**/functions/v1/exchange-rate', async (route) => {
    const peticion = route.request()
    if (peticion.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (proveedor === 'caido') return route.fulfill({ status: 503, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'BCRP no está disponible.' }) })
    const { date } = peticion.postDataJSON() as { date: string }
    consultas.push(date)
    sqlLocal(`insert into public.exchange_rate_quotes(date_requested, rate, reference_date, source, fetched_at) values ('${date}', ${tasa}, '${date}'::date - 2, '${FUENTE}', now())
      on conflict (date_requested) do update set rate = excluded.rate, reference_date = excluded.reference_date, source = excluded.source, fetched_at = excluded.fetched_at`)
    const fila = sqlLocal(`select rate::float8 || '|' || reference_date || '|' || fetched_at from public.exchange_rate_quotes where date_requested = '${date}'`).split('|')
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ date_requested: date, rate: fila[0], reference_date: fila[1], source: FUENTE, fetched_at: new Date(fila[2]).toISOString() }) })
  })
}

/** Cierra el formulario con Escape; como tiene datos sin guardar, confirma el descarte. */
async function cerrarDescartando(page: Page) {
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Descartar cambios' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function abrirNuevoGasto(page: Page) {
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Nuevo gasto' }).click()
  return page.getByRole('dialog')
}

async function clasificar(dialogo: Locator, descripcion: string) {
  await elegirEnGasto(dialogo, 'Ámbito', 'Personal')
  await elegirEnGasto(dialogo, 'Categoría', 'Alimentación')
  await elegirEnGasto(dialogo, 'Subcategoría (opcional)', 'Comidas fuera')
  await elegirEnGasto(dialogo, 'Medio de pago', 'Yape')
  await dialogo.getByLabel('Descripción', { exact: true }).fill(descripcion)
}

const gastoSql = (descripcion: string) => sqlLocal(`select concat_ws('|', original_currency, original_amount, amount, rtrim(rtrim(exchange_rate::text, '0'), '.'), conversion_method, exchange_rate_source) from public.expenses where household_id = ${HID} and description = '${descripcion}'`)
const nGastos = (descripcion: string) => Number(sqlLocal(`select count(*) from public.expenses where household_id = ${HID} and description = '${descripcion}'`))
const imputado = (descripcion: string) => Number(sqlLocal(`select coalesce(sum(a.amount), 0) from public.expense_fund_allocations a join public.expenses e on e.id = a.expense_id where e.household_id = ${HID} and e.description = '${descripcion}'`))

test.describe('Multimoneda USD/PEN', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(async ({ page }) => { consultas = []; proveedor = 'ok'; tasa = TASA_INICIAL; await simularProveedor(page) })
  test.afterAll(() => { sqlLocal(`delete from public.exchange_rate_quotes where source = '${FUENTE}'`) })

  test('PEN no muestra controles de conversión, no consulta cotizaciones y admite importes con coma', async ({ page }) => {
    const errores = vigilarConsola(page)
    const nombre = `Pan ${sufijo()}`
    await iniciarSesion(page)
    const dialogo = await abrirNuevoGasto(page)
    await expect(dialogo.getByRole('radio', { name: 'S/ PEN' })).toHaveAttribute('aria-checked', 'true')
    await expect(dialogo.getByRole('radiogroup', { name: 'Método de conversión' })).toHaveCount(0)
    await dialogo.getByLabel('Importe', { exact: true }).fill('12,5')
    await clasificar(dialogo, nombre)
    await expect(dialogo.getByText(/Se guardará/)).toContainText('S/ 12.50')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(gastoSql(nombre)).toBe(`PEN|12.50|12.50|1|none|identity`)
    expect(consultas).toEqual([])
    expect(errores).toEqual([])
  })

  test('USD automático: muestra tasa, fuente y equivalente; guarda original + PEN y los fondos descuentan soles una sola vez', async ({ page }) => {
    const errores = vigilarConsola(page)
    const nombre = `Suscripción IA ${sufijo()}`
    await iniciarSesion(page)
    const dialogo = await abrirNuevoGasto(page)
    await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('10.00')
    await clasificar(dialogo, nombre)
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 34.50')
    await expect(dialogo.getByText('1 USD = S/ 3.4500')).toBeVisible()
    await expect(dialogo.getByText(/referencia del/)).toBeVisible() // la cotización es de dos días antes: se dice
    await expect(dialogo.getByText(/Se guardará/)).toContainText('S/ 34.50')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(gastoSql(nombre)).toBe(`USD|10.00|34.50|3.45|automatic|${FUENTE}`)
    expect(nGastos(nombre)).toBe(1)
    expect(imputado(nombre)).toBe(34.5)
    // El listado ordena y suma por soles y muestra el original discretamente.
    const fila = page.getByRole('row').filter({ hasText: nombre })
    await expect(fila).toContainText('S/ 34.50')
    await expect(fila).toContainText('US$ 10.00')
    // El detalle explica la conversión.
    await fila.getByRole('button', { name: `Ver detalle de ${nombre}` }).click()
    const detalle = page.getByRole('dialog', { name: nombre })
    await expect(detalle.getByText('Conversión a soles')).toBeVisible()
    await expect(detalle).toContainText('US$ 10.00')
    await expect(detalle).toContainText('Automático')
    await expect(detalle).toContainText('El importe en soles queda fijo')
    expect(errores).toEqual([])
  })

  test('USD con tasa personalizada: US$ 20 × 3.52 = S/ 70.40, sin pisar la tasa escrita', async ({ page }) => {
    const nombre = `Tasa manual ${sufijo()}`
    await iniciarSesion(page)
    const dialogo = await abrirNuevoGasto(page)
    await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('20')
    await clasificar(dialogo, nombre)
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 69.00') // 20 × 3.45 automático
    await dialogo.getByRole('radio', { name: 'Personalizado' }).click()
    const tasa = dialogo.getByLabel('Tipo de cambio USD/PEN')
    await expect(tasa).toHaveValue('3.4500') // parte de la tasa que se estaba viendo
    await tasa.fill('3,52')
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 70.40')
    await expect(dialogo.getByLabel('Importe', { exact: true })).toHaveValue('20.00')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(gastoSql(nombre)).toBe('USD|20.00|70.40|3.52|manual|Usuario')
    expect(imputado(nombre)).toBe(70.4)
  })

  test('USD con cargo exacto en soles: el cargo manda y la tasa efectiva se calcula', async ({ page }) => {
    const nombre = `Cargo exacto ${sufijo()}`
    await iniciarSesion(page)
    const dialogo = await abrirNuevoGasto(page)
    await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('10')
    await clasificar(dialogo, nombre)
    await dialogo.getByRole('radio', { name: 'Cargo exacto' }).click()
    await dialogo.getByLabel('Cargo exacto en soles').fill('35,80')
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 35.80')
    await expect(dialogo.getByText('1 USD = S/ 3.5800')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(gastoSql(nombre)).toBe('USD|10.00|35.80|3.58|exact|Usuario')
    expect(nGastos(nombre)).toBe(1) // el cargo no es un segundo gasto
    expect(imputado(nombre)).toBe(35.8)
  })

  test('proveedor caído: no se inventa una tasa, el PEN sigue funcionando y se puede usar tasa manual', async ({ page }) => {
    proveedor = 'caido'
    const nombre = `Sin proveedor ${sufijo()}`
    await iniciarSesion(page)
    const dialogo = await abrirNuevoGasto(page)
    await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('10')
    await clasificar(dialogo, nombre)
    await expect(dialogo.getByText(/No se pudo consultar la cotización/)).toBeVisible()
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('—')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(dialogo.getByText('Completa una conversión válida antes de guardar.')).toBeVisible()
    expect(nGastos(nombre)).toBe(0)
    // El proveedor vuelve: «Consultar de nuevo» recupera la cotización sin cerrar el formulario.
    proveedor = 'ok'
    await dialogo.getByRole('button', { name: 'Consultar de nuevo' }).click()
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 34.50')
    // Y sin proveedor se puede guardar igual con una tasa personalizada.
    proveedor = 'caido'
    await dialogo.getByRole('radio', { name: 'Personalizado' }).click()
    await dialogo.getByLabel('Tipo de cambio USD/PEN').fill('3.40')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(gastoSql(nombre)).toBe('USD|10.00|34.00|3.4|manual|Usuario')
  })

  test('editar un gasto USD conserva su conversión aunque la cotización de hoy haya cambiado', async ({ page }) => {
    const nombre = `Editable ${sufijo()}`
    await iniciarSesion(page)
    let dialogo = await abrirNuevoGasto(page)
    await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('10')
    await clasificar(dialogo, nombre)
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 34.50')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    // El dólar «sube» en la caché: el gasto histórico no debe moverse.
    sqlLocal(`update public.exchange_rate_quotes set rate = 3.60 where source = '${FUENTE}'`)
    consultas = []
    await page.getByRole('row').filter({ hasText: nombre }).getByRole('button', { name: `Editar ${nombre}` }).click()
    dialogo = page.getByRole('dialog')
    await expect(dialogo.getByRole('radio', { name: 'US$ USD' })).toHaveAttribute('aria-checked', 'true')
    await expect(dialogo.getByLabel('Importe', { exact: true })).toHaveValue('10.00')
    await expect(dialogo.getByText('1 USD = S/ 3.4500')).toBeVisible()
    await expect(dialogo.getByText(/conservada/)).toBeVisible()
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 34.50')
    expect(consultas).toEqual([]) // abrir la edición no consulta nada
    // Cambiar solo el importe usa la tasa congelada: 15 × 3.45 = 51.75
    await dialogo.getByLabel('Importe', { exact: true }).fill('15')
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 51.75')
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Gasto actualizado.')).toBeVisible()
    expect(gastoSql(nombre)).toBe(`USD|15.00|51.75|3.45|automatic|${FUENTE}`)
    expect(imputado(nombre)).toBe(51.75)
    // Pasarlo a PEN y volver a editar deja la identidad.
    await page.getByRole('row').filter({ hasText: nombre }).getByRole('button', { name: `Editar ${nombre}` }).click()
    dialogo = page.getByRole('dialog')
    await dialogo.getByRole('radio', { name: 'S/ PEN' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('50')
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Gasto actualizado.').last()).toBeVisible()
    expect(gastoSql(nombre)).toBe('PEN|50.00|50.00|1|none|identity')
  })

  test('clonar un gasto USD conserva moneda e importe, pero consulta una cotización nueva', async ({ page }) => {
    const nombre = `Clonable ${sufijo()}`
    await iniciarSesion(page)
    const dialogo = await abrirNuevoGasto(page)
    await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('10')
    await clasificar(dialogo, nombre)
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    tasa = '3.60' // el dólar sube: la próxima consulta devuelve otra tasa
    consultas = []
    await page.reload()
    await page.getByRole('row').filter({ hasText: nombre }).getByRole('button', { name: `Clonar ${nombre}` }).click()
    const copia = page.getByRole('dialog')
    await expect(copia.getByRole('radio', { name: 'US$ USD' })).toHaveAttribute('aria-checked', 'true')
    await expect(copia.getByLabel('Importe', { exact: true })).toHaveValue('10.00')
    await expect.poll(() => consultas.length).toBeGreaterThan(0) // el clon no hereda la tasa del original
    await expect(copia.locator('[data-equivalente]')).toHaveText('S/ 36.00')
  })

  test('plantilla en USD: guarda moneda e importe, nunca una tasa; al registrar usa la cotización de su fecha', async ({ page }) => {
    sqlLocal(`update public.expense_templates set original_currency = 'USD', default_amount = 20 where household_id = ${HID} and name = 'Internet'`)
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await accionPlantilla(page, 'Internet', 'Registrar solo esta')
    const f = page.getByRole('dialog', { name: 'Registrar gasto', exact: true })
    await expect(f.getByRole('radio', { name: 'US$ USD' })).toHaveAttribute('aria-checked', 'true')
    await expect(f.getByLabel('Importe', { exact: true })).toHaveValue('20.00')
    await expect(f.locator('[data-equivalente]')).toHaveText('S/ 69.00')
    await f.getByRole('button', { name: 'Confirmar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(sqlLocal(`select concat_ws('|', original_currency, original_amount, amount, conversion_method) from public.expenses where household_id = ${HID} and template_id = (select id from public.expense_templates where household_id = ${HID} and name = 'Internet')`)).toBe('USD|20.00|69.00|automatic')
    expect(sqlLocal(`select concat_ws('|', original_currency, default_amount) from public.expense_templates where household_id = ${HID} and name = 'Internet'`)).toBe('USD|20.00')
  })

  test('registro por lote de plantillas en USD: totales en soles y una cotización por fecha', async ({ page }) => {
    sqlLocal(`update public.expense_templates set original_currency = 'USD', default_amount = 20 where household_id = ${HID} and name = 'Internet'`)
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await page.getByRole('checkbox', { name: 'Seleccionar Internet', exact: true }).check()
    const pie = page.locator('p.mr-auto').filter({ hasText: 'seleccionada' })
    await expect(pie).toContainText('S/ 69.00')
    await expect(page.getByText('≈ S/ 69.00')).toBeVisible()
    await page.getByRole('button', { name: /Revisar y registrar 1 gasto/ }).click()
    const revision = page.getByRole('dialog', { name: 'Confirmar registro de gastos' })
    await expect(revision).toContainText('US$ 20.00 ≈ S/ 69.00')
    await revision.getByRole('button', { name: /Registrar 1 gasto/ }).click()
    await expect(page.getByText(/Se registró 1 gasto por S\/ 69\.00/)).toBeVisible()
    expect(sqlLocal(`select concat_ws('|', original_amount, amount, conversion_method) from public.expenses where household_id = ${HID} and template_id = (select id from public.expense_templates where household_id = ${HID} and name = 'Internet')`)).toBe('20.00|69.00|automatic')
  })

  test('responsive: el formulario en USD no desborda ni corta el equivalente ni el pie en 320–1440 px', async ({ page }) => {
    await iniciarSesion(page)
    for (const [ancho, alto] of [[320, 640], [375, 812], [390, 844], [768, 1024], [1440, 900]] as const) {
      await page.setViewportSize({ width: ancho, height: alto })
      const dialogo = await abrirNuevoGasto(page)
      await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
      await dialogo.getByLabel('Importe', { exact: true }).fill('10')
      await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 34.50')
      await dialogo.getByRole('radio', { name: 'Cargo exacto' }).click()
      await expect(dialogo.getByLabel('Cargo exacto en soles')).toBeVisible()
      const medidas = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]') as HTMLElement
        const conv = d.querySelector('[data-conversion]') as HTMLElement
        const r = conv.getBoundingClientRect()
        return { pagina: document.documentElement.scrollWidth - window.innerWidth, dialogo: d.scrollWidth - d.clientWidth, convIzq: r.left, convDer: r.right, ancho: window.innerWidth }
      })
      expect(medidas.pagina, `desborde de página a ${ancho}px`).toBeLessThanOrEqual(0)
      expect(medidas.dialogo, `desborde del diálogo a ${ancho}px`).toBeLessThanOrEqual(0)
      expect(medidas.convIzq).toBeGreaterThanOrEqual(0)
      expect(medidas.convDer).toBeLessThanOrEqual(medidas.ancho)
      // Cada control de la conversión mide al menos 36 px de alto (objetivo táctil).
      for (const radio of await dialogo.getByRole('radio', { name: /Automático|Personalizado|Cargo exacto/ }).all()) expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(36)
      await expect(dialogo.getByRole('button', { name: 'Guardar gasto' })).toBeInViewport()
      await cerrarDescartando(page)
    }
  })

  test('accesible en tema claro y oscuro (axe) con el panel de conversión abierto', async ({ page }) => {
    await iniciarSesion(page)
    for (const tema of ['claro', 'oscuro'] as const) {
      const actual = await page.locator('html').getAttribute('data-theme')
      if ((tema === 'oscuro') !== (actual === 'dark')) {
        await page.getByRole('switch', { name: /Cambiar a tema/ }).filter({ visible: true }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light')
      }
      const dialogo = await abrirNuevoGasto(page)
      await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
      await dialogo.getByLabel('Importe', { exact: true }).fill('10')
      await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 34.50')
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))
      const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze()
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe en tema ${tema}`).toEqual([])
      await cerrarDescartando(page)
    }
  })

  test('eventos: un concepto y un compromiso en USD se planifican en soles y el pago real usa su propia conversión', async ({ page }) => {
    const errores = vigilarConsola(page)
    const id = sqlLocal(`insert into public.events(household_id, user_id, name, target_date, budget) values (${HID}, '${E2E_UID}', 'Fiesta USD', current_date + 30, 1000) returning id`).split(/\s/)[0]
    await iniciarSesion(page)
    await page.goto(`/eventos/${id}`)
    const secciones = page.getByRole('group', { name: 'Secciones del evento' })
    await secciones.getByRole('button', { name: 'Planificación', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo concepto', exact: true }).click()
    let dlg = page.getByRole('dialog')
    await dlg.getByLabel('Concepto', { exact: true }).fill('Decoración importada')
    await dlg.getByRole('radio', { name: 'US$ USD' }).click()
    await dlg.getByLabel('Presupuesto del concepto', { exact: true }).fill('100')
    await dlg.getByRole('radio', { name: 'Personalizado' }).click()
    await dlg.getByLabel('Tipo de cambio USD/PEN').fill('3.40')
    await expect(dlg.locator('[data-equivalente]')).toHaveText('S/ 340.00')
    await dlg.getByRole('button', { name: 'Guardar concepto', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Decoración importada', exact: true })).toBeVisible()
    await expect(page.getByText('US$ 100.00 · estimado S/ 340.00', { exact: false })).toBeVisible()
    expect(sqlLocal(`select concat_ws('|', original_currency, original_amount, planned_amount, conversion_method) from public.event_items where event_id = '${id}'`)).toBe('USD|100.00|340.00|manual')
    await secciones.getByRole('button', { name: 'Compromisos', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo compromiso', exact: true }).click()
    dlg = page.getByRole('dialog')
    await dlg.getByLabel('Concepto contratado').fill('Torta')
    await dlg.getByRole('radio', { name: 'US$ USD' }).click()
    await dlg.getByLabel('Importe contratado', { exact: true }).fill('50')
    await expect(dlg.locator('[data-equivalente]')).toHaveText('S/ 172.50') // cotización automática de hoy: 50 × 3.45
    await dlg.getByRole('button', { name: 'Guardar compromiso', exact: true }).click()
    await expect(page.getByText('US$ 50.00 · estimado S/ 172.50', { exact: false })).toBeVisible()
    expect(sqlLocal(`select concat_ws('|', original_currency, original_amount, contracted_amount, conversion_method) from public.event_commitments where event_id = '${id}'`)).toBe('USD|50.00|172.50|automatic')
    // El pendiente del evento está en soles y no se mezcla con los dólares.
    expect(Number(sqlLocal(`select pending from public.event_metrics where id = '${id}'`))).toBe(172.5)
    expect(errores).toEqual([])
  })

  test('el Dashboard y la proyección consolidan en soles (nunca suman dólares como soles)', async ({ page }) => {
    const nombre = `Consolidado ${sufijo()}`
    await iniciarSesion(page)
    const total = () => Number(sqlLocal(`select coalesce(sum(amount), 0) from public.expenses where household_id = ${HID} and status = 'active' and expense_date >= date_trunc('month', current_date)`))
    const antes = total()
    const dialogo = await abrirNuevoGasto(page)
    await dialogo.getByRole('radio', { name: 'US$ USD' }).click()
    await dialogo.getByLabel('Importe', { exact: true }).fill('1000')
    await clasificar(dialogo, nombre)
    await expect(dialogo.locator('[data-equivalente]')).toHaveText('S/ 3,450.00')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(total() - antes).toBeCloseTo(3450, 2) // 1000 US$ aportan 3 450 soles, no 1 000
    // La RPC del Dashboard devuelve el mismo total del mes.
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    const esperado = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total())
    await expect(page.getByText(`S/ ${esperado}`).first()).toBeVisible()
  })
})
