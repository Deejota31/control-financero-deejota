import { expect, test, type Locator, type Page } from '@playwright/test'
import { email, iniciarSesion, password, sufijo, vigilarConsola } from './helpers'

async function elegir(page: Page, ambito: Locator, opcion: string) {
  await ambito.click()
  await page.getByRole('option', { name: opcion, exact: true }).click()
}

async function llenarGasto(page: Page, d: { importe: string; ambito: string; categoria: string; sub?: string; medio: string; descripcion?: string }) {
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Importe', { exact: true }).fill(d.importe)
  await elegir(page, dialogo.getByRole('combobox', { exact: true, name: 'Ámbito' }), d.ambito)
  await elegir(page, dialogo.getByRole('combobox', { exact: true, name: 'Categoría' }), d.categoria)
  if (d.sub) await elegir(page, dialogo.getByRole('combobox', { exact: true, name: 'Subcategoría (opcional)' }), d.sub)
  await elegir(page, dialogo.getByRole('combobox', { exact: true, name: 'Medio de pago' }), d.medio)
  if (d.descripcion) await dialogo.getByLabel('Descripción', { exact: true }).fill(d.descripcion)
}

async function irAGastos(page: Page) {
  await page.getByRole('link', { name: 'Gastos' }).first().click()
  await expect(page.getByRole('heading', { name: 'Gastos', level: 1 })).toBeVisible()
}

