// Genera capturas a 1440 px de los prototipos (claro y oscuro) y verifica el selector de color.
// Uso (desde la raíz del proyecto): node prototipos/catalogo/capturar.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const aqui = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const salida = path.join(aqui, 'capturas')
mkdirSync(salida, { recursive: true })
const props = { a: 'a-tarjetas.html', b: 'b-explorador.html', c: 'c-compacta.html' }
const vistas = ['ambitos', 'categorias', 'medios']
const resultados = []
const ok = (nombre, cond, extra = '') => { resultados.push({ nombre, ok: Boolean(cond), extra }); console.log(`${cond ? 'OK ' : 'FALLA'} ${nombre} ${extra}`) }

const browser = await chromium.launch()
for (const tema of ['claro', 'oscuro']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const errores = []
  for (const [clave, archivo] of Object.entries(props)) {
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errores.push(`${clave}: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errores.push(`${clave}: ${m.text()}`) })
    const url = (extra = '') => `${pathToFileURL(path.join(aqui, archivo)).href}?tema=${tema}${extra}`
    for (const v of vistas) {
      await page.goto(url(`&vista=${v}`))
      await page.screenshot({ path: path.join(salida, `${clave}-${v}-${tema}.png`), fullPage: true })
    }
    // Modal de edición de una categoría que hereda color (Servicios) → selector normal
    await page.goto(url('&vista=categorias'))
    if (clave === 'b') await page.getByRole('treeitem', { name: /Servicios/ }).click()
    await page.getByRole('button', { name: 'Editar Servicios' }).first().click()
    await page.getByRole('dialog').waitFor()
    ok(`${clave}/${tema}: el modal abre con el color heredado marcado`, await page.getByRole('radio', { name: /Heredar de/ }).getAttribute('aria-checked') === 'true')
    await page.screenshot({ path: path.join(salida, `${clave}-modal-normal-${tema}.png`) })
    // Color propio + selector avanzado
    await page.getByRole('radio', { name: 'Color propio' }).click()
    await page.getByRole('button', { name: /Color personalizado/ }).click()
    await page.getByLabel('HEX').fill('#5B5BD6')
    ok(`${clave}/${tema}: HEX #5B5BD6 → RGB 91, 91, 214`, (await page.locator('#rgb-R').inputValue()) === '91' && (await page.locator('#rgb-G').inputValue()) === '91' && (await page.locator('#rgb-B').inputValue()) === '214')
    await page.locator('#rgb-B').fill('200')
    ok(`${clave}/${tema}: cambiar B a 200 actualiza el HEX`, (await page.getByLabel('HEX').inputValue()) === '#5B5BC8')
    await page.getByLabel('HEX').fill('#5B5BD6')
    await page.getByLabel('HEX').fill('zzz')
    ok(`${clave}/${tema}: un HEX inválido muestra el error`, await page.locator('#hex-err').isVisible())
    await page.getByLabel('HEX').fill('#5B5BD6')
    ok(`${clave}/${tema}: indicador de contraste visible`, await page.getByText(/Texto sobre fondo suave/).isVisible())
    await page.screenshot({ path: path.join(salida, `${clave}-modal-avanzado-${tema}.png`) })
    await page.getByRole('button', { name: /Volver a la paleta/ }).click()
    ok(`${clave}/${tema}: se puede volver a la paleta`, await page.getByRole('radiogroup', { name: 'Paleta de colores' }).isVisible())
    await page.keyboard.press('Escape')
    ok(`${clave}/${tema}: Escape cierra el modal`, (await page.getByRole('dialog').count()) === 0)
    // Reglas de administración
    await page.goto(url('&vista=ambitos'))
    if (clave === 'b') await page.getByRole('treeitem', { name: /Otros/ }).click()
    ok(`${clave}/${tema}: «Otros» no se puede eliminar ni subir/bajar`, await page.getByRole('button', { name: 'Eliminar Otros' }).isDisabled() && await page.getByRole('button', { name: 'Bajar Otros' }).isDisabled())
    if (clave === 'b') await page.getByRole('treeitem', { name: /Hogar/ }).click()
    ok(`${clave}/${tema}: un ámbito con gastos no se puede eliminar`, await page.getByRole('button', { name: 'Eliminar Hogar' }).isDisabled())
    await page.close()
  }
  ok(`${tema}: sin errores de consola`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}
// paleta
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
for (const tema of ['claro', 'oscuro']) {
  const p = await ctx.newPage()
  await p.goto(`${pathToFileURL(path.join(aqui, 'paleta.html')).href}?tema=${tema}`)
  await p.screenshot({ path: path.join(salida, `paleta-${tema}.png`), fullPage: true })
  const bajos = await p.evaluate(() => COLORES.flatMap((c) => ['claro', 'oscuro'].map((t) => [c.nombre, t, tonos(c.hex, t).cTexto]).filter((x) => x[2] < 4.5)))
  ok(`paleta/${tema}: los 20 colores cumplen 4.5:1 en texto`, bajos.length === 0, JSON.stringify(bajos))
  await p.close()
}
await browser.close()
console.log(`\n${resultados.filter((r) => r.ok).length}/${resultados.length} verificaciones correctas`)
process.exit(resultados.every((r) => r.ok) ? 0 : 1)
