import { type Locator, type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

const TAMANOS = [
  { w: 360, h: 800 }, { w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1366, h: 768 }, { w: 1440, h: 900 }, { w: 844, h: 390 },
]

/** Geometría real: los controles no rebasan la tarjeta, el cuerpo no se desplaza en horizontal y las acciones quedan dentro de la ventana. */
async function medir(page: Page, d: Locator, acciones: string[]) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
  const r = await d.evaluate((raiz, nombres) => {
    const caja = raiz.getBoundingClientRect(), vp = { w: innerWidth, h: innerHeight }, fallos: string[] = []
    if (caja.left < -0.5 || caja.right > vp.w + 0.5 || caja.top < -0.5 || caja.bottom > vp.h + 0.5) fallos.push(`la tarjeta excede la ventana (${Math.round(caja.left)},${Math.round(caja.top)} → ${Math.round(caja.right)},${Math.round(caja.bottom)} en ${vp.w}×${vp.h})`)
    for (const el of raiz.querySelectorAll<HTMLElement>('input:not([type=hidden]), textarea, select, button, [role=combobox], [role=radio]')) {
      const b = el.getBoundingClientRect()
      if (b.width === 0 || b.height === 0 || el.closest('[hidden]')) continue
      if (el.closest('.sr-only')) continue
      if (b.left < caja.left - 0.5 || b.right > caja.right + 0.5) fallos.push(`${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.id ?? el.textContent?.trim().slice(0, 24)}] rebasa la tarjeta en horizontal`)
    }
    for (const el of raiz.querySelectorAll<HTMLElement>('*')) {
      const cs = getComputedStyle(el)
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) fallos.push(`desplazamiento horizontal interno en <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}">`)
    }
    for (const n of nombres) {
      const btn = Array.from(raiz.querySelectorAll<HTMLElement>('button')).find((x) => x.textContent?.trim() === n)
      if (!btn) { fallos.push(`falta el botón «${n}»`); continue }
      const b = btn.getBoundingClientRect()
      if (b.top < 0 || b.bottom > vp.h + 0.5 || b.left < 0 || b.right > vp.w + 0.5) fallos.push(`«${n}» fuera de la ventana`)
    }
    const cuerpo = raiz.querySelector<HTMLElement>('.overflow-y-auto')
    return { fallos, scrollH: cuerpo ? cuerpo.scrollHeight - cuerpo.clientHeight : 0 }
  }, acciones)
  return r
}

test.describe('Modales: acciones visibles y campos contenidos en todos los tamaños', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  for (const t of TAMANOS) {
    test(`Nuevo gasto, Nuevo fondo y editor de catálogo a ${t.w}×${t.h}`, async ({ page }) => {
      await page.setViewportSize({ width: t.w, height: t.h })
      await iniciarSesion(page)
      await page.goto('/gastos')
      await page.getByRole('button', { name: 'Nuevo gasto' }).first().click()
      let d = page.getByRole('dialog').last()
      await expect(d).toBeVisible()
      let r = await medir(page, d, ['Cancelar', 'Guardar gasto'])
      expect(r.fallos, `Nuevo gasto ${t.w}×${t.h}`).toEqual([])
      await d.getByRole('button', { name: /Más opciones/ }).click()
      r = await medir(page, d, ['Cancelar', 'Guardar gasto'])
      expect(r.fallos, `Nuevo gasto (más opciones) ${t.w}×${t.h}`).toEqual([])
      await d.getByRole('button', { name: 'Cancelar' }).click()

      await page.goto('/fondos')
      await page.getByRole('button', { name: 'Nuevo fondo' }).first().click()
      d = page.getByRole('dialog').last()
      await expect(d).toBeVisible()
      for (const sec of ['Apariencia', 'Más opciones']) await d.getByRole('button', { name: new RegExp(`^${sec}`) }).click()
      r = await medir(page, d, ['Cancelar', 'Guardar fondo'])
      expect(r.fallos, `Nuevo fondo ${t.w}×${t.h}`).toEqual([])
      await page.keyboard.press('Escape')

      await page.goto('/catalogo')
      await page.getByRole('button', { name: 'Nuevo ámbito' }).first().click()
      d = page.getByRole('dialog').last()
      await expect(d).toBeVisible()
      r = await medir(page, d, [])
      expect(r.fallos, `Catálogo ${t.w}×${t.h}`).toEqual([])
    })
  }
})
