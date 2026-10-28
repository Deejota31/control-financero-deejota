import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, vigilarConsola } from './helpers'

const dinero = (t: string | null) => Number((t ?? '').replace(/[^\d.-]/g, ''))
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

const [INI, FIN] = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD') || '|' || to_char(date_trunc('month', current_date) + interval '1 month - 1 day', 'YYYY-MM-DD')`).split('|')

/** Gasto activo del mes actual según SQL, con condiciones adicionales (fuente independiente de la interfaz). */
const sqlTotal = (cond = '') => Number(sqlLocal(`select coalesce(sum(amount), 0) from public.expenses e where household_id = ${HID} and status = 'active' and expense_date between '${INI}' and '${FIN}' ${cond}`))
const sqlCantidad = (cond = '') => Number(sqlLocal(`select count(*) from public.expenses e where household_id = ${HID} and status = 'active' and expense_date between '${INI}' and '${FIN}' ${cond}`))
const idAmbito = (nombre: string) => sqlLocal(`select id from public.ambitos where household_id = ${HID} and name = '${nombre}'`)

const kpi = (page: Page, etiqueta: string) => page.getByLabel('Indicadores').locator('div').filter({ has: page.getByText(etiqueta, { exact: true }) }).first()
const valorKpi = async (page: Page, etiqueta: string) => dinero(await kpi(page, etiqueta).locator('span').nth(1).textContent())
const chips = (page: Page) => page.getByLabel('Filtros del dashboard')
/** Abre el selector de período y aplica un atajo. */
const periodo = async (page: Page, atajo: 'Este mes' | 'Mes anterior') => {
  await page.getByRole('button', { name: /^Período:/ }).click()
  await page.getByRole('button', { name: atajo, exact: true }).click()
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
}
const filaAmbito = (page: Page, nombre: string) => page.getByLabel('Ámbitos').getByRole('button', { name: new RegExp(`^${nombre}`) })
const sumaDona = async (page: Page) => {
  const t = await page.getByLabel('Ámbitos').getByRole('button').allTextContents()
  return t.map((x) => dinero(x.match(/S\/ [\d,]+\.\d{2}/)?.[0] ?? '0')).reduce((s, v) => s + v, 0)
}

