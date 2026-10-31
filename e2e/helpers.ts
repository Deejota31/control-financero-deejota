import { expect, type Locator, type Page } from '@playwright/test'

export const email = process.env.E2E_USER_EMAIL
export const password = process.env.E2E_USER_PASSWORD

export async function iniciarSesion(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Correo').fill(email!)
  await page.getByLabel('Contraseña', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toHaveAttribute('aria-current', 'page')
}

export const sufijo = () => `${Date.now().toString(36)}`

/** Falla la prueba si la consola del navegador registra errores. */
export function vigilarConsola(page: Page): string[] {
  const errores: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text())
  })
  page.on('pageerror', (e) => errores.push(e.message))
  return errores
}

/** Elige una opción de los chips del formulario de gasto (ámbito, categoría, subcategoría o medio de pago). */
export async function elegirEnGasto(dialogo: Locator, grupo: string, opcion: string) {
  await dialogo.getByRole('radiogroup', { name: grupo, exact: true }).getByRole('radio', { name: opcion, exact: true }).click()
}

/** Abre un selector (combobox) y elige la opción exacta. */
export async function elegir(page: Page, selector: Locator, opcion: string) {
  await selector.click()
  await page.getByRole('option', { name: opcion, exact: true }).click()
}

/** Fila de una plantilla de gasto en el gestor (secciones, selección múltiple y edición inline). */
export const filaPlantilla = (page: Page, nombre: string) => page.locator('[data-plantilla]').filter({ has: page.getByLabel(`Seleccionar ${nombre}`, { exact: true }) })

/** Ejecuta una acción del menú «Más acciones» de una plantilla de gasto. */
export async function accionPlantilla(page: Page, nombre: string, accion: string | RegExp) {
  await page.getByRole('button', { name: `Más acciones de ${nombre}`, exact: true }).click()
  await page.getByRole('menuitem', { name: accion }).or(page.getByRole('group', { name: `Acciones de ${nombre}`, exact: true }).getByRole('button', { name: accion })).first().click()
}

/** Fila de una plantilla de fondo en el gestor. */
export const filaPlantillaFondo = (page: Page, nombre: string) => page.locator(`[data-plantilla-fondo][data-nombre="${nombre}"]`)

/** Ejecuta una acción del menú «Más acciones» de una plantilla de fondo. */
export async function accionPlantillaFondo(page: Page, nombre: string, accion: string | RegExp) {
  await page.getByRole('button', { name: `Más acciones de la plantilla ${nombre}`, exact: true }).or(page.getByRole('button', { name: `Más acciones de ${nombre}`, exact: true })).click()
  await page.getByRole('menuitem', { name: accion }).or(page.getByRole('group', { name: `Acciones de ${nombre}`, exact: true }).getByRole('button', { name: accion })).first().click()
}
