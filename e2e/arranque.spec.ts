import { expect, test } from '@playwright/test'

test('la app arranca y muestra el título', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Gasto Deejota' })).toBeVisible()
  await expect(page.getByText('Entorno: local')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Conectado a Supabase local.')
})
