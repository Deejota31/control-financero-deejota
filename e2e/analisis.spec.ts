import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { contenidoBajoElBoton, email, iniciarSesion, password, vigilarConsola } from './helpers'

/**
 * Fila final del Dashboard: «Distribución por ámbito» y «Ranking con tendencia». Escritorio: una al lado de la otra; tablet y móvil: apiladas en ese orden.
 * «Top 5 categorías» y «Perfil de gasto» se retiraron: aquí se comprueba también que no queda rastro de ellos.
 */
const dist = (page: Page) => page.getByRole('region', { name: 'Distribución por ámbito' })
const rank = (page: Page) => page.getByRole('region', { name: 'Ranking con tendencia' })
const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

async function esperarTarjetas(page: Page) {
  await expect(dist(page)).toBeVisible()
  await expect(rank(page).getByRole('list', { name: 'Ranking' })).toBeVisible()
}

test.describe('Distribución por ámbito y Ranking con tendencia', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('escritorio: Distribución a la izquierda y Ranking a la derecha, en una sola fila y sin tarjetas debajo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await esperarTarjetas(page)
    const [d, r] = await Promise.all([dist(page).boundingBox(), rank(page).boundingBox()])
    expect(Math.abs(d!.y - r!.y), 'misma fila').toBeLessThanOrEqual(2)
    expect(Math.abs(d!.height - r!.height), 'misma altura').toBeLessThanOrEqual(2)
    expect(d!.x).toBeLessThan(r!.x)
    expect(Math.abs(r!.x - (d!.x + d!.width) - 16), 'separación de 16 px entre tarjetas').toBeLessThanOrEqual(1)
    // Es la última fila: ninguna otra tarjeta del contenido termina por debajo
    const sobresale = await page.evaluate(() => {
      const fondo = (e: Element) => e.getBoundingClientRect().bottom
      const ranking = document.querySelector('#contenido section[aria-label="Ranking con tendencia"]')!
      return Math.max(...Array.from(document.querySelectorAll('#contenido section[aria-label]')).map(fondo)) - fondo(ranking)
    })
    expect(sobresale, 'ninguna tarjeta termina por debajo de la fila').toBeLessThanOrEqual(2)
    // Gráfico diario y presupuesto se conservan; lo retirado no existe en ninguna forma
    await expect(page.getByRole('img', { name: /^Gasto por día/ })).toBeVisible()
    for (const nombre of ['Top 5 categorías', 'Top 5 subcategorías', 'Perfil de gasto', 'Análisis conectado', 'Flujo del dinero']) await expect(page.getByRole('region', { name: nombre })).toHaveCount(0)
    for (const t of ['Top 5', 'Perfil de gasto', 'Referencia histórica', 'Consumo de fondos', 'Gastos recientes', 'Gastos mensuales']) await expect(page.getByText(t)).toHaveCount(0)
    await expect(page.getByRole('img', { name: /^Radar/ })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Perfil en barras' })).toHaveCount(0)
    // Un solo selector «Agrupar por» en todo el Dashboard y es el del Ranking
    await expect(page.getByRole('group', { name: 'Agrupar por' })).toHaveCount(1)
    await expect(rank(page).getByRole('group', { name: 'Agrupar por' })).toBeVisible()
    expect(await desborde(page)).toBeLessThanOrEqual(1)
  })

  for (const [w, h] of [[320, 700], [375, 812], [430, 932], [768, 1024], [1023, 768]] as const) {
    test(`${w}×${h}: las tarjetas se apilan (Distribución y después Ranking), sin desborde ni textos cortados`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      await esperarTarjetas(page)
      const [d, r] = await Promise.all([dist(page).boundingBox(), rank(page).boundingBox()])
      expect(Math.abs(d!.x - r!.x), 'misma columna').toBeLessThanOrEqual(1)
      expect(Math.abs(d!.width - r!.width), 'mismo ancho').toBeLessThanOrEqual(1)
      expect(r!.y, 'el Ranking va después de la Distribución').toBeGreaterThanOrEqual(d!.y + d!.height + 8)
      expect(await desborde(page)).toBeLessThanOrEqual(1)
      await filasSinCortes(page)
    })
  }

  test('1024×768: desde el corte de escritorio las dos tarjetas quedan juntas y con espacio suficiente', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await iniciarSesion(page)
    await esperarTarjetas(page)
    const [d, r] = await Promise.all([dist(page).boundingBox(), rank(page).boundingBox()])
    expect(Math.abs(d!.y - r!.y)).toBeLessThanOrEqual(2)
    expect(d!.x).toBeLessThan(r!.x)
    expect(await desborde(page)).toBeLessThanOrEqual(1)
    await filasSinCortes(page)
  })

  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [430, 932], [390, 844], [375, 812], [320, 700]] as const) {
    test(`${w}×${h}: el Dashboard termina con 24 px de aire, sin espacio fantasma y sin contenido bajo el botón «Registrar gasto»`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      await esperarTarjetas(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(300)
      const m = await page.evaluate(() => {
        const tarjetas = Array.from(document.querySelectorAll('#contenido section[aria-label]'))
        const ultima = Math.max(...tarjetas.map((e) => e.getBoundingClientRect().bottom))
        const nav = document.querySelector('nav.fixed') as HTMLElement | null
        const base = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight
        const principal = document.querySelector('#contenido')!.getBoundingClientRect()
        return { aire: base - ultima, fantasma: document.documentElement.scrollHeight - (scrollY + principal.bottom), desbordeX: document.documentElement.scrollWidth - innerWidth, anidados: Array.from(document.querySelectorAll('#contenido *')).filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 0).length }
      })
      expect(Math.abs(m.aire - 24), 'aire bajo la última tarjeta (24 px)').toBeLessThanOrEqual(1)
      expect(m.fantasma, 'nada de altura tras el contenido').toBeLessThanOrEqual(1)
      expect(m.desbordeX).toBeLessThanOrEqual(0)
      expect(m.anidados, 'sin contenedores con scroll propio').toBe(0)
      expect(await contenidoBajoElBoton(page), 'contenido bajo el botón').toEqual([])
      // Todas las filas del ranking se pueden tocar: ni el botón ni la barra las tapan
      for (const fila of await rank(page).getByRole('list', { name: 'Ranking' }).getByRole('button').all()) await expect(fila).toBeInViewport()
    })
  }

  test('el nombre largo se recorta con puntos suspensivos sin empujar el importe ni desbordar la tarjeta', async ({ page }) => {
    await iniciarSesion(page)
    for (const [w, h] of [[320, 700], [1024, 768]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto('/')
      await esperarTarjetas(page)
      const largo = 'Nombre extraordinariamente largo de una categoría con muchas palabras seguidas'
      await rank(page).getByRole('list', { name: 'Ranking' }).getByRole('button').first().evaluate((fila, t) => {
        fila.querySelector('[data-nombre]')!.textContent = t
      }, largo)
      expect(await desborde(page), `${w}×${h}`).toBeLessThanOrEqual(1)
      await filasSinCortes(page)
      const tarjeta = (await rank(page).boundingBox())!
      const fila = (await rank(page).getByRole('list', { name: 'Ranking' }).getByRole('button').first().boundingBox())!
      expect(fila.x + fila.width).toBeLessThanOrEqual(tarjeta.x + tarjeta.width + 0.5)
    }
  })

  test('el cursor inspecciona con detalle y el clic filtra todo el panel sin abrir modales; Limpiar filtros lo quita', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await esperarTarjetas(page)
    const primero = rank(page).getByRole('list', { name: 'Ranking' }).getByRole('button').first()
    await expect(primero).toBeVisible()
    // Hover: tarjeta con importe, participación (con denominador), movimientos y seis meses
    await primero.hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toContainText('Participación')
    await expect(tip).toContainText(/% de S\//)
    await expect(tip).toContainText('Movimientos')
    await expect(tip).toContainText('Clic para filtrar todo el panel')
    // Clic: filtra, sin modal
    await primero.click()
    await expect(primero).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/categoria=/)
    // Un día elegido en las barras se combina con la categoría; su popup trae movimientos y el porcentaje del mes
    const barras = page.getByRole('img', { name: /^Gasto por día/ })
    // Centrado: si el gráfico quedara pegado al borde superior, los filtros fijos lo taparían y el cursor no llegaría a las barras.
    await barras.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    const caja = (await barras.boundingBox())!
    await page.mouse.move(caja.x + caja.width * 0.12, caja.y + caja.height * 0.5, { steps: 6 })
    await expect(page.getByText(/^% de /).first()).toBeVisible()
    await page.mouse.down()
    await page.mouse.up()
    await expect(page).toHaveURL(/categoria=.*dia=|dia=.*categoria=/)
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page).not.toHaveURL(/categoria=|dia=/)
    expect(errores).toEqual([])
  })

  test('«Agrupar por» cambia la dimensión del Ranking: por ámbito lista los ámbitos con gasto y su clic filtra por ámbito', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await esperarTarjetas(page)
    const filas = rank(page).getByRole('list', { name: 'Ranking' }).getByRole('button')
    const ambitos = await page.getByLabel('Ámbitos').getByRole('button').count()
    await rank(page).getByRole('group', { name: 'Agrupar por' }).getByRole('button', { name: 'Ámbito', exact: true }).click()
    await expect(filas).toHaveCount(Math.min(ambitos, 5))
    await filas.first().click()
    await expect(page).toHaveURL(/ambito=/)
    await expect(filas.first()).toHaveAttribute('aria-pressed', 'true')
  })
})

