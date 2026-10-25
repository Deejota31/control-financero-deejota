// Comprueba las propuestas dinámicas (sin errores de consola, interacciones clave) y genera capturas.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const aqui = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const salida = path.join(aqui, 'capturas', 'web'); mkdirSync(salida, { recursive: true })
const url = pathToFileURL(path.join(aqui, 'web', 'propuestas-dinamicas.html')).href
const res = []
const ok = (n, c, x = '') => { res.push(c); console.log(`${c ? 'OK ' : 'FALLA'} ${n} ${x}`) }
const b = await chromium.launch()
for (const [esquema, ancho] of [['light', 1440], ['dark', 1440], ['light', 390]]) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: esquema })
  const p = await ctx.newPage(); const err = []
  p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()) })
  await p.goto(url)
  for (const v of ['B', 'D', 'E', 'F', 'G', 'H']) {
    await p.locator(`[data-v="${v}"]`).click()
    for (const s of ['ambitos', 'categorias', 'medios']) {
      await p.locator(`[data-sec="${s}"]`).click()
      if (ancho === 1440 && (s === 'categorias' || (v === 'F' && s === 'ambitos'))) { await p.waitForTimeout(900); await p.screenshot({ path: path.join(salida, `${v}-${s}-${esquema}.png`), fullPage: true }) }
    }
    await p.locator('[data-sec="categorias"]').click()
  }
  const desborde = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  ok(`${esquema}/${ancho}: sin desborde horizontal`, !desborde)
  ok(`${esquema}/${ancho}: sin errores de consola`, err.length === 0, err.join(' | '))
  if (ancho === 1440 && esquema === 'light') {
    // D: cambiar la métrica reacomoda
    await p.locator('[data-v="D"]').click(); await p.locator('[data-sec="ambitos"]').click()
    const antes = await p.locator('.d-teja').first().evaluate((e) => e.style.width)
    await p.getByRole('radio', { name: 'Todos iguales' }).click(); await p.waitForTimeout(700)
    ok('D: la métrica cambia el tamaño de los mosaicos', antes !== (await p.locator('.d-teja').first().evaluate((e) => e.style.width)))
    // color rápido
    await p.getByRole('button', { name: 'Rojo', exact: true }).click()
    ok('D: elegir un color actualiza el detalle', (await p.locator('#detalle').textContent()).includes('Rojo'))
    // E: arrastrar una categoría a otro ámbito
    await p.locator('[data-v="E"]').click(); await p.locator('[data-sec="categorias"]').click()
    await p.locator('.d-card[data-id="c4"]').dragTo(p.locator('.d-col[data-zona="a1"]'))
    ok('E: arrastrar «Ocio» a Hogar cambia su ámbito', await p.evaluate(() => DATOS.categorias.find((c) => c.id === 'c4').ambito === 'a1'))
    await p.locator('.d-card[data-id="c1"]').focus(); await p.keyboard.press('Alt+ArrowDown')
    ok('E: Alt+↓ mueve una tarjeta con teclado', await p.evaluate(() => { const l = DATOS.categorias.filter((c) => c.ambito === 'a1').map((c) => c.id); return l.indexOf('c1') > 0 }))
    // F: seleccionar un arco
    await p.locator('[data-v="F"]').click()
    await p.locator('.arco').first().dispatchEvent('click')
    ok('F: seleccionar un arco muestra su nombre al centro', (await p.locator('#centro').textContent()).length > 3)
    // G: armonizar y deshacer
    await p.locator('[data-v="G"]').click()
    const antesColor = await p.evaluate(() => DATOS.categorias[0].color)
    await p.locator('#g-arm').click(); await p.locator('#g-und').click()
    ok('G: armonizar y deshacer restaura', (await p.evaluate(() => DATOS.categorias[0].color)) === antesColor)
    await p.getByRole('button', { name: 'Violeta', exact: true }).first().click()
    ok('G: la vista previa se recolorea', (await p.locator('.pc-chip').first().evaluate((e) => e.style.getPropertyValue('--b'))) !== '')
    // H: renombrar, añadir, eliminar con deshacer
    await p.locator('[data-v="H"]').click(); await p.locator('[data-sec="medios"]').click()
    await p.locator('#h-nuevo').fill('Billetera digital'); await p.locator('#h-nuevo').press('Enter')
    ok('H: Enter añade un elemento', await p.getByText('Billetera digital').first().isVisible())
    await p.locator('#h-lista').getByRole('button', { name: 'Eliminar Billetera digital' }).click()
    ok('H: eliminar muestra aviso con Deshacer', await p.getByRole('button', { name: 'Deshacer' }).isVisible())
    await p.getByRole('button', { name: 'Deshacer' }).click()
    ok('H: Deshacer lo recupera', await p.getByText('Billetera digital').first().isVisible())
    await p.locator('#h-lista').getByRole('button', { name: 'Renombrar Yape' }).click(); await p.keyboard.type('Yape Plus'); await p.keyboard.press('Enter')
    ok('H: renombrar en línea', await p.getByText('Yape Plus').first().isVisible())
    await p.locator('#h-lista').getByRole('button', { name: 'Cambiar color de Efectivo' }).click()
    ok('H: el punto abre el selector de color', await p.getByRole('dialog', { name: /Color de Efectivo/ }).isVisible())
    await p.screenshot({ path: path.join(salida, 'H-popover-light.png'), fullPage: true })
    await p.keyboard.press('Escape')
    // modal avanzado desde B
    await p.locator('[data-v="B"]').click(); await p.getByRole('button', { name: /Editar…/ }).click()
    ok('B: el modal de edición abre', await p.getByRole('dialog').isVisible())
  }
  await ctx.close()
}
await b.close()
console.log(`\n${res.filter(Boolean).length}/${res.length} verificaciones`)
process.exit(res.every(Boolean) ? 0 : 1)
