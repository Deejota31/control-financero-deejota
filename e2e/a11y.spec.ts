import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { elegirEnGasto, email, iniciarSesion, password } from './helpers'

/**
 * Auditoría automatizada con axe-core (WCAG 2.0/2.1 A y AA + buenas prácticas) en las pantallas principales
 * y en los diálogos, en tema claro y oscuro. Cualquier excepción debe justificarse en docs/accesibilidad.md.
 */
const ETIQUETAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

// Sin excepciones activas. (Ver docs/accesibilidad.md para el registro de limitaciones reales.)
const REGLAS_EXCLUIDAS: string[] = []

async function auditar(page: Page, contexto: string) {
  // Las animaciones de entrada mezclan colores a medias: se audita el estado final
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS).disableRules(REGLAS_EXCLUIDAS).analyze()
  const resumen = r.violations.map((v) => `${v.id} (${v.impact}) — ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`)
  expect(resumen, `Violaciones de accesibilidad en ${contexto}`).toEqual([])
}

async function fijarTema(page: Page, tema: 'claro' | 'oscuro') {
  const actual = await page.locator('html').getAttribute('data-theme')
  if ((tema === 'oscuro') !== (actual === 'dark')) {
    await page.getByRole('button', { name: /Cambiar a tema/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light')
  }
}

const PAGINAS = [
  { ruta: '/', nombre: 'Dashboard', espera: 'Gasto acumulado' },
  { ruta: '/gastos', nombre: 'Gastos', espera: 'Movimientos' },
  { ruta: '/fondos', nombre: 'Fondos', espera: 'Presupuesto asignado' },
  { ruta: '/catalogo', nombre: 'Catálogo', espera: 'Ámbitos' },
  { ruta: '/salud', nombre: 'Salud financiera', espera: '¿Cuánto presupuesto queda?' },
  { ruta: '/configuracion', nombre: 'Configuración: perfil', espera: 'Formato de fecha' },
  { ruta: '/configuracion?seccion=hogar', nombre: 'Configuración: hogar', espera: 'Nombre del hogar' },
  { ruta: '/configuracion?seccion=exportar', nombre: 'Configuración: exportar', espera: 'Gastos en CSV' },
  { ruta: '/configuracion?seccion=cuenta', nombre: 'Configuración: cuenta', espera: 'Correo de acceso' },
  { ruta: '/configuracion?seccion=actividad', nombre: 'Configuración: actividad', espera: 'Ver toda la actividad' },
]

test.describe('Accesibilidad (axe)', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('pantallas de acceso, recuperación y sesión vencida', async ({ page }) => {
    for (const [ruta, texto] of [['/acceso', 'Iniciar sesión'], ['/recuperar', 'Recuperar contraseña'], ['/sesion-expirada', 'Tu sesión venció'], ['/restablecer', 'Enlace no válido']] as const) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { name: texto })).toBeVisible()
      await auditar(page, `${ruta} (claro)`)
    }
    // login con errores visibles
    await page.goto('/acceso')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Ingresa tu correo.')).toBeVisible()
    await auditar(page, '/acceso con errores de validación')
  })

  for (const tema of ['claro', 'oscuro'] as const) {
    test(`páginas principales, tema ${tema}`, async ({ page }) => {
      test.setTimeout(120_000)
      await iniciarSesion(page)
      await fijarTema(page, tema)
      for (const p of PAGINAS) {
        await page.goto(p.ruta)
        await expect(page.getByText(p.espera, { exact: false }).first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        await auditar(page, `${p.nombre} (${tema})`)
      }
    })

    test(`diálogos y estados con datos, tema ${tema}`, async ({ page }) => {
      test.setTimeout(120_000)
      await iniciarSesion(page)
      await fijarTema(page, tema)

      // Formulario de gasto con previsualización de fondos
      await page.goto('/gastos')
      await page.getByRole('button', { name: 'Nuevo gasto' }).click()
      const d = page.getByRole('dialog')
      await d.getByLabel('Importe', { exact: true }).fill('50')
      for (const [n, o] of [['Ámbito', 'Hogar'], ['Categoría', 'Servicios'], ['Medio de pago', 'Yape']] as const) {
        await elegirEnGasto(d, n, o)
      }
      await expect(d.getByText('Excedente al General')).toBeVisible()
      await auditar(page, `formulario de gasto (${tema})`)
      await d.getByRole('button', { name: 'Cancelar' }).click()
      if (await page.getByRole('button', { name: 'Descartar cambios' }).isVisible({ timeout: 800 }).catch(() => false)) await page.getByRole('button', { name: 'Descartar cambios' }).click()

      // Calendario
      await page.getByRole('button', { name: 'Nuevo gasto' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Fecha', exact: true }).click()
      await expect(page.getByRole('grid')).toBeVisible()
      await auditar(page, `calendario (${tema})`)
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

      // Confirmación de anulación
      await page.getByRole('button', { name: /^Anular / }).first().click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await auditar(page, `confirmación de anulación (${tema})`)
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()

      // Fondos: formulario con reglas
      await page.goto('/fondos')
      await page.getByRole('button', { name: 'Nuevo fondo' }).click()
      await expect(page.getByRole('dialog', { name: 'Nuevo fondo' })).toBeVisible()
      await auditar(page, `formulario de fondo (${tema})`)
      await page.keyboard.press('Escape')

      // Catálogo: formulario con selector de icono
      await page.goto('/catalogo')
      await page.getByRole('button', { name: 'Nuevo ámbito' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await auditar(page, `formulario de catálogo (${tema})`)
      await page.keyboard.press('Escape')

      // Plantillas y lote
      await page.goto('/gastos')
      await page.getByRole('button', { name: 'Registrar mensuales' }).click()
      await expect(page.getByRole('dialog', { name: 'Registrar gastos mensuales' })).toBeVisible()
      await auditar(page, `registro mensual (${tema})`)
    })
  }
})