/** Cada fila del ranking cabe en su tarjeta; importe y porcentaje se leen completos (solo el nombre puede recortarse con puntos suspensivos). */
async function filasSinCortes(page: Page) {
  const r = (await rank(page).boundingBox())!
  const filas = rank(page).getByRole('list', { name: 'Ranking' }).getByRole('button')
  const n = await filas.count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(5)
  for (let i = 0; i < n; i++) {
    const cortes = await filas.nth(i).evaluate((b) => {
      const caja = b.getBoundingClientRect()
      const hojas = Array.from(b.querySelectorAll('span')).filter((s) => s.children.length === 0 && s.textContent?.trim())
      // Solo el nombre puede recortarse (a dos líneas, con puntos suspensivos); importe, porcentaje y variación se leen completos.
      const cortado = hojas.filter((s) => !s.hasAttribute('data-nombre') && !s.closest('[data-nombre]') && s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent)
      const fuera = hojas.filter((s) => { const x = s.getBoundingClientRect(); return x.right > caja.right + 0.5 || x.left < caja.left - 0.5 }).map((s) => s.textContent)
      return { cortado, fuera, desborda: b.scrollWidth > b.clientWidth + 1 }
    })
    expect(cortes.cortado, `fila ${i + 1}: textos cortados`).toEqual([])
    expect(cortes.fuera, `fila ${i + 1}: textos fuera de la fila`).toEqual([])
    expect(cortes.desborda, `fila ${i + 1}: desborde`).toBe(false)
    const f = (await filas.nth(i).boundingBox())!
    expect(f.x + f.width, `fila ${i + 1} dentro de la tarjeta`).toBeLessThanOrEqual(r.x + r.width + 0.5)
  }
}
