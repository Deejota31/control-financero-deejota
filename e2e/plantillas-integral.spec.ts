import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { accionPlantilla, accionPlantillaFondo, elegir, email, filaPlantilla, filaPlantillaFondo, iniciarSesion, password, sufijo } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const ACT = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD')`)
const SIG = sqlLocal(`select to_char(date_trunc('month', current_date) + interval '1 month', 'YYYY-MM-DD')`)
const periodo = (mes: string) => `(select id from public.budget_periods where household_id = ${HID} and start_date = '${mes}')`
const num = (sql: string) => Number(sqlLocal(sql))
const nFondos = (mes: string) => num(`select count(*) from public.funds where period_id = ${periodo(mes)}`)
const nGastos = () => num(`select count(*) from public.expenses where household_id = ${HID}`)
const nPlantillasFondo = () => num(`select count(*) from public.fund_templates where household_id = ${HID}`)
const monto = (mes: string, nombre: string) => num(`select b.assigned_amount from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where f.period_id = ${periodo(mes)} and f.name = '${nombre}'`)

/** Crea una plantilla de fondo directamente en la base (las funciones del servidor exigen sesión): incluye el ámbito indicado. */
function plantillaFondoSql(nombre: string, importe: number, o: { ambito?: string; general?: boolean; prioridad?: number } = {}) {
  const id = sqlLocal(`insert into public.fund_templates (household_id, name, is_general, suggested_amount, priority, icon_key, color_token) values (${HID}, '${nombre}', ${o.general ? 'true' : 'false'}, ${importe}, ${o.prioridad ?? 100}, 'wallet', 'c1') returning id`).split('\n')[0].trim()
  if (o.ambito) sqlLocal(`insert into public.fund_template_scope_rules (household_id, template_id, ambito_id, effect) select ${HID}, '${id}', id, 'include' from public.ambitos where household_id = ${HID} and name = '${o.ambito}'`)
  return id
}

const asistente = (page: Page) => page.getByRole('dialog', { name: /^Planificación · / })
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

async function abrirAsistente(page: Page) {
  await page.goto(`/fondos?mes=${SIG}`)
  await page.getByRole('button', { name: 'Abrir planificación mensual' }).click()
  await expect(asistente(page)).toBeVisible()
  return asistente(page)
}

