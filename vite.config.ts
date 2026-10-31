/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * PWA sin dependencias: tras el build, sustituye en dist/sw.js la versión (hash de la lista de archivos, que ya llevan hash) y la lista de
 * archivos de la cáscara que se precachean (index.html y los JS/CSS de entrada). Un build con el mismo contenido da el MISMO sw.js: no hay
 * «actualizaciones» falsas; cualquier cambio de código cambia la versión y el navegador ofrece la actualización.
 */
function serviceWorker(): Plugin {
  return {
    name: 'control-financiero-sw',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const sw = 'dist/sw.js', html = 'dist/index.html'
      if (!existsSync(sw) || !existsSync(html)) return
      const entrada = [...readFileSync(html, 'utf8').matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
      const precache = ['/index.html', ...new Set(entrada)]
      const version = createHash('sha1').update(JSON.stringify(precache)).digest('hex').slice(0, 10)
      const codigo = readFileSync(sw, 'utf8').replace("'__BUILD_ID__'", JSON.stringify(version)).replace('/*__PRECACHE__*/ []', JSON.stringify(precache))
      if (codigo.includes("'__BUILD_ID__'") || codigo.includes('/*__PRECACHE__*/ []')) throw new Error('No se pudo sellar la versión del Service Worker')
      writeFileSync(sw, codigo)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
