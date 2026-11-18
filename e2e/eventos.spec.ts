import { test, expect } from './fixtures'
import { E2E_UID, sqlLocal } from './db'
import { elegirEnGasto, email, iniciarSesion as acceder, password, vigilarConsola } from './helpers'
import { rest, tokenDe } from './api'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const HID = `(select household_id from public.profiles where user_id='${E2E_UID}')`
async function iniciarSesion(page: Page) {
  await acceder(page)
  await expect(page.getByRole('region', { name: 'Filtros del dashboard' })).toBeVisible()
}
function eventoSql(nombre = 'Objetivo de prueba', plantilla = false) {
  return sqlLocal(`insert into public.events(household_id,user_id,name,description,target_date,budget,is_template,icon_key,color_token) values(${HID},'${E2E_UID}','${nombre}','Un objetivo preparado con calma y cada gasto en su lugar.',current_date+60,5000,${plantilla},'cake','c1') returning id`).split('\n')[0].trim()
}
async function rpc(page: Page, nombre: string, body: unknown) {
  const r = await page.request.post(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/${nombre}`, { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${await tokenDe(page)}` }, data: body })
  if (!r.ok()) throw new Error(`RPC ${nombre}: ${r.status()} ${await r.text()}`)
  return r.json()
}
async function ir(page: Page, id: string) { await page.goto(`/eventos/${id}`); await expect(page.getByRole('group', { name: 'Secciones del evento' })).toBeVisible() }