test.describe('Plantillas de gastos y de fondos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(() => sqlLocal(`delete from public.funds where period_id = ${periodo(SIG)}`))

  test('el formulario de plantilla de gasto es el de Nuevo gasto: mismos chips, sin comprobante ni cobertura', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const gasto = page.getByRole('dialog', { name: 'Nuevo gasto' })
    await expect(gasto.getByRole('radiogroup', { name: 'Ámbito', exact: true })).toBeVisible()
    await expect(gasto.getByText('Comprobante (opcional)')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Plantillas' }).click()
    await page.getByRole('button', { name: 'Nueva plantilla' }).first().click()
    const f = page.getByRole('dialog', { name: 'Nueva plantilla de gasto' })
    await expect(f.getByRole('radiogroup', { name: 'Ámbito', exact: true })).toBeVisible()
    await expect(f.getByLabel('Nombre de plantilla')).toBeVisible()
    await expect(f.getByLabel('Importe sugerido')).toBeVisible()
    await expect(f.getByText('Comprobante (opcional)')).toHaveCount(0)
    await expect(f.getByText('Cobertura estimada por fondos')).toHaveCount(0)
    await expect(f.getByRole('combobox')).toHaveCount(0) // nada de desplegables: todo se elige con chips
    await expect(f.getByRole('button', { name: 'Guardar plantilla' })).toBeVisible()
  })

  test('guardar un gasto como plantilla: precarga, no copia datos reales y el gasto original no cambia', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    const boton = page.getByRole('button', { name: /^Guardar como plantilla / }).first()
    const descripcion = (await boton.getAttribute('aria-label'))!.replace('Guardar como plantilla ', '')
    const antes = sqlLocal(`select id || '|' || amount || '|' || expense_date || '|' || coalesce(template_id::text, '') || '|' || coalesce(receipt_path, '') from public.expenses where household_id = ${HID} and description = '${descripcion.replace(/'/g, "''")}' order by expense_date desc, id limit 1`)
    const total = nGastos()
    await boton.click()
    const f = page.getByRole('dialog', { name: 'Nueva plantilla de gasto' })
    await expect(f.getByLabel('Descripción', { exact: true })).toHaveValue(descripcion)
    await expect(f.getByRole('radio', { checked: true }).first()).toBeVisible() // clasificación precargada
    const nombre = `Desde gasto ${sufijo()}`
    await f.getByLabel('Nombre de plantilla').fill(nombre)
    await f.getByRole('button', { name: 'Guardar plantilla' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    expect(num(`select count(*) from public.expense_templates where household_id = ${HID} and name = '${nombre}'`)).toBe(1)
    expect(nGastos()).toBe(total) // guardar una plantilla no crea movimientos
    expect(sqlLocal(`select id || '|' || amount || '|' || expense_date || '|' || coalesce(template_id::text, '') || '|' || coalesce(receipt_path, '') from public.expenses where household_id = ${HID} and description = '${descripcion.replace(/'/g, "''")}' order by expense_date desc, id limit 1`)).toBe(antes)

    // Editar la plantilla después no toca el gasto
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await accionPlantilla(page, nombre, 'Editar plantilla')
    const e = page.getByRole('dialog', { name: 'Editar plantilla de gasto' })
    await e.getByLabel('Importe sugerido').fill('999.99')
    await e.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Plantilla actualizada.')).toBeVisible()
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = '${nombre}'`)).toBe(999.99)
    expect(sqlLocal(`select id || '|' || amount || '|' || expense_date || '|' || coalesce(template_id::text, '') || '|' || coalesce(receipt_path, '') from public.expenses where household_id = ${HID} and description = '${descripcion.replace(/'/g, "''")}' order by expense_date desc, id limit 1`)).toBe(antes)
  })

  test('registrar gastos desde una plantilla: varias veces, con ajustes y sin modificar la plantilla', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await accionPlantilla(page, 'Internet', 'Registrar solo esta')
    const f = page.getByRole('dialog', { name: 'Registrar gasto', exact: true })
    await expect(f.getByLabel('Descripción', { exact: true })).toHaveValue('Internet del hogar')
    await expect(f.getByLabel('Importe', { exact: true })).toHaveValue('120.00')
    await expect(f.getByText('Cobertura estimada por fondos')).toBeVisible()
    await expect(f.getByRole('button', { name: 'Confirmar gasto' })).toBeVisible()
    const antes = nGastos()
    expect(antes).toBeGreaterThan(0)
    await f.getByLabel('Importe', { exact: true }).fill('130')
    await f.getByRole('button', { name: 'Confirmar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    expect(nGastos()).toBe(antes + 1)
    // Segundo registro con la misma plantilla (un gasto legítimo parecido no se bloquea)
    await accionPlantilla(page, 'Internet', 'Registrar solo esta')
    const g = page.getByRole('dialog', { name: 'Registrar gasto', exact: true })
    await g.getByRole('button', { name: 'Confirmar gasto' }).click()
    await expect(page.getByText('Gasto guardado.').first()).toBeVisible()
    await expect.poll(() => nGastos()).toBe(antes + 2)
    expect(num(`select count(*) from public.expenses where household_id = ${HID} and template_id = (select id from public.expense_templates where household_id = ${HID} and name = 'Internet')`)).toBe(2)
    // La plantilla no cambió y su historial de uso se muestra
    expect(num(`select default_amount from public.expense_templates where household_id = ${HID} and name = 'Internet'`)).toBe(120)
    await expect(filaPlantilla(page, 'Internet')).toContainText('Usada 2 veces')
  })

  test('fondo → plantilla: copia la configuración, no el consumo ni el período, y el fondo original no cambia', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/fondos')
    const fondosAntes = nFondos(ACT)
    const montoAntes = monto(ACT, 'Hogar')
    await page.getByRole('button', { name: 'Más acciones de Hogar' }).click()
    await page.getByRole('menuitem', { name: 'Guardar como plantilla' }).click()
    const f = page.getByRole('dialog', { name: 'Nueva plantilla de fondo' })
    await expect(f.getByLabel('Nombre')).toHaveValue('Hogar') // sin «(copia)»
    await expect(f.getByLabel('Importe sugerido (S/)')).toHaveValue(montoAntes.toFixed(2))
    await expect(f.getByText('Esta plantilla puede utilizarse en diferentes meses.')).toBeVisible()
    await expect(f.getByLabel('Importe de este mes (S/)')).toHaveCount(0)
    const nombre = `Plantilla Hogar ${sufijo()}`
    await f.getByLabel('Nombre').fill(nombre)
    await f.getByRole('button', { name: 'Guardar plantilla' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    expect(nPlantillasFondo()).toBe(1)
    // Reglas copiadas igual que las del fondo
    const reglasFondo = num(`select count(*) from public.fund_scope_rules r join public.funds f on f.id = r.fund_id where f.period_id = ${periodo(ACT)} and f.name = 'Hogar'`)
    expect(num(`select count(*) from public.fund_template_scope_rules r join public.fund_templates t on t.id = r.template_id where t.name = '${nombre}'`)).toBe(reglasFondo)
    // El fondo del mes sigue igual y no quedó vinculado
    expect(nFondos(ACT)).toBe(fondosAntes)
    expect(monto(ACT, 'Hogar')).toBe(montoAntes)
    expect(num(`select count(*) from public.funds where period_id = ${periodo(ACT)} and template_id is not null`)).toBe(0)
  })

  test('biblioteca de plantillas de fondos: crear, duplicar, desactivar, usar y eliminar', async ({ page }) => {
    await iniciarSesion(page)
    plantillaFondoSql('Sodexo', 280, { ambito: 'Trabajo' })
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Plantillas de fondos' }).click()
    const b = page.getByRole('dialog', { name: 'Plantillas de fondos' })
    await expect(filaPlantillaFondo(page, 'Sodexo').getByLabel('Importe de Sodexo')).toHaveValue('280.00')

    // Duplicar: copia independiente
    await accionPlantillaFondo(page, 'Sodexo', 'Duplicar')
    await expect(page.getByText('Plantilla duplicada.')).toBeVisible()
    await expect(filaPlantillaFondo(page, 'Sodexo (copia)')).toBeVisible()
    expect(nPlantillasFondo()).toBe(2)

    // Desactivar: sale de la vista de activas y reaparece en «Todas»
    await accionPlantillaFondo(page, 'Sodexo (copia)', 'Desactivar')
    await expect(filaPlantillaFondo(page, 'Sodexo (copia)')).toHaveCount(0)
    await elegir(page, b.getByRole('combobox', { name: 'Estado de plantillas de fondos' }), 'Todas')
    await expect(filaPlantillaFondo(page, 'Sodexo (copia)')).toContainText('Inactiva')

    // Preparar el fondo con el formulario de siempre, precargado, para el mes seleccionado
    await accionPlantillaFondo(page, 'Sodexo', /Preparar fondo con el formulario/)
    const nf = page.getByRole('dialog', { name: 'Nuevo fondo desde plantilla' })
    await expect(nf.getByLabel('Nombre')).toHaveValue('Sodexo')
    await expect(nf.getByLabel('Importe de este mes (S/)')).toHaveValue('280.00')
    await nf.getByLabel('Importe de este mes (S/)').fill('300')
    await nf.getByRole('button', { name: 'Guardar fondo' }).click()
    const conf = page.getByRole('alertdialog')
    await expect(conf.or(page.getByText('Fondo guardado.').first())).toBeVisible()
    if (await conf.isVisible()) await conf.getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect.poll(() => nFondos(SIG)).toBe(1)
    expect(monto(SIG, 'Sodexo')).toBe(300)
    expect(num(`select suggested_amount from public.fund_templates where name = 'Sodexo' and household_id = ${HID}`)).toBe(280) // la plantilla no cambió
    expect(num(`select count(*) from public.funds where period_id = ${periodo(SIG)} and template_id is not null`)).toBe(1)

    // Eliminar la plantilla conserva el fondo ya creado
    await accionPlantillaFondo(page, 'Sodexo (copia)', 'Eliminar')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText('Plantilla eliminada.')).toBeVisible()
    await accionPlantillaFondo(page, 'Sodexo', 'Eliminar')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect.poll(() => nPlantillasFondo()).toBe(0)
    expect(nFondos(SIG)).toBe(1)
    expect(num(`select count(*) from public.funds where period_id = ${periodo(SIG)} and template_id is not null`)).toBe(0)
  })

  test('planificación: aplicar varias plantillas ajustando importes, sin cerrar el asistente ni duplicar', async ({ page }) => {
    await iniciarSesion(page)
    plantillaFondoSql('General T', 3000, { general: true, prioridad: 1 })
    plantillaFondoSql('Sodexo T', 280, { ambito: 'Trabajo' })
    plantillaFondoSql('Pareja T', 200, { ambito: 'Familia' })
    const fondosActual = nFondos(ACT)
    const montoActual = monto(ACT, 'Hogar')
    const a = await abrirAsistente(page)
    const sec = a.getByRole('region', { name: 'Mis plantillas de fondos' })
    await expect(sec.locator('[data-plantilla-fondo]')).toHaveCount(3)
    expect(nFondos(SIG)).toBe(0) // ver plantillas no crea nada
    for (const n of ['General T', 'Sodexo T', 'Pareja T']) await sec.getByRole('checkbox', { name: `Usar ${n}` }).check()
    await sec.getByLabel('Importe de Sodexo T').fill('310')
    await expect(sec.getByText('3 seleccionadas').first()).toBeVisible()
    await sec.getByRole('button', { name: 'Aplicar 3 plantillas' }).click()
    await expect(page.getByText('Se crearon 3 fondos.')).toBeVisible()
    await expect(a).toBeVisible() // el asistente sigue abierto en la etapa de fondos
    await expect(a.getByRole('heading', { name: /Prepara tus fondos de/ })).toBeVisible()
    await expect(a.getByRole('list', { name: 'Fondos del mes' }).getByRole('listitem')).toHaveCount(3)
    expect(nFondos(SIG)).toBe(3)
    expect(monto(SIG, 'Sodexo T')).toBe(310)
    expect(monto(SIG, 'General T')).toBe(3000)
    // La plantilla conserva su importe sugerido y los meses existentes no cambian
    expect(num(`select suggested_amount from public.fund_templates where name = 'Sodexo T' and household_id = ${HID}`)).toBe(280)
    expect(nFondos(ACT)).toBe(fondosActual)
    expect(monto(ACT, 'Hogar')).toBe(montoActual)
    // La etapa no se completa sola: sigue «En progreso» hasta pulsar Continuar
    await expect(a.getByRole('list', { name: 'Etapas de la planificación' }).getByRole('button', { name: /^\d?\s*Fondos/ })).toContainText('En progreso')
    // Reaplicar no duplica: las ya aplicadas quedan marcadas y bloqueadas
    await expect(sec.getByRole('checkbox', { name: 'Usar Sodexo T' })).toHaveCount(0) // aplicada: sin casilla, con insignia y verificación
    await expect(filaPlantillaFondo(page, 'Sodexo T')).toContainText('Aplicada')
    await expect(filaPlantillaFondo(page, 'Sodexo T')).toContainText('S/ 310.00') // el importe real del mes, no el sugerido
    expect(nFondos(SIG)).toBe(3)
    // Independencia: cambiar el importe del fondo del mes no cambia la plantilla
    sqlLocal(`update public.fund_period_budgets set assigned_amount = 999 where fund_id = (select id from public.funds where period_id = ${periodo(SIG)} and name = 'Sodexo T')`)
    expect(num(`select suggested_amount from public.fund_templates where name = 'Sodexo T' and household_id = ${HID}`)).toBe(280)
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
  })

  test('un mes no admite dos Fondos Generales: la segunda plantilla general queda bloqueada', async ({ page }) => {
    await iniciarSesion(page)
    plantillaFondoSql('Gen A', 1000, { general: true })
    plantillaFondoSql('Gen B', 500, { general: true })
    const a = await abrirAsistente(page)
    const sec = a.getByRole('region', { name: 'Mis plantillas de fondos' })
    await sec.getByRole('checkbox', { name: 'Usar Gen A' }).check()
    await sec.getByRole('checkbox', { name: 'Usar Gen B' }).check()
    await expect(sec.getByText('Ya elegiste otro Fondo General para este mes')).toBeVisible() // dos Generales en la misma operación
    await sec.getByRole('checkbox', { name: 'Usar Gen B' }).uncheck()
    await sec.getByRole('button', { name: 'Aplicar 1 plantilla' }).click()
    await expect(page.getByText('Se creó 1 fondo.')).toBeVisible()
    await expect(sec.getByRole('checkbox', { name: 'Usar Gen B' })).toBeDisabled()
    await expect(sec.getByText('Este mes ya tiene Fondo General')).toBeVisible()
    expect(num(`select count(*) from public.funds where period_id = ${periodo(SIG)} and is_general and is_active`)).toBe(1)
  })

  test('crear plantillas desde el asistente (formularios anidados) no cierra la planificación', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    const sec = a.getByRole('region', { name: 'Mis plantillas de fondos' })
    await sec.getByRole('button', { name: 'Nueva plantilla' }).first().click()
    const f = page.getByRole('dialog', { name: 'Nueva plantilla de fondo' })
    await f.getByLabel('Nombre').fill('Desde asistente')
    await f.getByLabel('Importe sugerido (S/)').fill('150')
    await f.getByRole('radiogroup', { name: 'Regla para Hogar' }).getByRole('radio', { name: 'Incluir' }).click()
    await f.getByRole('button', { name: 'Guardar plantilla' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    await expect(filaPlantillaFondo(page, 'Desde asistente')).toBeVisible()
    await expect(a).toBeVisible()
    // Recién creada, disponible en la etapa y sin haber creado ningún fondo
    await expect(a.getByRole('checkbox', { name: 'Usar Desde asistente' })).toBeVisible()
    expect(nFondos(SIG)).toBe(0)
    // Plantillas de gasto dentro del asistente: se abre el formulario unificado y se vuelve a la etapa
    await a.getByRole('button', { name: 'Omitir etapa' }).click()
    await a.getByRole('button', { name: 'Abrir gastos mensuales' }).click()
    const lib = page.getByRole('dialog', { name: 'Plantillas mensuales' })
    await lib.getByRole('button', { name: 'Nueva plantilla' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Nueva plantilla de gasto' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
  })

  for (const ancho of [320, 375, 768, 1024, 1366]) {
    test(`responsive ${ancho}px: formularios de plantilla sin desbordes y con acciones visibles`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 })
      await iniciarSesion(page)
      plantillaFondoSql('Resp', 100, { ambito: 'Hogar' })
      await page.goto('/gastos')
      await page.getByRole('button', { name: 'Plantillas' }).click()
      await page.getByRole('button', { name: 'Nueva plantilla' }).first().click()
      const g = page.getByRole('dialog', { name: 'Nueva plantilla de gasto' })
      await expect(g.getByRole('button', { name: 'Guardar plantilla' })).toBeInViewport()
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await page.goto(`/fondos?mes=${SIG}`)
      await page.getByRole('button', { name: 'Plantillas de fondos' }).click()
      const b = page.getByRole('dialog', { name: 'Plantillas de fondos' })
      await expect(filaPlantillaFondo(page, 'Resp')).toBeVisible()
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
      await b.getByRole('button', { name: 'Nueva plantilla' }).first().click()
      const f = page.getByRole('dialog', { name: 'Nueva plantilla de fondo' })
      await expect(f.getByRole('button', { name: 'Guardar plantilla' })).toBeInViewport()
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
    })
  }

  for (const tema of ['light', 'dark'] as const) {
    test(`accesibilidad (${tema}): formulario de plantilla y biblioteca sin violaciones graves`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema })
      await iniciarSesion(page)
      plantillaFondoSql('A11y', 100, { ambito: 'Hogar' })
      await page.goto('/gastos')
      await page.getByRole('button', { name: 'Plantillas' }).click()
      await page.getByRole('button', { name: 'Nueva plantilla' }).first().click()
      await expect(page.getByRole('dialog', { name: 'Nueva plantilla de gasto' })).toBeVisible()
      const r1 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(r1.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await page.goto(`/fondos?mes=${SIG}`)
      await page.getByRole('button', { name: 'Plantillas de fondos' }).click()
      await expect(page.getByRole('dialog', { name: 'Plantillas de fondos' })).toBeVisible()
      const r2 = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(r2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
    })
  }
})
