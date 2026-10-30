import AxeBuilder from '@axe-core/playwright'
import { type Locator, type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Acciones por elemento en móvil: deslizar a la izquierda o pulsar «Acciones» abre un panel con TODAS las acciones.
 * El gesto se prueba con eventos táctiles reales del navegador (CDP) y, aparte, con el ratón en una ventana estrecha.
 * Las acciones destructivas solo se abren y se CANCELAN; los datos son los del usuario E2E aislado.
 */
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

/** Dedo real: toque, movimiento escalonado y suelta. Empieza en (x, y) de la página. */
async function dedo(page: Page, x: number, y: number, dx: number, dy: number, pasos = 8) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= pasos; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / pasos, y: y + (dy * i) / pasos }] })
    await page.waitForTimeout(12)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

/** Desliza sobre una fila: empieza en el lado derecho de la caja del elemento (zona sin controles) a la altura de `punto`. */
async function deslizar(page: Page, fila: Locator, punto: Locator, dx: number, dy = 0) {
  await fila.scrollIntoViewIfNeeded()
  const caja = (await fila.boundingBox())!
  const p = (await punto.boundingBox())!
  const ancho = page.viewportSize()!.width
  const x = dx < 0 ? Math.min(caja.x + caja.width * 0.6, ancho - 24) : Math.max(caja.x + caja.width * 0.45, 24)
  await dedo(page, x, p.y + p.height / 2, dx, dy)
}

const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const filaGasto = (page: Page) => page.getByRole('listitem').filter({ has: page.getByLabel(/^Seleccionar /) })
const paneles = (page: Page) => page.locator('[data-panel-acciones]')

async function nombresDeAcciones(panel: Locator) {
  return panel.locator('button[data-accion]').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')))
}

/** Cada botón del panel mide al menos 44 × 44 px y su texto es visible (no solo un icono). */
async function verificarPanel(page: Page, panel: Locator) {
  const vp = page.viewportSize()!
  const cajas = await panel.locator('button[data-accion]').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, texto: (b.textContent ?? '').trim() } }))
  expect(cajas.length).toBeGreaterThan(0)
  for (const c of cajas) { expect(c.h).toBeGreaterThanOrEqual(43.5); expect(c.w).toBeGreaterThanOrEqual(43.5); expect(c.texto.length).toBeGreaterThan(2) }
  const caja = (await panel.boundingBox())!
  expect(caja.x).toBeGreaterThanOrEqual(-1)
  expect(caja.x + caja.width).toBeLessThanOrEqual(vp.width + 1)
  expect(await sinDesborde(page)).toBeLessThanOrEqual(1)
}

