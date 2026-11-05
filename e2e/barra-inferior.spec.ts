import { type Locator, type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { contenidoBajoElBoton, email, iniciarSesion, password, vigilarConsola } from './helpers'

/**
 * Navegación inferior responsive: cinco destinos en cinco columnas iguales y «Registrar gasto» como botón flotante independiente
 * sobre la zona derecha de la barra (móvil y tablet, hasta 1023 px). Desde 1024 px la navegación es la barra lateral y el botón es una píldora.
 */
const MODULOS = [['Inicio', '/'], ['Gastos', '/gastos'], ['Fondos', '/fondos'], ['Catálogo', '/catalogo'], ['Ajustes', '/configuracion']] as const
const NOMBRES = MODULOS.map(([n]) => n)
const TAMANOS = [[320, 700], [360, 800], [375, 812], [390, 844], [430, 932], [768, 1024], [844, 390]] as const

const barra = (page: Page) => page.locator('nav[aria-label="Módulos"]:visible')
const fabDe = (page: Page) => page.getByRole('button', { name: 'Registrar gasto' })
const enlaces = (nav: Locator) => NOMBRES.map((n) => nav.getByRole('link', { name: n, exact: true }))

/** Caja del botón y de los cinco enlaces, para comprobar que no se pisan. */
async function cajas(page: Page) {
  const nav = barra(page)
  return {
    nav: (await nav.boundingBox())!,
    fab: (await fabDe(page).boundingBox())!,
    enlaces: await Promise.all(enlaces(nav).map(async (e) => (await e.boundingBox())!)),
  }
}

/** Borde inferior del último elemento realmente visible del contenido. Un elemento recortado por un contenedor (overflow) no se pinta bajo la barra, así que no cuenta. */
const finDelContenido = (page: Page) => page.evaluate(() => {
  const visibles = Array.from(document.querySelectorAll('#contenido *')).filter((e) => {
    const r = e.getBoundingClientRect()
    if (r.height === 0 || r.bottom > innerHeight) return false
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))
    const arriba = document.elementFromPoint(x, y)
    return arriba === e || e.contains(arriba)
  })
  return Math.max(0, ...visibles.map((e) => e.getBoundingClientRect().bottom))
})

