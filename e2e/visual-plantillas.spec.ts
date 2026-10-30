import AxeBuilder from '@axe-core/playwright'
import { type Locator, type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { elegir, email, filaPlantilla, iniciarSesion, password } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

/** Plantillas con nombre y clasificación largos para probar recortes, más 60 gastos para tener muchas páginas. */
function datos() {
  sqlLocal(`insert into public.expense_templates (household_id, name, description, default_amount, ambito_id, categoria_id, payment_method_id, expense_type, day_of_month, sort_order)
    select ${HID}, n.nombre, 'Compras del hogar', 12345.5, a.id, c.id, m.id, 'variable', 15, 10 + n.i
    from (values (1, 'Supermercado'), (2, 'Supermercado y compras grandes del mes con un nombre muy largo para probar')) as n(i, nombre),
      public.ambitos a, public.categorias c, public.medios_pago m
    where a.household_id = ${HID} and a.name = 'Hogar' and c.ambito_id = a.id and c.household_id = ${HID} and m.household_id = ${HID} and m.name = 'Transferencia'
    and c.id = (select min(id::text)::uuid from public.categorias where ambito_id = a.id)`)
}
function volumen() {
  sqlLocal(`insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id, expense_type, is_recurring, created_by)
    select ${HID}, (date_trunc('month', current_date) + ((n % 20) || ' days')::interval)::date, 5 + n, 'Gasto de volumen ' || lpad(n::text, 3, '0'),
      (select id from public.ambitos where household_id = ${HID} and name = 'Hogar'), (select id from public.categorias where household_id = ${HID} and name = 'Servicios' limit 1),
      (select id from public.medios_pago where household_id = ${HID} and name = 'Transferencia'), 'variable', false, '${E2E_UID}'
    from generate_series(1, 120) n; select public.recalc_period((select id from public.budget_periods where household_id = ${HID} and start_date = date_trunc('month', current_date)::date))`)
}
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const x = async (l: Locator) => (await l.boundingBox())!

async function abrirGestor(page: Page) {
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Plantillas' }).click()
  const g = page.getByRole('dialog', { name: 'Plantillas mensuales' })
  await expect(g).toBeVisible()
  return g
}

test.describe('Plantillas mensuales: layout compacto y sin desbordes', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('sin «Fecha general», filtros en una sola fila, «Pendientes» como interruptor y acciones de selección discretas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    await expect(g.getByText('Fecha general')).toHaveCount(0)
    await expect(g.getByRole('button', { name: 'Aplicar a seleccionadas' })).toHaveCount(0)
    await expect(g.getByRole('button', { name: 'Restaurar sugeridas' })).toHaveCount(0)
    await expect(g.getByText(/días sugeridos/)).toHaveCount(0)
    // Filtros principales: mismos controles, misma altura y misma línea
    const ys = []
    for (const c of [g.getByLabel('Buscar plantilla'), g.getByRole('combobox', { name: 'Agrupación' }), g.getByRole('combobox', { name: 'Orden' }), g.getByRole('combobox', { name: 'Estado' }), g.getByRole('button', { name: /Pendientes/ })]) {
      const b = await x(c.first())
      ys.push(Math.round(b.y + b.height / 2)) // centro vertical: el campo de búsqueda mide su input, que va centrado en su caja
      expect(b.height).toBeLessThanOrEqual(36)
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(4)
    // Disparadores cortos con el menú completo
    await expect(g.getByRole('combobox', { name: 'Agrupación' })).toContainText('Por categoría')
    await g.getByRole('combobox', { name: 'Agrupación' }).click()
    await expect(page.getByRole('option', { name: 'Agrupar por categoría' })).toBeVisible()
    await page.keyboard.press('Escape')
    // «Pendientes» sustituye al checkbox «Sin registrar en …»
    await expect(g.getByText(/Sin registrar en/)).toHaveCount(0)
    const pend = g.getByRole('button', { name: /Pendientes/ })
    await expect(pend).toHaveAttribute('aria-pressed', 'false')
    await pend.click()
    await expect(pend).toHaveAttribute('aria-pressed', 'true')
    await pend.click()
    // Limpiar la búsqueda
    await g.getByLabel('Buscar plantilla').fill('zzz')
    await expect(g.getByText('Ninguna plantilla coincide')).toBeVisible()
    await g.getByRole('button', { name: 'Limpiar búsqueda' }).click()
    await expect(g.getByLabel('Buscar plantilla')).toHaveValue('')
    // Acciones de selección en una barra secundaria pequeña
    for (const n of ['Seleccionar visibles', 'Deseleccionar todas', 'Contraer secciones']) expect((await x(g.getByRole('button', { name: n }))).height).toBeLessThanOrEqual(32)
  })

  test('nombres largos en una línea con tooltip, chips dentro de su columna, encabezados alineados y filas/grupos compactos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    datos()
    const g = await abrirGestor(page)
    const corta = filaPlantilla(page, 'Supermercado')
    const larga = filaPlantilla(page, 'Supermercado y compras grandes del mes con un nombre muy largo para probar')
    await expect(corta).toBeVisible()
    // «Supermercado» completo y en una sola línea; el nombre largo se recorta con puntos suspensivos y se recupera con el tooltip
    const nombre = corta.locator('p[title="Supermercado"]')
    expect((await x(nombre)).height).toBeLessThan(24)
    expect(await nombre.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
    const nombreLargo = larga.locator('p[title^="Supermercado y compras"]')
    expect((await x(nombreLargo)).height).toBeLessThan(24)
    await expect(nombreLargo).toHaveAttribute('title', 'Supermercado y compras grandes del mes con un nombre muy largo para probar')
    // Los chips no invaden la columna del importe y los encabezados coinciden con sus columnas
    for (const fila of [corta, larga]) {
      const chip = fila.locator('.chip-k').first()
      const importe = fila.getByLabel(/^Importe de /)
      const cb = await x(chip)
      const ib = await x(importe)
      expect(cb.x + cb.width).toBeLessThanOrEqual(ib.x - 4)
      const fb = await x(fila)
      expect(cb.x + cb.width).toBeLessThanOrEqual(fb.x + fb.width)
    }
    const ib = await x(corta.getByLabel(/^Importe de /))
    for (const [encabezado, ctrl] of [['Importe', corta.getByLabel(/^Importe de /)], ['Medio', corta.getByRole('combobox', { name: /^Medio de pago de / })], ['Fecha', corta.getByLabel(/^Fecha de /)]] as const) {
      const h = await x(g.getByText(encabezado, { exact: true }).first())
      const c = await x(ctrl)
      expect(Math.abs(h.x - c.x)).toBeLessThanOrEqual(encabezado === 'Importe' ? 40 : 14) // el importe lleva el prefijo «S/» dentro de su caja
    }
    expect(ib.width).toBeGreaterThan(60)
    // Alturas: fila ≤ 64 px y encabezado de grupo ≤ 46 px
    expect((await x(corta)).height).toBeLessThanOrEqual(64)
    const grupo = g.getByRole('region', { name: 'Servicios', exact: true }).locator('> div').first()
    expect((await x(grupo)).height).toBeLessThanOrEqual(46)
    // Importes grandes sin salirse
    await expect(corta.getByLabel(/^Importe de /)).toHaveValue('12345.50')
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
  })

  for (const ancho of [1920, 1440, 1366, 1280, 1024, 768, 430, 390, 375, 320]) {
    test(`gestor de plantillas a ${ancho}px: sin desbordes ni controles cortados`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: ancho < 600 ? 740 : 800 })
      await iniciarSesion(page)
      datos()
      const g = await abrirGestor(page)
      await filaPlantilla(page, 'Supermercado').getByLabel('Seleccionar Supermercado', { exact: true }).check()
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
      const caja = (await g.boundingBox())!
      const fuera = await g.evaluate((raiz) => {
        const c = raiz.getBoundingClientRect()
        return Array.from(raiz.querySelectorAll('button, input, [role="combobox"], .chip-k')).filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > c.right + 1 || b.left < c.left - 1) }).map((e) => `${e.tagName} ${e.getAttribute('aria-label') ?? e.textContent?.slice(0, 30)} ${Math.round(e.getBoundingClientRect().right - c.right)}`)
      })
      expect(fuera).toEqual([])
      expect(caja.width).toBeLessThanOrEqual(ancho)
      // El pie con la acción principal siempre queda a la vista
      await expect(g.getByRole('button', { name: /Revisar y registrar 1 gasto/ })).toBeInViewport()
      // Sin barra horizontal dentro del diálogo
      const horizontal = await g.evaluate((raiz) => Array.from(raiz.querySelectorAll('*')).filter((e) => { const s = getComputedStyle(e); return (s.overflowX === 'auto' || s.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 1 }).map((e) => `${e.tagName}.${String((e as HTMLElement).className).slice(0, 70)} ${e.scrollWidth}>${e.clientWidth}`))
      expect(horizontal).toEqual([])
    })
  }

  for (const tema of ['light', 'dark'] as const) {
    test(`accesibilidad (${tema}): gestor compacto y formulario sin violaciones graves`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema })
      await iniciarSesion(page)
      const g = await abrirGestor(page)
      await g.getByLabel('Seleccionar Internet', { exact: true }).check()
      const r1 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(r1.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 140)}`)).toEqual([])
      await g.getByRole('button', { name: 'Nueva plantilla' }).first().click()
      const f = page.getByRole('dialog', { name: 'Nueva plantilla de gasto' })
      await expect(f.getByLabel('¿El importe varía?')).toBeVisible()
      const r2 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(r2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 140)}`)).toEqual([])
    })
  }
})

