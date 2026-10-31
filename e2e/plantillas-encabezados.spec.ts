import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/** Los encabezados de «Plantillas de fondos» deben quedar sobre su columna: la rejilla del encabezado y la de las filas tienen las mismas columnas. */
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`

test.describe('Plantillas de fondos: encabezados alineados con sus columnas', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 800], [1024, 768]] as const) {
    test(`a ${w}×${h} cada encabezado coincide con su columna (sin columnas fantasma)`, async ({ page }) => {
      sqlLocal(`insert into public.fund_templates (household_id, name, suggested_amount, priority, icon_key, color_token, sort_order) values
        (${HID}, 'Sodexo', 280, 100, 'wallet', 'c1', 1), (${HID}, 'Viaje', 1000, 100, 'wallet', 'c2', 2)`)
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      await page.goto('/fondos')
      await page.getByRole('button', { name: /Plantillas/ }).first().click()
      const d = page.getByRole('dialog', { name: 'Plantillas de fondos' })
      await expect(d).toBeVisible()
      const fila = d.locator('[data-plantilla-fondo][data-nombre="Sodexo"]')
      await expect(fila).toBeVisible()

      const cab = (t: string) => d.locator('div[aria-hidden="true"] > span', { hasText: new RegExp(`^${t}$`) }).first()
      const caja = async (l: ReturnType<typeof d.locator>) => (await l.boundingBox())!
      const H = { plantilla: await caja(cab('Plantilla')), cobertura: await caja(cab('Cobertura')), importe: await caja(cab('Importe')), prioridad: await caja(cab('Prioridad')), estado: await caja(cab('Estado')) }

      // Plantilla: el texto del encabezado empieza donde empieza el icono/nombre de la fila
      const nombre = await caja(fila.getByText('Sodexo', { exact: true }))
      const icono = await caja(fila.locator('svg').nth(1)) // [0] asa de orden, [1] icono de la plantilla
      expect(Math.abs(H.plantilla.x - icono.x)).toBeLessThanOrEqual(3)
      expect(nombre.x).toBeGreaterThan(H.plantilla.x - 1)
      // Cobertura: empieza donde empieza el primer chip (o el texto «Sin reglas de cobertura» cuando la plantilla aún no tiene reglas)
      expect(Math.abs(H.cobertura.x - (await caja(fila.getByLabel('Cobertura de Sodexo').or(fila.getByText('Sin reglas de cobertura')))).x)).toBeLessThanOrEqual(3)
      // Importe: texto alineado a la derecha de su columna = borde derecho del campo de importe
      const importe = await caja(fila.getByLabel('Importe de Sodexo'))
      expect(Math.abs(H.importe.x + H.importe.width - (importe.x + importe.width))).toBeLessThanOrEqual(3)
      // Prioridad: centrada sobre el campo
      const prioridad = await caja(fila.getByLabel('Prioridad propuesta de Sodexo'))
      expect(Math.abs(H.prioridad.x + H.prioridad.width / 2 - (prioridad.x + prioridad.width / 2))).toBeLessThanOrEqual(3)
      // Estado: empieza donde empieza la etiqueta de estado
      const estado = await caja(fila.getByText(/^(No disponible|Disponible)$/).filter({ visible: true })) // sin reglas de cobertura la plantilla figura como «No disponible»
      expect(Math.abs(H.estado.x - estado.x)).toBeLessThanOrEqual(3)
      // Orden de izquierda a derecha y todo dentro del diálogo
      expect(H.plantilla.x).toBeLessThan(H.cobertura.x)
      expect(H.cobertura.x).toBeLessThan(H.importe.x)
      expect(H.importe.x).toBeLessThan(H.prioridad.x)
      expect(H.prioridad.x).toBeLessThan(H.estado.x)
      const dlg = await caja(d)
      expect(H.estado.x + H.estado.width).toBeLessThanOrEqual(dlg.x + dlg.width)
      // El menú de acciones queda en la última columna (a la derecha del estado), sin columna extra
      const menu = await caja(fila.getByRole('button', { name: 'Más acciones de la plantilla Sodexo' }))
      expect(menu.x).toBeGreaterThan(H.estado.x)
      // Las dos filas comparten exactamente las mismas columnas
      const otra = d.locator('[data-plantilla-fondo][data-nombre="Viaje"]')
      expect(Math.abs((await caja(otra.getByLabel('Importe de Viaje'))).x - importe.x)).toBeLessThanOrEqual(1)
      expect(Math.abs((await caja(otra.getByLabel('Prioridad propuesta de Viaje'))).x - prioridad.x)).toBeLessThanOrEqual(1)
    })
  }
})
