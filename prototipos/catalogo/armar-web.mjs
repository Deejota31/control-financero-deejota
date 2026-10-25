// Ensambla las propuestas dinámicas en UN solo HTML publicable (sin dependencias externas).
// Uso (raíz del proyecto): node prototipos/catalogo/armar-web.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
const aqui = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const leer = (f) => readFileSync(path.join(aqui, f), 'utf8')

let css = leer('shared.css')
// Tema: variables claras en :root; las oscuras por preferencia del sistema (si no hay elección explícita) y por data-theme.
const m = css.match(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/)
if (!m) throw new Error('No se encontró el bloque oscuro en shared.css')
css = css.replace(m[0], `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) {${m[1]}\n} }\n${m[0]}`)
let js = leer('shared.js')
js = js.replace("function temaActual() { return document.documentElement.dataset.theme === 'dark' ? 'oscuro' : 'claro' }",
  "function temaActual() { const t = document.documentElement.dataset.theme; if (t) return t === 'dark' ? 'oscuro' : 'claro'; return matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro' }")
if (!js.includes('matchMedia')) throw new Error('No se pudo parchear temaActual')

const html = `<title>Propuestas de Catálogo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
${leer('dinamicas.css')}
</style>
<script>
${js}
</script>
<script>
${leer('dinamicas.js')}
</script>
`
mkdirSync(path.join(aqui, 'web'), { recursive: true })
writeFileSync(path.join(aqui, 'web', 'propuestas-dinamicas.html'), html)
console.log('web/propuestas-dinamicas.html', Math.round(html.length / 1024), 'KB')