test.describe('Eventos y metas', () => {
  test.skip(!email || !password, 'Cuenta E2E propia necesaria')
  test('crear evento, planificar contrato y registrar un adelanto real sin doble contabilización', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await page.goto('/eventos')
    await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click()
    const f = page.getByRole('dialog', { name: 'Nuevo evento', exact: true })
    await f.getByLabel('Nombre del evento').fill('Cumpleaños de prueba')
    await f.getByLabel('Presupuesto estimado (S/)', { exact: true }).fill('1000')
    await f.getByLabel('Fecha objetivo', { exact: true }).click()
    await page.getByRole('dialog', { name: 'Calendario' }).getByRole('button', { name: 'Hoy', exact: true }).click()
    await f.getByLabel('Inicio de planificación (opcional)', { exact: true }).click()
    await page.getByRole('dialog', { name: 'Calendario' }).getByRole('button', { name: 'Hoy', exact: true }).click()
    await f.getByRole('button', { name: 'Quitar fecha inicial', exact: true }).click()
    await expect(f.getByLabel('Inicio de planificación (opcional)', { exact: true })).toContainText('Elegir fecha')
    await f.getByRole('button', { name: 'Guardar evento', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Cumpleaños de prueba', exact: true })).toBeVisible()
    await page.getByRole('group', { name: 'Secciones del evento' }).getByRole('button', { name: 'Planificación', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo concepto', exact: true }).click()
    let dlg = page.getByRole('dialog')
    await dlg.getByLabel('Concepto', { exact: true }).fill('Sesión fotográfica')
    await dlg.getByLabel('Presupuesto del concepto', { exact: true }).fill('900')
    await dlg.getByRole('button', { name: 'Guardar concepto', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sesión fotográfica', exact: true })).toBeVisible()
    await page.getByRole('group', { name: 'Secciones del evento' }).getByRole('button', { name: 'Compromisos', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo compromiso', exact: true }).click()
    dlg = page.getByRole('dialog')
    await dlg.getByLabel('Concepto contratado').fill('Fotografía estudio')
    await dlg.getByLabel('Importe contratado', { exact: true }).fill('900')
    await dlg.getByLabel('Concepto planificado (opcional)').selectOption({ label: 'Sesión fotográfica' })
    await dlg.getByRole('button', { name: 'Guardar compromiso', exact: true }).click()
    await page.getByRole('button', { name: 'Registrar pago', exact: true }).click()
    dlg = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await expect(dlg.getByRole('combobox', { name: 'Evento asociado (opcional)', exact: true })).toHaveValue('Cumpleaños de prueba')
    await dlg.getByLabel('Importe', { exact: true }).fill('300')
    await elegirEnGasto(dlg, 'Ámbito', 'Personal')
    await elegirEnGasto(dlg, 'Categoría', 'Alimentación')
    await elegirEnGasto(dlg, 'Medio de pago', 'Yape')
    await dlg.getByLabel('Descripción', { exact: true }).fill('Adelanto fotos de prueba')
    await dlg.getByRole('button', { name: 'Guardar gasto', exact: true }).click()
    await expect(page.getByText('Gasto guardado.', { exact: true })).toBeVisible()
    const contrato = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Fotografía estudio' }) })
    await expect(contrato).toContainText('S/ 300.00')
    await expect(contrato).toContainText('S/ 600.00')
    await expect(contrato).toContainText('Parcialmente pagado')
    await page.getByRole('group', { name: 'Secciones del evento' }).getByRole('button', { name: 'Resumen', exact: true }).click()
    const resumen = page.getByRole('region', { name: 'Resumen financiero del evento' })
    await expect(resumen).toContainText('S/ 900.00')
    await expect(resumen).toContainText('S/ 100.00')
    const pagos = await rest<{ event_id: string; amount: number }[]>(page, 'expenses?description=eq.Adelanto%20fotos%20de%20prueba&select=event_id,amount')
    expect(pagos).toHaveLength(1)
    expect(pagos[0].event_id).toBeTruthy()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Cumpleaños de prueba', exact: true })).toBeVisible()
    await page.getByRole('group', { name: 'Secciones del evento' }).getByRole('button', { name: 'Análisis', exact: true }).click()
    for (const [dimension, label] of [['categoria','Alimentación'],['subcategoria','Sin subcategoría'],['ambito','Personal'],['medio','Yape'],['mes',sqlLocal(`select to_char(current_date,'YYYY-MM')`)]]) {
      await page.getByLabel('Dimensión del análisis').selectOption(dimension)
      await expect(page.locator('main ul').last()).toContainText(label)
      await expect(page.locator('main ul').last()).toContainText('S/ 300.00')
    }
    expect(errores).toEqual([])
  })

  test('agregar existentes, editar por el flujo original y desvincular conservando el movimiento', async ({ page }) => {
    const id = eventoSql()
    const gasto = [sqlLocal(`select e.id from public.expenses e join public.budget_periods p on p.household_id=e.household_id and e.expense_date between p.start_date and p.end_date where e.household_id=${HID} and e.status='active' and p.status='open' order by e.id limit 1`), 'Gasto existente de prueba']
    sqlLocal(`update public.expenses set description='Gasto existente de prueba' where id='${gasto[0]}' and household_id=${HID}`)
    const inicial = sqlLocal(`select sum(amount) from public.expense_fund_allocations where household_id=${HID}`)
    await iniciarSesion(page)
    await ir(page, id)
    await page.getByRole('button', { name: 'Agregar gastos existentes', exact: true }).click()
    const d = page.getByRole('dialog', { name: 'Agregar gastos existentes' })
    await d.getByLabel('Buscar gastos del evento').fill(gasto[1])
    await d.getByRole('checkbox', { name: `Seleccionar ${gasto[1]}`, exact: true }).check()
    await d.getByRole('button', { name: 'Asociar gastos', exact: true }).click()
    await expect(page.getByText('1 gasto asociado.', { exact: true })).toBeVisible()
    expect(sqlLocal(`select sum(amount) from public.expense_fund_allocations where household_id=${HID}`)).toBe(inicial)
    await page.getByRole('group', { name: 'Secciones del evento' }).getByRole('button', { name: 'Gastos', exact: true }).click()
    await page.getByRole('button', { name: `Editar gasto ${gasto[1]}`, exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Editar gasto' })
    await expect(form.getByRole('combobox', { name: 'Evento asociado (opcional)', exact: true })).toHaveValue('Objetivo de prueba')
    await form.getByLabel('Importe', { exact: true }).fill('150')
    await form.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect(page.getByText('Gasto actualizado.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Ver detalle ${gasto[1]}`, exact: true }).click()
    await expect(page.getByRole('dialog').getByText('S/ 150.00').first()).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).first().click()
    const antesDesvincular = sqlLocal(`select sum(amount) from public.expense_fund_allocations where household_id=${HID}`)
    await page.getByRole('button', { name: `Desvincular ${gasto[1]}`, exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Desvincular', exact: true }).click()
    await expect(page.getByText('Gasto desvinculado.', { exact: true })).toBeVisible()
    expect(sqlLocal(`select amount::text||'|'||coalesce(event_id::text,'ninguno') from public.expenses where id='${gasto[0]}'`)).toBe('150.00|ninguno')
    expect(sqlLocal(`select sum(amount) from public.expense_fund_allocations where household_id=${HID}`)).toBe(antesDesvincular)
  })

  test('guardar plantilla, reutilizar, duplicar y archivar conservan planificación sin copiar pagos', async ({ page }) => {
    const id = eventoSql('Evento para plantilla')
    sqlLocal(`insert into public.event_items(event_id,household_id,name,planned_amount) values('${id}',${HID},'Decoración',500)`)
    await iniciarSesion(page)
    await ir(page, id)
    await page.getByRole('button', { name: 'Guardar como plantilla', exact: true }).click()
    const d = page.getByRole('dialog', { name: 'Nueva plantilla de evento' })
    await d.getByLabel('Nombre del evento').fill('Plantilla de celebración')
    await d.getByRole('button', { name: 'Guardar plantilla', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Plantilla de celebración', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Usar plantilla', exact: true }).click()
    const f = page.getByRole('dialog', { name: 'Crear evento desde configuración' })
    await f.getByLabel('Nombre del evento').fill('Nuevo cumpleaños de plantilla')
    await f.getByLabel('Fecha objetivo', { exact: true }).click()
    await page.getByRole('dialog', { name: 'Calendario' }).getByRole('button', { name: 'Hoy', exact: true }).click()
    await f.getByRole('button', { name: 'Guardar evento', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Nuevo cumpleaños de plantilla', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Resumen financiero del evento' })).toContainText('0 gastos activos')
    await page.getByRole('group', { name: 'Secciones del evento' }).getByRole('button', { name: 'Planificación', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Decoración', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Archivar', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archivar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Restaurar', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Restaurar', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restaurar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Archivar', exact: true })).toBeVisible()
  })

  test('concurrencia: vincular dos veces el mismo gasto mantiene una asociación y los mismos fondos', async ({ page }) => {
    const id = eventoSql()
    const gasto = sqlLocal(`select id from public.expenses where household_id=${HID} and status='active' order by id limit 1`)
    await iniciarSesion(page)
    const antes = sqlLocal(`select sum(amount) from public.expense_fund_allocations where household_id=${HID}`)
    const respuestas = await Promise.all([rpc(page,'link_event_expenses',{p_ids:[gasto],p_event:id}),rpc(page,'link_event_expenses',{p_ids:[gasto],p_event:id})])
    expect(respuestas).toEqual([1,1])
    const metricas = await rest<{ expense_count: number }[]>(page, `event_metrics?id=eq.${id}&select=expense_count`)
    expect(metricas[0].expense_count).toBe(1)
    expect(sqlLocal(`select sum(amount) from public.expense_fund_allocations where household_id=${HID}`)).toBe(antes)
    const key = crypto.randomUUID()
    const copias = await Promise.all([rpc(page,'clone_event',{p_source:id,p_values:{is_template:true,name:'Copia concurrente'},p_key:key}),rpc(page,'clone_event',{p_source:id,p_values:{is_template:true,name:'Copia concurrente'},p_key:key})])
    expect(copias[0]).toBe(copias[1])
    expect(sqlLocal(`select count(*) from public.events where household_id=${HID} and name='Copia concurrente'`)).toBe('1')
  })

  test('responsive, seis destinos, claro y oscuro, listado y detalle sin desbordar', async ({ page }) => {
    test.setTimeout(120_000)
    const id = eventoSql('Primer cumpleaños de mi hija y celebración familiar')
    sqlLocal(`insert into public.event_items(event_id,household_id,name,planned_amount) values('${id}',${HID},'Vestimenta, recuerdos y detalles para la celebración',1200)`)
    await iniciarSesion(page)
    for (const tema of ['light','dark']) {
      for (const width of [320,360,375,390,414,428,768,1024,1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/eventos')
        await expect(page.getByRole('heading', { name: 'Mis eventos', exact: true })).toBeVisible()
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme',t),tema)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), `lista ${tema} ${width}`).toBe(true)
        if (width < 1024) await expect(page.locator('nav[aria-label="Módulos"]:visible').getByRole('link')).toHaveCount(6)
        if (width === 390 || width === 1440) await page.screenshot({ path: `qa/eventos-lista-${width}-${tema}.png`, animations: 'disabled' })
        await ir(page,id)
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme',t),tema)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), `detalle ${tema} ${width}`).toBe(true)
        if (width === 390 || width === 1440) await page.screenshot({ path: `qa/eventos-detalle-${width}-${tema}.png`, animations: 'disabled' })
      }
    }
  })

  test('accesibilidad, validación y recuperación de errores', async ({ page }) => {
    eventoSql()
    await iniciarSesion(page)
    await page.goto('/eventos')
    await expect(page.getByRole('heading', { name: 'Objetivo de prueba' })).toBeVisible()
    for (const tema of ['light','dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme',t),tema)
      // Se audita el estado final: las transiciones de color mezclan tonos a medias.
      await page.evaluate(() => Promise.all(document.getAnimations().filter((x) => x.effect?.getTiming().iterations !== Infinity).map((x) => x.finished.catch(() => undefined))))
      const a = await new AxeBuilder({page}).analyze()
      expect(a.violations.filter((v) => ['serious','critical'].includes(v.impact ?? ''))).toEqual([])
    }
    await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click()
    const d = page.getByRole('dialog', { name: 'Nuevo evento' })
    await d.getByRole('button', { name: 'Guardar evento', exact: true }).click()
    await expect(d.getByText('Escribe un nombre.', { exact: true })).toBeVisible()
    const a = await new AxeBuilder({page}).include('[role="dialog"]').analyze()
    expect(a.violations.filter((v) => ['serious','critical'].includes(v.impact ?? ''))).toEqual([])
    await page.keyboard.press('Escape')
    await page.route('**/rest/v1/event_metrics*',(route) => route.fulfill({status:503,json:{message:'Prueba sin conexión'}}))
    await page.reload()
    await expect(page.getByText('No se pudieron cargar tus eventos.', {exact:true})).toBeVisible({ timeout: 25000 })
    await page.unroute('**/rest/v1/event_metrics*')
    await page.getByRole('button',{name:'Reintentar',exact:true}).click()
    await expect(page.getByRole('heading', {name:'Objetivo de prueba',exact:true})).toBeVisible()
  })

  test('formularios adaptables de evento, concepto y compromiso con acciones visibles', async ({ page }) => {
    test.setTimeout(120_000)
    const id = eventoSql()
    await iniciarSesion(page)
    await ir(page,id)
    for (const tema of ['light','dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme',t),tema)
      for (const width of [320,360,375,390,414,428,768,1024,1440]) {
        await page.setViewportSize({width,height:844})
        await page.getByRole('button',{name:'Editar',exact:true}).click()
        let d = page.getByRole('dialog',{name:'Editar evento',exact:true})
        await expect(d.getByRole('button',{name:'Guardar evento',exact:true})).toBeInViewport()
        expect(await d.evaluate((el) => el.scrollWidth<=el.clientWidth+1)).toBe(true)
        await d.getByLabel('Nombre del evento').focus()
        if (width<=428) {
          await page.setViewportSize({width,height:480})
          await expect(d.getByRole('button',{name:'Guardar evento',exact:true})).toBeInViewport()
          await page.setViewportSize({width,height:844})
        }
        if (width===390) await page.screenshot({path:`qa/eventos-formulario-${tema}.png`,animations:'disabled'})
        await d.getByRole('button',{name:'Cerrar',exact:true}).first().click()
        for (const [tab,crear,guardar] of [['Planificación','Nuevo concepto','Guardar concepto'],['Compromisos','Nuevo compromiso','Guardar compromiso']]) {
          await page.getByRole('group',{name:'Secciones del evento'}).getByRole('button',{name:tab,exact:true}).click()
          await page.getByRole('button',{name:crear,exact:true}).click()
          d = page.getByRole('dialog')
          expect(await d.evaluate((el) => el.scrollWidth<=el.clientWidth+1)).toBe(true)
          await expect(d.getByRole('button',{name:guardar,exact:true})).toBeInViewport()
          await d.getByRole('button',{name:'Cerrar',exact:true}).first().click()
        }
      }
    }
  })
})
