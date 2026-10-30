import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const MES = `(select id from public.budget_periods where household_id = ${HID} and start_date = date_trunc('month', current_date)::date)`
const fondo = (nombre: string) => `(select id from public.funds where period_id = ${MES} and name = '${nombre}')`
const lista = (page: Page) => page.getByRole('list', { name: 'Fondos' })
const fila = (page: Page, nombre: string) => lista(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
/** Caja de la celda de un encabezado de la tabla (el encabezado es visual: aria-hidden). */
const encabezado = (page: Page, texto: string) => page.locator('div[aria-hidden="true"]').locator('span', { hasText: new RegExp(`^${texto}$`) }).first()

test.describe('Tabla de Fondos: distribución, cobertura y uso', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('1–3 · columnas proporcionales: el nombre no deja un hueco y los encabezados coinciden con sus datos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    await expect(lista(page)).toBeVisible()
    const tabla = (await lista(page).boundingBox())!
    const celdas = await Promise.all(['Fondo', 'Cobertura', 'Prioridad', 'Asignado', 'Consumido', 'Disponible', 'Uso', 'Acciones'].map(async (t) => [t, (await encabezado(page, t).boundingBox())!] as const))
    const cols = Object.fromEntries(celdas)
    // todas las columnas están, en orden y sin solaparse
    const xs = celdas.map(([, b]) => b.x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    // Fondo ocupa una porción razonable (no domina la fila dejando el resto aplastado a la derecha)
    const anchoFondo = cols.Cobertura.x - cols.Fondo.x
    expect(anchoFondo / tabla.width, 'columna Fondo').toBeGreaterThan(0.14)
    expect(anchoFondo / tabla.width, 'columna Fondo').toBeLessThan(0.34)
    // las columnas financieras no quedan comprimidas en el borde derecho: Asignado empieza en la segunda mitad pero antes del 75 %
    expect((cols.Asignado.x - tabla.x) / tabla.width).toBeGreaterThan(0.4)
    expect((cols.Asignado.x - tabla.x) / tabla.width).toBeLessThan(0.75)
    // el importe de cada fila termina donde termina su encabezado (alineado a la derecha)
    const primera = lista(page).getByRole('listitem').first()
    const importes = primera.locator('span.num')
    for (const [i, t] of ['Asignado', 'Consumido', 'Disponible'].entries()) {
      const celda = (await importes.nth(i).boundingBox())!
      const cab = cols[t]
      expect(Math.abs(celda.x + celda.width - (cab.x + cab.width)), `${t}: encabezado y valor alineados`).toBeLessThanOrEqual(3)
    }
  })

  test('2 · la cobertura refleja las reglas reales del fondo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    // General: sin inclusiones => «Cobertura general» y la exclusión real (Sodexo) distinguida
    const excluido = sqlLocal(`select m.name from public.fund_payment_rules r join public.medios_pago m on m.id = r.payment_method_id where r.fund_id = ${fondo('Fondo General')} and r.effect = 'exclude'`)
    const general = fila(page, 'Fondo General').getByLabel('Cobertura de Fondo General').locator('visible=true')
    await expect(general).toContainText('Cobertura general')
    await expect(general).toContainText(`Sin ${excluido}`)
    // Específico: lo que dicen sus reglas (nombres del catálogo), sin «Cobertura general»
    const reglas = sqlLocal(`select string_agg(distinct n, '|') from (
      select c.name n from public.fund_scope_rules r join public.categorias c on c.id = r.categoria_id where r.fund_id = ${fondo('Alimentos Sodexo')} and r.effect = 'include'
      union select m.name from public.fund_payment_rules r join public.medios_pago m on m.id = r.payment_method_id where r.fund_id = ${fondo('Alimentos Sodexo')} and r.effect = 'include') x`).split('|')
    const sodexo = fila(page, 'Alimentos Sodexo').getByLabel('Cobertura de Alimentos Sodexo').locator('visible=true')
    for (const n of reglas) await expect(sodexo).toContainText(n)
    await expect(sodexo).not.toContainText('Cobertura general')
    const hogar = sqlLocal(`select a.name from public.fund_scope_rules r join public.ambitos a on a.id = r.ambito_id where r.fund_id = ${fondo('Hogar')} and r.effect = 'include'`)
    await expect(fila(page, 'Hogar').getByLabel('Cobertura de Hogar').locator('visible=true')).toContainText(hogar)
  })

  test('2 · con muchas reglas se muestran dos etiquetas, un «+N» y el detalle completo con inclusiones y exclusiones', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    sqlLocal(`insert into public.fund_scope_rules (household_id, fund_id, categoria_id, effect)
      select ${HID}, ${fondo('Bebé')}, c.id, 'include' from public.categorias c join public.ambitos a on a.id = c.ambito_id where a.name = 'Hogar' and c.household_id = ${HID} limit 3`)
    sqlLocal(`insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect) select ${HID}, ${fondo('Bebé')}, id, 'exclude' from public.medios_pago where household_id = ${HID} and name = 'Efectivo'`)
    try {
      await page.goto('/fondos')
      const cobertura = fila(page, 'Bebé').getByLabel('Cobertura de Bebé').locator('visible=true')
      await expect(cobertura).toBeVisible()
      const mas = cobertura.getByRole('button', { name: /Ver la cobertura completa de Bebé/ })
      await expect(mas).toBeVisible()
      await expect(mas).toHaveText(/^\+\d+$/)
      await mas.focus() // también con teclado
      const detalle = page.getByRole('tooltip')
      await expect(detalle).toContainText('Incluye')
      await expect(detalle).toContainText('Excluye')
      await expect(detalle).toContainText('Sin Efectivo')
    } finally {
      sqlLocal(`delete from public.fund_scope_rules where fund_id = ${fondo('Bebé')} and categoria_id is not null`)
      sqlLocal(`delete from public.fund_payment_rules where fund_id = ${fondo('Bebé')} and effect = 'exclude'`)
    }
  })

  test('6 · un fondo sin presupuesto no muestra porcentajes engañosos ni divide entre cero', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const antes = sqlLocal(`select assigned_amount from public.fund_period_budgets where fund_id = ${fondo('Familia')}`)
    sqlLocal(`update public.fund_period_budgets set assigned_amount = 0 where fund_id = ${fondo('Familia')}`)
    try {
      await page.goto('/fondos')
      const f = fila(page, 'Familia')
      await expect(f.getByText(/Sin presupuesto/)).toBeVisible()
      await expect(f.getByRole('progressbar')).toHaveCount(0)
      await expect(f).not.toContainText('NaN')
      await expect(f).not.toContainText('Infinity')
    } finally {
      sqlLocal(`update public.fund_period_budgets set assigned_amount = ${antes} where fund_id = ${fondo('Familia')}`)
    }
  })

  test('6 · la barra de uso refleja el consumo real y el estado (habitual, atención, sobregasto)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    const filas = await lista(page).getByRole('listitem').all()
    for (const f of filas) {
      const barra = f.getByRole('progressbar')
      if ((await barra.count()) === 0) continue
      const nombre = (await f.getByRole('heading').first().textContent())!.trim()
      const [asig, cons] = sqlLocal(`select b.assigned_amount || '|' || coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.fund_id = b.fund_id), 0) from public.fund_period_budgets b where b.fund_id = ${fondo(nombre)}`).split('|').map(Number)
      const pct = Math.min(100, Math.round((cons / asig) * 100))
      expect(Number(await barra.getAttribute('aria-valuenow')), `uso de ${nombre}`).toBeCloseTo(pct, 0)
    }
  })

  test('8 · sin desbordes de 320 a 1920 px, con las columnas que caben y tarjetas en móvil', async ({ page }) => {
    test.setTimeout(120_000)
    await iniciarSesion(page)
    for (const [w, h] of [[320, 700], [375, 812], [430, 932], [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto('/fondos')
      await expect(lista(page)).toBeVisible()
      expect(await sinDesborde(page), `página ${w}px`).toBeLessThanOrEqual(1)
      const caja = (await lista(page).evaluate((el) => { const p = el.parentElement as HTMLElement; return { sw: p.scrollWidth, cw: p.clientWidth } }))
      expect(caja.sw, `tabla ${w}px sin scroll interno`).toBeLessThanOrEqual(caja.cw + 1)
      const primera = lista(page).getByRole('listitem').first()
      await expect(primera.getByRole('button', { name: /Ver gastos/ })).toBeVisible()
      await expect(primera.getByRole('button', { name: /Más acciones de/ })).toBeVisible()
      const mostradas = await page.locator('div[aria-hidden="true"]').locator('span', { hasText: /^Cobertura$/ }).first().isVisible()
      expect(mostradas, `columna Cobertura visible solo con espacio (${w}px)`).toBe(w >= 1366)
      const cab = await page.locator('div[aria-hidden="true"]').locator('span', { hasText: /^Asignado$/ }).first().isVisible()
      expect(cab, `encabezados solo en tabla (${w}px)`).toBe(w >= 1024)
    }
  })

  test('8 · modo oscuro: tabla y tarjetas sin desbordes', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/fondos')
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    for (const [w, h] of [[390, 844], [1280, 800], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await expect(lista(page)).toBeVisible()
      expect(await sinDesborde(page), `oscuro ${w}px`).toBeLessThanOrEqual(1)
    }
  })

  test('10 · la independencia mensual se mantiene: el mes siguiente no muestra estos fondos', async ({ page }) => {
    await iniciarSesion(page)
    const sig = sqlLocal(`select to_char(date_trunc('month', current_date) + interval '1 month', 'YYYY-MM-DD')`)
    await page.goto(`/fondos?mes=${sig}`)
    await expect(page.getByText(/Todavía no tienes fondos configurados/)).toBeVisible()
    await expect(lista(page)).toHaveCount(0)
  })
})
