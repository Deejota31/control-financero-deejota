import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Comportamiento de iPhone (Safari / PWA) que se puede comprobar en el navegador de pruebas con emulación táctil: sin zoom automático al enfocar campos,
 * filtros pegajosos alineados, dona centrada, barra inferior simétrica y modales utilizables con poca altura (teclado abierto).
 * LIMITACIÓN: esto es Chromium emulando un iPhone, no Safari real. El zoom de iOS y el cierre del teclado deben comprobarse en un dispositivo físico.
 */
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Mes anterior completo: el seed de pruebas siempre tiene gasto ahí (se genera hacia atrás desde la fecha actual). */
function mesPrevio() {
  const h = new Date()
  return { desde: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), hasta: iso(new Date(h.getFullYear(), h.getMonth(), 0)) }
}

/** Controles editables visibles cuya letra computada es menor de 16 px (iOS amplía la página al enfocarlos). */
async function editablesPequenos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sel = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=hidden]):not([type=color]), select, textarea'
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el)
      if (r.width < 2 || r.height < 2 || s.display === 'none' || s.visibility === 'hidden') continue
      if (el.closest('.sr-only')) continue
      const px = parseFloat(s.fontSize)
      if (px < 16) out.push(`${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? el.id ?? el.getAttribute('type') ?? ''}] ${px}px`)
    }
    return out
  })
}

