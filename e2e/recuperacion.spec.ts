import { expect, test, type Page } from '@playwright/test'

const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD
const MAILPIT = 'http://127.0.0.1:54324'

async function ultimoEnlace(page: Page, destinatario: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const lista = await (await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + destinatario)}`)).json()
    const msg = lista.messages?.[0]
    if (msg) {
      const detalle = await (await page.request.get(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()
      const m = String(detalle.HTML ?? detalle.Text).match(/href="([^"]*verify[^"]*)"/) ?? String(detalle.Text).match(/(http[^\s"]*verify[^\s"]*)/)
      if (m) return m[1].replace(/&amp;/g, '&')
    }
    await page.waitForTimeout(500)
  }
  throw new Error('No llegó el correo de recuperación a Mailpit')
}

test.describe('restablecimiento de contraseña (Mailpit local)', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('el enlace del correo permite crear una contraseña nueva y luego se restaura la original', async ({ page }) => {
    const temporal = 'Temporal-E2E-98765'
    await page.request.delete(`${MAILPIT}/api/v1/messages`)

    // El enlace debe abrirse en el mismo navegador que lo solicitó (flujo PKCE).
    await page.goto('/recuperar')
    await page.getByLabel('Correo').fill(email!)
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByRole('status')).toContainText('Si el correo está registrado')

    await page.goto(await ultimoEnlace(page, email!))
    await expect(page.getByRole('heading', { name: 'Crea tu contraseña nueva' })).toBeVisible()

    await page.getByLabel('Contraseña nueva').fill(temporal)
    await page.getByLabel('Repite la contraseña').fill(temporal)
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    // Restaurar la contraseña original desde Configuración.
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    await page.getByLabel('Contraseña nueva').fill(password!)
    await page.getByLabel('Repite la contraseña').fill(password!)
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
    await expect(page.getByText('Contraseña actualizada.')).toBeVisible()

    // La original vuelve a funcionar.
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})
