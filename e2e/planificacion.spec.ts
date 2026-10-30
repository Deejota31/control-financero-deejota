import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const ACT = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD')`)
const SIG = sqlLocal(`select to_char(date_trunc('month', current_date) + interval '1 month', 'YYYY-MM-DD')`)
const periodo = (mes: string) => `(select id from public.budget_periods where household_id = ${HID} and start_date = '${mes}')`
const nFondos = (mes: string) => Number(sqlLocal(`select count(*) from public.funds where period_id = ${periodo(mes)}`))
const monto = (mes: string, nombre: string) => Number(sqlLocal(`select b.assigned_amount from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where f.period_id = ${periodo(mes)} and f.name = '${nombre}'`))
const plan = (mes: string, col: string) => sqlLocal(`select ${col} from public.period_plans where period_id = ${periodo(mes)}`)

/** El mes siguiente es el escenario de «mes nuevo»: cada prueba lo deja vacío antes de empezar (y sin plan). */
function vaciarSiguiente() {
  sqlLocal(`delete from public.period_plans where period_id = ${periodo(SIG)}`)
  sqlLocal(`delete from public.funds where period_id = ${periodo(SIG)}`)
}

const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test.describe('Fondos independientes por mes y planificación mensual', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(() => vaciarSiguiente())
  test.afterAll(() => vaciarSiguiente())

  test('A · un mes nuevo no hereda fondos: estado vacío con sus tres acciones', async ({ page }) => {
    await iniciarSesion(page)
    expect(nFondos(ACT)).toBe(5)
    await page.goto(`/fondos?mes=${SIG}`)
    await expect(page.getByText('Período futuro')).toBeVisible()
    await expect(page.getByText(/Todavía no tienes fondos configurados para/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear nuevo fondo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copiar fondos del mes anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir planificación mensual' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Fondos' })).toHaveCount(0)
    expect(nFondos(SIG)).toBe(0)
  })

  test('B/H · copia parcial con importe editado: independiente del origen e idempotente', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Copiar fondos del mes anterior' }).click()
    const d = page.getByRole('dialog', { name: 'Copiar fondos de otro mes' })
    await expect(d.getByRole('checkbox', { name: 'Copiar Hogar' })).toBeChecked()
    await d.getByRole('checkbox', { name: 'Copiar Bebé' }).uncheck()
    await d.getByRole('checkbox', { name: 'Copiar Familia' }).uncheck()
    await d.getByLabel('Importe de Hogar').fill('800')
    expect(nFondos(SIG)).toBe(0) // seleccionar no crea nada
    await d.getByRole('button', { name: 'Copiar 3 fondos' }).click()
    await expect(page.getByText(/3 fondos copiados/)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(3)
    expect(nFondos(SIG)).toBe(3)
    expect(nFondos(ACT)).toBe(5)
    expect(monto(SIG, 'Hogar')).toBe(800)
    expect(monto(ACT, 'Hogar')).toBe(700)

    // Repetir: lo ya copiado no se puede volver a copiar y no se duplica nada.
    await page.getByRole('button', { name: 'Copiar fondos de otro mes' }).click()
    const d2 = page.getByRole('dialog', { name: 'Copiar fondos de otro mes' })
    await expect(d2.getByRole('checkbox', { name: 'Copiar Hogar' })).toBeDisabled()
    await expect(d2.getByText('No se copiará: ya se había copiado.').first()).toBeVisible()
    await expect(d2.getByRole('button', { name: 'Copiar 2 fondos' })).toBeVisible()
    await d2.getByRole('button', { name: 'Cancelar' }).click()
    expect(nFondos(SIG)).toBe(3)
  })

  test('C · editar el importe de un fondo en un mes no cambia los demás meses', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Copiar fondos del mes anterior' }).click()
    await page.getByRole('dialog', { name: 'Copiar fondos de otro mes' }).getByRole('button', { name: 'Copiar 5 fondos' }).click()
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(5)
    await page.getByRole('button', { name: 'Más acciones de Hogar' }).click()
    await page.getByRole('menuitem', { name: /Editar/ }).click()
    const f = page.getByRole('dialog')
    await f.getByLabel('Importe de este mes (S/)').fill('950')
    await f.getByRole('button', { name: 'Guardar fondo' }).click()
    const confirmacion = page.getByRole('alertdialog')
    await expect(confirmacion.or(page.getByText('Fondo guardado.').first())).toBeVisible()
    if (await confirmacion.isVisible()) await confirmacion.getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(page.getByText('Fondo guardado.')).toBeVisible()
    expect(monto(SIG, 'Hogar')).toBe(950)
    expect(monto(ACT, 'Hogar')).toBe(700)
    // Otro mes con otra cantidad de fondos: el actual sigue con los suyos.
    await page.goto(`/fondos?mes=${ACT}`)
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(5)
  })

  // ---- Asistente: continuidad del flujo -----------------------------------------------------------------------------------------------------
  const asistente = (page: Page) => page.getByRole('dialog', { name: /^Planificación · / })
  const abrirAsistente = async (page: Page, mes = SIG) => {
    await page.goto(`/fondos?mes=${mes}`)
    await page.getByRole('button', { name: 'Abrir planificación mensual' }).click()
    await expect(asistente(page)).toBeVisible()
    return asistente(page)
  }
  /** Crea un fondo desde el formulario «Nuevo fondo» abierto por el asistente. */
  const crearFondo = async (page: Page, nombre: string, ambito: string, importe: string) => {
    const a = asistente(page)
    await a.getByRole('button', { name: 'Crear nuevo fondo' }).click()
    const form = page.getByRole('dialog', { name: 'Nuevo fondo' })
    await expect(form).toBeVisible()
    await form.getByLabel('Nombre').fill(nombre)
    await form.getByRole('radiogroup', { name: `Regla para ${ambito}` }).getByRole('radio', { name: 'Incluir' }).click()
    await form.getByLabel('Importe de este mes (S/)').fill(importe)
    await form.getByRole('button', { name: 'Guardar fondo' }).click()
    const confirmacion = page.getByRole('alertdialog')
    await expect(confirmacion.or(page.getByText('Fondo guardado.').first())).toBeVisible()
    if (await confirmacion.isVisible()) await confirmacion.getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(form).toBeHidden()
  }
  const estadoTarjeta = (page: Page, etapa: string) => asistente(page).getByRole('list', { name: 'Etapas de la planificación' }).getByRole('button', { name: new RegExp(`^\\d?\\s*${etapa}`) })

  test('A · crear un fondo desde la planificación no cierra el asistente', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await expect(a.getByRole('heading', { name: /Prepara tus fondos de/ })).toBeVisible()
    await crearFondo(page, 'Fondo A', 'Hogar', '120')
    await expect(a).toBeVisible() // el asistente sigue abierto
    await expect(a.getByRole('heading', { name: /Prepara tus fondos de/ })).toBeVisible() // misma etapa
    await expect(a.getByRole('list', { name: 'Fondos del mes' }).getByText('Fondo A')).toBeVisible()
    await expect(a.getByText('1 fondo', { exact: true })).toBeVisible()
    await expect(a.getByText('S/ 120.00').first()).toBeVisible() // presupuesto actualizado
    await expect(a.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    expect(nFondos(SIG)).toBe(1)
    expect(monto(SIG, 'Fondo A')).toBe(120)
    // Sigue siendo de ese mes: el mes actual conserva los suyos.
    expect(nFondos(ACT)).toBe(5)
  })

  test('B · tres fondos seguidos sin salir del asistente, sin duplicados', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Uno', 'Hogar', '100')
    await crearFondo(page, 'Dos', 'Bebé', '200')
    await crearFondo(page, 'Tres', 'Familia', '300')
    await expect(a).toBeVisible()
    await expect(a.getByRole('list', { name: 'Fondos del mes' }).getByRole('listitem')).toHaveCount(3)
    await expect(a.getByText('3 fondos', { exact: true })).toBeVisible()
    await expect(a.getByText('S/ 600.00').first()).toBeVisible()
    expect(nFondos(SIG)).toBe(3)
    expect(Number(sqlLocal(`select count(distinct lower(name)) from public.funds where period_id = ${periodo(SIG)}`))).toBe(3)
  })

  test('C · cancelar el formulario vuelve al mismo punto sin crear nada ni perder selecciones', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await a.getByRole('checkbox', { name: 'Copiar Bebé' }).uncheck() // selección temporal previa
    await a.getByRole('button', { name: 'Crear nuevo fondo' }).click()
    const form = page.getByRole('dialog', { name: 'Nuevo fondo' })
    await expect(form).toBeVisible()
    await expect(form.getByLabel('Nombre')).toBeFocused() // el foco entra al formulario
    await page.keyboard.press('Escape') // solo cierra la capa superior
    await expect(form).toBeHidden()
    await expect(a).toBeVisible()
    await expect(a.getByRole('checkbox', { name: 'Copiar Bebé' })).not.toBeChecked() // la selección sigue ahí
    await a.getByRole('button', { name: 'Crear nuevo fondo' }).click()
    await page.getByRole('dialog', { name: 'Nuevo fondo' }).getByRole('button', { name: 'Cancelar' }).click()
    await expect(a).toBeVisible()
    expect(nFondos(SIG)).toBe(0)
  })

  test('C · un error al guardar mantiene el formulario abierto con sus datos', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Repetido', 'Hogar', '50')
    await a.getByRole('button', { name: 'Crear nuevo fondo' }).click()
    const form = page.getByRole('dialog', { name: 'Nuevo fondo' })
    await form.getByLabel('Nombre').fill('Repetido') // mismo nombre en el mismo mes: la base lo rechaza
    await form.getByRole('radiogroup', { name: 'Regla para Hogar' }).getByRole('radio', { name: 'Incluir' }).click()
    await form.getByLabel('Importe de este mes (S/)').fill('75')
    await form.getByRole('button', { name: 'Guardar fondo' }).click()
    await expect(page.getByText(/ya existe|duplicad|unique|Ya hay/i).first()).toBeVisible()
    await expect(form).toBeVisible()
    await expect(form.getByLabel('Nombre')).toHaveValue('Repetido')
    await expect(form.getByLabel('Importe de este mes (S/)')).toHaveValue(/75/)
    await expect(a).toBeVisible()
    expect(nFondos(SIG)).toBe(1)
  })

  test('D · los estados de las etapas siguen lo confirmado, no lo visitado', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    // Al iniciar
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('En progreso')
    await expect(estadoTarjeta(page, 'Gastos')).toContainText('Pendiente')
    await expect(estadoTarjeta(page, 'Resumen')).toContainText('Por finalizar')
    // Crear un fondo NO completa la etapa
    await crearFondo(page, 'Base', 'Hogar', '100')
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('En progreso')
    expect(plan(SIG, 'funds_stage')).toBe('pending')
    // Visitar Gastos tampoco completa nada
    await estadoTarjeta(page, 'Gastos').click()
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('En progreso')
    await estadoTarjeta(page, 'Fondos').click()
    // Confirmar la etapa (Continuar) la completa y pasa a Gastos
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('Completada')
    await expect(estadoTarjeta(page, 'Gastos')).toContainText('En progreso')
    await expect(estadoTarjeta(page, 'Resumen')).toContainText('Por finalizar')
    expect(plan(SIG, 'funds_stage')).toBe('done')
    // Gastos: confirmar la revisión
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(estadoTarjeta(page, 'Gastos')).toContainText('Completada')
    await expect(estadoTarjeta(page, 'Resumen')).toContainText('Por finalizar')
    // Finalizar
    await a.getByRole('button', { name: 'Finalizar planificación' }).click()
    await expect(page.getByText(/finalizada/)).toBeVisible()
    await abrirDeNuevo(page)
    await expect(estadoTarjeta(page, 'Resumen')).toContainText('Finalizada')
  })

  const abrirDeNuevo = async (page: Page) => {
    await page.getByRole('button', { name: 'Planificación', exact: true }).click()
    await page.getByRole('dialog', { name: 'Planificación mensual' }).getByRole('button', { name: /planificación$/ }).click()
    await expect(asistente(page)).toBeVisible()
  }

  test('D · omitir una etapa la deja «Omitida», no «Completada»', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await a.getByRole('button', { name: 'Omitir etapa' }).click()
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('Omitida')
    await expect(estadoTarjeta(page, 'Gastos')).toContainText('En progreso')
    expect(plan(SIG, 'funds_stage')).toBe('skipped')
  })

  test('E · guardado progresivo: cerrar y volver conserva fondos y estados', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Persistente', 'Hogar', '90')
    await crearFondo(page, 'Persistente 2', 'Bebé', '60')
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(a).toBeHidden()
    // Recargar el navegador: todo viene de Supabase
    await page.reload()
    await page.getByRole('button', { name: 'Planificación', exact: true }).click()
    const estado = page.getByRole('dialog', { name: 'Planificación mensual' })
    await expect(estado.getByText('En progreso')).toBeVisible()
    await estado.getByRole('button', { name: 'Continuar planificación' }).click()
    await expect(asistente(page).getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible() // retoma en Gastos
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('Completada')
    await estadoTarjeta(page, 'Fondos').click()
    await expect(asistente(page).getByRole('list', { name: 'Fondos del mes' }).getByRole('listitem')).toHaveCount(2)
    expect(nFondos(SIG)).toBe(2) // sin duplicados
  })

  test('E · editar la etapa de fondos ya completada la vuelve a pendiente', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Primero', 'Hogar', '100')
    await a.getByRole('button', { name: 'Continuar' }).click()
    expect(plan(SIG, 'funds_stage')).toBe('done')
    await estadoTarjeta(page, 'Fondos').click()
    await crearFondo(page, 'Otro', 'Bebé', '40') // hay algo nuevo que confirmar
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('En progreso')
    expect(plan(SIG, 'funds_stage')).toBe('pending')
  })

  test('F · gastos mensuales: abrir plantillas y registrar por lote sin salir ni duplicar', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Para gastos', 'Hogar', '500')
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    await a.getByRole('button', { name: 'Abrir gastos mensuales' }).click()
    const gestion = page.getByRole('dialog').filter({ hasText: /Gastos mensuales|plantilla/i }).last()
    await expect(gestion).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(a).toBeVisible() // la planificación sigue abierta
    const antes = Number(sqlLocal(`select count(*) from public.expenses where household_id = ${HID} and status = 'active' and expense_date >= '${SIG}'`))
    // La etapa es un gestor: sin nada seleccionado no se puede registrar, y seleccionar/editar no crea nada hasta confirmar la revisión.
    await expect(a.getByRole('button', { name: /Revisar y registrar/ })).toBeDisabled()
    await a.getByLabel('Seleccionar Internet', { exact: true }).check()
    await a.getByRole('button', { name: /Revisar y registrar 1 gasto/ }).click()
    const rev = page.getByRole('dialog', { name: 'Confirmar registro de gastos' })
    await expect(rev).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(rev).toBeHidden()
    await expect(a).toBeVisible()
    expect(Number(sqlLocal(`select count(*) from public.expenses where household_id = ${HID} and status = 'active' and expense_date >= '${SIG}'`))).toBe(antes) // abrir no registra nada
    await expect(estadoTarjeta(page, 'Gastos')).toContainText('En progreso')
  })

  test('G · finalizar y volver a abrir: completada, etapas correctas y sin registros duplicados', async ({ page }) => {
    await iniciarSesion(page)
    const gastosAntes = sqlLocal(`select count(*) from public.expenses where household_id = ${HID}`)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Final', 'Hogar', '250')
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    await a.getByRole('button', { name: 'Omitir etapa' }).click()
    await expect(a.getByRole('heading', { name: /Resumen de planificación/ })).toBeVisible()
    await expect(a.getByText('Fondos').first()).toBeVisible()
    await a.getByRole('button', { name: 'Finalizar planificación' }).click()
    await expect(page.getByText(/finalizada/)).toBeVisible()
    expect(plan(SIG, 'status')).toBe('completed')
    expect(plan(SIG, 'funds_stage')).toBe('done')
    expect(plan(SIG, 'expenses_stage')).toBe('skipped')
    expect(plan(SIG, 'completed_at')).not.toBe('')
    expect(sqlLocal(`select count(*) from public.expenses where household_id = ${HID}`)).toBe(gastosAntes)
    expect(nFondos(SIG)).toBe(1)
    await abrirDeNuevo(page)
    await expect(estadoTarjeta(page, 'Fondos')).toContainText('Completada')
    await expect(estadoTarjeta(page, 'Gastos')).toContainText('Omitida')
    await expect(estadoTarjeta(page, 'Resumen')).toContainText('Finalizada')
    await expect(asistente(page).getByText(/Finalizada el/).first()).toBeVisible()
    expect(nFondos(SIG)).toBe(1)
    expect(monto(SIG, 'Final')).toBe(250)
  })

  test('I · los meses son independientes: fondos y planificación de un mes no tocan los de otro', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Solo siguiente', 'Hogar', '10')
    await a.getByRole('button', { name: 'Continuar' }).click()
    await page.keyboard.press('Escape')
    await page.goto(`/fondos?mes=${ACT}`)
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(5)
    await expect(page.getByText('Solo siguiente')).toHaveCount(0)
    expect(Number(sqlLocal(`select count(*) from public.period_plans where period_id = ${periodo(ACT)}`))).toBe(0)
    expect(plan(SIG, 'funds_stage')).toBe('done')
  })

  test('E · con selecciones temporales sin confirmar se advierte antes de abandonar', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await a.getByRole('checkbox', { name: 'Copiar Hogar' }).uncheck() // cambio temporal, aún no guardado
    await page.keyboard.press('Escape')
    const aviso = page.getByRole('alertdialog')
    await expect(aviso).toBeVisible()
    await aviso.getByRole('button', { name: /Seguir|Cancelar|Volver/ }).first().click()
    await expect(a).toBeVisible()
    await expect(a.getByRole('checkbox', { name: 'Copiar Hogar' })).not.toBeChecked()
    expect(nFondos(SIG)).toBe(0) // lo temporal nunca se guardó
    await page.keyboard.press('Escape')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar cambios' }).click()
    await expect(a).toBeHidden()
    expect(nFondos(SIG)).toBe(0)
  })

  test('A · editar un fondo desde el asistente vuelve a la misma etapa con el dato actualizado', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Editable', 'Hogar', '100')
    await a.getByRole('button', { name: 'Editar Editable' }).click()
    const form = page.getByRole('dialog', { name: 'Editar fondo' })
    await form.getByLabel('Importe de este mes (S/)').fill('180')
    await form.getByRole('button', { name: 'Guardar fondo' }).click()
    const confirmacion = page.getByRole('alertdialog')
    await expect(confirmacion.or(page.getByText('Fondo guardado.').first())).toBeVisible()
    if (await confirmacion.isVisible()) await confirmacion.getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(form).toBeHidden()
    await expect(a.getByRole('heading', { name: /Prepara tus fondos de/ })).toBeVisible()
    await expect(a.getByText('S/ 180.00').first()).toBeVisible()
    expect(monto(SIG, 'Editable')).toBe(180)
    expect(nFondos(SIG)).toBe(1)
  })

  test('A · tras cerrar subformularios y el asistente no quedan clics ni scroll bloqueados y el foco vuelve', async ({ page }) => {
    await iniciarSesion(page)
    const a = await abrirAsistente(page)
    await crearFondo(page, 'Foco', 'Hogar', '10')
    await a.getByRole('button', { name: 'Crear nuevo fondo' }).click()
    await page.getByRole('dialog', { name: 'Nuevo fondo' }).getByRole('button', { name: 'Cancelar' }).click()
    // con el asistente aún abierto sus controles siguen operativos
    await expect(a.getByRole('button', { name: 'Crear nuevo fondo' })).toBeEnabled()
    await a.getByRole('button', { name: 'Crear nuevo fondo' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Nuevo fondo' }).getByLabel('Nombre')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Nuevo fondo' })).toBeHidden() // termina la salida del formulario
    await expect(a.getByRole('button', { name: 'Crear nuevo fondo' })).toBeFocused() // el foco vuelve al elemento de origen
    await page.keyboard.press('Escape')
    await expect(a).toBeHidden()
    const bloqueo = await page.evaluate(() => ({ eventos: getComputedStyle(document.body).pointerEvents, desborde: getComputedStyle(document.body).overflow }))
    expect(bloqueo.eventos).not.toBe('none')
    expect(bloqueo.desborde).not.toBe('hidden')
    await page.getByRole('button', { name: 'Planificación', exact: true }).click() // la página responde
    await expect(page.getByRole('dialog', { name: 'Planificación mensual' })).toBeVisible()
  })

  test('H · el asistente y su formulario secundario caben de 320 a 1920 px y en modo oscuro', async ({ page }) => {
    test.setTimeout(120_000)
    await iniciarSesion(page)
    for (const [w, h] of [[320, 640], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h })
      const a = await abrirAsistente(page)
      await expect(a.getByRole('button', { name: 'Confirmar fondos' })).toBeVisible()
      for (const dlg of [a]) {
        const c = await dlg.boundingBox()
        expect(c!.x, `asistente ${w}`).toBeGreaterThanOrEqual(-1)
        expect(c!.x + c!.width, `asistente ${w}`).toBeLessThanOrEqual(w + 1)
        expect(c!.y + c!.height, `asistente alto ${w}`).toBeLessThanOrEqual(h + 1)
      }
      expect(await sinDesborde(page), `página con el asistente ${w}px`).toBeLessThanOrEqual(1)
      await a.getByRole('button', { name: 'Crear nuevo fondo' }).click()
      const form = page.getByRole('dialog', { name: 'Nuevo fondo' })
      await expect(form.getByRole('button', { name: 'Guardar fondo' })).toBeVisible()
      const f = await form.boundingBox()
      expect(f!.x + f!.width, `formulario ${w}`).toBeLessThanOrEqual(w + 1)
      expect(f!.y + f!.height, `formulario alto ${w}`).toBeLessThanOrEqual(h + 1)
      expect(await sinDesborde(page), `página con el formulario ${w}px`).toBeLessThanOrEqual(1)
      await form.getByRole('button', { name: 'Cancelar' }).click()
      await expect(form).toBeHidden()
      await page.keyboard.press('Escape')
      await expect(a).toBeHidden()
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.setViewportSize({ width: 390, height: 844 })
    const a = await abrirAsistente(page)
    await a.getByRole('button', { name: 'Crear nuevo fondo' }).click()
    await expect(page.getByRole('dialog', { name: 'Nuevo fondo' })).toBeVisible()
  })

  for (const tema of ['light', 'dark'] as const) {
    test(`accesibilidad (axe) del estado vacío, la copia, el estado y el asistente, tema ${tema}`, async ({ page }) => {
      test.setTimeout(90_000)
      await iniciarSesion(page)
      await page.goto(`/fondos?mes=${SIG}`)
      await page.evaluate((v) => document.documentElement.setAttribute('data-theme', v), tema)
      const auditar = async (contexto: string) => {
        await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze()
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`), `${contexto} (${tema})`).toEqual([])
      }
      await expect(page.getByText(/Todavía no tienes fondos configurados/)).toBeVisible()
      await auditar('Fondos de un mes sin fondos')
      await page.getByRole('button', { name: 'Copiar fondos del mes anterior' }).click()
      await expect(page.getByRole('dialog', { name: 'Copiar fondos de otro mes' }).getByRole('checkbox', { name: 'Copiar Hogar' })).toBeVisible()
      await auditar('Copiar fondos')
      await page.getByRole('button', { name: 'Cancelar' }).click()
      await page.getByRole('button', { name: 'Planificación', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Planificación mensual' })).toBeVisible()
      await auditar('Estado de planificación')
      await page.getByRole('button', { name: 'Comenzar planificación' }).click()
      await expect(page.getByRole('dialog', { name: /^Planificación · / }).getByRole('button', { name: 'Confirmar fondos' })).toBeVisible()
      await auditar('Asistente, etapa 1')
      await page.getByRole('button', { name: 'Omitir etapa' }).click()
      await auditar('Asistente, etapa 2')
      await page.getByRole('button', { name: 'Omitir etapa' }).click()
      await auditar('Asistente, etapa 3')
    })
  }
})
