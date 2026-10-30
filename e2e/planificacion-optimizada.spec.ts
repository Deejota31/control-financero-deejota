import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { accionPlantillaFondo, elegir, email, filaPlantilla, filaPlantillaFondo, iniciarSesion, password } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const ACT = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD')`)
const SIG = sqlLocal(`select to_char(date_trunc('month', current_date) + interval '1 month', 'YYYY-MM-DD')`)
const MES_SIG = SIG.slice(0, 7)
const periodo = (mes: string) => `(select id from public.budget_periods where household_id = ${HID} and start_date = '${mes}')`
const num = (sql: string) => Number(sqlLocal(sql))
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

function plantillaFondoSql(nombre: string, importe: number, o: { ambito?: string; ambitos?: string[]; general?: boolean; prioridad?: number } = {}) {
  const id = sqlLocal(`insert into public.fund_templates (household_id, name, is_general, suggested_amount, priority, icon_key, color_token) values (${HID}, '${nombre}', ${o.general ? 'true' : 'false'}, ${importe}, ${o.prioridad ?? 100}, 'wallet', 'c1') returning id`).split('\n')[0].trim()
  for (const a of o.ambitos ?? (o.ambito ? [o.ambito] : [])) sqlLocal(`insert into public.fund_template_scope_rules (household_id, template_id, ambito_id, effect) select ${HID}, '${id}', id, 'include' from public.ambitos where household_id = ${HID} and name = '${a}'`)
  return id
}

const asistente = (page: Page) => page.getByRole('dialog', { name: /^Planificación · / })
async function abrirAsistente(page: Page) {
  await page.goto(`/fondos?mes=${SIG}`)
  await page.getByRole('button', { name: 'Abrir planificación mensual' }).click()
  await expect(asistente(page)).toBeVisible()
  return asistente(page)
}

