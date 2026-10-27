import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

const TAMANOS = [{ w: 360, h: 800 }, { w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1366, h: 768 }, { w: 1440, h: 900 }, { w: 844, h: 390 }]
const RUTAS: [string, string][] = [['/', 'Dashboard'], ['/gastos', 'Gastos'], ['/fondos', 'Fondos'], ['/catalogo', 'Catálogo'], ['/salud', 'Salud financiera'], ['/configuracion', 'Configuración']]

/**
 * Detecta contenido recortado o fuera de pantalla: un elemento visible que se sale de un ancestro que recorta (overflow distinto de visible y sin
 * scroll horizontal propio) o de la ventana. Que el documento no tenga scroll horizontal no basta: el contenido puede estar oculto por overflow-hidden.
 */
async function recortes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fallos: string[] = []
    const raiz = document.getElementById('contenido')!
    const nombre = (e: Element) => `<${e.tagName.toLowerCase()}${e.getAttribute('aria-label') ? ` "${e.getAttribute('aria-label')}"` : ''} class="${String(e.className).slice(0, 40)}">${(e.textContent ?? '').trim().slice(0, 24)}`
    if (document.documentElement.scrollWidth > innerWidth + 1) fallos.push(`el documento desborda en horizontal (${document.documentElement.scrollWidth} > ${innerWidth})`)
    for (const e of raiz.querySelectorAll('*')) {
      if (e.closest('.sr-only, [hidden], svg, [aria-hidden="true"]')) continue
      const r = e.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(e).visibility === 'hidden') continue
      if (!(e.children.length === 0 || e.matches('button, a, input, select, th, td'))) continue // solo hojas y controles, para no repetir el aviso por cada ancestro
      for (let a = e.parentElement; a && a !== raiz.parentElement; a = a.parentElement) {
        const cs = getComputedStyle(a)
        const recorta = cs.overflowX !== 'visible'
        if (!recorta) continue
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') break // tiene su propio scroll horizontal: es accesible
        const c = a.getBoundingClientRect()
        if (r.right > c.right + 1 || r.left < c.left - 1) { fallos.push(`${nombre(e)} recortado por ${nombre(a)}`); break }
      }
      if (r.right > innerWidth + 1 && !e.closest('[class*="overflow-x-auto"], .overflow-x-auto')) fallos.push(`${nombre(e)} sale de la ventana (${Math.round(r.right)} > ${innerWidth})`)
    }
    return [...new Set(fallos)].slice(0, 12)
  })
}

test.describe('Responsive: ningún módulo recorta su contenido', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.setTimeout(120_000)

  for (const t of TAMANOS) {
    test(`seis módulos a ${t.w}×${t.h}`, async ({ page }) => {
      await page.setViewportSize({ width: t.w, height: t.h })
      await iniciarSesion(page)
      for (const [ruta, titulo] of RUTAS) {
        await page.goto(ruta)
        await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(400)
        expect(await recortes(page), `${titulo} a ${t.w}×${t.h}`).toEqual([])
      }
    })
  }
})

test.describe('Responsive: apartados descubribles', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  for (const w of [360, 390, 768]) {
    test(`Configuración muestra sus cinco apartados dentro de la pantalla a ${w} px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 })
      await iniciarSesion(page)
      await page.goto('/configuracion')
      for (const n of ['Perfil y preferencias', 'Hogar', 'Exportar datos', 'Cuenta y seguridad', 'Actividad reciente']) {
        const b = await page.getByRole('tab', { name: n }).boundingBox()
        expect(b, n).not.toBeNull()
        expect(b!.x, n).toBeGreaterThanOrEqual(0)
        expect(b!.x + b!.width, n).toBeLessThanOrEqual(w)
      }
    })
  }
})
