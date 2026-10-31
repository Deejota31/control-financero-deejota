import { defineConfig } from '@playwright/test'

// Las credenciales E2E viven en .env.local (no versionado).
try {
  process.loadEnvFile('.env.local')
} catch {
  /* sin .env.local: los tests que requieren sesión se omiten */
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  workers: 1,
  // Margen realista para una máquina de desarrollo con otros programas abiertos: los flujos largos (varios diálogos, recorridos por los seis módulos)
  // rozaban los 30 s y las esperas de 5 s fallaban solo cuando el equipo estaba ocupado. Un bloqueo de verdad sigue fallando.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