const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test.describe('iPhone: pantalla de acceso', () => {
  test.use(IPHONE)

  test('el emulador es táctil, el viewport no bloquea el zoom y los campos tienen 16 px o más', async ({ page }) => {
    await page.goto('/acceso')
    expect(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)).toBe(true)
    const meta = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(meta).toContain('width=device-width')
    expect(meta).toContain('initial-scale=1')
    expect(meta).toContain('viewport-fit=cover')
    expect(meta).not.toMatch(/maximum-scale|user-scalable\s*=\s*(no|0)|minimum-scale/i) // el usuario conserva el zoom manual (accesibilidad)
    expect(await editablesPequenos(page)).toEqual([])
    await page.getByLabel('Correo').focus()
    await page.keyboard.type('ejemplo@correo.com')
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('iPhone: sesión iniciada', () => {
  test.use(IPHONE)
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('ningún campo editable de las pantallas principales tiene menos de 16 px', async ({ page }) => {
    await iniciarSesion(page)
    for (const ruta of ['/', '/gastos', '/fondos', '/catalogo', '/salud', '/configuracion?seccion=perfil', '/configuracion?seccion=hogar', '/configuracion?seccion=cuenta']) {
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
      expect(await editablesPequenos(page), `campos pequeños en ${ruta}`).toEqual([])
      expect(await sinDesborde(page), `desborde horizontal en ${ruta}`).toBeLessThanOrEqual(0)
    }
  })

  test('los formularios y modales (nuevo gasto, plantillas, registro mensual, catálogo, fondos) no tienen campos pequeños ni desbordan', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    await expect(page.getByRole('dialog', { name: /Nuevo gasto/ })).toBeVisible()
    expect(await editablesPequenos(page), 'Nuevo gasto').toEqual([])
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Plantillas' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await editablesPequenos(page), 'Plantillas de gasto').toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Registrar mensuales' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await editablesPequenos(page), 'Registro mensual').toEqual([])
    await page.keyboard.press('Escape')

    await page.goto('/catalogo')
    await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await editablesPequenos(page), 'Nuevo ámbito').toEqual([])
    await page.keyboard.press('Escape')

    await page.goto('/fondos')
    await page.getByRole('button', { name: 'Nuevo fondo' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await editablesPequenos(page), 'Nuevo fondo').toEqual([])
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
  })

  test('al enfocar y escribir en Descripción no cambia la escala ni aparece desplazamiento horizontal, y el campo sigue visible', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const campo = page.getByLabel('Descripción', { exact: true })
    await campo.focus()
    await page.keyboard.type('Almuerzo de prueba')
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
    const r = await campo.boundingBox()
    expect(r!.x).toBeGreaterThanOrEqual(0)
    expect(r!.x + r!.width).toBeLessThanOrEqual(390)
    await expect(campo).toBeInViewport()
  })

  test('con poca altura (teclado abierto) el modal se desplaza y «Guardar gasto» sigue alcanzable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 420 }) // el teclado de iOS ocupa más de la mitad de la pantalla
    await iniciarSesion(page)
    await page.goto('/gastos')
    await page.getByRole('button', { name: 'Nuevo gasto' }).click()
    const guardar = page.getByRole('button', { name: 'Guardar gasto' })
    await guardar.scrollIntoViewIfNeeded()
    await expect(guardar).toBeInViewport()
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
  })

  test('los filtros del Dashboard se pegan alineados con el contenido, sin hueco ni desplazamiento lateral', async ({ page }) => {
    const { desde, hasta } = mesPrevio()
    await iniciarSesion(page)
    await page.goto(`/?desde=${desde}&hasta=${hasta}`)
    const filtros = page.getByRole('region', { name: 'Filtros del dashboard' })
    await expect(filtros).toBeVisible()
    const kpi = page.getByRole('region', { name: 'Indicadores' }).locator('> div').first()
    await expect(kpi).toBeVisible()
    const k = (await kpi.boundingBox())!
    const antes = (await filtros.boundingBox())!
    expect(Math.abs(antes.x - k.x)).toBeLessThanOrEqual(1) // mismo borde izquierdo que las tarjetas
    expect(Math.abs(antes.x + antes.width - (k.x + k.width))).toBeLessThanOrEqual(1) // y mismo borde derecho

    await page.evaluate(() => window.scrollTo(0, 900))
    await page.waitForTimeout(250)
    const banda = filtros.locator('..')
    const b = (await banda.boundingBox())!
    expect(b.y).toBeLessThanOrEqual(1) // pegada arriba (sin los 8 px sueltos de antes)
    expect(b.x).toBeLessThanOrEqual(0.5)
    expect(b.x + b.width).toBeGreaterThanOrEqual(389.5) // la banda cubre todo el ancho útil: nada se asoma por los lados
    const dentro = (await filtros.boundingBox())!
    expect(Math.abs(dentro.x - k.x)).toBeLessThanOrEqual(1) // el filtro sigue alineado con el contenido al pegarse
    expect(dentro.y).toBeGreaterThanOrEqual(b.y)
    expect(await sinDesborde(page)).toBeLessThanOrEqual(0)
    // Estable: otra posición de scroll no lo mueve
    await page.evaluate(() => window.scrollTo(0, 1500))
    await page.waitForTimeout(250)
    expect(Math.abs((await filtros.boundingBox())!.y - dentro.y)).toBeLessThanOrEqual(1)
  })

  test('la dona de ámbitos queda centrada en su tarjeta', async ({ page }) => {
    const { desde, hasta } = mesPrevio()
    await iniciarSesion(page)
    await page.goto(`/?desde=${desde}&hasta=${hasta}`)
    const dona = page.getByRole('img', { name: /Distribución del gasto por ámbito/ })
    await dona.scrollIntoViewIfNeeded()
    const tarjeta = page.getByRole('region', { name: 'Distribución por ámbito' })
    const d = (await dona.boundingBox())!, t = (await tarjeta.boundingBox())!
    expect(Math.abs(d.x + d.width / 2 - (t.x + t.width / 2))).toBeLessThanOrEqual(2)
  })

  test('los gráficos ocupan el ancho de su tarjeta y el eje de días tiene marcas regulares sin superponerse', async ({ page }) => {
    const { desde, hasta } = mesPrevio()
    await iniciarSesion(page)
    await page.goto(`/?desde=${desde}&hasta=${hasta}`)
    const tarjeta = page.getByRole('region', { name: 'Gasto acumulado' })
    await tarjeta.scrollIntoViewIfNeeded()
    await expect(tarjeta.locator('.recharts-surface').first()).toBeVisible()
    const t = (await tarjeta.boundingBox())!
    for (const g of await tarjeta.locator('.recharts-wrapper').all()) {
      const b = (await g.boundingBox())!
      expect(b.x).toBeGreaterThanOrEqual(t.x - 1)
      expect(b.x + b.width).toBeLessThanOrEqual(t.x + t.width + 1) // sin cortes ni desplazamiento
    }
    // Marcas del eje X de cada gráfico: ninguna se superpone con otra y son las mismas en ambos (1, 5, 10, 15, 20, 25 y el último día si queda lejos)
    const graficos = tarjeta.locator('.recharts-wrapper')
    await expect(graficos).toHaveCount(2)
    const textos: string[][] = []
    for (const g of await graficos.all()) {
      // Las marcas de días son números sueltos; las del eje Y llevan «S/».
      await expect(g.locator('.recharts-cartesian-axis-tick-value').first()).toBeVisible()
      const cajas = await g.locator('.recharts-cartesian-axis-tick-value').evaluateAll((els) => els
        .map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: e.textContent ?? '' } })
        .filter((c) => /^\d{1,2}$/.test(c.t))) // solo los días; las del eje Y llevan «S/»
      expect(cajas.length).toBeGreaterThanOrEqual(5)
      for (let i = 1; i < cajas.length; i++) expect(cajas[i].l).toBeGreaterThan(cajas[i - 1].r + 2)
      textos.push(cajas.map((c) => c.t))
    }
    expect(textos[0]).toEqual(textos[1])
    expect(textos[0].slice(0, 6)).toEqual(['1', '5', '10', '15', '20', '25'])
  })

  test('barra inferior: el botón central está exactamente centrado y los iconos son simétricos', async ({ page }) => {
    await iniciarSesion(page)
    const nav = page.locator('nav[aria-label="Módulos"]').last()
    await expect(nav).toBeVisible()
    const centros = await nav.locator('a, button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2 }))
    expect(centros).toHaveLength(7) // 3 + botón central + 3
    const ancho = 390
    expect(Math.abs(centros[3] - ancho / 2)).toBeLessThanOrEqual(1)
    for (let i = 0; i < 3; i++) expect(Math.abs(centros[i] - (ancho - centros[6 - i]))).toBeLessThanOrEqual(1)
  })

  test('el Dashboard del mes en curso compara el mismo tramo del mes anterior y no muestra una proyección sin sustento', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/')
    await expect(page.getByRole('region', { name: 'Indicadores' })).toBeVisible()
    const hoy = new Date()
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    if (hoy.getDate() < ultimoDia) {
      const kpi = page.getByRole('region', { name: 'Indicadores' }).getByText('Variación vs período anterior').locator('..')
      await expect(kpi).toContainText(/Mismo tramo anterior|Sin base comparable/)
    }
    // Nunca aparece la antigua etiqueta de proyección lineal presentada como estimación fiable
    await expect(page.getByText('Cierre proyectado (estimación)')).toHaveCount(0)
  })
})