const seCruzan = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** Contraste WCAG entre dos colores «rgb(...)» resueltos por el navegador. */
function contraste(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

test.describe('Barra inferior de cinco secciones y botón «Registrar gasto» flotante', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  for (const [w, h] of TAMANOS) {
    test(`${w}×${h}: cinco columnas iguales, «+» flotante sobre la zona derecha, sin desbordes y con espacio al final de cada página`, async ({ page }) => {
      test.setTimeout(120_000)
      const errores = vigilarConsola(page)
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      const nav = barra(page)
      await expect(nav).toBeVisible()
      await expect(nav.getByRole('link')).toHaveText(NOMBRES) // exactamente cinco, en este orden
      await expect(nav.getByRole('button')).toHaveCount(0) // el «+» no forma parte de la cuadrícula

      const c = await cajas(page)
      c.enlaces.forEach((e, i) => {
        const n = NOMBRES[i]
        expect(Math.abs(e.width - w / 5), `${n}: ancho de columna`).toBeLessThanOrEqual(1)
        expect(Math.abs(e.x - (i * w) / 5), `${n}: posición de columna`).toBeLessThanOrEqual(1)
        expect(e.width, `${n}: zona táctil`).toBeGreaterThanOrEqual(44)
        expect(e.height, `${n}: zona táctil`).toBeGreaterThanOrEqual(44)
      })
      for (const [i, enlace] of enlaces(nav).entries()) {
        // Icono y etiqueta centrados en su columna; la etiqueta, completa, en una sola línea y con tamaño legible
        const m = await enlace.evaluate((a) => {
          const [pastilla, etiqueta] = Array.from(a.children) as HTMLElement[]
          const col = a.getBoundingClientRect()
          const ico = pastilla.querySelector('svg')!.getBoundingClientRect()
          const txt = etiqueta.getBoundingClientRect()
          const estilo = getComputedStyle(etiqueta)
          return {
            centroIcono: ico.left + ico.width / 2 - (col.left + col.width / 2),
            centroTexto: txt.left + txt.width / 2 - (col.left + col.width / 2),
            cortada: etiqueta.scrollWidth > etiqueta.clientWidth + 0.5,
            lineas: Math.round(txt.height / parseFloat(estilo.lineHeight)),
            fuente: parseFloat(estilo.fontSize),
            dentro: txt.left >= col.left - 0.5 && txt.right <= col.right + 0.5,
          }
        })
        const n = NOMBRES[i]
        expect(Math.abs(m.centroIcono), `${n}: icono centrado`).toBeLessThanOrEqual(1)
        expect(Math.abs(m.centroTexto), `${n}: etiqueta centrada`).toBeLessThanOrEqual(1)
        expect(m.cortada, `${n}: etiqueta sin cortar`).toBe(false)
        expect(m.lineas, `${n}: una sola línea`).toBe(1)
        expect(m.dentro, `${n}: etiqueta dentro de su columna`).toBe(true)
        expect(m.fuente, `${n}: tamaño legible`).toBeGreaterThanOrEqual(11)
      }

      // Botón flotante: 52–56 px, separado de la barra y del borde derecho, sin tapar ningún destino
      const fab = c.fab
      expect(fab.width).toBeGreaterThanOrEqual(51.5)
      expect(fab.width).toBeLessThanOrEqual(56.5)
      expect(Math.abs(fab.width - fab.height)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(w - (fab.x + fab.width) - 16), 'separación al borde derecho').toBeLessThanOrEqual(1)
      expect(Math.abs(c.nav.y - (fab.y + fab.height) - (h <= 480 ? 8 : 12)), 'separación sobre la barra (12 px; 8 px con poca altura)').toBeLessThanOrEqual(0.5)
      expect(Math.abs(h - c.nav.y - (h <= 480 ? 48 : 56)), 'alto de la barra').toBeLessThanOrEqual(0.5)
      for (const e of c.enlaces) expect(seCruzan(fab, e)).toBe(false)
      await expect(page.locator('.fab-gasto')).toHaveCount(1) // un único botón en el DOM, no uno por tamaño

      // Sin desplazamiento horizontal, y al final de cada página nada queda bajo el botón ni bajo la barra
      for (const [, ruta] of MODULOS) {
        await page.goto(ruta)
        await page.waitForLoadState('networkidle')
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${ruta}: desborde horizontal`).toBeLessThanOrEqual(0)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(250)
        const f = (await fabDe(page).boundingBox())!
        expect(await contenidoBajoElBoton(page), `${ruta} ${w}×${h}: contenido bajo el botón flotante`).toEqual([])
        // Las páginas con acciones por fila o paginación reservan sitio: su último contenido termina sobre el botón. El Dashboard (finLibre) solo exige no taparlo.
        if (ruta !== '/') expect(await finDelContenido(page), `${ruta} ${w}×${h}: el final del contenido queda sobre el botón flotante`).toBeLessThanOrEqual(f.y + 1)
      }
      expect(errores).toEqual([])
    })
  }

  test('cada destino navega a su ruta y marca solo su estado activo, también al entrar por URL o recargar', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    const nav = barra(page)
    const activo = async (esperado: string) => {
      await expect(nav.locator('[aria-current="page"]')).toHaveText(esperado)
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
    }
    for (const [nombre, ruta] of MODULOS) {
      await nav.getByRole('link', { name: nombre, exact: true }).click()
      await expect(page).toHaveURL(ruta === '/' ? /\/$/ : new RegExp(`${ruta}$`))
      await activo(nombre)
      await page.reload()
      await activo(nombre)
      await expect(fabDe(page)).toBeVisible()
    }
    await page.goto('/gastos?q=zzz-sin-resultados')
    await activo('Gastos') // los parámetros de la URL no cambian el destino activo
    await page.goto('/fondos')
    await activo('Fondos')
  })

  for (const [w, h] of [[390, 844], [844, 390]] as const) {
    test(`${w}×${h}: «Registrar gasto» abre el formulario por encima de la barra, se oculta y devuelve el foco al cerrar`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      await page.goto('/fondos')
      const url = page.url()
      const fab = fabDe(page)
      await fab.click()
      const d = page.getByRole('dialog', { name: 'Nuevo gasto' })
      await expect(d).toBeVisible()
      await expect(fab).toBeHidden() // no se superpone al diálogo
      const caja = (await d.boundingBox())!
      expect(caja.y).toBeGreaterThanOrEqual(0)
      expect(caja.y + caja.height).toBeLessThanOrEqual(h + 0.5)
      await expect(d.getByRole('button', { name: 'Guardar gasto' })).toBeInViewport()
      // La barra queda debajo de la capa del diálogo: ningún enlace recibe el toque (con el diálogo abierto el resto de la página es aria-hidden, así que se localiza por CSS)
      const tapado = await barra(page).locator('a', { hasText: 'Ajustes' }).evaluate((a) => {
        const r = a.getBoundingClientRect()
        const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return arriba !== a && !a.contains(arriba)
      })
      expect(tapado).toBe(true)
      await page.keyboard.press('Escape')
      await expect(d).toBeHidden()
      await expect(fab).toBeVisible()
      await expect(fab).toBeFocused() // el foco vuelve al disparador
      await expect(page).toHaveURL(url)
      // Ambas rutas de cierre dejan el mismo estado: botón visible, un solo disparador
      await fab.click()
      await expect(d).toBeVisible()
      await d.getByRole('button', { name: 'Cerrar' }).first().click()
      await expect(d).toBeHidden()
      await expect(page.locator('.fab-gasto:visible')).toHaveCount(1)
    })
  }

  test('con el teclado virtual abierto se ocultan la barra y el botón; el zoom de pellizco no cuenta como teclado', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    await expect(barra(page)).toBeVisible()
    // El viewport visual mide innerHeight × proporción − tapado (lo que ocupa el teclado) y tiene una escala (el zoom).
    const simular = (proporcion: number, tapado: number, escala: number) => page.evaluate(([p, t, e]) => {
      const vv = window.visualViewport!
      Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight * p - t })
      Object.defineProperty(vv, 'scale', { configurable: true, get: () => e })
      vv.dispatchEvent(new Event('resize'))
    }, [proporcion, tapado, escala] as const)
    await simular(1, 320, 1) // teclado: el viewport visual pierde 320 px
    await expect(barra(page)).toBeHidden()
    await expect(fabDe(page)).toBeHidden()
    await simular(0.5, 0, 2) // zoom ×2: el viewport visual mide la mitad, pero no hay teclado
    await expect(barra(page)).toBeVisible()
    await expect(fabDe(page)).toBeVisible()
  })

  test('teclado: orden lógico (Inicio → … → Ajustes → Registrar gasto) y foco visible dentro de cada enlace', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    const nav = barra(page)
    const [primero, ...resto] = enlaces(nav)
    await primero.focus()
    for (const e of resto) {
      await page.keyboard.press('Tab')
      await expect(e).toBeFocused()
      const anillo = await e.evaluate((a) => { const s = getComputedStyle(a); return { estilo: s.outlineStyle, ancho: s.outlineWidth, desplazamiento: parseFloat(s.outlineOffset) } })
      expect(anillo.estilo).toBe('solid')
      expect(anillo.ancho).toBe('3px')
      expect(anillo.desplazamiento, 'el anillo va por dentro: el borde de la pantalla no lo recorta').toBeLessThan(0)
    }
    await page.keyboard.press('Tab')
    await expect(fabDe(page)).toBeFocused()
    const anillo = await fabDe(page).evaluate((a) => getComputedStyle(a).outlineStyle)
    expect(anillo).toBe('solid')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Nuevo gasto' })).toBeVisible()
  })

  test('nunca hay dos navegaciones ni ninguna: la barra inferior llega hasta 1023 px y desde 1024 px manda la lateral', async ({ page }) => {
    test.setTimeout(90_000)
    await iniciarSesion(page)
    for (const w of [320, 639, 640, 767, 768, 1022, 1023, 1024, 1025, 1280, 1440]) {
      await page.setViewportSize({ width: w, height: 768 })
      const visibles = page.locator('nav[aria-label="Módulos"]:visible')
      await expect(visibles, `${w} px`).toHaveCount(1)
      await expect(visibles.getByRole('link'), `${w} px`).toHaveCount(5)
      const lateral = w >= 1024
      await expect(page.locator('aside'), `${w} px`).toBeVisible({ visible: lateral })
      await expect(page.locator('aside nav[aria-label="Módulos"]:visible'), `${w} px`).toHaveCount(lateral ? 1 : 0) // la visible es la lateral solo desde 1024 px
      await expect(fabDe(page), `${w} px: un solo botón «Registrar gasto»`).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${w} px: desborde horizontal`).toBeLessThanOrEqual(0)
      const f = (await fabDe(page).boundingBox())!
      if (lateral) {
        // Píldora con texto, a 24 px de la esquina inferior derecha
        await expect(fabDe(page)).toContainText('Registrar gasto')
        expect(f.width).toBeGreaterThan(100)
        expect(Math.abs(w - (f.x + f.width) - 24), `${w} px: margen derecho`).toBeLessThanOrEqual(1)
        expect(Math.abs(768 - (f.y + f.height) - 24), `${w} px: margen inferior`).toBeLessThanOrEqual(1)
      } else {
        expect(f.width, `${w} px: círculo`).toBeLessThanOrEqual(56.5)
      }
    }
  })

  for (const [w, h] of [[1024, 768], [1440, 900]] as const) {
    test(`${w}×${h}: al final de cada página el contenido queda sobre la píldora «Registrar gasto»`, async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      for (const [, ruta] of MODULOS) {
        await page.goto(ruta)
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(250)
        const f = (await fabDe(page).boundingBox())!
        expect(await contenidoBajoElBoton(page), `${ruta} ${w}×${h}: contenido bajo la píldora`).toEqual([])
        if (ruta !== '/') expect(await finDelContenido(page), `${ruta} ${w}×${h}`).toBeLessThanOrEqual(f.y + 1)
      }
    })
  }

  test('con prefers-reduced-motion la barra y el botón no animan', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await iniciarSesion(page)
    for (const el of [fabDe(page), ...enlaces(barra(page))]) {
      expect(await el.evaluate((e) => getComputedStyle(e).transitionProperty)).toBe('none')
    }
  })

  for (const tema of ['claro', 'oscuro'] as const) {
    test(`tema ${tema}: texto e iconos de la barra y del botón con contraste suficiente`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await iniciarSesion(page)
      await page.waitForTimeout(1500) // el perfil termina de cargar y aplica su tema
      const html = page.locator('html')
      if ((tema === 'oscuro') !== ((await html.getAttribute('data-theme')) === 'dark')) await page.getByRole('switch').filter({ visible: true }).click()
      await expect(html).toHaveAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light')
      const nav = barra(page)
      const fondoBarra = await nav.evaluate((e) => getComputedStyle(e).backgroundColor)
      const colores = await nav.getByRole('link').evaluateAll((as) => as.map((a) => {
        const [pastilla, etiqueta] = Array.from(a.children) as HTMLElement[]
        return { activo: a.getAttribute('aria-current') === 'page', texto: getComputedStyle(etiqueta).color, fondoPastilla: getComputedStyle(pastilla).backgroundColor, icono: getComputedStyle(pastilla.querySelector('svg')!).color }
      }))
      for (const c of colores) {
        expect(contraste(c.texto, fondoBarra), c.activo ? 'etiqueta activa' : 'etiqueta inactiva').toBeGreaterThanOrEqual(4.5)
        if (c.activo) expect(contraste(c.icono, c.fondoPastilla), 'icono activo sobre su fondo').toBeGreaterThanOrEqual(4.5)
        else expect(contraste(c.icono, fondoBarra), 'icono inactivo').toBeGreaterThanOrEqual(4.5)
      }
      expect(colores.filter((c) => c.activo)).toHaveLength(1)
      const { fg, bg } = await fabDe(page).evaluate((e) => ({ fg: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }))
      expect(contraste(fg, bg), 'signo + sobre el botón').toBeGreaterThanOrEqual(4.5)
    })
  }
})
