import { defineConfig } from '@playwright/test'

// Las credenciales E2E viven en .env.local (no versionado).
try {
  process.loadEnvFile('.env.local')
} catch {
  /* sin .env.local: los tests que requieren sesión se omiten */
}

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
