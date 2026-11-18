import { test, expect } from './fixtures'
import { E2E_UID, sqlLocal } from './db'
import { elegirEnGasto, email, iniciarSesion, password, vigilarConsola } from './helpers'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

function historial() {
  sqlLocal(`begin; set local role authenticated;
    select set_config('request.jwt.claims','{"sub":"${E2E_UID}","role":"authenticated"}',true);
    with contexto as (
      select a.id as ambito, c.id as categoria, s.id as subcategoria,
        (select id from public.medios_pago where name='Efectivo' limit 1) as medio
      from public.ambitos a join public.categorias c on c.ambito_id=a.id join public.subcategorias s on s.categoria_id=c.id
      where a.name='Personal' and c.name='Alimentación' and s.name='Bebidas'
    ) select public.create_expense(jsonb_build_object('description','Bebida frecuente '||i,'amount',1,'expense_date',current_date,
      'ambito_id',ambito,'categoria_id',categoria,'subcategoria_id',subcategoria,'payment_method_id',medio,'expense_type','variable','is_recurring',false),gen_random_uuid())
      from contexto cross join generate_series(1,12) i cross join lateral generate_series(1,13-i) j;
    commit;`)
}
async function nuevo(page: Page) {
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).first().click()
  const dialogo = page.getByRole('dialog')
  await elegirEnGasto(dialogo, 'Ámbito', 'Personal')
  await elegirEnGasto(dialogo, 'Categoría', 'Alimentación')
  await elegirEnGasto(dialogo, 'Subcategoría (opcional)', 'Bebidas')
  return dialogo
}

test.describe('Descripciones frecuentes', () => {
  test.skip(!email || !password, 'Requiere la cuenta E2E propia')
  test('historial real: chips, frecuencia, búsqueda, selección y contexto sin autocompletar', async ({ page }) => {
    historial()
    const errores = vigilarConsola(page)
    await iniciarSesion(page)
    const d = await nuevo(page)
    const input = d.getByLabel('Descripción', { exact: true })
    const grupo = d.getByRole('group', { name: 'Tus descripciones frecuentes' })
    await expect(input).toHaveValue('')
    await expect(grupo.getByRole('button', { name: /^Usar / })).toHaveCount(5)
    await expect(grupo.getByRole('button', { name: 'Usar Bebida frecuente 1 12 registros', exact: true })).toBeVisible()
    const accesibilidad = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(accesibilidad.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
    await page.screenshot({ path: 'qa/descripciones-escritorio.png' })
    await grupo.getByRole('button', { name: 'Ver más' }).click()
    await expect(grupo.getByRole('button', { name: /^Usar / })).toHaveCount(10)
    await grupo.getByRole('button', { name: 'Ver menos' }).click()
    await input.fill('frecuente 12')
    await expect(grupo.getByRole('button', { name: /^Usar / })).toHaveCount(1)
    const chip = grupo.getByRole('button', { name: 'Usar Bebida frecuente 12 1 registro', exact: true })
    await chip.focus()
    await page.keyboard.press('Enter')
    await expect(input).toHaveValue('Bebida frecuente 12')
    await expect(d).toBeVisible()
    await elegirEnGasto(d, 'Categoría', 'Transporte')
    await expect(input).toHaveValue('Bebida frecuente 12')
    await expect(grupo).toHaveCount(0)
    expect(errores).toEqual([])
  })

  test('un fallo de red en las sugerencias permite escribir y conservar los demás campos', async ({ page }) => {
    await page.route('**/rest/v1/rpc/sugerencias_descripciones', (route) => route.abort('connectionrefused'))
    await iniciarSesion(page)
    const d = await nuevo(page)
    await d.getByLabel('Descripción', { exact: true }).fill('Descripción manual')
    await expect(d.getByLabel('Descripción', { exact: true })).toHaveValue('Descripción manual')
    await expect(d.getByRole('group', { name: 'Tus descripciones frecuentes' })).toHaveCount(0)
    await expect(d.getByRole('button', { name: 'Guardar gasto' })).toBeEnabled()
  })

  test('fondos: cobertura efectiva y medios de pago determinan las sugerencias', async ({ page }) => {
    sqlLocal(`begin; set local role authenticated;
      select set_config('request.jwt.claims','{"sub":"${E2E_UID}","role":"authenticated"}',true);
      select public.save_fund(jsonb_build_object('name','Cobertura sugerencias '||i,'description','Presupuesto de prueba personal',
        'is_general',false,'is_active',true,'default_amount',10,'period_id',(public.ensure_period_rpc(current_date)).id,'period_amount',10,
        'scope_rules',jsonb_build_array(jsonb_build_object('kind','ambito','ref',(select id from public.ambitos where name='Personal'),'effect','include')),'payment_rules','[]'::jsonb)) from generate_series(1,2) i;
      commit;`)
    await iniciarSesion(page)
    await page.goto('/fondos')
    await page.getByRole('button', { name: 'Nuevo fondo', exact: true }).click()
    const d = page.getByRole('dialog')
    const input = d.getByLabel('Descripción (opcional)', { exact: true })
    await expect(d.getByRole('group', { name: 'Tus descripciones frecuentes' })).toHaveCount(0)
    await d.getByRole('radiogroup', { name: 'Regla para Personal', exact: true }).getByRole('radio', { name: /Incluir/ }).click()
    await d.getByRole('button', { name: 'Usar Presupuesto de prueba personal 2 registros', exact: true }).click()
    await expect(input).toHaveValue('Presupuesto de prueba personal')
    await d.getByRole('radiogroup', { name: 'Regla para Yape', exact: true }).getByRole('radio', { name: /Incluir/ }).click()
    await expect(d.getByRole('group', { name: 'Tus descripciones frecuentes' })).toHaveCount(0)
    await expect(input).toHaveValue('Presupuesto de prueba personal')
  })

  test('chips largos en claro y oscuro sin desbordar en los nueve anchos', async ({ page }) => {
    await page.route('**/rest/v1/rpc/sugerencias_descripciones', (route) => route.fulfill({ json: Array.from({ length: 10 }, (_, i) => ({
      description: `Descripción ${i} ` + 'muy extensa '.repeat(12), frequency: 20 - i, last_used: '2026-11-16T10:00:00Z',
    })) }))
    await iniciarSesion(page)
    const d = await nuevo(page)
    for (const tema of ['light','dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
      for (const ancho of [320,360,375,390,414,428,768,1024,1440]) {
        await page.setViewportSize({ width: ancho, height: 844 })
        const grupo = d.getByRole('group', { name: 'Tus descripciones frecuentes' })
        await expect(grupo.getByRole('button', { name: /^Usar / })).toHaveCount(5)
        await d.getByLabel('Descripción', { exact: true }).focus()
        expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${tema} ${ancho}`).toBe(true)
        expect(await grupo.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${tema} chips ${ancho}`).toBe(true)
        await expect(d.getByRole('button', { name: 'Guardar gasto' })).toBeInViewport()
        if (ancho === 390) await page.screenshot({ path: `qa/descripciones-movil-${tema}.png` })
      }
    }
  })
})
