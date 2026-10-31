import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD

async function iniciarSesion(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Correo').fill(email!)
  await page.getByLabel('Contraseña', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toHaveAttribute('aria-current', 'page')
}

test.describe('rutas y errores sin sesión', () => {
  for (const ruta of ['/', '/gastos', '/fondos', '/configuracion']) {
    test(`protege ${ruta}`, async ({ page }) => {
      await page.goto(ruta)
      await expect(page).toHaveURL(/\/acceso$/)
    })
  }

  test('valida campos requeridos', async ({ page }) => {
    await page.goto('/acceso')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByText('Ingresa tu correo.')).toBeVisible()
    await expect(page.getByText('Ingresa tu contraseña.')).toBeVisible()
  })

  test('rechaza credenciales incorrectas y orienta al usuario', async ({ page }) => {
    await page.goto('/acceso')
    await page.getByLabel('Correo').fill('nadie@gastodeejota.local')
    await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta-123')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    const alerta = page.getByRole('alert')
    await expect(alerta).toContainText('Correo o contraseña incorrectos.')
    await expect(alerta).toContainText('npm run db:reset')
    await expect(page).toHaveURL(/\/acceso$/)
  })

  test('muestra un error claro si no hay conexión con Supabase', async ({ page }) => {
    await page.route('**/auth/v1/token**', (route) => route.abort('connectionrefused'))
    await page.goto('/acceso')
    await page.getByLabel('Correo').fill('a@b.co')
    await page.getByLabel('Contraseña', { exact: true }).fill('cualquiera123')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servidor.')
  })

  test('recuperación de contraseña responde sin revelar si el correo existe', async ({ page }) => {
    await page.goto('/recuperar')
    await page.getByLabel('Correo').fill('desconocido@gastodeejota.local')
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByRole('status')).toContainText('Si el correo está registrado')
  })

  test('un enlace de restablecimiento sin sesión se informa como vencido', async ({ page }) => {
    await page.goto('/restablecer')
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
  })

  test('la pantalla de sesión vencida ofrece volver a entrar', async ({ page }) => {
    await page.goto('/sesion-expirada')
    await page.getByRole('link', { name: 'Iniciar sesión de nuevo' }).click()
    await expect(page).toHaveURL(/\/acceso$/)
  })
})

test.describe('con el usuario demo local', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('inicia sesión, navega, conserva la sesión al recargar y cierra sesión', async ({ page }) => {
    await iniciarSesion(page)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    await page.getByRole('link', { name: 'Gastos' }).first().click()
    await expect(page).toHaveURL(/\/gastos$/)
    await expect(page.getByRole('link', { name: 'Gastos' }).first()).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).not.toHaveAttribute('aria-current', 'page')

    await page.reload()
    await expect(page).toHaveURL(/\/gastos$/)
    await expect(page.getByRole('heading', { name: 'Gastos' })).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
    await expect(page).toHaveURL(/\/acceso$/)
    await page.goto('/gastos')
    await expect(page).toHaveURL(/\/acceso$/)
  })

  test('un usuario con sesión no ve la pantalla de acceso', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/acceso')
    await expect(page).toHaveURL(/localhost:5173\/$|127\.0\.0\.1:5173\/$/)
  })

  test('guarda el perfil en Supabase y lo recupera tras recargar', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    const nombre = page.getByLabel('Nombre', { exact: true })
    await expect(nombre).toBeVisible()
    await nombre.fill('Perfil Prueba E2E')
    await page.getByRole('radio', { name: /Año-mes-día/ }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Perfil Prueba E2E')
    await expect(page.getByRole('radio', { name: /Año-mes-día/ })).toHaveAttribute('aria-checked', 'true')

    // restaurar valores de demo
    await page.getByLabel('Nombre', { exact: true }).fill('Usuario Demo')
    await page.getByRole('radio', { name: /Día . mes . año/ }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible()
  })

  test('el tema claro/oscuro cambia, se guarda en el perfil y persiste', async ({ page }) => {
    await iniciarSesion(page)
    const html = page.locator('html')
    await page.waitForLoadState('networkidle') // el perfil ya aplicó su tema
    // Parte siempre del tema claro, sea cual sea el estado guardado en el perfil
    if ((await html.getAttribute('data-theme')) === 'dark') await page.getByRole('switch', { name: 'Cambiar a tema claro' }).filter({ visible: true }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await page.getByRole('switch', { name: 'Cambiar a tema oscuro' }).filter({ visible: true }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(15, 16, 69)')
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('switch', { name: 'Cambiar a tema claro' }).filter({ visible: true }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(241, 240, 253)')
  })

  test('la validación de contraseña nueva funciona en Configuración', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('link', { name: 'Configuración' }).first().click()
    await page.getByRole('tab', { name: /^Cuenta y seguridad/ }).click()
    await page.getByLabel('Contraseña nueva').fill('corta')
    await page.getByLabel('Repite la contraseña').fill('otra')
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
    await expect(page.getByText('Usa al menos 8 caracteres.')).toBeVisible()
  })

  test('en pantalla pequeña se usa la barra de navegación inferior', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await iniciarSesion(page)
    const nav = page.getByRole('navigation', { name: 'Módulos' }).last()
    await expect(nav).toBeVisible()
    await nav.getByRole('link', { name: 'Fondos' }).click()
    await expect(page).toHaveURL(/\/fondos$/)
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(desborde).toBe(false)
  })
})