test.describe('Nueva plantilla de gasto: formulario simplificado', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('«¿El importe varía?», Día sugerido y Tipo de gasto en una fila, sin párrafos de ayuda; el guardado sigue igual', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const g = await abrirGestor(page)
    await g.getByRole('button', { name: 'Nueva plantilla' }).first().click()
    const f = page.getByRole('dialog', { name: 'Nueva plantilla de gasto' })
    await expect(f.getByLabel('¿El importe varía?')).toBeVisible()
    await expect(f.getByText(/El importe cambia cada vez/)).toHaveCount(0)
    await expect(f.getByText(/nunca se asume cero/)).toHaveCount(0) // la explicación pasó a un tooltip
    await expect(f.getByText(/periodicidad/)).toHaveCount(0)
    await expect(f.getByText(/lo eliges al registrar/)).toHaveCount(0)
    // Día sugerido y Tipo de gasto alineados horizontalmente
    const dia = await x(f.getByLabel('Día sugerido'))
    const tipo = await x(f.getByRole('radiogroup', { name: 'Tipo de gasto' }))
    expect(Math.abs((dia.y + dia.height / 2) - (tipo.y + tipo.height / 2))).toBeLessThanOrEqual(8)
    await expect(f.getByText('(opcional)').filter({ hasText: 'Día' })).toHaveCount(0)
    // Orden vertical: Importe sugerido → ¿El importe varía? → Día/Tipo
    const imp = await x(f.getByLabel('Importe sugerido'))
    const chk = await x(f.getByLabel('¿El importe varía?'))
    expect(imp.y).toBeLessThan(chk.y)
    expect(chk.y).toBeLessThan(dia.y)
    // Guardado con importe variable
    await f.getByRole('radiogroup', { name: 'Ámbito', exact: true }).getByRole('radio', { name: 'Hogar', exact: true }).click()
    await f.getByRole('radiogroup', { name: 'Categoría', exact: true }).getByRole('radio', { name: 'Servicios', exact: true }).click()
    await f.getByLabel('Descripción', { exact: true }).fill('Gas natural')
    await f.getByLabel('Nombre de plantilla').fill('Gas natural')
    await f.getByLabel('¿El importe varía?').check()
    await f.getByRole('button', { name: 'Guardar plantilla' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    expect(sqlLocal(`select is_amount_variable::text || '|' || coalesce(default_amount::text, 'null') from public.expense_templates where household_id = ${HID} and name = 'Gas natural'`)).toBe('true|null')
  })
})

