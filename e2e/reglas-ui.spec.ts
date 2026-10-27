import { expect, test } from './fixtures'
import { email, iniciarSesion, password, sufijo } from './helpers'

test.describe('Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas', () => {
  test.skip(!email || !password, 'Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.local')

  test('los radios de regla cambian con flechas, Inicio y Fin y solo uno entra en el orden de tabulación', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/fondos')
    await page.getByRole('button', { name: 'Nuevo fondo' }).click()
    const d = page.getByRole('dialog')
    const grupo = d.getByRole('radiogroup', { name: 'Regla para Hogar', exact: true })
    const r = (n: string) => grupo.getByRole('radio', { name: n })
    await expect(r('Sin regla')).toHaveAttribute('aria-checked', 'true')
    await expect(grupo.locator('[tabindex="0"]')).toHaveCount(1)
    await r('Sin regla').focus()
    await page.keyboard.press('ArrowRight')
    await expect(r('Incluir')).toHaveAttribute('aria-checked', 'true')
    await expect(r('Incluir')).toBeFocused()
    await page.keyboard.press('End')
    await expect(r('Excluir')).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('ArrowRight') // da la vuelta
    await expect(r('Sin regla')).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(r('Excluir')).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Home')
    await expect(r('Sin regla')).toHaveAttribute('aria-checked', 'true')
    // El estado no depende solo del color: el seleccionado lleva su texto y una marca
    await page.keyboard.press('ArrowRight')
    await expect(r('Incluir')).toContainText('✓')
    await expect(grupo.locator('[tabindex="0"]')).toHaveCount(1)
  })

  test('contraer una rama no borra reglas, muestra su resumen y un ámbito incluido puede contraerse', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/fondos')
    await page.getByRole('button', { name: 'Nuevo fondo' }).click()
    const d = page.getByRole('dialog')
    await d.getByRole('radiogroup', { name: 'Regla para Hogar', exact: true }).getByRole('radio', { name: 'Incluir' }).click()
    const rama = d.getByRole('button', { name: /^(Expandir|Contraer) Hogar$/ })
    await expect(rama).toHaveAttribute('aria-expanded', 'false') // incluir no la expande
    await rama.click()
    await expect(rama).toHaveAttribute('aria-expanded', 'true')
    await d.getByRole('radiogroup', { name: /^Regla para Hogar › Servicios$/ }).getByRole('radio', { name: 'Excluir' }).click()
    await rama.click()
    await expect(rama).toHaveAttribute('aria-expanded', 'false')
    await expect(rama).toContainText('✕ 1') // resumen de lo que hay dentro de la rama cerrada
    await rama.click()
    await expect(d.getByRole('radiogroup', { name: /^Regla para Hogar › Servicios$/ }).getByRole('radio', { name: 'Excluir' })).toHaveAttribute('aria-checked', 'true')
    await expect(d.getByRole('radiogroup', { name: 'Regla para Hogar', exact: true }).getByRole('radio', { name: 'Incluir' })).toHaveAttribute('aria-checked', 'true')
    // Búsqueda con contexto
    await d.getByLabel('Buscar en la clasificación').fill('luz')
    await expect(d.getByRole('radiogroup', { name: /Hogar › Servicios › Luz/ })).toBeVisible()
  })

  test('con cambios sin guardar, Escape, X y Cancelar piden confirmar; Seguir editando conserva el borrador y el foco vuelve al disparador', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/fondos')
    const disparador = page.getByRole('button', { name: 'Nuevo fondo' })
    await disparador.click()
    const d = page.getByRole('dialog', { name: 'Nuevo fondo' })
    await d.getByLabel('Nombre').fill(`Borrador ${sufijo()}`)
    for (const cerrar of [() => page.keyboard.press('Escape'), () => d.getByRole('button', { name: 'Cerrar' }).click(), () => d.getByRole('button', { name: 'Cancelar' }).click()]) {
      await cerrar()
      const c = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' })
      await expect(c).toBeVisible()
      await c.getByRole('button', { name: 'Seguir editando' }).click()
      await expect(d).toBeVisible()
      await expect(d.getByLabel('Nombre')).toHaveValue(/^Borrador /)
    }
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Descartar cambios' }).click()
    await expect(d).toBeHidden()
    await expect(disparador).toBeFocused()
    // Sin cambios, cierra directo
    await disparador.click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('abrir y cerrar diálogos y selectores de inmediato no hace desaparecer el siguiente', async ({ page }) => {
    await iniciarSesion(page)
    await page.goto('/fondos')
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: 'Nuevo fondo' }).click()
      const d = page.getByRole('dialog', { name: 'Nuevo fondo' })
      await d.getByRole('button', { name: /^Apariencia/ }).click()
      await d.getByRole('button', { name: /Cambiar icono/ }).click()
      await expect(d.getByRole('group', { name: 'Explorador de íconos' })).toBeVisible()
      await page.keyboard.press('Escape') // contrae el explorador, no cierra el diálogo
      await d.getByRole('button', { name: /Cambiar icono/ }).click() // y se vuelve a abrir al instante
      await expect(d.getByRole('group', { name: 'Explorador de íconos' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(d).toBeVisible()
      await d.getByRole('button', { name: 'Cancelar' }).click()
      await expect(page.getByRole('dialog')).toBeHidden()
    }
    for (let i = 0; i < 6; i++) {
      await page.locator('button.fab-gasto:visible').click()
      await expect(page.getByRole('dialog', { name: 'Nuevo gasto' })).toBeVisible()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Nuevo fondo' }).click()
      await expect(page.getByRole('dialog', { name: 'Nuevo fondo' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toBeHidden()
    }
  })
})
