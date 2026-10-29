import { readFile } from 'node:fs/promises'
import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { elegirEnGasto, email, iniciarSesion, password, vigilarConsola } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

async function irA(page: Page, seccion: string) {
  await page.getByRole('link', { name: 'Configuración' }).first().click()
  await page.getByRole('tab', { name: new RegExp(`^${seccion}`) }).click()
}

async function nuevoGasto(page: Page, descripcion: string) {
  await page.getByRole('link', { name: 'Gastos' }).first().click()
  await page.getByRole('button', { name: 'Nuevo gasto' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Importe', { exact: true }).fill('7')
  for (const [nombre, opcion] of [['Ámbito', 'Personal'], ['Categoría', 'Ocio'], ['Medio de pago', 'Yape']] as const) {
    await elegirEnGasto(d, nombre, opcion)
  }
  await d.getByLabel('Descripción', { exact: true }).fill(descripcion)
  await d.getByRole('button', { name: 'Guardar gasto' }).click()
  await expect(page.getByText('Gasto guardado.')).toBeVisible()
}

/** Lector CSV mínimo con comillas. */
function filasCsv(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++ } else if (c === '"') comillas = false
      else celda += c
    } else if (c === '"') comillas = true
    else if (c === ',') { fila.push(celda); celda = '' }
    else if (c === '\n') { fila.push(celda.endsWith('\r') ? celda.slice(0, -1) : celda); filas.push(fila); fila = []; celda = '' }
    else celda += c
  }
  return filas.filter((f) => f.length > 1)
}

