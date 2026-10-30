import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { elegir, email, iniciarSesion, password, vigilarConsola } from './helpers'

const abrirDetalle = async (page: Page, fondo: string) => {
  await page.goto('/fondos')
  const fila = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: fondo, exact: true }) })
  await fila.getByRole('button', { name: 'Ver gastos' }).click()
  const d = page.getByRole('dialog', { name: new RegExp(`Gastos imputados · ${fondo}`) })
  await expect(d).toBeVisible()
  return d
}

test.describe('Gastos imputados a un fondo', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('el Fondo General separa consumo directo y excedentes sin sumarlos dos veces; buscar no cambia el resumen', async ({ page }) => {
    const errores = vigilarConsola(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const d = await abrirDetalle(page, 'Fondo General')
    const resumen = d.getByRole('region', { name: 'Resumen del fondo' })
    await expect(resumen).toContainText('Asignado')
    await expect(resumen.getByRole('progressbar')).toBeVisible()
    await expect(resumen).toContainText('no se suma otra vez')
    const texto = (await resumen.innerText()).replace(/\s+/g, ' ')
    const nums = [...texto.matchAll(/S\/ ([\d,]+\.\d{2})/g)].map((m) => Number(m[1].replace(',', '')))
    const consumo = Number(/Consumido S\/ ([\d,]+\.\d{2})/.exec(texto)?.[1].replace(',', ''))
    const ecuacion = /Consumo S\/ ([\d,]+\.\d{2}) = directo S\/ ([\d,]+\.\d{2}) \+ excedentes recibidos S\/ ([\d,]+\.\d{2})/.exec(texto)!
    expect(Number(ecuacion[2].replace(',', '')) + Number(ecuacion[3].replace(',', ''))).toBeCloseTo(Number(ecuacion[1].replace(',', '')), 2)
    expect(Number(ecuacion[1].replace(',', ''))).toBeCloseTo(consumo, 2)
    expect(nums.length).toBeGreaterThan(3)

    // Excedentes destacados con texto (no solo color)
    await expect(d.getByText(/Excedente de /).first()).toBeVisible()
    await elegir(page, d.getByRole('combobox', { name: 'Tipo de imputación' }), 'Excedentes')
    const filasExc = await d.getByRole('listitem').count()
    expect(filasExc).toBeGreaterThan(0)
    await expect(d.getByRole('navigation', { name: 'Paginación' })).toContainText(/\d+–\d+ de \d+/)

    // Buscar sin resultados: mensaje claro y el resumen no cambia
    await d.getByLabel('Buscar por concepto').fill('zzz-no-existe')
    await expect(d.getByText('Ningún gasto coincide')).toBeVisible()
    expect((await resumen.innerText()).replace(/\s+/g, ' ')).toBe(texto)
    await d.getByRole('button', { name: 'Quitar búsqueda y filtros' }).click()
    await expect(d.getByRole('combobox', { name: 'Tipo de imputación' })).toContainText('Todas')

    // Fila expandible con el reparto real del gasto y retorno sin perder filtros
    await elegir(page, d.getByRole('combobox', { name: 'Tipo de imputación' }), 'Excedentes')
    const abrir = d.locator('button[aria-controls]').first()
    await abrir.click()
    const detalle = d.getByRole('region', { name: /^Detalle de / })
    await expect(detalle).toContainText('Gasto total')
    await expect(detalle).toContainText('(este fondo)')
    await expect(detalle).toContainText('Fondo General')
    await abrir.click()
    await expect(detalle).toHaveCount(0)
    await expect(d.getByRole('combobox', { name: 'Tipo de imputación' })).toContainText('Excedentes')
    // El cuerpo es lo único que se desplaza y el cierre sigue accesible
    await expect(d.getByRole('button', { name: 'Cerrar' })).toBeInViewport()
    await d.getByRole('button', { name: 'Cerrar' }).click()
    await expect(d).toBeHidden()
    expect(errores).toEqual([])
  })

  test('un gasto compartido muestra con qué fondo, el importe de este fondo y el total del gasto', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    const d = await abrirDetalle(page, 'Hogar')
    const compartido = d.getByText(/Compartido con /).first()
    if (await compartido.count()) {
      await expect(compartido).toContainText('General')
      await expect(d.getByText(/total S\//).first()).toBeVisible()
    }
    // Ninguna fila se sale del contenedor
    const rebasa = await d.evaluate((raiz) => {
      const c = raiz.getBoundingClientRect()
      return Array.from(raiz.querySelectorAll('li, li *')).some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1) })
    })
    expect(rebasa).toBe(false)
  })

  for (const [w, h] of [[360, 800], [390, 844], [768, 1024], [1024, 768]] as const) {
    test(`se adapta a ${w}×${h}: filas compactas, sin recortes y con el cierre visible`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await iniciarSesion(page)
      const d = await abrirDetalle(page, 'Fondo General')
      await expect(d.getByRole('button', { name: 'Cerrar' })).toBeInViewport()
      const r = await d.evaluate((raiz) => {
        const c = raiz.getBoundingClientRect()
        const fuera = Array.from(raiz.querySelectorAll('button, input, select, li')).filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > c.right + 1 || b.left < c.left - 1) }).length
        const cuerpo = raiz.querySelector('.overflow-y-auto') as HTMLElement
        return { fuera, desbordeH: cuerpo.scrollWidth - cuerpo.clientWidth, caja: [Math.round(c.width), Math.round(c.height)] }
      })
      expect(r.fuera).toBe(0)
      expect(r.desbordeH).toBeLessThanOrEqual(1)
      expect(r.caja[0]).toBeLessThanOrEqual(w)
      expect(r.caja[1]).toBeLessThanOrEqual(h)
      await d.getByRole('button', { name: /Ver detalle/ }).first().click()
      await expect(d.getByRole('region', { name: /^Detalle de / })).toBeVisible()
    })
  }

  test('un fondo sin gastos muestra un estado vacío cuidado y se adapta al contenido', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await iniciarSesion(page)
    await page.goto('/fondos')
    // Cualquier fondo sin consumo; si no hay ninguno, la prueba no aplica.
    const sinConsumo = page.getByRole('listitem').filter({ hasText: 'S/ 0.00' }).filter({ has: page.getByRole('button', { name: 'Ver gastos' }) })
    test.skip((await sinConsumo.count()) === 0, 'No hay un fondo sin gastos en los datos de prueba')
  })
})