test.describe('Planificación: plantillas de fondos compactas', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(() => { sqlLocal(`delete from public.period_plans where period_id = ${periodo(SIG)}`); sqlLocal(`delete from public.funds where period_id = ${periodo(SIG)}`) })

  test('filas horizontales de poca altura con encabezados, estados Disponible/Seleccionada/Aplicada y cobertura con «+N»', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    plantillaFondoSql('General C', 4000, { general: true })
    plantillaFondoSql('Sodexo C', 280, { ambito: 'Trabajo', prioridad: 10 })
    plantillaFondoSql('Aporte Pareja con un nombre bastante largo para probar', 400, { ambitos: ['Familia', 'Personal', 'Hogar', 'Bebé'], prioridad: 20 })
    const a = await abrirAsistente(page)
    const sec = a.getByRole('region', { name: 'Mis plantillas de fondos' })
    for (const h of ['Plantilla', 'Cobertura', 'Importe', 'Prioridad', 'Estado']) await expect(sec.getByText(h, { exact: true }).first()).toBeAttached()
    await expect(sec.getByText('3 disponibles')).toBeVisible()
    await expect(sec.getByText('0 aplicadas')).toBeVisible()
    // Cada fila ocupa poco alto y los controles están alineados en una sola línea
    for (const n of ['General C', 'Sodexo C']) {
      const caja = (await filaPlantillaFondo(page, n).boundingBox())!
      expect(caja.height).toBeLessThanOrEqual(64)
    }
    // Cobertura real de la plantilla: máximo dos etiquetas y «+N» con el detalle completo
    await expect(sec.getByRole('button', { name: /Ver la cobertura completa de Aporte Pareja/ })).toBeVisible()
    // Estados
    await expect(filaPlantillaFondo(page, 'Sodexo C')).toContainText('Disponible')
    await sec.getByRole('checkbox', { name: 'Usar Sodexo C' }).check()
    await expect(filaPlantillaFondo(page, 'Sodexo C')).toContainText('Seleccionada')
    await sec.getByLabel('Importe de Sodexo C').fill('300')
    await sec.getByRole('checkbox', { name: 'Usar General C' }).check()
    await sec.getByLabel('Importe de General C').fill('5000')
    await expect(sec.getByText('2 seleccionadas · S/ 5,300.00')).toBeVisible()
    await sec.getByRole('button', { name: 'Aplicar 2 plantillas' }).click()
    await expect(page.getByText('Se crearon 2 fondos.')).toBeVisible()
    await expect(a).toBeVisible()
    for (const n of ['General C', 'Sodexo C']) {
      const f = filaPlantillaFondo(page, n)
      await expect(f).toContainText('Aplicada')
      await expect(f.getByRole('img', { name: /ya aplicada en este mes/ })).toBeVisible() // verificación, no una casilla deshabilitada
      await expect(f.getByRole('checkbox')).toHaveCount(0)
    }
    await expect(filaPlantillaFondo(page, 'General C')).toContainText('S/ 5,000.00') // importe mensual real
    await expect(sec.getByText('1 disponible')).toBeVisible()
    await expect(sec.getByText('2 aplicadas')).toBeVisible()
    // La plantilla conserva su importe sugerido
    expect(num(`select suggested_amount from public.fund_templates where household_id = ${HID} and name = 'General C'`)).toBe(4000)
    // «Administrar plantillas» abre la biblioteca sin cerrar la planificación
    await sec.getByRole('button', { name: 'Administrar plantillas' }).click()
    await expect(page.getByRole('dialog', { name: 'Plantillas de fondos' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(a).toBeVisible()
    await expect(a.getByRole('heading', { name: /Prepara tus fondos de/ })).toBeVisible()
  })

  test('menú de fila: preparar fondo con el formulario, actualizar la plantilla con confirmación y duplicar', async ({ page }) => {
    await iniciarSesion(page)
    plantillaFondoSql('Sodexo M', 280, { ambito: 'Trabajo', prioridad: 10 })
    const a = await abrirAsistente(page)
    const sec = a.getByRole('region', { name: 'Mis plantillas de fondos' })
    await sec.getByLabel('Importe de Sodexo M').fill('310')
    await accionPlantillaFondo(page, 'Sodexo M', 'Actualizar plantilla con estos valores')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Actualizar plantilla' }).click()
    await expect(page.getByText('Plantilla actualizada.')).toBeVisible()
    expect(num(`select suggested_amount from public.fund_templates where household_id = ${HID} and name = 'Sodexo M'`)).toBe(310)
    await accionPlantillaFondo(page, 'Sodexo M', 'Duplicar')
    await expect(filaPlantillaFondo(page, 'Sodexo M (copia)')).toBeVisible()
    await accionPlantillaFondo(page, 'Sodexo M', /Preparar fondo con el formulario/)
    await expect(page.getByRole('dialog', { name: 'Nuevo fondo desde plantilla' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(a).toBeVisible()
  })
})

test.describe('Planificación: etapa Gastos y Resumen', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(() => { sqlLocal(`delete from public.period_plans where period_id = ${periodo(SIG)}`); sqlLocal(`delete from public.funds where period_id = ${periodo(SIG)}`) })

  test('la etapa Gastos es un gestor: selecciona, edita, registra varios sin cerrar el asistente y actualiza estados; el Resumen cuadra y finaliza', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    plantillaFondoSql('General R', 3000, { general: true })
    const a = await abrirAsistente(page)
    const fondos = a.getByRole('region', { name: 'Mis plantillas de fondos' })
    await fondos.getByRole('checkbox', { name: 'Usar General R' }).check()
    await fondos.getByRole('button', { name: 'Aplicar 1 plantilla' }).click()
    await expect(page.getByText('Se creó 1 fondo.')).toBeVisible()
    await a.getByRole('button', { name: 'Continuar' }).click()

    // Etapa Gastos: tabla con encabezados, secciones por categoría, selección y edición inline
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    for (const h of ['Plantilla', 'Clasificación', 'Importe', 'Medio', 'Fecha', 'Estado']) await expect(a.getByText(h, { exact: true }).first()).toBeAttached()
    await expect(a.getByRole('region', { name: 'Servicios', exact: true })).toBeVisible()
    await expect(a.getByText('0 registrados')).toBeVisible()
    const antes = num(`select count(*) from public.expenses where household_id = ${HID}`)
    await a.getByLabel('Importe de Internet').fill('130.50')
    await a.getByLabel('Importe de Streaming').fill('50')
    await expect(a.getByText('2 seleccionadas · S/ 180.50')).toBeVisible()
    await expect(filaPlantilla(page, 'Internet')).toContainText('Seleccionada')
    await a.getByRole('button', { name: /Revisar y registrar 2 gastos/ }).click()
    const rev = page.getByRole('dialog', { name: 'Confirmar registro de gastos' })
    await expect(rev.getByText('Válido').first()).toBeVisible()
    expect(num(`select count(*) from public.expenses where household_id = ${HID}`)).toBe(antes) // la revisión no crea nada
    await rev.getByRole('button', { name: 'Registrar 2 gastos' }).click()
    await expect(page.getByText(/Se registraron 2 gastos por S\/ 180\.50/)).toBeVisible()
    await expect(asistente(page)).toBeVisible() // el asistente sigue en la etapa Gastos
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    await expect(filaPlantilla(page, 'Internet')).toContainText('Registrada')
    await expect(a.getByText('2 registrados')).toBeVisible()
    expect(num(`select count(*) from public.expenses where household_id = ${HID}`)).toBe(antes + 2)
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = 'Internet'`)).toBe(120) // la plantilla no cambió
    // Gastos queda «Completada» al confirmar la revisión aunque haya plantillas opcionales pendientes
    await a.getByRole('button', { name: 'Continuar' }).click()

    // Resumen ejecutivo
    await expect(a.getByRole('heading', { name: /Resumen de planificación/ })).toBeVisible()
    const kpis = a.getByRole('region', { name: 'Indicadores' })
    await expect(kpis).toContainText('Presupuesto total')
    await expect(kpis).toContainText('S/ 3,000.00')
    await expect(kpis).toContainText('Gastos reales')
    await expect(kpis).toContainText('S/ 180.50')
    await expect(kpis).toContainText('Disponible')
    await expect(kpis).toContainText('S/ 2,819.50')
    const fin = a.getByRole('region', { name: 'Estado financiero' })
    await expect(fin.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6')
    await expect(fin).toContainText('Consumo de fondos')
    await expect(fin).toContainText('Gastos sin fondo compatible')
    await expect(fin).toContainText('S/ 0.00')
    const plan = a.getByRole('region', { name: 'Planificación' })
    await expect(plan.getByRole('group', { name: 'Fondos' })).toContainText('Completada')
    await expect(plan.getByRole('group', { name: 'Gastos' })).toContainText('Completada')
    await expect(plan.getByRole('group', { name: 'Resumen' })).toContainText('Por finalizar')
    await a.getByRole('button', { name: 'Finalizar planificación' }).click()
    await expect(page.getByText(/Planificación de .* finalizada/)).toBeVisible()
    // Reabrir: queda finalizada y no crea fondos ni gastos
    const fondosAntes = num(`select count(*) from public.funds where period_id = ${periodo(SIG)}`)
    const gastosAntes = num(`select count(*) from public.expenses where household_id = ${HID}`)
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Planificación', exact: true }).click()
    await page.getByRole('dialog', { name: 'Planificación mensual' }).getByRole('button', { name: 'Ver planificación' }).click()
    await expect(asistente(page).getByRole('heading', { name: /Resumen de planificación/ })).toBeVisible() // una planificación finalizada se abre directamente en su resumen
    await expect(asistente(page).getByText(/Finalizada/).first()).toBeVisible()
    await expect(asistente(page).getByRole('button', { name: 'Finalizar planificación' })).toHaveCount(0)
    expect(num(`select count(*) from public.funds where period_id = ${periodo(SIG)}`)).toBe(fondosAntes)
    expect(num(`select count(*) from public.expenses where household_id = ${HID}`)).toBe(gastosAntes)
  })

  test('el Resumen sin fondos ni gastos muestra ceros coherentes y pide confirmar las etapas', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await a.getByRole('button', { name: /^3\s*Resumen/ }).click()
    const kpis = a.getByRole('region', { name: 'Indicadores' })
    await expect(kpis).toContainText('S/ 0.00')
    await expect(a.getByRole('region', { name: 'Estado financiero' }).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    await expect(a.getByRole('button', { name: 'Finalizar planificación' })).toBeDisabled()
    await expect(a.getByText(/Confirma u omite cada etapa/)).toBeVisible()
  })
})

test.describe('Gastos imputados a un fondo: filtros, paginación real y scroll independiente', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  /** 40 gastos de Hogar en el mes actual (algunos con nota) para tener volumen real; luego se recalcula el mes como hace el servidor. */
  function volumen() {
    sqlLocal(`insert into public.expenses (household_id, expense_date, amount, description, ambito_id, categoria_id, payment_method_id, expense_type, is_recurring, notes, created_by)
      select ${HID}, (date_trunc('month', current_date) + ((n % 20) || ' days')::interval)::date, 5 + n, 'Volumen ' || lpad(n::text, 2, '0'),
        (select id from public.ambitos where household_id = ${HID} and name = 'Hogar'), (select id from public.categorias where household_id = ${HID} and name = 'Servicios' limit 1),
        (select id from public.medios_pago where household_id = ${HID} and name = 'Transferencia'), 'variable', false, case when n % 10 = 0 then 'nota-especial-xyz' else null end, '${E2E_UID}'
      from generate_series(1, 40) n; select public.recalc_period(${periodo(ACT)})`) // una sola transacción: la suma de imputaciones se valida al confirmarla
  }
  const abrir = async (page: Page, fondo: string) => {
    await page.goto('/fondos')
    const fila = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: fondo, exact: true }) })
    await fila.getByRole('button', { name: 'Ver gastos' }).click()
    const d = page.getByRole('dialog', { name: new RegExp(`Gastos imputados · ${fondo}`) })
    await expect(d).toBeVisible()
    return d
  }
  const pagina = (d: ReturnType<Page['getByRole']>) => d.getByRole('navigation', { name: 'Paginación' })
  const resumenPie = (d: ReturnType<Page['getByRole']>) => pagina(d).locator('span').first()

  test('paginación real de 10/20/50/100, búsqueda sobre todos los registros, orden global y filtros combinados', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    volumen()
    const d = await abrir(page, 'Fondo General')
    await elegir(page, d.getByRole('combobox', { name: 'Registros por página' }), '10 por página')
    await expect(resumenPie(d)).toContainText(/^1–10 de \d+/)
    await expect(d.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    await expect(d.getByRole('button', { name: 'Página 2' })).toBeVisible()
    await expect(d.locator('li:has(button[aria-controls])')).toHaveCount(10) // 10 filas, no se acumulan
    await expect(d.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    const total = Number(/de (\d+)/.exec(await resumenPie(d).innerText())![1])
    expect(total).toBeGreaterThan(20) // volumen suficiente para tres páginas de 10

    // Orden por importe mayor primero sobre TODOS los resultados: lo último de la página 1 ≥ lo primero de la 2
    await elegir(page, d.getByRole('combobox', { name: 'Ordenar por' }), 'Importe: mayor primero')
    const importes = async () => (await d.getByRole('listitem').locator('span.num > span.font-bold').allInnerTexts()).map((t) => Number(t.replace(/[^\d.]/g, '')))
    const p1 = await importes()
    expect(p1).toEqual([...p1].sort((x, y) => y - x))
    await d.getByRole('button', { name: 'Página siguiente' }).click()
    await expect(resumenPie(d)).toContainText(/^11–20 de/)
    const p2 = await importes()
    expect(p2).toHaveLength(10)
    expect(p1[p1.length - 1]).toBeGreaterThanOrEqual(p2[0])
    // Cambiar de página contrae el detalle abierto y vuelve al inicio del listado
    await d.locator('button[aria-controls]').first().click()
    await expect(d.getByRole('region', { name: /^Detalle de / })).toHaveCount(1)
    await d.getByRole('button', { name: 'Página siguiente' }).click()
    await expect(d.getByRole('region', { name: /^Detalle de / })).toHaveCount(0)

    // Búsqueda sobre todos los movimientos (notas incluidas): vuelve a la página 1 y muestra el total filtrado
    await d.getByLabel('Buscar por concepto').fill('nota-especial-xyz')
    await expect(resumenPie(d)).toContainText(/^1–([1-9][0-9]*) de ([1-9][0-9]*)/) // solo los movimientos con esa nota, sobre todo el fondo
    await expect(d.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    await d.getByRole('button', { name: 'Limpiar búsqueda' }).click()
    await expect(resumenPie(d)).toContainText(/^1–10 de \d+/)
    await d.getByLabel('Buscar por concepto').fill('Servicios') // por categoría
    await expect(resumenPie(d)).toContainText(/de \d+/)
    await d.getByLabel('Buscar por concepto').fill('zzz-no-existe')
    await expect(d.getByText('Ningún gasto coincide')).toBeVisible()
    await expect(resumenPie(d)).toContainText('0–0 de 0')
    await d.getByRole('button', { name: 'Quitar búsqueda y filtros' }).click()

    // Tamaños 50 y 100: una sola página cuando todo cabe
    await elegir(page, d.getByRole('combobox', { name: 'Registros por página' }), '100 por página')
    await expect(d.getByRole('button', { name: /^Página \d+$/ })).toHaveCount(1)
    await expect(d.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
  })

  test('scroll independiente: el diálogo no crece al expandir, los encabezados y el pie permanecen visibles', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 })
    await iniciarSesion(page)
    volumen()
    const d = await abrir(page, 'Hogar')
    await elegir(page, d.getByRole('combobox', { name: 'Registros por página' }), '50 por página')
    const lista = d.getByLabel('Gastos imputados', { exact: true }).last()
    const alto0 = (await d.boundingBox())!.height
    expect(alto0).toBeLessThanOrEqual(800)
    const scrollable = await lista.evaluate((e) => e.scrollHeight > e.clientHeight)
    expect(scrollable).toBe(true)
    await d.locator('button[aria-controls]').first().click()
    expect(Math.abs((await d.boundingBox())!.height - alto0)).toBeLessThan(2) // expandir no agranda el diálogo
    // Desplazar el listado: cabecera de tabla fija en lo alto y pie accesible
    const cab = d.getByText('Concepto', { exact: true }).first()
    const y0 = (await cab.boundingBox())!.y
    await lista.evaluate((e) => e.scrollTo({ top: 400 }))
    expect(Math.abs((await cab.boundingBox())!.y - y0)).toBeLessThanOrEqual(2)
    await expect(d.getByRole('button', { name: 'Página siguiente' })).toBeInViewport()
    await expect(d.getByLabel('Buscar por concepto')).toBeInViewport() // la zona superior no se mueve
    // El detalle organiza movimiento y distribución financiera
    await expect(d.getByRole('region', { name: /^Detalle de / })).toContainText('Información del movimiento')
    await expect(d.getByRole('region', { name: /^Detalle de / })).toContainText('Distribución financiera')
  })

  test('Fondo General: directas, compartidas y excedentes se filtran con el selector visual y no se duplican importes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    volumen()
    const d = await abrir(page, 'Fondo General')
    const consumido = Number(/Consumido S\/ ([\d,]+\.\d{2})/.exec((await d.getByRole('region', { name: 'Resumen del fondo' }).innerText()).replace(/\s+/g, ' '))![1].replace(',', ''))
    await elegir(page, d.getByRole('combobox', { name: 'Registros por página' }), '100 por página')
    // El subtotal (junto al rango) aparece con un filtro activo: directas + compartidas + excedentes = consumo del fondo, sin duplicar importes por joins
    let suma = 0
    for (const [opcion, etiqueta] of [['Directas', null], ['Compartidas', null], ['Excedentes', /Excedente de /]] as const) {
      await elegir(page, d.getByRole('combobox', { name: 'Tipo de imputación' }), opcion)
      if (etiqueta) await expect(d.getByText(etiqueta).first()).toBeVisible()
      const pie = (await resumenPie(d).innerText()).replace(/S\/\s*/g, '')
      const m = /([\d,]+\.\d{2})/.exec(pie)
      suma += m ? Number(m[1].replace(',', '')) : 0
    }
    expect(suma).toBeCloseTo(consumido, 2)
  })

  for (const ancho of [320, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1920]) {
    test(`responsive ${ancho}px: filtros, listado y paginación sin desbordes y con el pie accesible`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 })
      await iniciarSesion(page)
      const d = await abrir(page, 'Fondo General')
      await expect(d.getByLabel('Buscar por concepto')).toBeInViewport()
      await expect(d.getByRole('button', { name: 'Página siguiente' })).toBeInViewport()
      await expect(d.getByRole('combobox', { name: 'Registros por página' })).toBeInViewport()
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
      const dentro = await d.evaluate((raiz) => {
        const c = raiz.getBoundingClientRect()
        return Array.from(raiz.querySelectorAll('button, input, [role="combobox"]')).filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > c.right + 1 || b.left < c.left - 1) }).length
      })
      expect(dentro).toBe(0)
      const alto = (await d.boundingBox())!.height
      await d.locator('button[aria-controls]').first().click()
      expect(Math.abs((await d.boundingBox())!.height - alto)).toBeLessThan(2)
    })
  }

  for (const tema of ['light', 'dark'] as const) {
    test(`accesibilidad (${tema}): modal de gastos imputados, gestor de gastos y resumen sin violaciones graves`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema })
      await iniciarSesion(page)
      const d = await abrir(page, 'Fondo General')
      await d.locator('button[aria-controls]').first().click()
      const r1 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(r1.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 140)}`)).toEqual([])
      await page.keyboard.press('Escape')
      plantillaFondoSql('General A', 1000, { general: true })
      const a = await abrirAsistente(page)
      await a.getByRole('checkbox', { name: 'Usar General A' }).check()
      await a.getByRole('button', { name: 'Aplicar 1 plantilla' }).click()
      await a.getByRole('button', { name: 'Continuar' }).click()
      await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
      const r2 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(r2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 140)}`)).toEqual([])
      await a.getByRole('button', { name: 'Continuar' }).click()
      await expect(a.getByRole('heading', { name: /Resumen de planificación/ })).toBeVisible()
      const r3 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(r3.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 140)}`)).toEqual([])
    })
  }

  test('MES_SIG se usa para fechas dentro del mes siguiente en la etapa de gastos', async ({ page }) => {
    await iniciarSesion(page)
    plantillaFondoSql('General F', 1000, { general: true })
    const a = await abrirAsistente(page)
    await a.getByRole('checkbox', { name: 'Usar General F' }).check()
    await a.getByRole('button', { name: 'Aplicar 1 plantilla' }).click()
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(a.getByLabel('Fecha de Internet')).toContainText(`06/${MES_SIG.slice(5)}/${MES_SIG.slice(0, 4)}`) // el día sugerido dentro del mes que se planifica
    await elegir(page, a.getByRole('combobox', { name: 'Medio de pago de Internet' }), 'Plin')
    await expect(filaPlantilla(page, 'Internet')).toContainText('Seleccionada')
  })
})
