import AxeBuilder from '@axe-core/playwright'
import { type Locator, type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { accionPlantilla, accionPlantillaFondo, elegir, email, filaPlantilla, filaPlantillaFondo, iniciarSesion, password } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const ACT = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD')`)
const SIG = sqlLocal(`select to_char(date_trunc('month', current_date) + interval '1 month', 'YYYY-MM-DD')`)
const MES = ACT.slice(0, 7)
const periodo = (mes: string) => `(select id from public.budget_periods where household_id = ${HID} and start_date = '${mes}')`
const num = (sql: string) => Number(sqlLocal(sql))
const nGastos = () => num(`select count(*) from public.expenses where household_id = ${HID}`)
const nFondos = (mes: string) => num(`select count(*) from public.funds where period_id = ${periodo(mes)}`)
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

function plantillaFondoSql(nombre: string, importe: number, o: { ambito?: string; general?: boolean; prioridad?: number; grupo?: string } = {}) {
  const id = sqlLocal(`insert into public.fund_templates (household_id, name, is_general, suggested_amount, priority, icon_key, color_token, group_name) values (${HID}, '${nombre}', ${o.general ? 'true' : 'false'}, ${importe}, ${o.prioridad ?? 100}, 'wallet', 'c1', ${o.grupo ? `'${o.grupo}'` : 'null'}) returning id`).split('\n')[0].trim()
  if (o.ambito) sqlLocal(`insert into public.fund_template_scope_rules (household_id, template_id, ambito_id, effect) select ${HID}, '${id}', id, 'include' from public.ambitos where household_id = ${HID} and name = '${o.ambito}'`)
  return id
}

/** Elige un día en el calendario del selector de fecha indicado (el calendario abre en el mes de la fecha actual del control). */
async function elegirFecha(page: Page, selector: Locator, iso: string) {
  await selector.click()
  await page.locator(`[role="gridcell"][data-date="${iso}"]`).click()
}

async function abrirGestor(page: Page) {
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Plantillas' }).click()
  await expect(page.getByRole('dialog', { name: 'Plantillas mensuales' })).toBeVisible()
  return page.getByRole('dialog', { name: 'Plantillas mensuales' })
}
const orden = (page: Page, seccion: string) => page.getByRole('region', { name: seccion, exact: true }).locator('[data-plantilla]').evaluateAll((els) => els.map((e) => e.querySelector('input[aria-label^="Seleccionar "]')!.getAttribute('aria-label')!.replace('Seleccionar ', '')))
const resumen = (g: Locator) => g.locator('p[aria-live="polite"]').last()

test.describe('Gestor de plantillas de gastos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('secciones por categoría reales del catálogo, con selección individual, por sección y de visibles (estado indeterminado)', async ({ page }) => {
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    for (const s of ['Servicios', 'Educación', 'Ocio']) await expect(g.getByRole('region', { name: s, exact: true })).toBeVisible()
    await expect(g.getByRole('region', { name: 'Servicios', exact: true }).locator('[data-plantilla]')).toHaveCount(3)

    await g.getByLabel('Seleccionar Internet', { exact: true }).check()
    await expect(resumen(g)).toContainText('1 seleccionada')
    const seccion = g.getByLabel('Seleccionar sección Servicios')
    expect(await seccion.evaluate((e: HTMLInputElement) => e.indeterminate)).toBe(true) // solo algunas de la sección
    await seccion.check()
    await expect(resumen(g)).toContainText('3 seleccionadas')
    expect(await seccion.evaluate((e: HTMLInputElement) => e.indeterminate)).toBe(false)
    await seccion.uncheck()
    await expect(resumen(g)).toContainText('0 seleccionadas')

    await g.getByRole('button', { name: 'Seleccionar visibles' }).click()
    await expect(resumen(g)).toContainText('5 seleccionadas')
    await g.getByRole('button', { name: 'Deseleccionar todas' }).click()
    await expect(resumen(g)).toContainText('0 seleccionadas')
  })

  test('filtrar no pierde las selecciones y «Seleccionar visibles» solo toca lo que se ve', async ({ page }) => {
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    await g.getByLabel('Seleccionar Internet', { exact: true }).check()
    await g.getByLabel('Buscar plantilla').fill('Agua')
    await expect(g.locator('[data-plantilla]')).toHaveCount(1) // la búsqueda expande y muestra solo lo relevante
    await expect(resumen(g)).toContainText('1 oculta por filtros')
    await g.getByRole('button', { name: 'Seleccionar visibles' }).click()
    await expect(resumen(g)).toContainText('2 seleccionadas')
    await g.getByLabel('Buscar plantilla').fill('')
    await expect(g.getByLabel('Seleccionar Internet', { exact: true })).toBeChecked() // la selección sobrevivió al filtro
    await expect(g.getByLabel('Seleccionar Agua', { exact: true })).toBeChecked()
    await expect(g.getByLabel('Seleccionar Streaming', { exact: true })).not.toBeChecked() // lo oculto nunca entró en «visibles»
    // Contraer una sección no pierde su selección
    await g.getByRole('button', { name: /^Servicios/, expanded: true }).click()
    await expect(g.getByRole('region', { name: 'Servicios', exact: true }).locator('[data-plantilla]')).toHaveCount(0)
    await expect(resumen(g)).toContainText('2 seleccionadas')
  })

  test('edición inline (importe, medio y fechas) solo vale para el registro: se registran varias y la plantilla no cambia', async ({ page }) => {
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    const antes = nGastos()
    await g.getByLabel('Importe de Internet').fill('130.50')
    await elegir(page, g.getByRole('combobox', { name: 'Medio de pago de Internet' }), 'Plin')
    await g.getByLabel('Importe de Streaming').fill('50')
    await expect(resumen(g)).toContainText('2 seleccionadas') // editar un valor selecciona la fila
    await expect(resumen(g)).toContainText('S/ 180.50')

    // La fecha se edita en la propia fila: sugerida por plantilla (día 6 de Internet) y cambiable por fila sin afectar a las demás
    await expect(g.getByLabel('Fecha de Internet')).toContainText(`06/${MES.slice(5)}`)
    await expect(g.getByText('Fecha general')).toHaveCount(0) // ya no existe el bloque de fecha general
    await elegirFecha(page, g.getByLabel('Fecha de Streaming'), `${MES}-20`)
    await elegirFecha(page, g.getByLabel('Fecha de Internet'), `${MES}-12`)
    await expect(g.getByLabel('Fecha de Streaming')).toContainText(`20/${MES.slice(5)}`)

    await g.getByRole('button', { name: /Revisar y registrar 2 gastos/ }).click()
    const rev = page.getByRole('dialog', { name: 'Confirmar registro de gastos' })
    await expect(rev.getByText('Válido').first()).toBeVisible()
    expect(nGastos()).toBe(antes) // la revisión no crea nada
    await rev.getByRole('button', { name: 'Registrar 2 gastos' }).click()
    await expect(page.getByText(/Se registraron 2 gastos por S\/ 180\.50/)).toBeVisible()
    await expect.poll(() => nGastos()).toBe(antes + 2)
    expect(sqlLocal(`select e.expense_date || '|' || e.amount || '|' || m.name from public.expenses e join public.medios_pago m on m.id = e.payment_method_id where e.household_id = ${HID} and e.template_id = (select id from public.expense_templates where household_id = ${HID} and name = 'Internet')`)).toBe(`${MES}-12|130.50|Plin`)
    // Las plantillas conservan su configuración original
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = 'Internet'`)).toBe(120)
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = 'Streaming'`)).toBe(45)
    await expect(resumen(g)).toContainText('0 seleccionadas')
    // Seleccionar de nuevo una ya registrada avisa de un posible duplicado (sin bloquear)
    await g.getByLabel('Seleccionar Internet', { exact: true }).check()
    await expect(filaPlantilla(page, 'Internet')).toContainText('Registrada')
    await g.getByRole('button', { name: /Revisar y registrar 1 gasto/ }).click()
    await expect(page.getByRole('dialog', { name: 'Confirmar registro de gastos' }).getByText(/Posible duplicado/)).toBeVisible()
    await page.getByRole('button', { name: 'Volver' }).click()
    expect(nGastos()).toBe(antes + 2)
  })

  test('importe variable exige confirmación, nunca se asume cero y no se llega a la revisión con datos pendientes', async ({ page }) => {
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    await g.getByLabel('Seleccionar Recibo de luz', { exact: true }).check()
    await expect(filaPlantilla(page, 'Recibo de luz')).toContainText('Revisar importe')
    await g.getByRole('button', { name: /Revisar y registrar 1 gasto/ }).click()
    await expect(filaPlantilla(page, 'Recibo de luz').getByRole('alert')).toContainText('Revisa y confirma el importe')
    await expect(page.getByRole('dialog', { name: 'Confirmar registro de gastos' })).toHaveCount(0)
    await g.getByLabel('Importe de Recibo de luz').fill('')
    await g.getByRole('button', { name: /Revisar y registrar 1 gasto/ }).click()
    await expect(filaPlantilla(page, 'Recibo de luz').getByRole('alert')).toContainText(/importe/i) // vacío no es cero
    await g.getByLabel('Importe de Recibo de luz').fill('55.20')
    await expect(filaPlantilla(page, 'Recibo de luz')).not.toContainText('Revisar importe')
    await g.getByRole('button', { name: /Revisar y registrar 1 gasto/ }).click()
    await expect(page.getByRole('dialog', { name: 'Confirmar registro de gastos' })).toBeVisible()
  })

  test('«Actualizar plantilla con estos valores» pide confirmación y es la única forma de cambiar la configuración original', async ({ page }) => {
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    await g.getByLabel('Importe de Internet').fill('99')
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = 'Internet'`)).toBe(120)
    await accionPlantilla(page, 'Internet', 'Actualizar plantilla con estos valores')
    const c = page.getByRole('alertdialog')
    await expect(c).toContainText('S/ 120.00')
    await expect(c).toContainText('S/ 99.00')
    await c.getByRole('button', { name: 'Cancelar' }).click()
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = 'Internet'`)).toBe(120) // cancelar no cambia nada
    await accionPlantilla(page, 'Internet', 'Actualizar plantilla con estos valores')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Actualizar plantilla' }).click()
    await expect(page.getByText('Plantilla actualizada.')).toBeVisible()
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = 'Internet'`)).toBe(99)
  })

  test('orden manual: subir/bajar y arrastrar cambian solo el orden, persisten y no tocan la clasificación; agrupar persiste', async ({ page }) => {
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    expect(await orden(page, 'Servicios')).toEqual(['Recibo de luz', 'Internet', 'Agua'])
    const claseAntes = sqlLocal(`select ambito_id::text || categoria_id::text from public.expense_templates where household_id = ${HID} and name = 'Recibo de luz'`)
    await accionPlantilla(page, 'Recibo de luz', 'Bajar en la sección')
    await expect.poll(() => orden(page, 'Servicios')).toEqual(['Internet', 'Recibo de luz', 'Agua'])
    // Arrastrar «Agua» antes de «Internet»
    await filaPlantilla(page, 'Agua').dragTo(filaPlantilla(page, 'Internet'))
    await expect.poll(() => orden(page, 'Servicios')).toEqual(['Agua', 'Internet', 'Recibo de luz'])
    expect(sqlLocal(`select ambito_id::text || categoria_id::text from public.expense_templates where household_id = ${HID} and name = 'Recibo de luz'`)).toBe(claseAntes) // orden visual ≠ clasificación
    // Persistencia: al reabrir el gestor el orden se conserva
    await page.reload()
    await page.getByRole('button', { name: 'Plantillas' }).click()
    expect(await orden(page, 'Servicios')).toEqual(['Agua', 'Internet', 'Recibo de luz'])
    // Con otro criterio de orden el arrastre se desactiva
    await elegir(page, page.getByRole('combobox', { name: 'Orden', exact: true }), 'Orden por nombre')
    await expect(filaPlantilla(page, 'Agua')).toHaveAttribute('draggable', 'false')
    // La agrupación elegida se recuerda
    await elegir(page, page.getByRole('combobox', { name: 'Agrupación', exact: true }), 'Agrupar por tipo (fijo / variable)')
    await expect(page.getByRole('region', { name: 'Gastos fijos', exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await expect(page.getByRole('region', { name: 'Gastos fijos', exact: true })).toBeVisible()
    await expect(g).toBeVisible()
  })
})

test.describe('Gestor de plantillas de fondos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(() => sqlLocal(`delete from public.funds where period_id = ${periodo(SIG)}`))

  test('secciones por tipo y por grupo propio, orden manual y prioridad propuesta editable que no toca la plantilla', async ({ page }) => {
    await iniciarSesion(page)
    plantillaFondoSql('General G', 3000, { general: true })
    plantillaFondoSql('Sodexo G', 280, { ambito: 'Trabajo', prioridad: 10, grupo: 'Trabajo y estudio' })
    plantillaFondoSql('Pareja G', 200, { ambito: 'Familia', prioridad: 20, grupo: 'Familia' })
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Plantillas de fondos' }).click()
    const b = page.getByRole('dialog', { name: 'Plantillas de fondos' })
    await elegir(page, b.getByRole('combobox', { name: 'Agrupación de plantillas de fondos' }), 'Agrupar por tipo (General / específico)')
    await expect(b.getByRole('region', { name: 'Fondos generales', exact: true })).toBeVisible()
    await expect(b.getByRole('region', { name: 'Fondos específicos', exact: true }).locator('[data-plantilla-fondo]')).toHaveCount(2)
    await elegir(page, b.getByRole('combobox', { name: 'Agrupación de plantillas de fondos' }), 'Agrupar por grupo propio')
    for (const s of ['Trabajo y estudio', 'Familia', 'Sin grupo']) await expect(b.getByRole('region', { name: s, exact: true })).toBeVisible()
    await elegir(page, b.getByRole('combobox', { name: 'Agrupación de plantillas de fondos' }), 'Sin secciones')

    // Orden manual: cambia solo la posición visual, nunca la prioridad financiera
    await accionPlantillaFondo(page, 'Sodexo G', 'Bajar en la lista')
    await expect.poll(() => sqlLocal(`select name from public.fund_templates where household_id = ${HID} and not is_general order by sort_order limit 1`)).toBe('Pareja G')
    expect(num(`select priority from public.fund_templates where household_id = ${HID} and name = 'Sodexo G'`)).toBe(10)

    // Prioridad propuesta e importe: valen para el fondo del mes, la plantilla conserva los suyos
    await b.getByLabel('Importe de Sodexo G').fill('310')
    await b.getByLabel('Prioridad propuesta de Sodexo G').fill('5')
    await expect(b.getByText(/la plantilla conserva S\/ 280\.00 y prioridad 10/)).toBeVisible()
    await b.getByRole('button', { name: 'Aplicar 1 plantilla' }).click()
    await expect(page.getByText('Se creó 1 fondo.')).toBeVisible()
    expect(num(`select priority from public.funds where period_id = ${periodo(SIG)} and name = 'Sodexo G'`)).toBe(5)
    expect(num(`select b.assigned_amount from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where f.period_id = ${periodo(SIG)} and f.name = 'Sodexo G'`)).toBe(310)
    expect(num(`select suggested_amount from public.fund_templates where household_id = ${HID} and name = 'Sodexo G'`)).toBe(280)
    expect(num(`select priority from public.fund_templates where household_id = ${HID} and name = 'Sodexo G'`)).toBe(10)
    await expect(filaPlantillaFondo(page, 'Sodexo G')).toContainText('Aplicada')
    expect(nFondos(SIG)).toBe(1)

    // Actualizar la plantilla con estos valores es explícito y confirmado
    await b.getByLabel('Importe de Pareja G').fill('250')
    await accionPlantillaFondo(page, 'Pareja G', 'Actualizar plantilla con estos valores')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Actualizar plantilla' }).click()
    await expect(page.getByText('Plantilla actualizada.')).toBeVisible()
    expect(num(`select suggested_amount from public.fund_templates where household_id = ${HID} and name = 'Pareja G'`)).toBe(250)
  })
})

for (const ancho of [320, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1920]) {
  test(`gestores responsive ${ancho}px: sin desbordes, con selección, edición y acción principal accesibles`, async ({ page }) => {
    test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
    await page.setViewportSize({ width: ancho, height: 800 })
    await iniciarSesion(page)
    plantillaFondoSql('Resp G', 100, { ambito: 'Hogar' })
    const g = await abrirGestor(page)
    await g.getByLabel('Seleccionar Internet', { exact: true }).check()
    for (const c of [g.getByLabel('Importe de Internet'), g.getByLabel('Fecha de Internet'), g.getByRole('combobox', { name: 'Medio de pago de Internet' })]) {
      await c.scrollIntoViewIfNeeded()
      await expect(c).toBeInViewport()
    }
    await expect(g.getByRole('button', { name: /Revisar y registrar 1 gasto/ })).toBeInViewport()
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
    // Ningún control de la fila queda cortado por el borde del diálogo
    const caja = (await g.boundingBox())!
    for (const c of [g.getByLabel('Importe de Internet'), g.getByRole('combobox', { name: 'Medio de pago de Internet' }), g.getByLabel('Fecha de Internet')]) {
      const b = (await c.boundingBox())!
      expect(b.x).toBeGreaterThanOrEqual(caja.x - 1)
      expect(b.x + b.width).toBeLessThanOrEqual(caja.x + caja.width + 1)
    }
    await page.keyboard.press('Escape')
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Plantillas de fondos' }).click()
    const f = page.getByRole('dialog', { name: 'Plantillas de fondos' })
    await f.getByLabel('Usar Resp G', { exact: true }).check()
    await expect(f.getByLabel('Importe de Resp G')).toBeInViewport()
    await expect(f.getByLabel('Prioridad propuesta de Resp G')).toBeInViewport()
    await expect(f.getByRole('button', { name: /Aplicar 1 plantilla/ })).toBeInViewport()
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
  })
}

for (const tema of ['light', 'dark'] as const) {
  test(`gestores accesibles (${tema}): sin violaciones graves`, async ({ page }) => {
    test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
    await page.emulateMedia({ colorScheme: tema })
    await iniciarSesion(page)
    plantillaFondoSql('A11y G', 100, { ambito: 'Hogar' })
    const g = await abrirGestor(page)
    await g.getByLabel('Seleccionar Internet', { exact: true }).check()
    const r1 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(r1.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 160)}`)).toEqual([])
    await page.keyboard.press('Escape')
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Plantillas de fondos' }).click()
    await expect(page.getByRole('dialog', { name: 'Plantillas de fondos' })).toBeVisible()
    const r2 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(r2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 160)}`)).toEqual([])
  })
}
