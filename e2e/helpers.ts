import { expect, type Locator, type Page } from '@playwright/test'

export const email = process.env.E2E_USER_EMAIL
export const password = process.env.E2E_USER_PASSWORD

export async function iniciarSesion(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Correo').fill(email!)
  await page.getByLabel('Contraseña', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(enlaceModulo(page, 'Dashboard').first()).toHaveAttribute('aria-current', 'page')
}

/**
 * Enlace de un módulo en la navegación visible. La barra lateral usa el nombre completo («Dashboard», «Configuración») y la inferior el corto
 * («Inicio», «Ajustes»); el nombre accesible de cada una es su texto visible.
 */
export function enlaceModulo(page: Page, modulo: 'Dashboard' | 'Configuración') {
  const nombre = modulo === 'Dashboard' ? /^(Dashboard|Inicio)$/ : /^(Configuración|Ajustes)$/
  return page.getByRole('link', { name: nombre })
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

/**
 * Elementos del contenido (texto, iconos, controles) que quedan bajo el botón flotante «Registrar gasto» en la posición de scroll actual.
 * Al final del scroll debe estar vacía: el botón flota sobre el viewport y nunca puede ocultar un dato o un control.
 */
export function contenidoBajoElBoton(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fab = document.querySelector('.fab-gasto')
    if (!fab || getComputedStyle(fab).display === 'none') return []
    const f = fab.getBoundingClientRect()
    const interactivo = 'a, button, input, select, textarea, [role="button"]'
    // Un texto ocupa solo lo que se pinta (sus líneas), no toda la caja del párrafo: una nota corta a la izquierda no está bajo un botón de la derecha.
    const cajas = (e: Element): DOMRect[] => {
      if (e.children.length === 0 && !e.matches(interactivo) && e.textContent?.trim()) {
        const rango = document.createRange()
        rango.selectNodeContents(e)
        return Array.from(rango.getClientRects())
      }
      return [e.getBoundingClientRect()]
    }
    return Array.from(document.querySelectorAll('#contenido *'))
      .filter((e) => {
        const hoja = e.children.length === 0 && (Boolean(e.textContent?.trim()) || e instanceof SVGElement)
        if (!hoja && !e.matches(interactivo)) return false
        return cajas(e).some((r) => r.width > 0 && r.height > 0 && r.left < f.right && f.left < r.right && r.top < f.bottom && f.top < r.bottom)
      })
      .map((e) => `${e.tagName.toLowerCase()} «${(e.textContent ?? '').trim().slice(0, 30)}»`)
  })
}
