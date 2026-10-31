import { defineConfig } from '@playwright/test'

// Pruebas de la PWA sobre la BUILD DE PRODUCCIÓN (el Service Worker solo se registra ahí). Uso: npm run test:pwa
// Compila y sirve dist/ con `vite preview` en el puerto 4173. Reutiliza la misma preparación aislada (usuario E2E propio y bloqueo exclusivo)
// que la suite normal: no se pueden ejecutar a la vez.
try {
  process.loadEnvFile('.env.local')
} catch {
  /* sin .env.local: los tests que requieren sesión se omiten */
}

export default defineConfig({
  testDir: './e2e-pwa',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  workers: 1,
  outputDir: 'test-results-pwa', // distinto del de la suite normal: así la evidencia de los fallos de una no borra la de la otra
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'allow', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