test.describe('Paginación unificada', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('Gastos: rango breve, tamaños 10/20/50/100, números con «…», filtros y orden conservados, sin duplicados', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    volumen()
    await page.goto('/gastos?desde=2020-01-01')
    const nav = page.getByRole('navigation', { name: 'Paginación' })
    await expect(nav).toContainText(/^1–20 de \d+/)
    expect((await x(nav)).height).toBeLessThanOrEqual(36) // una sola fila compacta
    await expect(nav.getByRole('combobox', { name: 'Registros por página' })).toContainText('20 por página')
    // Tamaño 10: muchos números → siempre la primera, la última y la actual con «…»
    await elegir(page, nav.getByRole('combobox', { name: 'Registros por página' }), '10 por página')
    await expect(page).toHaveURL(/tamano=10/)
    await expect(nav).toContainText(/^1–10 de \d+/)
    await expect(nav.getByText('…').first()).toBeVisible()
    expect(await nav.getByRole('button', { name: /^Página \d+$/ }).count()).toBeLessThanOrEqual(7)
    // Navegar por números, conservar el orden y no repetir filas entre páginas
    await page.goto('/gastos?desde=2020-01-01&tamano=10&orden=monto&dir=asc') // orden por importe ascendente: debe conservarse al paginar
    await expect(nav).toContainText(/^1–10 de \d+/)
    const filasPagina = async () => page.locator('tbody tr').evaluateAll((rs) => rs.map((r) => r.textContent ?? ''))
    const p1 = await filasPagina()
    await nav.getByRole('button', { name: 'Página 2', exact: true }).click()
    await expect(nav.getByRole('button', { name: 'Página 2', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveURL(/pagina=2/)
    await page.waitForLoadState('networkidle')
    await expect.poll(async () => (await filasPagina()).join('|')).not.toBe(p1.join('|')) // llegan las filas de la página 2
    const p2 = await filasPagina()
    expect(p1.length).toBe(10)
    expect(p2.length).toBe(10)
    expect(p1.join('|')).not.toBe(p2.join('|')) // la página reemplaza las filas
    // Sin omitir ni repetir: con 100 por página, las páginas suman exactamente el total filtrado
    const total = Number(/de (\d+)/.exec(await nav.innerText())![1])
    await elegir(page, nav.getByRole('combobox', { name: 'Registros por página' }), '100 por página')
    await expect(nav).toContainText(new RegExp(`^1–${Math.min(100, total)} de ${total}`))
    await expect.poll(async () => (await filasPagina()).length).toBe(Math.min(100, total))
    let suma = Math.min(100, total)
    if (total > 100) {
      await nav.getByRole('button', { name: 'Página siguiente' }).click()
      await expect(nav).toContainText(new RegExp(`^101–${Math.min(200, total)} de ${total}`))
      await expect.poll(async () => (await filasPagina()).length).toBe(Math.min(200, total) - 100)
      suma += Math.min(200, total) - 100
    }
    expect(suma).toBe(Math.min(200, total))
    await elegir(page, nav.getByRole('combobox', { name: 'Registros por página' }), '50 por página')
    await expect(nav.getByRole('button', { name: 'Página 1', exact: true })).toHaveAttribute('aria-current', 'page') // cambiar el tamaño vuelve a la primera página
    await expect(page).toHaveURL(/dir=asc/) // y conserva el orden
    await expect(page).toHaveURL(/tamano=50/)
    // Último número y estados de los extremos
    await page.goto('/gastos?desde=2020-01-01&tamano=10&orden=monto&dir=asc')
    const ultima = nav.getByRole('button', { name: /^Página \d+$/ }).last()
    await ultima.click()
    await expect(nav.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
    await expect(nav.getByRole('button', { name: 'Página anterior' })).toBeEnabled()
    // Sin resultados la tabla se sustituye por su estado vacío (el paginador con 0–0 se prueba en Gastos imputados)
    await page.goto('/gastos?desde=2020-01-01&q=zzzzzz-no-existe')
    await expect(page.getByRole('navigation', { name: 'Paginación' })).toHaveCount(0)
  })

  for (const ancho of [320, 375, 430, 768, 1366]) {
    test(`paginador a ${ancho}px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 })
      await iniciarSesion(page)
      volumen()
      await page.goto('/gastos?desde=2020-01-01&tamano=10')
      const nav = page.getByRole('navigation', { name: 'Paginación' })
      await expect(nav).toBeVisible()
      await nav.scrollIntoViewIfNeeded()
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
      const cb = await x(nav)
      expect(cb.x + cb.width).toBeLessThanOrEqual(ancho + 1)
      if (ancho < 480) {
        await expect(nav.getByText(/^1\/\d+$/)).toBeVisible()
        await expect(nav.getByRole('button', { name: /^Página \d+$/ })).toHaveCount(0)
      } else {
        await expect(nav.getByRole('button', { name: 'Página 1', exact: true })).toBeVisible()
      }
      await expect(nav.getByRole('button', { name: 'Página siguiente' })).toBeInViewport()
    })
  }
})