async function buscar(page: Page, texto: string) {
  await page.getByLabel('Buscar', { exact: true }).fill(texto)
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(texto).replace(/%20/g, '(\\+|%20)')}`))
}

test.describe('Gastos', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('crea, valida, edita, clona con la misma fecha, anula y restaura un gasto', async ({ page }) => {
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    await irAGastos(page)
    await expect(page.getByRole('table')).toBeVisible()

    // Validación
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(dialogo.getByText('Ingresa un importe mayor que 0 (por ejemplo 25.50).')).toBeVisible()
    await expect(dialogo.getByText('Elige un ámbito.')).toBeVisible()
    await expect(dialogo.getByText('Elige un medio de pago.')).toBeVisible()
    await dialogo.getByLabel('Importe', { exact: true }).fill('0')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(dialogo.getByText('Ingresa un importe mayor que 0 (por ejemplo 25.50).')).toBeVisible()
    await dialogo.getByLabel('Importe', { exact: true }).fill('-5')
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(dialogo.getByText('Ingresa un importe mayor que 0 (por ejemplo 25.50).')).toBeVisible()

    // Crear: la descripción se propone desde la subcategoría y se puede editar
    await llenarGasto(page, { importe: '33.5', ambito: 'Personal', categoria: 'Alimentación', sub: 'Comidas fuera', medio: 'Yape' })
    await expect(dialogo.getByLabel('Descripción', { exact: true })).toHaveValue('Comidas fuera')
    await expect(dialogo.getByLabel('Importe', { exact: true })).toHaveValue('33.50')
    await expect(dialogo.getByText('Saldo después:').first()).toBeVisible()
    const desc = `E2E ${sufijo()}`
    await dialogo.getByLabel('Descripción', { exact: true }).fill(desc)
    await dialogo.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    await buscar(page, desc)
    const fila = page.getByRole('row').filter({ hasText: desc })
    await expect(fila).toHaveCount(1)
    await expect(fila).toContainText('S/ 33.50')

    // Editar
    await fila.getByRole('button', { name: `Editar ${desc}` }).click()
    await page.getByRole('dialog').getByLabel('Importe', { exact: true }).fill('40')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Gasto actualizado.')).toBeVisible()
    await expect(fila).toContainText('S/ 40.00')

    // Clonar: conserva la fecha original y puede cambiarse cualquier dato
    const fechaOriginal = (await fila.getByRole('cell').nth(1).textContent())!.trim()
    await fila.getByRole('button', { name: `Clonar ${desc}` }).click()
    const dlg = page.getByRole('dialog')
    await expect(dlg.getByText(fechaOriginal)).toBeVisible()
    await expect(dlg.getByLabel('Descripción', { exact: true })).toHaveValue(desc)
    const copia = `${desc} copia`
    await dlg.getByLabel('Descripción', { exact: true }).fill(copia)
    await dlg.getByRole('button', { name: 'Guardar gasto' }).click()
    await expect(page.getByText('Gasto guardado.')).toBeVisible()
    await buscar(page, desc)
    await expect(page.getByRole('row').filter({ hasText: copia })).toHaveCount(1)
    await expect(page.getByRole('row').filter({ hasText: copia }).getByRole('cell').nth(1)).toHaveText(fechaOriginal)

    // Anular: confirmación con efecto en fondos
    await page.getByRole('button', { name: `Anular ${copia}` }).click()
    const confirmacion = page.getByRole('alertdialog')
    await expect(confirmacion).toContainText('Se liberará en los fondos')
    await confirmacion.getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: copia })).toHaveCount(0)

    // Ver anulados y restaurar
    await page.getByRole('combobox', { exact: true, name: 'Estado' }).click()
    await page.getByRole('option', { name: 'Anulados' }).click()
    const anulado = page.getByRole('row').filter({ hasText: copia })
    await expect(anulado).toContainText('Anulado')
    await anulado.getByRole('button', { name: `Restaurar ${copia}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restaurar' }).click()
    await expect(page.getByText('1 gasto restaurado.')).toBeVisible()

    // Limpieza: anular ambos
    await page.getByRole('combobox', { exact: true, name: 'Estado' }).click()
    await page.getByRole('option', { name: 'Activos' }).click()
    await page.getByLabel('Seleccionar todos los de esta página').check()
    await expect(page.getByText('2 seleccionados')).toBeVisible()
    await page.getByRole('button', { name: 'Anular seleccionados' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('2 gastos anulados.')).toBeVisible()
    expect(errores).toEqual([])
  })

  test('bloquea una combinación incompatible y explica el motivo', async ({ page }) => {
    await iniciarSesion(page)
    await irAGastos(page)
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const dialogo = page.getByRole('dialog')
    await llenarGasto(page, { importe: '20', ambito: 'Personal', categoria: 'Ocio', sub: 'Salidas', medio: 'Sodexo', descripcion: 'Prueba bloqueo' })
    await expect(dialogo.getByText('No se puede guardar con esta combinación.')).toBeVisible()
    await expect(dialogo.getByText(/ningún fondo admite a la vez/i)).toBeVisible()
    await expect(dialogo.getByRole('button', { name: 'Guardar gasto' })).toBeDisabled()
    // Cambiar a un medio compatible habilita el guardado
    await elegir(page, dialogo.getByRole('combobox', { exact: true, name: 'Medio de pago' }), 'Yape')
    await expect(dialogo.getByRole('button', { name: 'Guardar gasto' })).toBeEnabled()
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  })

  test('el fondo agotado deriva el excedente al Fondo General en la previsualización', async ({ page }) => {
    await iniciarSesion(page)
    await irAGastos(page)
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const dialogo = page.getByRole('dialog')
    await llenarGasto(page, { importe: '50', ambito: 'Hogar', categoria: 'Servicios', sub: 'Luz', medio: 'Yape' })
    await expect(dialogo.getByText('Excedente al General')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  })

  test('los filtros se reflejan en la URL, se combinan y se limpian', async ({ page }) => {
    await iniciarSesion(page)
    await irAGastos(page)
    await buscar(page, 'Almuerzo')
    const filas = page.getByRole('row').filter({ hasText: 'Almuerzo' })
    await expect(filas.first()).toBeVisible()
    await page.getByRole('combobox', { exact: true, name: 'Ámbito' }).click()
    await page.getByRole('option', { name: 'Trabajo' }).click()
    await expect(page).toHaveURL(/ambito=/)
    await page.getByRole('combobox', { exact: true, name: 'Fondo' }).click()
    await page.getByRole('option', { name: 'Alimentos Sodexo' }).click()
    await expect(page).toHaveURL(/fondo=/)
    await page.reload()
    await expect(page.getByLabel('Buscar', { exact: true })).toHaveValue('Almuerzo')
    await expect(page.getByRole('row').filter({ hasText: 'Almuerzo' }).first()).toBeVisible()

    await page.getByLabel('Buscar', { exact: true }).fill('zzz-no-existe')
    await expect(page.getByText('Ningún gasto coincide con los filtros')).toBeVisible()
    await page.getByRole('button', { name: 'Limpiar filtros' }).first().click()
    await expect(page).not.toHaveURL(/ambito=|fondo=|q=/)
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('ordena, pagina y exporta con los filtros aplicados', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos?desde=2020-01-01')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText(/Página 1 de [2-9]/)).toBeVisible()
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByText(/Página 2 de/)).toBeVisible()
    await expect(page).toHaveURL(/pagina=2/)

    // ordenar por importe ascendente
    await page.getByRole('button', { name: /^Importe/ }).click()
    await page.getByRole('button', { name: /^Importe/ }).click()
    await expect(page).toHaveURL(/orden=monto/)
    await expect(page).toHaveURL(/dir=asc/)
    await expect(page.getByText(/Página 1 de/)).toBeVisible()

    // selección múltiple y exportación de la selección
    await page.getByRole('checkbox', { name: /^Seleccionar / }).nth(1).check()
    await page.getByRole('checkbox', { name: /^Seleccionar / }).nth(2).check()
    await expect(page.getByText('2 seleccionados')).toBeVisible()
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar selección' }).click()])
    expect(descarga.suggestedFilename()).toBe('gastos_seleccion.csv')
    const [todo] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()])
    expect(todo.suggestedFilename()).toMatch(/^gastos_2020-01-01_/)
  })

  test('plantillas mensuales: crear, decidir "No aplica", registrar por lote y detectar lo ya registrado', async ({ page }) => {
    await iniciarSesion(page)
    await irAGastos(page)
    const nombre = `Tpl ${sufijo()}`

    await page.getByRole('button', { name: 'Plantillas' }).click()
    await page.getByRole('button', { name: 'Nueva plantilla' }).click()
    const form = page.getByRole('dialog').last()
    await form.getByLabel('Nombre', { exact: true }).fill(nombre)
    await form.getByLabel('Descripción del gasto').fill(`Gasto ${nombre}`)
    await form.getByLabel('Importe sugerido').fill('12.34')
    await elegir(page, form.getByRole('combobox', { exact: true, name: 'Ámbito' }), 'Hogar')
    await elegir(page, form.getByRole('combobox', { exact: true, name: 'Categoría' }), 'Servicios')
    await elegir(page, form.getByRole('combobox', { exact: true, name: 'Medio de pago (opcional)' }), 'Transferencia')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Plantilla guardada.')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).first().click()

    await page.getByRole('button', { name: 'Registrar mensuales' }).click()
    const lote = page.getByRole('dialog')
    // Solo la plantilla de esta prueba se registra; el resto se omite o marca "No aplica este mes".
    const decisiones = lote.getByRole('radiogroup', { name: /^Decisión para / })
    await expect(decisiones.first()).toBeVisible()
    await expect(lote.getByRole('radiogroup', { name: `Decisión para ${nombre}` })).toBeVisible()
    const total = await decisiones.count()
    for (let i = 0; i < total; i++) {
      const grupo = decisiones.nth(i)
      const etiqueta = await grupo.getAttribute('aria-label')
      if (etiqueta === `Decisión para ${nombre}`) continue
      await grupo.getByRole('radio', { name: i % 2 ? 'Omitir' : 'No aplica este mes' }).click()
    }
    await expect(lote.getByText(/Se registrarán 1 gasto por S\/ 12\.34/)).toBeVisible()
    await lote.getByRole('button', { name: 'Revisar y registrar' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText('Se registró 1 gasto por S/ 12.34.').or(page.getByText('Se registraron 1 gasto por S/ 12.34.'))).toBeVisible()

    // El gasto existe y vuelve a abrirse el lote: la plantilla figura como ya registrada
    await buscar(page, `Gasto ${nombre}`)
    await expect(page.getByRole('row').filter({ hasText: `Gasto ${nombre}` })).toHaveCount(1)
    await page.getByRole('button', { name: 'Registrar mensuales' }).click()
    await expect(page.getByRole('dialog').getByRole('row').filter({ hasText: nombre })).toContainText('Ya registrada este mes')
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).first().click()

    // Limpieza
    await page.getByRole('button', { name: `Anular Gasto ${nombre}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByText('1 gasto anulado.')).toBeVisible()
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await page.getByRole('button', { name: `Eliminar ${nombre}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText('Plantilla eliminada.')).toBeVisible()
  })

  test('si Supabase falla, la tabla muestra un error con opción de reintentar', async ({ page }) => {
    await iniciarSesion(page)
    await page.route('**/rest/v1/expenses**', (r) => r.abort('connectionrefused'))
    await irAGastos(page)
    // TanStack Query reintenta una vez antes de mostrar el error
    await expect(page.getByText('No se pudieron cargar los gastos.')).toBeVisible({ timeout: 20_000 })
    await page.unroute('**/rest/v1/expenses**')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByRole('table')).toBeVisible()
  })
})
