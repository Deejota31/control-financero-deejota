import { expect, test } from '@playwright/test'

test('sin sesión, la app lleva al acceso y está conectada a Supabase local', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/acceso$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})