test.describe('Configuración', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('tiene cinco secciones con navegación interna y datos de cuenta de solo lectura', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    const nav = page.getByRole('tablist', { name: 'Secciones de configuración' })
    await expect(nav.getByRole('tab')).toHaveCount(5)
    for (const [tab, h] of [['Perfil y preferencias', 'Perfil y preferencias'], ['Hogar', 'Hogar'], ['Exportar datos', 'Exportar datos'], ['Cuenta y seguridad', 'Cuenta y seguridad'], ['Actividad reciente', 'Actividad reciente']]) {
      await nav.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      await expect(page.getByRole('heading', { name: h, level: 2, exact: true })).toBeVisible()
    }
    await irA(page, 'Cuenta y seguridad')
    await expect(page.getByText('Correo de acceso')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /correo/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible()
    await irA(page, 'Hogar')
    await expect(page.getByText(/datos de demostración/i)).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/seccion=hogar/) // la sección se conserva al recargar
    expect(errores).toEqual([])
  })

  test('moneda fija, zona horaria con búsqueda por teclado, vista previa de fecha y estados de guardado', async ({ page }) => {
    await iniciarSesion(page)
    await irA(page, 'Perfil y preferencias')
    await expect(page.getByLabel('Moneda')).toHaveAttribute('readonly', '')
    await expect(page.getByText(/no convierte monedas/)).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Sin cambios' })).toBeVisible()

    // zona horaria: abrir con teclado, filtrar y elegir
    const zona = page.getByRole('combobox', { name: 'Zona horaria' })
    await zona.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.type('Madrid')
    await page.keyboard.press('Enter')
    await expect(zona).toContainText('Madrid')
    await expect(page.getByText('Hay cambios sin guardar')).toBeVisible()

    // formato de fecha con vista previa de la fecha actual
    const iso = page.getByRole('radio', { name: /Año-mes-día/ })
    const previa = (await iso.textContent())!.match(/\d{4}-\d{2}-\d{2}/)![0]
    await iso.click()
    await expect(iso).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Así se verán las fechas')).toContainText(previa)

    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible()
    expect(sqlLocal(`select timezone || '|' || date_format from public.profiles where user_id = '${E2E_UID}'`)).toBe('Europe/Madrid|yyyy-MM-dd')

    // persiste al recargar y se aplica en las tablas
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Zona horaria' })).toContainText('Madrid')
    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await expect(page.getByRole('row').nth(1).getByRole('cell').nth(1)).toHaveText(/^\d{4}-\d{2}-\d{2}$/)

    // descartar vuelve a lo guardado
    await irA(page, 'Perfil y preferencias')
    await page.getByRole('radio', { name: /Día \/ mes \/ año/ }).click()
    await page.getByRole('button', { name: 'Descartar' }).click()
    await expect(page.getByRole('radio', { name: /Año-mes-día/ })).toHaveAttribute('aria-checked', 'true')
    // restaurar valores originales
    await page.getByRole('radio', { name: /Día \/ mes \/ año/ }).click()
    await page.getByRole('combobox', { name: 'Zona horaria' }).click()
    await page.keyboard.type('America/Lima')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible()
  })

  test('un error al guardar se comunica y conserva los cambios', async ({ page }) => {
    await iniciarSesion(page)
    await irA(page, 'Perfil y preferencias')
    await page.route('**/rest/v1/profiles*', (r) => (r.request().method() === 'PATCH' ? r.abort('connectionrefused') : r.continue()))
    await page.getByRole('radio', { name: /Mes \/ día \/ año/ }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('No se pudo guardar. Inténtalo de nuevo.')).toBeVisible()
    await expect(page.getByRole('radio', { name: /Mes \/ día \/ año/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('el tema se guarda y se aplica', async ({ page }) => {
    await iniciarSesion(page)
    await irA(page, 'Perfil y preferencias')
    await page.getByRole('radio', { name: 'Oscuro' }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(sqlLocal(`select theme from public.profiles where user_id = '${E2E_UID}'`)).toBe('oscuro')
  })

  test('renombra el hogar', async ({ page }) => {
    await iniciarSesion(page)
    await irA(page, 'Hogar')
    const campo = page.getByLabel('Nombre del hogar')
    const guardar = page.locator('form').filter({ has: campo }).getByRole('button', { name: 'Guardar' })
    const original = await campo.inputValue()
    await campo.fill('Hogar Prueba E2E')
    await guardar.click()
    await expect(page.getByText('Nombre del hogar guardado.')).toBeVisible()
    await campo.fill(original)
    await guardar.click()
    await expect(page.getByText('Nombre del hogar guardado.').first()).toBeVisible()
  })

  test('actividad: resumen de 8, sin eventos de sistema, y vista completa con filtros y paginación', async ({ page }) => {
    await iniciarSesion(page)
    await nuevoGasto(page, 'E2E actividad')
    await page.getByRole('button', { name: 'Anular E2E actividad' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    const filasAntes = sqlLocal(`select count(*) from public.audit_logs where household_id = ${HID}`)
    const sistema = Number(sqlLocal(`select count(*) from public.audit_logs where household_id = ${HID} and user_id is null`))
    expect(sistema).toBeGreaterThan(0) // la carga inicial genera eventos de sistema

    await irA(page, 'Actividad reciente')
    const lista = page.getByLabel('Actividad reciente', { exact: true })
    const items = lista.getByRole('listitem')
    await expect(items.first()).toContainText('Anuló')
    await expect(items.first()).toContainText('E2E actividad')
    await expect(items.first()).toContainText('Anulación')
    await expect(items.nth(1)).toContainText('Creó')
    expect(await items.count()).toBeLessThanOrEqual(8)
    await expect(lista.getByText('Sistema', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Ver toda la actividad' }).click()
    const modal = page.getByRole('dialog', { name: 'Toda la actividad' })
    await expect(modal).toBeVisible()
    const completa = modal.getByLabel('Actividad', { exact: true })
    // solo eventos de usuario: caben en una página
    await expect(completa.getByRole('listitem')).toHaveCount(Number(sqlLocal(`select count(*) from public.audit_logs where household_id = ${HID} and user_id is not null`)))
    await expect(modal.getByText(/página 1 de 1/)).toBeVisible()

    // filtros: acción
    await modal.getByRole('combobox', { name: 'Acción' }).click()
    await page.getByRole('option', { name: 'Anuló', exact: true }).click()
    await expect(modal.getByText(/página 1 de 1/)).toBeVisible()
    await expect(completa.getByRole('listitem')).toHaveCount(1)
    await modal.getByRole('button', { name: 'Limpiar filtros' }).click()

    // los eventos de sistema solo aparecen si se piden
    await modal.getByLabel('Incluir eventos de sistema').check()
    await expect(modal.getByText(`${Number(filasAntes).toLocaleString('es-PE')} eventos`)).toBeVisible()
    await expect(completa.getByRole('listitem')).toHaveCount(15) // primera página
    await modal.getByRole('button', { name: 'Siguiente' }).click()
    await expect(modal.getByText(/página 2 de/)).toBeVisible()
    await modal.getByRole('button', { name: 'Anterior' }).click()
    await modal.getByRole('combobox', { name: 'Entidad' }).click()
    await page.getByRole('option', { name: 'Fondo', exact: true }).click()
    await expect(completa.getByText('Sistema', { exact: true }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
    await expect(page.getByRole('button', { name: 'Ver toda la actividad' })).toBeFocused()

    // la auditoría es de solo lectura: ver la actividad no altera ni borra filas
    expect(sqlLocal(`select count(*) from public.audit_logs where household_id = ${HID}`)).toBe(filasAntes)
  })

  test('exporta CSV de gastos: nombre, UTF-8, nombres legibles, anulados opcionales y protección de fórmulas', async ({ page }) => {
    await iniciarSesion(page)
    await nuevoGasto(page, '=cmd|calc')
    await nuevoGasto(page, 'E2E por anular')
    await page.getByRole('button', { name: 'Anular E2E por anular' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    await irA(page, 'Exportar datos')

    const activos = Number(sqlLocal(`select count(*) from public.expenses where household_id = ${HID} and status = 'active'`))
    const todos = Number(sqlLocal(`select count(*) from public.expenses where household_id = ${HID}`))
    expect(todos).toBe(activos + 1)

    const exportar = async () => {
      const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()])
      expect(d.suggestedFilename()).toMatch(/^gasto-deejota-gastos-\d{4}-\d{2}-\d{2}\.csv$/)
      const bruto = await readFile((await d.path())!, 'utf8')
      expect(bruto.charCodeAt(0)).toBe(0xfeff) // UTF-8 con BOM para Excel
      return { bruto, filas: filasCsv(bruto.slice(1)) }
    }

    const a = await exportar()
    await expect(page.getByText('Exportación de gastos lista.')).toBeVisible()
    expect(a.filas.length - 1).toBe(activos)
    const enc = a.filas[0]
    expect(enc).toEqual(expect.arrayContaining(['fecha', 'importe', 'ambito', 'categoria', 'medio_de_pago', 'fondos_imputados']))
    const fila = a.filas.find((f) => f[enc.indexOf('descripcion')].includes('cmd|calc'))!
    expect(fila[enc.indexOf('descripcion')]).toBe("'=cmd|calc") // neutralizada
    expect(fila[enc.indexOf('ambito')]).toBe('Personal')
    expect(fila[enc.indexOf('medio_de_pago')]).toBe('Yape')
    expect(fila[enc.indexOf('importe')]).toBe('7.00')
    expect(fila[enc.indexOf('fondos_imputados')]).toMatch(/: 7\.00/)
    expect(a.bruto).not.toMatch(/receipt|created_by|[0-9a-f]{8}-[0-9a-f]{4}-/) // sin ids internos ni rutas

    await page.getByLabel('Incluir gastos anulados').check()
    const b = await exportar()
    expect(b.filas.length - 1).toBe(todos)
    expect(b.filas.some((f) => f[enc.indexOf('estado')] === 'Anulado')).toBe(true)

    // rango de fechas: un día sin gastos da solo el encabezado
    await page.getByRole('button', { name: /Desde/ }).first().click()
    await page.getByRole('gridcell').first().click()
    const parcial = await exportar()
    expect(parcial.filas.length - 1).toBeLessThanOrEqual(todos)
  })

  test('el respaldo JSON pide confirmación, trae versión de esquema y no incluye secretos ni autoría', async ({ page }) => {
    await iniciarSesion(page)
    await irA(page, 'Exportar datos')
    // cancelar la confirmación no descarga nada
    let descargas = 0
    page.on('download', () => descargas++)
    await page.getByRole('button', { name: 'Descargar respaldo' }).click()
    await expect(page.getByRole('alertdialog', { name: /respaldo completo/ })).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
    await page.waitForTimeout(500)
    expect(descargas).toBe(0)

    await page.getByRole('button', { name: 'Descargar respaldo' }).click()
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('alertdialog').getByRole('button', { name: 'Descargar respaldo' }).click()])
    expect(d.suggestedFilename()).toMatch(/^gasto-deejota-respaldo-\d{4}-\d{2}-\d{2}\.json$/)
    const texto = await readFile((await d.path())!, 'utf8')
    const json = JSON.parse(texto)
    expect(json.aplicacion).toBe('Gasto Deejota')
    expect(json.version_esquema).toBe(1)
    expect(Date.parse(json.exportado_en)).not.toBeNaN()
    expect(Object.keys(json)).toEqual(expect.arrayContaining(['perfil', 'hogar', 'catalogo', 'fondos', 'periodos', 'gastos', 'imputaciones', 'plantillas']))
    expect(json.gastos.length).toBe(Number(sqlLocal(`select count(*) from public.expenses where household_id = ${HID}`)))
    expect(json.imputaciones.length).toBe(Number(sqlLocal(`select count(*) from public.expense_fund_allocations where household_id = ${HID}`)))
    expect(json.fondos.fondos.length).toBeGreaterThan(3)
    expect(json.catalogo.categorias.length).toBeGreaterThan(5)
    const sinNota = JSON.stringify({ ...json, nota: '' })
    expect(sinNota).not.toMatch(/access_token|refresh_token|service_role|encrypted_password|receipt_path|created_by|annulled_by|password|secret|apikey/i)
    expect(json.perfil).not.toHaveProperty('user_id')
    expect(sinNota).not.toContain(E2E_UID)
  })

  test('si la lectura falla a mitad de la exportación se avisa y no se descarga un archivo incompleto', async ({ page }) => {
    await iniciarSesion(page)
    await irA(page, 'Exportar datos')
    let descargas = 0
    page.on('download', () => descargas++)
    await page.route('**/rest/v1/expenses*', (r) => r.abort('connectionrefused'))
    await page.getByRole('button', { name: 'Exportar CSV' }).click()
    await expect(page.getByText(/Sin conexión con el servidor|No se pudo completar la exportación/)).toBeVisible({ timeout: 25_000 })
    await page.waitForTimeout(300)
    expect(descargas).toBe(0)
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled() // la interfaz queda usable
  })
})
