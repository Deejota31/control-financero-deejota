import { readFile } from 'node:fs/promises'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Más gastos que el antiguo límite de 5,000 (y que el máximo de 1,000 filas por respuesta del API).
 * Se cargan directamente en la base del usuario E2E (que se reinicia tras la prueba) y se comparan los totales
 * mostrados por la aplicación con los calculados por SQL.
 */
const TOTAL_MASIVOS = 5600

const dinero = (t: string | null) => Number((t ?? '').replace(/[^\d.-]/g, ''))

/** Lector CSV mínimo con comillas (el formato lo genera aCsv). */
function filasCsv(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let comillas = false
  const SALTO = String.fromCharCode(10)
  const RETORNO = String.fromCharCode(13)
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"'
        i++
      } else if (c === '"') comillas = false
      else celda += c
    } else if (c === '"') comillas = true
    else if (c === ',') {
      fila.push(celda)
      celda = ''
    } else if (c === SALTO) {
      fila.push(celda.endsWith(RETORNO) ? celda.slice(0, -1) : celda)
      filas.push(fila)
      fila = []
      celda = ''
    } else celda += c
  }
  if (celda || fila.length) {
    fila.push(celda)
    filas.push(fila)
  }
  return filas
}

function cargarMasivos() {
  sqlLocal(`
    with h as (select household_id as hid from public.profiles where user_id = '${E2E_UID}'),
    ids as (
      select h.hid,
        (select id from public.ambitos where household_id = h.hid and name = 'Personal') as amb,
        (select c.id from public.categorias c join public.ambitos a on a.id = c.ambito_id where a.household_id = h.hid and a.name = 'Personal' and c.name = 'Ocio') as cat,
        (select id from public.medios_pago where household_id = h.hid and name = 'Yape') as med
      from h)
    insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id)
    select i.hid, date_trunc('month', current_date)::date + (g % 24), ((g % 97) + 1) + 0.25, 'masivo ' || g, i.amb, i.cat, i.med
    from ids i, generate_series(1, ${TOTAL_MASIVOS}) g;
    select public.recalc_period((select id from public.budget_periods where household_id = (select household_id from public.profiles where user_id = '${E2E_UID}') and start_date = date_trunc('month', current_date)::date));
  `)
}

function totalesSql() {
  const hid = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
  const fila = sqlLocal(`select count(*) || '|' || sum(amount) from public.expenses where household_id = ${hid} and status = 'active' and expense_date between date_trunc('month', current_date)::date and (date_trunc('month', current_date) + interval '1 month - 1 day')::date`)
  const [cantidad, total] = fila.split('|')
  return { cantidad: Number(cantidad), total: Number(total) }
}

test.describe('Volumen: totales exactos con más gastos que el límite anterior', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.setTimeout(240_000)

  test('Dashboard, Gastos, Fondos y Salud incluyen todos los registros', async ({ page }) => {
    cargarMasivos()
    const esperado = totalesSql()
    expect(esperado.cantidad).toBeGreaterThan(5000)
    expect(esperado.cantidad).toBeGreaterThan(TOTAL_MASIVOS) // masivos + seed demo

    // Dashboard: el KPI, la nota y el gráfico acumulado usan el total real
    await iniciarSesion(page)
    const kpi = page.getByLabel('Indicadores').locator('div').filter({ has: page.getByText('Gasto del período', { exact: true }) }).first()
    await expect(kpi).toContainText(`${esperado.cantidad} movimientos`)
    expect(dinero(await kpi.locator('span').nth(1).textContent())).toBeCloseTo(esperado.total, 2)
    const grafico = page.getByRole('img', { name: /^Gasto acumulado de/ })
    expect((await grafico.getAttribute('aria-label'))!.replace(/,/g, '')).toContain(`S/ ${esperado.total.toFixed(2)}`)
    // La distribución por ámbito suma el mismo total
    const filasAmbito = await page.getByLabel('Distribución por ámbito').getByRole('button').allTextContents()
    const suma = filasAmbito.map((t) => dinero(t.match(/S\/ [\d,]+\.\d{2}/)?.[0] ?? '0')).reduce((s, v) => s + v, 0)
    expect(suma).toBeCloseTo(esperado.total, 1)

    // Gastos: la paginación cuenta todos y la exportación entrega todas las filas
    await page.goto('/gastos')
    await expect(page.getByText(`de ${esperado.cantidad}`, { exact: false }).first()).toBeVisible()
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()])
    const csv = await readFile((await descarga.path())!, 'utf8')
    const filas = filasCsv(csv.replace(String.fromCharCode(0xfeff), '')).filter((f) => f.length > 1)
    const col = filas[0].indexOf('Importe (PEN)')
    expect(col).toBeGreaterThan(0)
    expect(filas.length - 1).toBe(esperado.cantidad)
    const importes = filas.slice(1).map((f) => Number(f[col]))
    expect(importes.every((n) => !Number.isNaN(n))).toBe(true)
    expect(importes.reduce((t, v) => t + v, 0)).toBeCloseTo(esperado.total, 1)

    // Configuración: exportación completa (más de 5,000 filas) en CSV y en respaldo JSON
    await page.goto('/configuracion?seccion=exportar')
    const [dCsv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()])
    const csvCfg = filasCsv((await readFile((await dCsv.path())!, 'utf8')).replace(String.fromCharCode(0xfeff), ''))
    const hist = sqlLocal(`select count(*) || '|' || coalesce(sum(amount), 0) from public.expenses where status = 'active' and household_id = (select household_id from public.profiles where user_id = '${E2E_UID}')`).split('|').map(Number)
    expect(csvCfg.length - 1).toBe(hist[0])
    expect(hist[0]).toBeGreaterThan(5000)
    const colImp = csvCfg[0].indexOf('importe')
    expect(csvCfg.slice(1).reduce((t, f) => t + Number(f[colImp]), 0)).toBeCloseTo(hist[1], 1)
    await page.getByRole('button', { name: 'Descargar respaldo' }).click()
    const [dJson] = await Promise.all([page.waitForEvent('download'), page.getByRole('alertdialog').getByRole('button', { name: 'Descargar respaldo' }).click()])
    const respaldo = JSON.parse(await readFile((await dJson.path())!, 'utf8'))
    expect(respaldo.gastos.length).toBe(Number(sqlLocal(`select count(*) from public.expenses where household_id = (select household_id from public.profiles where user_id = '${E2E_UID}')`)))
    expect(respaldo.imputaciones.length).toBeGreaterThanOrEqual(hist[0])

    // Fondos: el consumo imputado (miles de imputaciones) coincide con el total
    await page.goto('/fondos')
    const consumido = page.getByLabel('Resumen del período').locator('div').filter({ has: page.getByText('Consumido', { exact: true }) }).last()
    await expect.poll(async () => dinero(await consumido.locator('span').nth(1).textContent())).toBeCloseTo(esperado.total, 1)

    // Salud financiera: lee todo el historial sin truncar
    await page.goto('/salud')
    const gastado = page.getByLabel('¿Cuánto presupuesto queda?').locator('div').filter({ has: page.getByText('Gastado', { exact: true }) }).last()
    await expect.poll(async () => dinero(await gastado.locator('span').nth(1).textContent())).toBeCloseTo(esperado.total, 1)
    await expect(gastado).toContainText(`${esperado.cantidad} movimientos`)
  })
})
