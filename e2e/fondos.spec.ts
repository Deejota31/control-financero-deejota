import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const dinero = (t: string | null) => Number((t ?? '').replace(/[^\d.-]/g, ''))

/** Si el cambio recalcula gastos, la app pide confirmación; si no, guarda directamente. */
async function confirmarSiPide(page: Page, exito: string) {
  const confirmacion = page.getByRole('alertdialog')
  await expect(confirmacion.or(page.getByText(exito))).toBeVisible()
  if (await confirmacion.isVisible()) {
    await expect(confirmacion).toContainText('recalcula los períodos abiertos')
    await confirmacion.getByRole('button', { name: 'Aplicar cambios' }).click()
  }
  await expect(page.getByText(exito)).toBeVisible()
}

const fila = (page: Page, nombre: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
const accion = async (page: Page, nombre: string, item: string | RegExp) => {
  await page.getByRole('button', { name: `Más acciones de ${nombre}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}
const kpi = (page: Page, etiqueta: string) => page.getByLabel('Resumen del período').locator('div').filter({ has: page.getByText(etiqueta, { exact: true }) }).last()
const sqlAsignado = () => Number(sqlLocal(`select coalesce(sum(b.assigned_amount), 0) from public.fund_period_budgets b join public.funds f on f.id = b.fund_id join public.budget_periods p on p.id = b.period_id where f.household_id = ${HID} and f.is_active and p.start_date = date_trunc('month', current_date)`))
const sqlGastos = () => sqlLocal(`select count(*) || '|' || coalesce(sum(amount), 0) from public.expenses where household_id = ${HID} and status = 'active'`)

async function nuevoFondo(page: Page, nombre: string, ambito: string, importe: string, soloMedio?: string) {
  await page.getByRole('button', { name: 'Nuevo fondo' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Nombre').fill(nombre)
  await d.getByRole('radiogroup', { name: `Regla para ${ambito}` }).getByRole('radio', { name: 'Incluir' }).click()
  if (soloMedio) await d.getByRole('radiogroup', { name: `Regla para ${soloMedio}` }).getByRole('radio', { name: 'Incluir' }).click()
  await d.getByLabel('Importe por defecto (S/)').fill(importe)
  await d.getByRole('button', { name: 'Guardar fondo' }).click()
  await confirmarSiPide(page, 'Fondo guardado.')
}

test.describe('Fondos presupuestales', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('muestra resumen, tabla compacta con el Fondo General primero y el excedente transferido', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await expect(page.getByText('Período abierto')).toBeVisible()
    for (const t of ['Presupuesto asignado', 'Consumido', 'Disponible', 'Fondos en sobregasto']) await expect(page.getByLabel('Resumen del período').getByText(t, { exact: true })).toBeVisible()
    for (const c of ['Fondo', 'Prioridad', 'Asignado', 'Consumido', 'Disponible', 'Uso', 'Acciones']) await expect(page.getByText(c, { exact: true }).first()).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Fondo General' })).toBeVisible()
    // El Fondo General va siempre primero; después, los específicos por prioridad
    const nombres = await page.getByRole('list', { name: 'Fondos' }).getByRole('heading').allTextContents()
    expect(nombres[0]).toBe('Fondo General')
    const esperados = sqlLocal(`select name from public.funds where household_id = ${HID} and is_active and not is_general order by priority, name`).split('\n')
    expect(nombres.slice(1)).toEqual(esperados)
    // Altura de fila compacta (64–76 px)
    const alto = (await page.getByRole('list', { name: 'Fondos' }).getByRole('listitem').nth(1).boundingBox())!.height
    expect(alto).toBeGreaterThanOrEqual(60)
    expect(alto).toBeLessThanOrEqual(80)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    // Los totales superiores coinciden con SQL
    expect(dinero(await kpi(page, 'Presupuesto asignado').textContent())).toBeCloseTo(sqlAsignado(), 2)

    // detalle del Fondo General con excedentes de fondos específicos
    await fila(page, 'Fondo General').getByRole('button', { name: 'Ver gastos' }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByText(/Excedente de /).first()).toBeVisible()
    await dialogo.getByRole('button', { name: 'Cerrar' }).first().click()
    expect(errores).toEqual([])
  })

  test('busca por nombre y filtra por Activos / Inactivos / Todos sin alterar los totales', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    const total = dinero(await kpi(page, 'Presupuesto asignado').textContent())
    await page.getByRole('searchbox', { name: 'Buscar fondo' }).fill('hog')
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(1)
    await expect(fila(page, 'Hogar')).toBeVisible()
    expect(dinero(await kpi(page, 'Presupuesto asignado').textContent())).toBe(total) // los totales no dependen del filtro
    await page.getByRole('searchbox', { name: 'Buscar fondo' }).fill('zzz')
    await expect(page.getByText('Ningún fondo coincide')).toBeVisible()
    await page.getByRole('button', { name: 'Ver todos' }).click()
    await expect(page.getByRole('searchbox', { name: 'Buscar fondo' })).toHaveValue('')
    await page.getByRole('button', { name: 'Inactivos', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Inactivos', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('el período cerrado muestra el histórico sin acciones de edición', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await expect(page.getByText('Período cerrado').first()).toBeVisible()
    await expect(page.getByText(/resultado histórico/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nuevo fondo' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Más acciones de / })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Fondo General' })).toBeVisible()
  })

  test('un cambio que recalcula gastos explica su efecto y no se aplica hasta confirmar', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    const hogar = fila(page, 'Hogar')
    await expect(hogar.getByText('Agotado').or(hogar.getByText('Sobregirado')).first()).toBeVisible()

    await accion(page, 'Hogar', /Cambiar presupuesto del período/)
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Importe asignado (S/)').fill('600')
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    const confirmacion = page.getByRole('alertdialog')
    await expect(confirmacion).toContainText('recalcula los períodos abiertos')
    await expect(confirmacion).toContainText('Consumo antes')

    // Cancelar: nada cambia
    await confirmacion.getByRole('button', { name: 'Cancelar' }).click()
    await page.reload()
    await expect(hogar).toContainText('S/ 700.00')

    // Confirmar y luego restaurar
    await accion(page, 'Hogar', /Cambiar presupuesto del período/)
    await page.getByRole('dialog').getByLabel('Importe asignado (S/)').fill('600')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(page.getByText('Presupuesto actualizado.')).toBeVisible()
    await expect(hogar).toContainText('S/ 600.00')
    await accion(page, 'Hogar', /Cambiar presupuesto del período/)
    await page.getByRole('dialog').getByLabel('Importe asignado (S/)').fill('700')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(hogar).toContainText('S/ 700.00')
  })

  test('crea un fondo específico con reglas, valida, lo clona y lo desactiva desde el menú', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await page.getByRole('button', { name: 'Nuevo fondo' }).click()
    const dialogo = page.getByRole('dialog')
    const nombre = `Fondo ${sufijo()}`
    await dialogo.getByLabel('Nombre').fill(nombre)
    // sin reglas de inclusión no se puede guardar un específico
    await dialogo.getByRole('button', { name: 'Guardar fondo' }).click()
    await expect(dialogo.getByText('Un fondo específico necesita al menos un ámbito, categoría o subcategoría incluido.')).toBeVisible()
    await dialogo.getByRole('radiogroup', { name: 'Regla para Trabajo' }).getByRole('radio', { name: 'Incluir' }).click()
    await dialogo.getByRole('radiogroup', { name: 'Regla para Efectivo' }).getByRole('radio', { name: 'Excluir' }).click()
    await dialogo.getByLabel('Importe por defecto (S/)').fill('150')
    await dialogo.getByRole('button', { name: 'Guardar fondo' }).click()
    await confirmarSiPide(page, 'Fondo guardado.')
    await expect(fila(page, nombre)).toContainText('S/ 150.00')

    await accion(page, nombre, /Clonar/)
    await expect(page.getByRole('dialog').getByLabel('Nombre')).toHaveValue(/\(copia\)$/)
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

    await accion(page, nombre, /Desactivar/)
    await confirmarSiPide(page, 'Fondo desactivado.')
    await expect(fila(page, nombre)).toHaveCount(0) // sale de «Activos»
    await page.getByRole('button', { name: 'Inactivos', exact: true }).click()
    await expect(fila(page, nombre)).toContainText('Inactivo')
  })

  test('cambia la prioridad con el menú y arrastrando; el General sigue primero y el orden persiste', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await expect(page.getByRole('heading', { name: 'Fondo General' })).toBeVisible()
    const nombres = () => page.getByRole('list', { name: 'Fondos' }).getByRole('heading').allTextContents()
    const antes = await nombres()
    expect(antes[0]).toBe('Fondo General')
    // Subir prioridad del segundo fondo específico
    const segundo = antes[2]
    await accion(page, segundo, /Subir prioridad/)
    await confirmarSiPide(page, 'Prioridad actualizada.')
    await expect.poll(nombres).toEqual([antes[0], antes[2], antes[1], ...antes.slice(3)])
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Fondo General' })).toBeVisible()
    expect(await nombres()).toEqual([antes[0], antes[2], antes[1], ...antes.slice(3)])
    // El Fondo General no se puede subir ni bajar
    await page.getByRole('button', { name: 'Más acciones de Fondo General' }).click()
    await expect(page.getByRole('menuitem', { name: /Subir prioridad/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    // Arrastrar el último específico antes del primero
    const ultimo = (await nombres()).at(-1)!
    const primero = (await nombres())[1]
    await fila(page, ultimo).dragTo(fila(page, primero))
    await confirmarSiPide(page, 'Prioridad actualizada.')
    await expect.poll(async () => (await nombres())[1]).toBe(ultimo)
  })

  test('elimina un fondo vacío tras confirmar; cancelar no cambia nada y los totales coinciden', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    const nombre = `Vacío ${sufijo()}`
    await nuevoFondo(page, nombre, 'Trabajo', '150', 'Plin')
    const conFondo = sqlAsignado()
    expect(dinero(await kpi(page, 'Presupuesto asignado').textContent())).toBeCloseTo(conFondo, 2)

    // Cancelar
    await accion(page, nombre, /Eliminar fondo/)
    const d = page.getByRole('dialog', { name: `Eliminar fondo «${nombre}»` })
    await expect(d).toContainText('Nunca se ha usado')
    await expect(d).toContainText('No se pierde ningún importe')
    await d.getByRole('button', { name: 'Cancelar' }).click()
    await expect(fila(page, nombre)).toBeVisible()
    expect(sqlLocal(`select count(*) from public.funds where household_id = ${HID} and name = '${nombre}'`)).toBe('1')

    // Confirmar
    const gastosAntes = sqlGastos()
    await accion(page, nombre, /Eliminar fondo/)
    await page.getByRole('dialog', { name: `Eliminar fondo «${nombre}»` }).getByRole('button', { name: 'Eliminar fondo' }).click()
    await expect(page.getByText(`Fondo «${nombre}» eliminado.`)).toBeVisible()
    await expect(fila(page, nombre)).toHaveCount(0) // la lista se actualiza sin recargar
    expect(sqlLocal(`select count(*) from public.funds where household_id = ${HID} and name = '${nombre}'`)).toBe('0')
    expect(sqlGastos()).toBe(gastosAntes)
    expect(dinero(await kpi(page, 'Presupuesto asignado').textContent())).toBeCloseTo(conFondo - 150, 2) // los indicadores se actualizan
  })

  test('elimina un fondo con gastos imputados eligiendo un destino compatible, sin alterar los gastos', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    const nombre = `Con gastos ${sufijo()}`
    await nuevoFondo(page, nombre, 'Trabajo', '300')
    // un gasto de «Trabajo» de este mes queda imputado al fondo nuevo
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const g = page.getByRole('dialog')
    await g.getByLabel('Importe', { exact: true }).fill('45.50')
    for (const [n, o] of [['Ámbito', 'Trabajo'], ['Categoría', 'Alimentación'], ['Medio de pago', 'Yape']] as const) {
      await g.getByRole('combobox', { name: n, exact: true }).click()
      await page.getByRole('option', { name: o, exact: true }).click()
    }
    await g.getByLabel('Descripción', { exact: true }).fill('Gasto del fondo a eliminar')
    await g.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    const imputadoAntes = Number(sqlLocal(`select coalesce(sum(a.amount), 0) from public.expense_fund_allocations a join public.funds f on f.id = a.fund_id where f.name = '${nombre}'`))
    expect(imputadoAntes).toBeGreaterThan(0)
    const gastosAntes = sqlGastos()

    await page.goto('/fondos')
    await accion(page, nombre, /Eliminar fondo/)
    const d = page.getByRole('dialog', { name: `Eliminar fondo «${nombre}»` })
    await expect(d.getByRole('list', { name: 'Dependencias' })).toContainText('Gastos imputados')
    const boton = d.getByRole('button', { name: 'Reasignar y eliminar' })
    await expect(boton).toBeDisabled() // exige elegir destino
    await d.getByLabel('Fondo de destino compatible').selectOption({ label: 'Fondo General (General)' })
    await expect(d.getByText(/no se borran ni cambian de importe/)).toBeVisible() // efecto simulado antes de confirmar
    expect(sqlLocal(`select count(*) from public.funds where name = '${nombre}'`)).toBe('1') // la simulación no cambia nada
    await boton.click()
    await expect(page.getByText(`Fondo «${nombre}» eliminado.`)).toBeVisible()
    expect(sqlLocal(`select count(*) from public.funds where name = '${nombre}'`)).toBe('0')
    expect(sqlGastos()).toBe(gastosAntes) // ningún gasto borrado ni con otro importe
    expect(sqlLocal(`select count(*) from public.expenses e where e.household_id = ${HID} and e.status = 'active' and e.amount <> (select sum(a.amount) from public.expense_fund_allocations a where a.expense_id = e.id)`)).toBe('0')
  })

  test('un fondo con historial cerrado y el Fondo General explican el motivo y ofrecen desactivar, no eliminar', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    await accion(page, 'Hogar', /Eliminar fondo/)
    const d = page.getByRole('dialog', { name: 'Eliminar fondo «Hogar»' })
    await expect(d).toContainText('historial en períodos cerrados')
    await expect(d.getByRole('button', { name: /Reasignar y eliminar|^Eliminar fondo$/ })).toHaveCount(0)
    await expect(d.getByRole('button', { name: 'Desactivar en su lugar' })).toBeVisible()
    await d.getByRole('button', { name: 'Cancelar' }).click()
    expect(sqlLocal(`select count(*) from public.funds where household_id = ${HID} and name = 'Hogar'`)).toBe('1')

    await accion(page, 'Fondo General', /Eliminar fondo/)
    const g = page.getByRole('dialog', { name: 'Eliminar fondo «Fondo General»' })
    await expect(g).toContainText('absorbe el excedente')
    await g.getByRole('button', { name: 'Desactivar en su lugar' }).click()
    await expect(page.getByText('Fondo desactivado.').or(page.getByRole('alertdialog')).or(page.getByRole('dialog', { name: 'No se puede guardar este cambio' }))).toBeVisible()
    sqlLocal(`update public.funds set is_active = true where household_id = ${HID} and is_general`)
  })

  test('si la eliminación falla, se avisa y el fondo queda intacto', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Fondos' }).first().click()
    const nombre = `Falla ${sufijo()}`
    await nuevoFondo(page, nombre, 'Trabajo', '90', 'Plin')
    await page.route('**/rest/v1/rpc/delete_fund', (r) => (r.request().postData()?.includes('"p_dry_run":true') ? r.continue() : r.abort('connectionrefused')))
    await accion(page, nombre, /Eliminar fondo/)
    await page.getByRole('dialog', { name: `Eliminar fondo «${nombre}»` }).getByRole('button', { name: 'Eliminar fondo' }).click()
    await expect(page.getByText(/No se hizo ningún cambio/)).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('dialog', { name: `Eliminar fondo «${nombre}»` })).toBeVisible() // se puede reintentar o cancelar
    expect(sqlLocal(`select count(*) from public.funds where household_id = ${HID} and name = '${nombre}'`)).toBe('1')
  })

  test('en móvil la tabla pasa a tarjetas compactas sin desborde y con las acciones disponibles', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    const tarjeta = fila(page, 'Hogar')
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText('disponible')
    await expect(tarjeta.getByRole('button', { name: 'Ver gastos' })).toBeVisible()
    await expect(tarjeta.getByRole('button', { name: 'Más acciones de Hogar' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })
})
