// Regenera los PNG de public/ (favicon, icono de la app, apple-touch-icon) desde los SVG de la marca. Uso: node scripts/generar-iconos.mjs
// Los SVG (public/favicon.svg y public/icon-maskable.svg) son la fuente; los PNG solo existen porque algunos navegadores y sistemas no aceptan SVG.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const SALIDAS = [
  ['public/favicon.svg', 32, 'public/favicon-32.png'],
  ['public/favicon.svg', 180, 'public/apple-touch-icon.png'],
  ['public/favicon.svg', 192, 'public/icon-192.png'],
  ['public/favicon.svg', 512, 'public/icon-512.png'],
  ['public/icon-maskable.svg', 192, 'public/icon-maskable-192.png'],
  ['public/icon-maskable.svg', 512, 'public/icon-maskable-512.png'],
]

const navegador = await chromium.launch()
try {
  for (const [svg, tam, destino] of SALIDAS) {
    const pagina = await navegador.newPage({ viewport: { width: tam, height: tam } })
    const dato = Buffer.from(readFileSync(svg)).toString('base64')
    await pagina.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${tam}px;height:${tam}px}</style><img src="data:image/svg+xml;base64,${dato}">`)
    await pagina.screenshot({ path: destino, omitBackground: true })
    await pagina.close()
    console.log(`✔ ${destino} (${tam}×${tam})`)
  }
} finally {
  await navegador.close()
}