test.describe('Acciones por elemento con gesto táctil', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.use({ hasTouch: true })

  test('Gastos: deslizar a la izquierda abre todas las acciones; el botón abre las mismas; derecha, fuera y Escape cierran; solo una fila abierta', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    await page.goto('/gastos')
    const filas = filaGasto(page)
    await expect(filas.first()).toBeVisible()
    const f1 = filas.nth(0), f2 = filas.nth(1)
    const n1 = (await f1.getByLabel(/^Seleccionar /).getAttribute('aria-label'))!.replace('Seleccionar ', '')

    // Cerrada: sin acciones sueltas, solo el botón (≥ 44 px) con nombre accesible
    await expect(f1.getByRole('button', { name: `Más acciones de ${n1}`, exact: true })).toHaveAttribute('aria-expanded', 'false')
    const caja = (await f1.getByRole('button', { name: `Más acciones de ${n1}`, exact: true }).boundingBox())!
    expect(caja.height).toBeGreaterThanOrEqual(43.5)
    await expect(f1.getByRole('button', { name: `Clonar ${n1}`, exact: true })).toHaveCount(0)

    // Un deslizamiento completo a la izquierda abre el panel con las cinco acciones del gasto activo
    await deslizar(page, f1, f1.getByText(n1, { exact: true }).first(), -140)
    const panel = paneles(page)
    await expect(panel).toHaveCount(1)
    await expect(panel).toContainText(n1)
    await expect(f1.getByRole('button', { name: `Más acciones de ${n1}`, exact: true })).toHaveAttribute('aria-expanded', 'true')
    const porGesto = await nombresDeAcciones(panel)
    expect(porGesto).toEqual([`Ver detalle de ${n1}`, `Editar ${n1}`, `Clonar ${n1}`, `Guardar como plantilla ${n1}`, `Anular ${n1}`])
    await verificarPanel(page, panel)

    // Deslizar a la derecha cierra
    await deslizar(page, f1, f1.getByText(n1, { exact: true }).first(), 140)
    await expect(panel).toHaveCount(0)

    // El botón abre exactamente las mismas acciones
    await f1.getByRole('button', { name: `Más acciones de ${n1}`, exact: true }).click()
    await expect(panel).toHaveCount(1)
    expect(await nombresDeAcciones(panel)).toEqual(porGesto)

    // Abrir otra fila cierra la anterior: solo un panel abierto
    await deslizar(page, f2, f2.locator('p').first(), -140)
    await expect(panel).toHaveCount(1)
    await expect(f1.getByRole('button', { name: `Más acciones de ${n1}`, exact: true })).toHaveAttribute('aria-expanded', 'false')

    // Tocar fuera cierra
    await page.getByRole('heading', { name: 'Gastos' }).first().tap()
    await expect(panel).toHaveCount(0)

    // Escape cierra y devuelve el foco al botón que lo abrió
    const btn = f1.getByRole('button', { name: `Más acciones de ${n1}`, exact: true })
    await btn.focus()
    await page.keyboard.press('Enter')
    await expect(panel).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(btn).toBeFocused()
  })

  test('Gastos: vertical, gesto corto y diagonal no abren nada; la casilla y el botón siguen funcionando; el gesto no modifica datos', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    await page.goto('/gastos')
    const f = filaGasto(page).nth(1)
    await expect(f).toBeVisible()
    const n = (await f.getByLabel(/^Seleccionar /).getAttribute('aria-label'))!.replace('Seleccionar ', '')
    const antes = sqlLocal(`select count(*) filter (where status = 'annulled') || '/' || count(*) from public.expenses where household_id = ${HID}`)
    const y = (await f.boundingBox())!.y + 20

    await dedo(page, 330, y, -30, 0) // corto
    await expect(paneles(page)).toHaveCount(0)
    await dedo(page, 330, y, -120, 100) // diagonal
    await expect(paneles(page)).toHaveCount(0)
    await dedo(page, 330, y, -10, -180) // vertical: desplaza la página
    await expect(paneles(page)).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(40)

    await page.evaluate(() => window.scrollTo(0, 0))
    const g = filaGasto(page).nth(1)
    // Un gesto iniciado sobre la casilla no abre el panel y la casilla se puede marcar
    const c = (await g.getByLabel(`Seleccionar ${n}`).boundingBox())!
    await dedo(page, c.x + c.width / 2, c.y + c.height / 2, -140, 0)
    await expect(paneles(page)).toHaveCount(0)
    await g.getByLabel(`Seleccionar ${n}`).check()
    await expect(g.getByLabel(`Seleccionar ${n}`)).toBeChecked()
    // Con el panel abierto la tarjeta sigue mostrando su selección
    await g.getByRole('button', { name: `Más acciones de ${n}`, exact: true }).click()
    await expect(paneles(page)).toHaveCount(1)
    await expect(g.getByLabel(`Seleccionar ${n}`)).toBeChecked()
    // El panel no cambió ningún dato
    expect(sqlLocal(`select count(*) filter (where status = 'annulled') || '/' || count(*) from public.expenses where household_id = ${HID}`)).toBe(antes)
  })

  test('Gastos: acciones no destructivas llegan a su flujo; Anular abre su confirmación y cancelarla no cambia el gasto', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    await page.goto('/gastos')
    const f = filaGasto(page).first()
    const n = (await f.getByLabel(/^Seleccionar /).getAttribute('aria-label'))!.replace('Seleccionar ', '')
    const estado = () => sqlLocal(`select string_agg(status, ',') from public.expenses where household_id = ${HID} and description = '${n.replace(/'/g, "''")}'`)
    const antes = estado()

    await f.getByRole('button', { name: `Más acciones de ${n}`, exact: true }).click()
    await paneles(page).getByRole('button', { name: `Editar ${n}`, exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await deslizar(page, f, f.getByText(n, { exact: true }).first(), -140)
    await paneles(page).getByRole('button', { name: `Anular ${n}`, exact: true }).click()
    const confirmar = page.getByRole('alertdialog')
    await expect(confirmar).toBeVisible()
    await confirmar.getByRole('button', { name: 'Cancelar' }).click()
    await expect(confirmar).toHaveCount(0)
    expect(estado()).toBe(antes)
    await expect(paneles(page)).toHaveCount(0)
  })

  test('Gastos anulado: muestra «Anulado», Restaurar y Editar deshabilitado con su motivo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    sqlLocal(`with e as (select id from public.expenses where household_id = ${HID} order by expense_date desc, created_at desc limit 1), d as (delete from public.expense_fund_allocations where expense_id in (select id from e)) update public.expenses set status = 'annulled', annulled_at = now() where id in (select id from e)`)
    await iniciarSesion(page)
    await page.goto('/gastos?estado=annulled')
    const f = filaGasto(page).filter({ hasText: 'Anulado' }).first()
    await expect(f).toBeVisible()
    const n = (await f.getByLabel(/^Seleccionar /).getAttribute('aria-label'))!.replace('Seleccionar ', '')
    await f.getByRole('button', { name: `Más acciones de ${n}`, exact: true }).click()
    const panel = paneles(page)
    expect(await nombresDeAcciones(panel)).toEqual([`Ver detalle de ${n}`, `Editar ${n}`, `Clonar ${n}`, `Guardar como plantilla ${n}`, `Restaurar ${n}`])
    await expect(panel.getByRole('button', { name: `Editar ${n}`, exact: true })).toBeDisabled()
    await expect(panel.getByRole('button', { name: `Editar ${n}`, exact: true })).toContainText('restáuralo')
    await expect(panel.getByRole('button', { name: `Anular ${n}`, exact: true })).toHaveCount(0)
  })

  test('Fondos: el panel ofrece todas las acciones con sus restricciones; eliminar abre la simulación y se cancela', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    const f = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Hogar', exact: true }) })
    await expect(f).toBeVisible()
    // Tarjeta cerrada: nombre, estado, disponible, uso, asignado y consumido legibles
    await expect(f).toContainText('disponible')
    await expect(f).toContainText('Asignado')
    await expect(f).toContainText('Consumido')
    await expect(f.getByRole('progressbar')).toBeVisible()
    await deslizar(page, f, f.getByRole('heading', { name: 'Hogar', exact: true }), -140)
    const panel = paneles(page)
    await expect(panel).toHaveCount(1)
    const nombres = await nombresDeAcciones(panel)
    for (const esperada of ['Editar fondo Hogar', 'Cambiar presupuesto del período de Hogar', 'Clonar fondo Hogar', 'Guardar como plantilla el fondo Hogar', 'Subir prioridad de Hogar', 'Bajar prioridad de Hogar', 'Desactivar fondo Hogar', 'Eliminar fondo Hogar']) expect(nombres).toContain(esperada)
    await verificarPanel(page, panel)
    // El panel no rompe la lectura del saldo ni la barra de progreso
    await expect(f.getByRole('progressbar')).toBeVisible()
    await expect(f).toContainText('disponible')

    const nHogar = () => sqlLocal(`select count(*) from public.funds where household_id = ${HID} and name = 'Hogar'`)
    const antesHogar = nHogar()
    await panel.getByRole('button', { name: 'Eliminar fondo Hogar', exact: true }).click()
    const dlg = page.getByRole('dialog').or(page.getByRole('alertdialog'))
    await expect(dlg.first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dlg).toHaveCount(0)
    expect(nHogar()).toBe(antesHogar)
  })

  test('Fondo General: sin acciones de prioridad (no existen para él)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    const f = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Fondo General', exact: true }) })
    await f.getByRole('button', { name: 'Más acciones de Fondo General', exact: true }).click()
    const nombres = await nombresDeAcciones(paneles(page))
    expect(nombres.some((n) => /prioridad/i.test(n ?? ''))).toBe(false)
    expect(nombres).toContain('Editar fondo Fondo General')
  })

  test('Catálogo a 320 px: el nombre completo es legible y el panel ofrece subir, bajar, editar, desactivar y eliminar', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await iniciarSesion(page)
    await page.goto('/catalogo')
    await page.getByRole('tab', { name: 'Categorías', exact: true }).click()
    const lista = page.getByRole('list', { name: 'Lista de categorías' })
    const f = lista.getByRole('listitem').filter({ hasText: 'Alimentación' }).first()
    await expect(f).toBeVisible()
    // El nombre no se recorta: ocupa su línea completa
    const nombre = f.getByText('Alimentación', { exact: true })
    expect(await nombre.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
    await expect(f.getByRole('button', { name: 'Subir Alimentación' })).toHaveCount(0)
    await deslizar(page, f, nombre, -140)
    const panel = paneles(page)
    await expect(panel).toHaveCount(1)
    expect(await nombresDeAcciones(panel)).toEqual(['Subir Alimentación', 'Bajar Alimentación', 'Editar Alimentación', 'Desactivar Alimentación', 'Eliminar Alimentación'])
    await verificarPanel(page, panel)
    const nCat = () => sqlLocal(`select count(*) from public.categorias where household_id = ${HID} and name = 'Alimentación'`)
    const antesCat = nCat()
    await panel.getByRole('button', { name: 'Eliminar Alimentación' }).click()
    const confirmar = page.getByRole('alertdialog')
    await expect(confirmar).toBeVisible()
    await confirmar.getByRole('button', { name: 'Cancelar' }).click()
    expect(nCat()).toBe(antesCat)
    // Tocar el contenido sigue seleccionando el elemento, sin abrir el panel
    await f.getByRole('button', { name: 'Ver Alimentación' }).click()
    await expect(f.getByRole('button', { name: 'Ver Alimentación' })).toHaveAttribute('aria-pressed', 'true')
    await expect(paneles(page)).toHaveCount(0)
  })

  test('Plantillas mensuales a 844 × 390: el panel cabe, se recorre por dentro y todas las acciones son alcanzables', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Plantillas' }).click()
    const dlg = page.getByRole('dialog', { name: 'Plantillas mensuales' })
    await expect(dlg).toBeVisible()
    const fila = dlg.locator('[data-plantilla]').filter({ has: page.getByLabel('Seleccionar Recibo de luz', { exact: true }) })
    await fila.scrollIntoViewIfNeeded()
    await fila.getByRole('button', { name: 'Más acciones de Recibo de luz', exact: true }).click()
    const panel = dlg.locator('[data-panel-acciones]')
    await expect(panel).toBeVisible()
    const nombres = await nombresDeAcciones(panel)
    expect(nombres).toEqual(['Registrar solo esta (formulario) Recibo de luz', 'Editar plantilla Recibo de luz', 'Actualizar plantilla con estos valores de Recibo de luz', 'Duplicar plantilla Recibo de luz', 'Desactivar plantilla Recibo de luz', 'Subir en la sección Recibo de luz', 'Bajar en la sección Recibo de luz', 'Eliminar plantilla Recibo de luz'])
    // El panel está dentro del diálogo y de la pantalla; cada acción se alcanza desplazando el panel
    await expect(panel).toBeInViewport({ ratio: 0.95 })
    for (const b of await panel.locator('button[data-accion]').all()) { await b.scrollIntoViewIfNeeded(); await expect(b).toBeInViewport() }
    // «Actualizar» está deshabilitada y explica por qué; abrir el panel no selecciona ni cambia la plantilla
    await expect(panel.getByRole('button', { name: /^Actualizar plantilla con estos valores/ })).toBeDisabled()
    await expect(panel.getByRole('button', { name: /^Actualizar plantilla con estos valores/ })).toContainText('Aún no cambiaste')
    await expect(fila.getByLabel('Seleccionar Recibo de luz', { exact: true })).not.toBeChecked()
    // Eliminar solo abre su confirmación; cancelar no borra
    await panel.getByRole('button', { name: 'Eliminar plantilla Recibo de luz' }).click()
    const confirmar = page.getByRole('alertdialog')
    await expect(confirmar).toBeVisible()
    await confirmar.getByRole('button', { name: 'Cancelar' }).click()
    expect(sqlLocal(`select count(*) from public.expense_templates where household_id = ${HID} and name = 'Recibo de luz'`)).toBe('1')
    // Escape cierra el panel, no el diálogo
    await dlg.locator('[data-plantilla]').filter({ has: page.getByLabel('Seleccionar Recibo de luz', { exact: true }) }).getByRole('button', { name: 'Más acciones de Recibo de luz', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(dlg).toBeVisible()
  })

  test('Plantillas de fondos a 844 × 390: etiquetas comprensibles, acciones completas y una plantilla aplicada no se puede preparar otra vez', async ({ page }) => {
    sqlLocal(`insert into public.fund_templates (household_id, name, suggested_amount, priority, icon_key, color_token, sort_order) values (${HID}, 'Mercado', 800, 102, 'wallet', 'c1', 1)`)
    await page.setViewportSize({ width: 844, height: 390 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    await page.getByRole('button', { name: /Plantillas/ }).first().click()
    const dlg = page.getByRole('dialog', { name: 'Plantillas de fondos' })
    await expect(dlg).toBeVisible()
    const fila = dlg.locator('[data-plantilla-fondo][data-nombre="Mercado"]')
    await fila.scrollIntoViewIfNeeded()
    await expect(fila).toContainText('Prioridad') // nunca un número suelto
    await expect(fila).toContainText('Importe')
    await fila.getByRole('button', { name: 'Más acciones de Mercado', exact: true }).click()
    const panel = dlg.locator('[data-panel-acciones]')
    expect(await nombresDeAcciones(panel)).toEqual(['Preparar fondo con el formulario Mercado', 'Editar plantilla Mercado', 'Actualizar plantilla con estos valores de Mercado', 'Duplicar plantilla Mercado', 'Desactivar plantilla Mercado', 'Subir en la lista Mercado', 'Bajar en la lista Mercado', 'Eliminar plantilla Mercado'])
    await expect(panel).toBeInViewport({ ratio: 0.95 })
    await panel.getByRole('button', { name: 'Eliminar plantilla Mercado' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
    expect(sqlLocal(`select count(*) from public.fund_templates where household_id = ${HID} and name = 'Mercado'`)).toBe('1')
  })

  test('sin desplazamiento horizontal ni controles tras la barra inferior en la matriz de tamaños (con el panel abierto)', async ({ page }) => {
    test.setTimeout(180_000)
    await iniciarSesion(page)
    for (const [w, h] of [[320, 640], [360, 800], [375, 812], [390, 844], [430, 932], [768, 1024]] as const) {
      await page.setViewportSize({ width: w, height: h })
      for (const ruta of ['/gastos', '/fondos']) {
        await page.goto(ruta)
        const boton = page.getByRole('button', { name: /^Más acciones de /, exact: false }).last()
        await boton.scrollIntoViewIfNeeded()
        await boton.click()
        const panel = paneles(page)
        await expect(panel).toHaveCount(1)
        expect(await sinDesborde(page), `${ruta} ${w}×${h}`).toBeLessThanOrEqual(1)
        // El último botón del panel queda por encima de la barra de navegación inferior
        const nav = page.getByRole('navigation', { name: 'Módulos' })
        const ultimo = panel.locator('button[data-accion]').last()
        await ultimo.scrollIntoViewIfNeeded()
        const b = (await ultimo.boundingBox())!
        if (await nav.isVisible()) expect(b.y + b.height, `${ruta} ${w}×${h}`).toBeLessThanOrEqual((await nav.boundingBox())!.y + 1)
      }
    }
  })

  for (const tema of ['light', 'dark'] as const) {
    test(`el panel abierto no tiene fallos de accesibilidad (${tema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema })
      await page.setViewportSize({ width: 390, height: 844 })
      await iniciarSesion(page)
      await page.goto('/gastos')
      await filaGasto(page).first().getByRole('button', { name: /^Más acciones de /, exact: false }).click()
      await expect(paneles(page)).toHaveCount(1)
      const r = await new AxeBuilder({ page }).include('[data-panel-acciones]').withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
  }
})

test.describe('Ventana estrecha con ratón (pointer: fine)', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('el botón de acciones mide ≥ 44 px, abre el panel y arrastrar con el ratón también lo abre', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await iniciarSesion(page)
    await page.goto('/gastos')
    const f = filaGasto(page).first()
    const n = (await f.getByLabel(/^Seleccionar /).getAttribute('aria-label'))!.replace('Seleccionar ', '')
    const btn = f.getByRole('button', { name: `Más acciones de ${n}`, exact: true })
    const caja = (await btn.boundingBox())!
    expect(caja.height).toBeGreaterThanOrEqual(43.5)
    expect(caja.width).toBeGreaterThanOrEqual(43.5)
    await btn.click()
    await expect(paneles(page)).toHaveCount(1)
    await verificarPanel(page, paneles(page))
    await paneles(page).getByRole('button', { name: `Cerrar acciones de ${n}`, exact: true }).click()
    await expect(paneles(page)).toHaveCount(0)
    await expect(btn).toBeFocused()
    // Arrastre con el ratón sobre el texto de la tarjeta
    const t = (await f.getByText(n, { exact: true }).first().boundingBox())!
    await page.mouse.move(t.x + 20, t.y + t.height / 2)
    await page.mouse.down()
    await page.mouse.move(t.x - 60, t.y + t.height / 2, { steps: 10 })
    await page.mouse.up()
    await expect(paneles(page)).toHaveCount(1)
  })

  test('escritorio 1440 × 900: la tabla de Gastos conserva sus iconos de acción y no hay panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.goto('/gastos')
    const fila = page.getByRole('row').filter({ has: page.getByLabel(/^Seleccionar (?!todos)/) }).first()
    await expect(fila.getByRole('button', { name: /^Clonar / })).toBeVisible()
    await expect(fila.getByRole('button', { name: /^Anular / })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Más acciones de / })).toHaveCount(0)
  })

  test('menús de escritorio con poca altura: acotados a la pantalla y con desplazamiento interno (sin coordenadas negativas)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 380 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    const f = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Hogar', exact: true }) })
    await f.getByRole('button', { name: 'Más acciones de Hogar', exact: true }).click()
    const menu = page.getByRole('menu', { name: 'Acciones de Hogar' })
    await expect(menu).toBeVisible()
    const caja = (await menu.boundingBox())!
    expect(caja.y).toBeGreaterThanOrEqual(0)
    expect(caja.y + caja.height).toBeLessThanOrEqual(381)
    expect(await menu.evaluate((e) => e.scrollHeight >= e.clientHeight)).toBe(true)
  })
})
