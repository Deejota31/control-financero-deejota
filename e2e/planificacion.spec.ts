import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { E2E_UID, sqlLocal } from './db'
import { expect, test } from './fixtures'
import { email, iniciarSesion, password } from './helpers'

const HID = `(select household_id from public.profiles where user_id = '${E2E_UID}')`
const ACT = sqlLocal(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD')`)
const SIG = sqlLocal(`select to_char(date_trunc('month', current_date) + interval '1 month', 'YYYY-MM-DD')`)
const periodo = (mes: string) => `(select id from public.budget_periods where household_id = ${HID} and start_date = '${mes}')`
const nFondos = (mes: string) => Number(sqlLocal(`select count(*) from public.funds where period_id = ${periodo(mes)}`))
const monto = (mes: string, nombre: string) => Number(sqlLocal(`select b.assigned_amount from public.fund_period_budgets b join public.funds f on f.id = b.fund_id where f.period_id = ${periodo(mes)} and f.name = '${nombre}'`))
const plan = (mes: string, col: string) => sqlLocal(`select ${col} from public.period_plans where period_id = ${periodo(mes)}`)

/** El mes siguiente es el escenario de «mes nuevo»: cada prueba lo deja vacío antes de empezar (y sin plan). */
function vaciarSiguiente() {
  sqlLocal(`delete from public.period_plans where period_id = ${periodo(SIG)}`)
  sqlLocal(`delete from public.funds where period_id = ${periodo(SIG)}`)
}

const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test.describe('Fondos independientes por mes y planificación mensual', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')
  test.beforeEach(() => vaciarSiguiente())
  test.afterAll(() => vaciarSiguiente())

  test('A · un mes nuevo no hereda fondos: estado vacío con sus tres acciones', async ({ page }) => {
    await iniciarSesion(page)
    expect(nFondos(ACT)).toBe(5)
    await page.goto(`/fondos?mes=${SIG}`)
    await expect(page.getByText('Período futuro')).toBeVisible()
    await expect(page.getByText(/Todavía no tienes fondos configurados para/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear nuevo fondo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copiar fondos del mes anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir planificación mensual' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Fondos' })).toHaveCount(0)
    expect(nFondos(SIG)).toBe(0)
  })

  test('B/H · copia parcial con importe editado: independiente del origen e idempotente', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Copiar fondos del mes anterior' }).click()
    const d = page.getByRole('dialog', { name: 'Copiar fondos de otro mes' })
    await expect(d.getByRole('checkbox', { name: 'Copiar Hogar' })).toBeChecked()
    await d.getByRole('checkbox', { name: 'Copiar Bebé' }).uncheck()
    await d.getByRole('checkbox', { name: 'Copiar Familia' }).uncheck()
    await d.getByLabel('Importe de Hogar').fill('800')
    expect(nFondos(SIG)).toBe(0) // seleccionar no crea nada
    await d.getByRole('button', { name: 'Copiar 3 fondos' }).click()
    await expect(page.getByText(/3 fondos copiados/)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(3)
    expect(nFondos(SIG)).toBe(3)
    expect(nFondos(ACT)).toBe(5)
    expect(monto(SIG, 'Hogar')).toBe(800)
    expect(monto(ACT, 'Hogar')).toBe(700)

    // Repetir: lo ya copiado no se puede volver a copiar y no se duplica nada.
    await page.getByRole('button', { name: 'Copiar fondos de otro mes' }).click()
    const d2 = page.getByRole('dialog', { name: 'Copiar fondos de otro mes' })
    await expect(d2.getByRole('checkbox', { name: 'Copiar Hogar' })).toBeDisabled()
    await expect(d2.getByText('No se copiará: ya se había copiado.').first()).toBeVisible()
    await expect(d2.getByRole('button', { name: 'Copiar 2 fondos' })).toBeVisible()
    await d2.getByRole('button', { name: 'Cancelar' }).click()
    expect(nFondos(SIG)).toBe(3)
  })

  test('C · editar el importe de un fondo en un mes no cambia los demás meses', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Copiar fondos del mes anterior' }).click()
    await page.getByRole('dialog', { name: 'Copiar fondos de otro mes' }).getByRole('button', { name: 'Copiar 5 fondos' }).click()
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(5)
    await page.getByRole('button', { name: 'Más acciones de Hogar' }).click()
    await page.getByRole('menuitem', { name: /Editar/ }).click()
    const f = page.getByRole('dialog')
    await f.getByLabel('Importe de este mes (S/)').fill('950')
    await f.getByRole('button', { name: 'Guardar fondo' }).click()
    const confirmacion = page.getByRole('alertdialog')
    await expect(confirmacion.or(page.getByText('Fondo guardado.'))).toBeVisible()
    if (await confirmacion.isVisible()) await confirmacion.getByRole('button', { name: 'Aplicar cambios' }).click()
    await expect(page.getByText('Fondo guardado.')).toBeVisible()
    expect(monto(SIG, 'Hogar')).toBe(950)
    expect(monto(ACT, 'Hogar')).toBe(700)
    // Otro mes con otra cantidad de fondos: el actual sigue con los suyos.
    await page.goto(`/fondos?mes=${ACT}`)
    await expect(page.getByRole('list', { name: 'Fondos' }).getByRole('listitem')).toHaveCount(5)
  })

  test('G · el asistente guarda lo confirmado: se puede cerrar y retomar', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Planificación', exact: true }).click()
    const estado = page.getByRole('dialog', { name: 'Planificación mensual' })
    await expect(estado.getByText('Pendiente')).toBeVisible()
    await estado.getByRole('button', { name: 'Comenzar planificación' }).click()
    const asistente = page.getByRole('dialog', { name: /^Planificación · / })
    await expect(asistente.getByRole('heading', { name: /Prepara tus fondos de/ })).toBeVisible()
    await asistente.getByRole('checkbox', { name: 'Copiar Bebé' }).uncheck()
    await asistente.getByRole('checkbox', { name: 'Copiar Familia' }).uncheck()
    await asistente.getByRole('button', { name: 'Confirmar fondos' }).click()
    await expect(page.getByText(/3 fondos copiados/)).toBeVisible()
    expect(nFondos(SIG)).toBe(3)
    await expect.poll(() => plan(SIG, 'funds_stage')).toBe('done')
    expect(plan(SIG, 'status')).toBe('in_progress')
    await page.keyboard.press('Escape')

    // Al volver: sigue en progreso y retoma donde se quedó.
    await page.getByRole('button', { name: 'Planificación', exact: true }).click()
    const estado2 = page.getByRole('dialog', { name: 'Planificación mensual' })
    await expect(estado2.getByText('En progreso')).toBeVisible()
    await estado2.getByRole('button', { name: 'Continuar planificación' }).click()
    await expect(page.getByRole('dialog', { name: /^Planificación · / }).getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    expect(nFondos(SIG)).toBe(3) // retomar no duplica nada
  })

  test('G · asistente completo: fondos, gastos y finalización sin crear nada extra', async ({ page }) => {
    await iniciarSesion(page)
    const gastosAntes = sqlLocal(`select count(*) from public.expenses where household_id = ${HID}`)
    await page.goto(`/fondos?mes=${SIG}`)
    await page.getByRole('button', { name: 'Abrir planificación mensual' }).click()
    const a = page.getByRole('dialog', { name: /^Planificación · / })
    await a.getByRole('button', { name: 'Confirmar fondos' }).click()
    await expect(page.getByText(/5 fondos copiados/)).toBeVisible()
    await a.getByRole('button', { name: 'Continuar' }).click()
    await expect(a.getByRole('heading', { name: /Prepara tus gastos de/ })).toBeVisible()
    await expect(a.getByText('Una plantilla es una configuración reutilizable, no un gasto', { exact: false })).toBeVisible()
    await a.getByRole('button', { name: 'Omitir etapa' }).click()
    await expect(a.getByRole('heading', { name: /Resumen de planificación/ })).toBeVisible()
    await expect(a.getByRole('button', { name: 'Finalizar planificación' })).toBeEnabled()
    await a.getByRole('button', { name: 'Finalizar planificación' }).click()
    await expect(page.getByText(/finalizada/)).toBeVisible()
    expect(plan(SIG, 'status')).toBe('completed')
    expect(plan(SIG, 'funds_stage')).toBe('done')
    expect(plan(SIG, 'expenses_stage')).toBe('skipped') // la etapa omitida queda identificada
    expect(plan(SIG, 'completed_at')).not.toBe('')
    expect(sqlLocal(`select count(*) from public.expenses where household_id = ${HID}`)).toBe(gastosAntes) // finalizar no crea gastos
    expect(nFondos(SIG)).toBe(5)
    await page.getByRole('button', { name: 'Planificación', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Planificación mensual' }).getByText('Completada')).toBeVisible()
  })

  test('J · la copia y el asistente caben en pantallas pequeñas y en modo oscuro', async ({ page }) => {
    await iniciarSesion(page)
    for (const [w, h] of [[320, 640], [390, 844], [768, 1024]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`/fondos?mes=${SIG}`)
      await expect(page.getByText(/Todavía no tienes fondos configurados/)).toBeVisible()
      expect(await sinDesborde(page), `Fondos vacío ${w}px`).toBeLessThanOrEqual(1)
      await page.getByRole('button', { name: 'Copiar fondos del mes anterior' }).click()
      const d = page.getByRole('dialog', { name: 'Copiar fondos de otro mes' })
      await expect(d.getByRole('button', { name: /Copiar \d+ fondos?/ })).toBeVisible()
      const caja = await d.boundingBox()
      expect(caja!.x).toBeGreaterThanOrEqual(-1)
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(w + 1)
      await d.getByRole('button', { name: 'Cancelar' }).click()
      await page.getByRole('button', { name: 'Abrir planificación mensual' }).click()
      const a = page.getByRole('dialog', { name: /^Planificación · / })
      await expect(a.getByRole('button', { name: 'Confirmar fondos' })).toBeVisible()
      const c2 = await a.boundingBox()
      expect(c2!.x + c2!.width).toBeLessThanOrEqual(w + 1)
      expect(await sinDesborde(page), `asistente ${w}px`).toBeLessThanOrEqual(1)
      await page.keyboard.press('Escape')
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Abrir planificación mensual' }).click()
    await expect(page.getByRole('dialog', { name: /^Planificación · / })).toBeVisible()
  })

  for (const tema of ['light', 'dark'] as const) {
    test(`accesibilidad (axe) del estado vacío, la copia, el estado y el asistente, tema ${tema}`, async ({ page }) => {
      test.setTimeout(90_000)
      await iniciarSesion(page)
      await page.goto(`/fondos?mes=${SIG}`)
      await page.evaluate((v) => document.documentElement.setAttribute('data-theme', v), tema)
      const auditar = async (contexto: string) => {
        await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze()
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`), `${contexto} (${tema})`).toEqual([])
      }
      await expect(page.getByText(/Todavía no tienes fondos configurados/)).toBeVisible()
      await auditar('Fondos de un mes sin fondos')
      await page.getByRole('button', { name: 'Copiar fondos del mes anterior' }).click()
      await expect(page.getByRole('dialog', { name: 'Copiar fondos de otro mes' }).getByRole('checkbox', { name: 'Copiar Hogar' })).toBeVisible()
      await auditar('Copiar fondos')
      await page.getByRole('button', { name: 'Cancelar' }).click()
      await page.getByRole('button', { name: 'Planificación', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Planificación mensual' })).toBeVisible()
      await auditar('Estado de planificación')
      await page.getByRole('button', { name: 'Comenzar planificación' }).click()
      await expect(page.getByRole('dialog', { name: /^Planificación · / }).getByRole('button', { name: 'Confirmar fondos' })).toBeVisible()
      await auditar('Asistente, etapa 1')
      await page.getByRole('button', { name: 'Continuar' }).click()
      await auditar('Asistente, etapa 2')
      await page.getByRole('button', { name: 'Omitir etapa' }).click()
      await auditar('Asistente, etapa 3')
    })
  }
})