test.describe('Dashboard', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('muestra KPIs, gráficos, presupuesto consolidado y paneles con datos demo', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await expect(page.getByText('Datos DEMO')).toBeVisible()
    for (const t of ['Gasto del período', 'Movimientos', 'Variación vs período anterior', 'Mayor gasto']) await expect(kpi(page, t)).toBeVisible()
    for (const t of ['Presupuesto asignado', 'Gastado del período', 'Disponible consolidado', 'Exceso sobre el presupuesto']) await expect(page.getByText(t, { exact: true })).toBeVisible()
    await expect(page.getByText(/Cierre proyectado \(estimación\)/)).toBeVisible()
    for (const h of ['Presupuesto consolidado', 'Gasto acumulado', 'Distribución por ámbito', 'Top 5 categorías', 'Perfil de gasto', 'Ranking con tendencia']) {
      await expect(page.getByRole('heading', { name: h })).toBeVisible()
    }
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    await expect(kpi(page, 'Gasto del período')).toContainText(`${sqlCantidad()} movimientos`)
    expect(await valorKpi(page, 'Gasto del período')).toBeCloseTo(sqlTotal(), 2)
    expect(errores).toEqual([])
  })

  test('alterna el Top 5 entre categorías y subcategorías', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('button', { name: 'Subcategorías', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Top 5 subcategorías' })).toBeVisible()
    await page.getByRole('button', { name: 'Categorías', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Top 5 categorías' })).toBeVisible()
  })

  test('seleccionar un ámbito en la dona filtra KPIs, gráficos y gastos; volver a seleccionarlo lo quita', async ({ page }) => {
    await iniciarSesion(page)
    const sinFiltro = { total: await valorKpi(page, 'Gasto del período'), ambitos: await page.getByLabel('Ámbitos').getByRole('button').count() }
    const disponibleAntes = await page.getByText('Disponible consolidado', { exact: true }).locator('xpath=..').textContent()

    await filaAmbito(page, 'Hogar').click()
    const hogar = sqlTotal(`and ambito_id = '${idAmbito('Hogar')}'`)
    await expect(chips(page).getByText('Hogar')).toBeVisible()
    await expect(page).toHaveURL(/ambito=/)
    await expect(kpi(page, 'Gasto con filtros actuales')).toBeVisible()
    await expect.poll(() => valorKpi(page, 'Gasto con filtros actuales')).toBeCloseTo(hogar, 2)
    await expect(kpi(page, 'Gasto con filtros actuales')).toContainText(`${sqlCantidad(`and ambito_id = '${idAmbito('Hogar')}'`)} movimientos`)
    // la dona conserva todos los ámbitos para poder cambiar de selección; la fila elegida queda marcada
    expect(await page.getByLabel('Ámbitos').getByRole('button').count()).toBe(sinFiltro.ambitos)
    await expect(filaAmbito(page, 'Hogar')).toHaveAttribute('aria-pressed', 'true')
    // el presupuesto es el del período completo y el gasto filtrado se muestra aparte
    await expect(page.getByText(/Gasto con filtros actuales: S\//)).toBeVisible()
    expect(await page.getByText('Disponible consolidado', { exact: true }).locator('xpath=..').textContent()).toBe(disponibleAntes)
    // gastos recientes y gráfico acumulado reflejan el filtro
    await expect(page.getByRole('region', { name: 'Gasto acumulado' }).getByText('Filtrado')).toBeVisible()
    await expect(page.getByRole('img', { name: /^Gasto acumulado de.*con filtros/ })).toBeVisible()

    // seleccionar otra vez desactiva
    await filaAmbito(page, 'Hogar').click()
    await expect(page).not.toHaveURL(/ambito=/)
    await expect(kpi(page, 'Gasto del período')).toBeVisible()
    expect(await valorKpi(page, 'Gasto del período')).toBeCloseTo(sinFiltro.total, 2)
  })

  test('seleccionar un día con el gráfico filtra todo el panel y se quita con Limpiar filtros', async ({ page }) => {
    await iniciarSesion(page)
    // gráfico acumulado: clic dentro del área de datos (el gráfico de barras diario se retiró: el calendario cubre ese detalle)
    const barras = page.getByRole('img', { name: /^Gasto acumulado de/ })
    await barras.scrollIntoViewIfNeeded()
    const caja = (await barras.boundingBox())!
    await page.mouse.move(caja.x + caja.width * 0.12, caja.y + caja.height * 0.5, { steps: 6 })
    await expect(page.getByRole('tooltip').or(page.getByText('% de ')).first()).toBeVisible()
    await page.mouse.down()
    await page.mouse.up()
    await expect(page.getByRole('button', { name: /^Día: \d{2}\/\d{2}\/\d{4}/ })).toBeVisible()
    await expect(page).toHaveURL(/dia=\d{4}-\d{2}-\d{2}/)
    const dia = new URL(page.url()).searchParams.get('dia')!
    await expect.poll(() => valorKpi(page, 'Gasto con filtros actuales')).toBeCloseTo(sqlTotal(`and expense_date = '${dia}'`), 2)
    await expect(kpi(page, 'Variación vs período anterior')).toContainText('No aplica')
    // el acumulado sigue mostrando todo el período, con el día resaltado
    await expect(page.getByRole('img', { name: /^Gasto acumulado de/ })).toBeVisible()
    // limpiar restablece
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page).not.toHaveURL(/dia=/)
    expect(await valorKpi(page, 'Gasto del período')).toBeCloseTo(sqlTotal(), 2)
  })

  test('seleccionar una categoría del Top 5 filtra la dona y los KPIs sin reducir el propio Top 5', async ({ page }) => {
    await iniciarSesion(page)
    const filas = page.getByRole('region', { name: /^Top 5/ }).getByRole('button', { name: /mov\./ })
    await expect(filas.first()).toBeVisible()
    const total = await filas.count()
    await filas.first().click()
    await expect(page.getByRole('combobox', { name: 'Categoría', exact: true })).not.toHaveText('Categoría')
    await expect(page).toHaveURL(/categoria=/)
    const cat = new URL(page.url()).searchParams.get('categoria')!
    const esperado = sqlTotal(`and categoria_id = '${cat}'`)
    await expect.poll(() => valorKpi(page, 'Gasto con filtros actuales')).toBeCloseTo(esperado, 2)
    // la dona muestra solo lo de esa categoría y suma lo mismo que el KPI
    await expect.poll(() => sumaDona(page)).toBeCloseTo(esperado, 1)
    expect(await filas.count()).toBe(total)
    await expect(filas.first()).toHaveAttribute('aria-pressed', 'true')
  })

  test('los filtros se combinan (Y lógico), se quitan por chip y "Limpiar filtros" conserva el período', async ({ page }) => {
    await iniciarSesion(page)
    await filaAmbito(page, 'Personal').click()
    await page.getByRole('combobox', { name: 'Medio de pago', exact: true }).click()
    await page.getByRole('option', { name: 'Yape', exact: true }).click()
    await page.getByRole('combobox', { name: 'Tipo de gasto', exact: true }).click()
    await page.getByRole('option', { name: 'Variable', exact: true }).click()
    const cond = `and ambito_id = '${idAmbito('Personal')}' and payment_method_id = (select id from public.medios_pago where household_id = ${HID} and name = 'Yape') and expense_type = 'variable'`
    await expect.poll(() => valorKpi(page, 'Gasto con filtros actuales')).toBeCloseTo(sqlTotal(cond), 2)
    await expect(page.getByRole('combobox', { name: 'Medio de pago', exact: true })).toContainText('Yape')
    await expect(page.getByRole('combobox', { name: 'Tipo de gasto', exact: true })).toContainText('Variable')
    await expect(page.getByRole('combobox', { name: 'Ámbito', exact: true })).toContainText('Personal')

    // el tipo se quita con su propia «x»
    await page.getByRole('combobox', { name: 'Tipo de gasto', exact: true }).locator('xpath=..').getByRole('button', { name: 'Limpiar selección' }).click()
    await expect(page).not.toHaveURL(/tipo=/)
    await expect(page).toHaveURL(/ambito=/)

    await periodo(page, 'Mes anterior')
    await expect(page).toHaveURL(/desde=/)
    await expect(page).toHaveURL(/ambito=/) // el cambio de período conserva los demás criterios
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page).not.toHaveURL(/ambito=|medio=|tipo=/)
    await expect(page).toHaveURL(/desde=/) // el período no se pierde
    await expect(page.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled()
  })

  test('"Ver en Gastos" conserva los criterios y la tabla coincide con los KPIs', async ({ page }) => {
    await iniciarSesion(page)
    await filaAmbito(page, 'Hogar').click()
    await expect.poll(() => valorKpi(page, 'Gasto con filtros actuales')).toBeGreaterThan(0)
    const n = sqlCantidad(`and ambito_id = '${idAmbito('Hogar')}'`)
    await page.getByRole('button', { name: 'Ver en Gastos' }).click()
    await expect(page).toHaveURL(/\/gastos\?.*ambito=/)
    await expect(page).toHaveURL(new RegExp(`desde=${INI}`))
    await expect(page.getByText(`${n} movimientos con los filtros aplicados`)).toBeVisible()
    await expect(page.getByLabel('Seleccionar todos los de esta página')).toBeVisible()
  })

  test('una respuesta antigua no sobrescribe a una reciente al cambiar filtros rápido', async ({ page }) => {
    await iniciarSesion(page)
    let llamadas = 0
    await page.route('**/rest/v1/rpc/dashboard_panel', async (route) => {
      llamadas++
      if (llamadas === 1) await new Promise((r) => setTimeout(r, 2500)) // la primera selección responde tarde
      await route.continue()
    })
    await filaAmbito(page, 'Hogar').click()
    await filaAmbito(page, 'Familia').click()
    const familia = sqlTotal(`and ambito_id = '${idAmbito('Familia')}'`)
    await page.waitForTimeout(3500) // deja llegar la respuesta atrasada
    await expect(page).toHaveURL(new RegExp(`ambito=${idAmbito('Familia')}`))
    expect(await valorKpi(page, 'Gasto con filtros actuales')).toBeCloseTo(familia, 2)
    await expect(chips(page).getByText('Familia')).toBeVisible()
    await expect(chips(page).getByText('Hogar')).toHaveCount(0)
  })

  test('el tooltip de la dona aparece al pasar el cursor y no tapa el total central', async ({ page }) => {
    await iniciarSesion(page)
    const dona = page.getByRole('img', { name: /^Distribución del gasto por ámbito/ })
    await dona.scrollIntoViewIfNeeded()
    const d = (await dona.boundingBox())!
    const centro = { x: d.x + d.width / 2, y: d.y + d.height / 2 }
    const RADIO_INTERNO = 62
    const distanciaAlCentro = (k: { x: number; y: number; width: number; height: number }) => {
      const px = Math.max(k.x, Math.min(centro.x, k.x + k.width))
      const py = Math.max(k.y, Math.min(centro.y, k.y + k.height))
      return Math.hypot(centro.x - px, centro.y - py)
    }

    // 1) cursor sobre un segmento del anillo
    await page.mouse.move(centro.x + 75, centro.y - 5, { steps: 8 })
    const tarjeta = dona.getByRole('status')
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText('Importe')
    await expect(tarjeta).toContainText('Movimientos')
    await expect(tarjeta).toContainText('%')
    expect(distanciaAlCentro((await tarjeta.boundingBox())!)).toBeGreaterThan(RADIO_INTERNO)
    // el total central sigue visible
    await expect(dona.getByText('Total', { exact: true })).toBeVisible()

    // 2) también con teclado (foco en la leyenda)
    await page.mouse.move(5, 5)
    await filaAmbito(page, 'Hogar').focus()
    await expect(tarjeta).toContainText('Hogar')
    expect(distanciaAlCentro((await tarjeta.boundingBox())!)).toBeGreaterThan(RADIO_INTERNO)
  })

  test('los gráficos temporales muestran un tooltip con fecha, gasto del día, movimientos y acumulado', async ({ page }) => {
    await iniciarSesion(page)
    const acumulado = page.getByRole('img', { name: /^Gasto acumulado de/ })
    await acumulado.scrollIntoViewIfNeeded()
    const c = (await acumulado.boundingBox())!
    await page.mouse.move(c.x + c.width * 0.4, c.y + c.height * 0.5, { steps: 8 })
    await expect(page.getByText('Gasto del día').first()).toBeVisible()
    await expect(page.getByText('Acumulado', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Movimientos', { exact: true }).first()).toBeVisible()
  })

  test('el filtro por teclado: Enter en una fila de la dona activa y desactiva el filtro', async ({ page }) => {
    await iniciarSesion(page)
    const fila = filaAmbito(page, 'Trabajo')
    await fila.focus()
    await page.keyboard.press('Enter')
    await expect(fila).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Enter')
    await expect(fila).toHaveAttribute('aria-pressed', 'false')
  })

  test('cambiar el período actualiza todo y compara con el anterior', async ({ page }) => {
    await iniciarSesion(page)
    const gastoActual = await valorKpi(page, 'Gasto del período')
    await periodo(page, 'Mes anterior')
    await expect(page).toHaveURL(/desde=/)
    await expect(page.getByText(/Cierre proyectado/)).toHaveCount(0)
    await expect.poll(() => valorKpi(page, 'Gasto del período')).not.toBe(gastoActual)
    await expect(page.getByText('Variación vs período anterior')).toBeVisible()
    await periodo(page, 'Este mes')
    await expect(page.getByText(/Cierre proyectado/)).toBeVisible()
  })

  test('un rango sin gastos muestra un estado vacío y uno inválido explica el problema', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/?desde=2020-01-01&hasta=2020-01-31')
    await expect(page.getByText('No hay gastos en este período')).toBeVisible()
    await page.goto('/?desde=2026-10-20&hasta=2026-10-01')
    await expect(page.getByText('La fecha inicial es posterior a la final. Ajusta el rango.')).toBeVisible()
  })

  test('acceso rápido: registrar gasto desde el Dashboard sin salir de él', async ({ page }) => {
    await iniciarSesion(page)
    await page.locator('button.fab-gasto:visible').click()
    await expect(page).toHaveURL(/\/$/) // el formulario global se abre sin salir del dashboard
    await expect(page.getByRole('dialog', { name: 'Nuevo gasto' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  })

  test('un gasto nuevo en Gastos se refleja en los KPIs del Dashboard y al anularlo vuelve', async ({ page }) => {
    await iniciarSesion(page)
    const antes = await valorKpi(page, 'Gasto del período')
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Importe', { exact: true }).fill('10')
    for (const [nombre, opcion] of [['Ámbito', 'Personal'], ['Categoría', 'Ocio'], ['Medio de pago', 'Yape']] as const) {
      await d.getByRole('combobox', { name: nombre, exact: true }).click()
      await page.getByRole('option', { name: opcion, exact: true }).click()
    }
    await d.getByLabel('Descripción', { exact: true }).fill('E2E dashboard')
    await d.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect.poll(() => valorKpi(page, 'Gasto del período')).toBeCloseTo(antes + 10, 2)

    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await page.getByLabel('Buscar', { exact: true }).fill('E2E dashboard')
    await page.getByRole('button', { name: 'Anular E2E dashboard' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect.poll(() => valorKpi(page, 'Gasto del período')).toBeCloseTo(antes, 2)
  })

  test('si Supabase falla, el dashboard muestra un error con opción de reintentar', async ({ page }) => {
    await iniciarSesion(page)
    await page.route('**/rest/v1/rpc/dashboard_panel', (r) => r.abort('connectionrefused'))
    await page.goto('/?desde=2026-09-01&hasta=2026-09-30')
    await expect(page.getByText('No se pudieron cargar los datos del dashboard.')).toBeVisible({ timeout: 20_000 })
    await page.unroute('**/rest/v1/rpc/dashboard_panel')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByRole('region', { name: 'Indicadores', exact: true })).toBeVisible()
  })

  test('el tema oscuro mantiene gráficos y componentes flotantes legibles', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    await page.getByRole('combobox', { name: 'Medio de pago', exact: true }).click()
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Cambiar a tema claro' }).click()
  })
})

test.describe('Dashboard: barra de filtros e indicadores', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('a 1440 px todos los controles caben en una sola fila, sin desborde y a la misma altura', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const barra = page.getByRole('region', { name: 'Filtros del dashboard' })
    await expect(barra).toBeVisible()
    const nombres = [/^Período:/, /^Día:/, 'Ámbito', 'Categoría', 'Subcategoría', 'Medio de pago', 'Tipo de gasto']
    const cajas = [] as { y: number; h: number; x2: number }[]
    for (const n of nombres) {
      const el = typeof n === 'string' ? barra.getByRole('combobox', { name: n, exact: true }) : barra.getByRole('button', { name: n })
      const b = (await el.boundingBox())!
      cajas.push({ y: b.y, h: b.height, x2: b.x + b.width })
    }
    for (const b of [(await barra.getByRole('button', { name: 'Limpiar filtros' }).boundingBox())!]) cajas.push({ y: b.y, h: b.height, x2: b.x + b.width })
    const y0 = cajas[0].y + cajas[0].h / 2
    for (const c of cajas) expect(Math.abs(c.y + c.h / 2 - y0), 'centrado vertical').toBeLessThanOrEqual(2)
    const caja = (await barra.boundingBox())!
    expect(Math.max(...cajas.map((c) => c.x2))).toBeLessThanOrEqual(caja.x + caja.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    expect(caja.height).toBeLessThan(70) // una fila
  })

  test('el selector de período acepta fechas personalizadas, valida el rango y limpia', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('button', { name: /^Período:/ }).click()
    await expect(page.getByRole('button', { name: 'Este mes', exact: true })).toBeVisible()
    await page.getByLabel('Desde', { exact: true }).click()
    await page.getByRole('gridcell', { name: /^10/ }).first().click()
    await page.getByLabel('Hasta', { exact: true }).click()
    await page.getByRole('gridcell', { name: /^20/ }).first().click()
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page).toHaveURL(/desde=\d{4}-\d{2}-10/)
    await expect(page).toHaveURL(/hasta=\d{4}-\d{2}-20/)
    await expect(page.getByRole('button', { name: /^Período: 10 .* – 20 / })).toBeVisible()
    // el resumen y el SQL coinciden
    const [d, h] = [new URL(page.url()).searchParams.get('desde')!, new URL(page.url()).searchParams.get('hasta')!]
    const esperado = Number(sqlLocal(`select coalesce(sum(amount), 0) from public.expenses where household_id = ${HID} and status = 'active' and expense_date between '${d}' and '${h}'`))
    await expect.poll(() => valorKpi(page, 'Gasto del período')).toBeCloseTo(esperado, 2)
    // limpiar rango vuelve al mes actual
    await page.getByRole('button', { name: /^Período:/ }).click()
    await page.getByRole('button', { name: 'Limpiar rango' }).click()
    await expect(page).not.toHaveURL(/desde=/)
  })

  test('Ámbito, Categoría y Subcategoría se filtran entre sí y el Top 5 sigue conectado', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('combobox', { name: 'Ámbito', exact: true }).click()
    await page.getByRole('option', { name: 'Hogar', exact: true }).click()
    await page.getByRole('combobox', { name: 'Categoría', exact: true }).click()
    // solo categorías del ámbito elegido
    await expect(page.getByRole('option', { name: 'Servicios', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Educación', exact: true })).toHaveCount(0)
    await page.getByRole('option', { name: 'Servicios', exact: true }).click()
    await page.getByRole('combobox', { name: 'Subcategoría', exact: true }).click()
    await page.getByRole('option').first().click()
    await expect(page).toHaveURL(/ambito=.*categoria=.*subcategoria=|subcategoria=.*/)
    await expect(kpi(page, 'Gasto con filtros actuales')).toBeVisible()
    const sub = new URL(page.url()).searchParams.get('subcategoria')!
    await expect.poll(() => valorKpi(page, 'Gasto con filtros actuales')).toBeCloseTo(sqlTotal(`and subcategoria_id = '${sub}'`), 2)
  })

  test('los cuatro indicadores tienen ícono y acento propios y la variación usa verde/rojo según el sentido', async ({ page }) => {
    await iniciarSesion(page)
    const tarjetas = page.getByRole('region', { name: 'Indicadores', exact: true }).locator('> div')
    await expect(tarjetas).toHaveCount(4)
    const clases = await tarjetas.evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith('acento-'))))
    expect(new Set(clases).size).toBeGreaterThanOrEqual(3)
    expect(clases[0]).toBe('acento-indigo')
    expect(clases[1]).toBe('acento-sky')
    expect(clases[3]).toBe('acento-amber')
    for (const t of await tarjetas.all()) await expect(t.locator('svg').first()).toBeVisible()
    const variacion = await kpi(page, 'Variación vs período anterior').textContent()
    expect(clases[2]).toBe(/\+\d/.test(variacion ?? '') ? 'acento-red' : /-\d/.test(variacion ?? '') ? 'acento-green' : 'acento-slate')
  })

  test('el Presupuesto consolidado tiene encabezado degradado y los ocho indicadores en cuadrícula de 4 × 2', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    const fondo = await panel.locator('header').evaluate((e) => getComputedStyle(e).backgroundImage)
    expect(fondo).toContain('linear-gradient')
    const tiles = panel.getByRole('list', { name: 'Indicadores complementarios' }).locator('> [role=listitem] > div')
    await expect(tiles).toHaveCount(8)
    const ys = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(ys).size).toBe(2) // dos filas
    expect(ys.filter((y) => y === ys[0])).toHaveLength(4) // cuatro columnas
    const alturas = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    expect(new Set(alturas).size).toBe(1) // misma altura
    const acentos = await tiles.evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith('acento-'))))
    expect(acentos.slice(0, 2)).toEqual(['acento-blue', 'acento-slate'])
  })
})

