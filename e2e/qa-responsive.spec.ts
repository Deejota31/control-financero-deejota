import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Barrido responsive de la revisión de calidad: cada módulo y los diálogos clave en 11 tamaños. Además de «sin scroll horizontal», se comprueba que ningún
 * control interactivo quede fuera de pantalla ni recortado por un contenedor con overflow oculto (un contenedor que se desplaza no cuenta como recorte).
 */
const TAMANOS = [[320, 640], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [844, 390]] as const
const MODULOS = [['/', 'Dashboard'], ['/gastos', 'Gastos'], ['/fondos', 'Fondos'], ['/catalogo', 'Catálogo'], ['/salud', 'Salud financiera'], ['/configuracion', 'Configuración']] as const

/** Lista los defectos de layout visibles en este momento (vacía si todo está bien). Se ejecuta dentro de la página. */
async function defectos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const out: string[] = []
    const nombre = (el: Element) => ((el.getAttribute('aria-label') || el.textContent || el.tagName) ?? '').trim().replace(/\s+/g, ' ').slice(0, 36)
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el)
      return r.width >= 2 && r.height >= 2 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
    }
    const recortadores = (el: Element) => {
      const res: Element[] = []
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a)
        if (['hidden', 'clip'].includes(s.overflowX) || ['hidden', 'clip'].includes(s.overflowY)) res.push(a)
      }
      return res
    }
    if (document.documentElement.scrollWidth > vw + 1) out.push(`la página se desplaza en horizontal (${document.documentElement.scrollWidth - vw}px)`)
    const sel = 'button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, [role=button], [role=radio], [role=checkbox], [role=tab], [role=combobox], [role=switch]'
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue
      if (el.closest('[aria-hidden="true"]') || el.closest('.sr-only')) continue
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1 || r.left < -1) { out.push(`fuera de pantalla: «${nombre(el)}»`); continue }
      const area = r.width * r.height
      for (const c of recortadores(el)) {
        const cr = c.getBoundingClientRect()
        const w = Math.max(0, Math.min(r.right, cr.right) - Math.max(r.left, cr.left))
        const h = Math.max(0, Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top))
        // un control que queda por debajo del pliegue de un cuerpo con scroll NO es un recorte: solo cuenta el recorte en horizontal o por overflow oculto
        if (w * h < area * 0.9 && (['hidden', 'clip'].includes(getComputedStyle(c).overflowX) ? w < r.width * 0.9 : false)) { out.push(`recortado por un contenedor: «${nombre(el)}»`); break }
      }
    }
    return [...new Set(out)].slice(0, 6)
  })
}

async function cargado(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('status', { name: /^Cargando/ })).toHaveCount(0, { timeout: 15_000 })
  await page.waitForTimeout(250)
}

test.describe('Revisión de calidad: responsive por módulo y diálogo', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  for (const [w, h] of TAMANOS) {
    test(`módulos ${w}×${h}`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      for (const [ruta, nombre] of MODULOS) {
        await page.goto(ruta)
        await cargado(page)
        expect(await defectos(page), `${nombre} a ${w}×${h}`).toEqual([])
      }
    })

    test(`diálogos ${w}×${h}`, async ({ page }) => {
      test.setTimeout(150_000)
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      const enPantalla = async (dialogo: ReturnType<Page['getByRole']>, etiqueta: string) => {
        const c = (await dialogo.boundingBox())!
        expect(c.x, `${etiqueta} borde izquierdo`).toBeGreaterThanOrEqual(-1)
        expect(c.x + c.width, `${etiqueta} borde derecho`).toBeLessThanOrEqual(w + 1)
        expect(c.y + c.height, `${etiqueta} borde inferior`).toBeLessThanOrEqual(h + 1)
        expect(await defectos(page), `${etiqueta} a ${w}×${h}`).toEqual([])
      }

      await page.goto('/gastos')
      await cargado(page)
      await page.getByRole('button', { name: 'Nuevo gasto' }).first().click()
      const gasto = page.getByRole('dialog', { name: 'Nuevo gasto' })
      await expect(gasto.getByRole('button', { name: 'Guardar gasto' })).toBeVisible() // el pie con acciones sigue a la vista
      await enPantalla(gasto, 'Nuevo gasto')
      await page.keyboard.press('Escape')
      await expect(gasto).toBeHidden()

      await page.goto('/fondos')
      await cargado(page)
      await page.getByRole('button', { name: 'Nuevo fondo' }).click()
      const fondo = page.getByRole('dialog', { name: 'Nuevo fondo' })
      await expect(fondo.getByRole('button', { name: 'Guardar fondo' })).toBeVisible()
      await enPantalla(fondo, 'Nuevo fondo')
      await fondo.getByRole('button', { name: 'Cancelar' }).click()

      await page.getByRole('button', { name: 'Copiar fondos de otro mes' }).click()
      const copia = page.getByRole('dialog', { name: 'Copiar fondos de otro mes' })
      await expect(copia.getByRole('button', { name: 'Cancelar' })).toBeVisible()
      await enPantalla(copia, 'Copiar fondos')
      await copia.getByRole('button', { name: 'Cancelar' }).click()

      await page.getByRole('button', { name: 'Planificación', exact: true }).click()
      const estado = page.getByRole('dialog', { name: 'Planificación mensual' })
      await enPantalla(estado, 'Estado de planificación')
      await estado.getByRole('button', { name: /planificación$/ }).click()
      const asistente = page.getByRole('dialog', { name: /^Planificación · / })
      await expect(asistente.getByRole('button', { name: 'Crear nuevo fondo' })).toBeVisible()
      await enPantalla(asistente, 'Asistente')
      await asistente.getByRole('button', { name: 'Crear nuevo fondo' }).click()
      const encima = page.getByRole('dialog', { name: 'Nuevo fondo' })
      await expect(encima.getByRole('button', { name: 'Guardar fondo' })).toBeVisible()
      await enPantalla(encima, 'Nuevo fondo sobre el asistente')
    })
  }
})
