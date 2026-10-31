import { E2E_UID, sqlLocal } from './db'
import { test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

/**
 * Capturas «antes / después» del rediseño global (Aurora Fintech Premium). Solo corre con CAPTURAS_DIR=<carpeta> (no forma parte de la suite normal).
 * Datos: el usuario E2E aislado; las plantillas se crean con SQL y se descartan al reiniciar su hogar.
 */
const DIR = process.env.CAPTURAS_DIR
const FASE = process.env.CAPTURAS_FASE ?? 'antes'
const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const TAMANOS = [[1440, 900], [390, 844]] as const
const PAGINAS = [['dashboard', '/'], ['gastos', '/gastos'], ['fondos', '/fondos'], ['catalogo', '/catalogo'], ['salud', '/salud'], ['configuracion', '/configuracion']] as const

test.describe('Capturas del rediseño global', () => {
  test.skip(!DIR || !email || !password, 'Define CAPTURAS_DIR y las credenciales E2E')

  for (const [w, h] of TAMANOS) {
    for (const tema of ['claro', 'oscuro'] as const) {
      test(`${FASE} ${w}x${h} ${tema}`, async ({ page }) => {
        test.setTimeout(180_000)
        sqlLocal(`insert into public.fund_templates (household_id, name, suggested_amount, priority, icon_key, color_token, sort_order) values (${HID}, 'Mercado', 800, 102, 'wallet', 'c1', 1)`)
        await page.addInitScript((t) => localStorage.setItem('gd-tema', t), tema)
        await page.setViewportSize({ width: w, height: h })
        await iniciarSesion(page)
        // El tema guardado en el perfil manda al iniciar sesión: se fija con el propio interruptor (así se prueba también que funciona)
        await page.waitForTimeout(1500) // el perfil termina de cargar y aplica su tema
        const oscuroAhora = await page.locator('html').getAttribute('data-theme')
        if ((tema === 'oscuro') !== (oscuroAhora === 'dark')) await page.getByRole('switch').filter({ visible: true }).click()
        await page.locator('html').waitFor()
        const foto = (n: string) => page.screenshot({ path: `${DIR}/${FASE}/${n}-${w}x${h}-${tema}.png` })
        for (const [nombre, ruta] of PAGINAS) {
          await page.goto(ruta)
          await page.waitForTimeout(1200)
          await foto(nombre)
        }
        // Modal «Registrar gasto» y asistente de planificación
        await page.goto('/gastos')
        await page.getByRole('button', { name: /Registrar gasto/ }).first().click()
        await page.getByRole('dialog').waitFor()
        await page.waitForTimeout(500)
        await foto('modal-gasto')
        await page.keyboard.press('Escape')
        await page.goto('/catalogo')
        await page.waitForTimeout(800)
        await foto('catalogo-paleta')
      })
    }
  }
})