test.describe('Presupuesto consolidado', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  const PERIODO = `(select id from public.budget_periods where household_id = ${HID} and start_date = '${INI}')`

  test('caso normal: métricas, barra de consumo y disponible = asignado − imputado', async ({ page }) => {
    await iniciarSesion(page)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    await expect(panel.getByText('En curso')).toBeVisible()
    const asignado = Number(sqlLocal(`select coalesce(sum(b.assigned_amount), 0) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where b.period_id = ${PERIODO} and f.is_active`))
    const imputado = Number(sqlLocal(`select coalesce(sum(a.amount), 0) from public.expense_fund_allocations a where a.period_id = ${PERIODO}`))
    const metrica = async (e: string) => dinero(await panel.getByText(e, { exact: true }).locator('xpath=..').locator('span').nth(1).textContent())
    expect(await metrica('Presupuesto asignado')).toBeCloseTo(asignado, 2)
    expect(await metrica('Disponible consolidado')).toBeCloseTo(asignado - imputado, 2)
    expect(await metrica('Exceso sobre el presupuesto')).toBe(0)
    const barra = panel.getByRole('progressbar', { name: 'Consumo del presupuesto consolidado' })
    await expect(barra).toHaveAttribute('aria-valuenow', String(Math.round((imputado / asignado) * 100)))
    await expect(panel.getByText(/Límite S\//)).toBeVisible()
    await expect(panel.getByText('Fondos sobregirados')).toBeVisible()
  })

  test('presupuesto agotado: disponible exactamente cero y estado "Agotado"', async ({ page }) => {
    sqlLocal(`update public.fund_period_budgets b set assigned_amount = coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.fund_id = b.fund_id and a.period_id = b.period_id), 0) where b.period_id = ${PERIODO}`)
    await iniciarSesion(page)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    await expect(panel.getByText('Agotado', { exact: true }).first()).toBeVisible()
    await expect(panel.getByText(/^Disponible S\/ 0\.00$/)).toBeVisible()
    await expect(panel.getByRole('progressbar', { name: 'Consumo del presupuesto consolidado' })).toHaveAttribute('aria-valuenow', '100')
    await expect(panel.getByText(/Excedente de/)).toHaveCount(0)
  })

  test('presupuesto excedido: muestra el exceso real, el límite y la advertencia', async ({ page }) => {
    sqlLocal(`update public.fund_period_budgets set assigned_amount = 10 where period_id = ${PERIODO}`)
    await iniciarSesion(page)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    const imputado = Number(sqlLocal(`select coalesce(sum(a.amount), 0) from public.expense_fund_allocations a where a.period_id = ${PERIODO}`))
    const asignado = Number(sqlLocal(`select sum(assigned_amount) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where b.period_id = ${PERIODO} and f.is_active`))
    await expect(panel.getByText('Excedido', { exact: true })).toBeVisible()
    await expect(panel.getByText(/Excedente de S\//)).toBeVisible()
    const exceso = imputado - asignado
    const caja = panel.getByText('Exceso sobre el presupuesto', { exact: true }).locator('xpath=..')
    expect(dinero(await caja.locator('span').nth(1).textContent())).toBeCloseTo(exceso, 2)
    await expect(panel.getByText(/Exceso S\//).first()).toBeVisible()
    const barra = panel.getByRole('progressbar', { name: 'Consumo del presupuesto consolidado' })
    expect(await barra.getAttribute('aria-valuetext')).toMatch(/Excede el presupuesto en S\//)
    await expect(panel.getByText(/Límite S\/ /)).toBeVisible()
    // registrar un gasto sigue siendo posible aunque el presupuesto esté superado
    await page.goto('/gastos')
    await expect(page.getByRole('button', { name: 'Nuevo gasto' })).toBeEnabled()
  })

  test('con filtros activos no resta el gasto filtrado del presupuesto: lo muestra aparte', async ({ page }) => {
    await iniciarSesion(page)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    const antes = await panel.getByText('Disponible consolidado', { exact: true }).locator('xpath=..').textContent()
    await filaAmbito(page, 'Hogar').click()
    await expect(panel.getByText(/Gasto con filtros actuales: S\//)).toBeVisible()
    await expect(panel.getByText(/no se puede repartir por los filtros/)).toBeVisible()
    expect(await panel.getByText('Disponible consolidado', { exact: true }).locator('xpath=..').textContent()).toBe(antes)
  })

  test('sin gasto sin fondo asignable: el indicador muestra S/ 0.00 y la ayuda se abre con teclado', async ({ page }) => {
    await iniciarSesion(page)
    const panel = page.getByRole('region', { name: 'Presupuesto consolidado' })
    await expect(panel.getByText('Sin fondo asignable').locator('xpath=..')).toContainText('S/ 0.00')
    await page.getByRole('button', { name: 'Cómo se calcula el presupuesto consolidado' }).focus()
    await expect(page.getByText('¿Cómo se calcula?')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('¿Cómo se calcula?')).toHaveCount(0)
  })
})
