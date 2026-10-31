import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccesoSocial } from './AccesoSocial'

describe('AccesoSocial (solo visual)', () => {
  it('muestra Google y Facebook deshabilitados (sin etiquetas «Próximamente») y el separador «o continúa con»', () => {
    render(<AccesoSocial />)
    expect(screen.getByText('o continúa con')).toBeInTheDocument()
    const google = screen.getByRole('button', { name: 'Continuar con Google (no disponible por ahora)' })
    const facebook = screen.getByRole('button', { name: 'Continuar con Facebook (no disponible por ahora)' })
    expect(google).toBeDisabled()
    expect(facebook).toBeDisabled()
    expect(document.body.textContent).not.toMatch(/pr[óo]ximamente/i)
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    // Tooltip discreto en el contenedor (un botón deshabilitado no recibe el puntero)
    expect(google.parentElement).toHaveAttribute('title', 'Aún no disponible')
  })

  it('no ejecuta ninguna acción ni navega al pulsarlos', async () => {
    const alElegir = vi.fn()
    const antes = window.location.href
    // Aunque se pase un manejador, sin proveedores habilitados no se llama.
    render(<AccesoSocial alElegir={alElegir} />)
    await userEvent.click(screen.getByRole('button', { name: /Google/ }))
    await userEvent.click(screen.getByRole('button', { name: /Facebook/ }))
    expect(alElegir).not.toHaveBeenCalled()
    expect(window.location.href).toBe(antes)
  })

  it('los logotipos son decorativos y mantienen proporción 1:1 (misma caja)', () => {
    const { container } = render(<AccesoSocial />)
    const logos = container.querySelectorAll('button svg')
    expect(logos).toHaveLength(2)
    for (const l of logos) {
      expect(l).toHaveAttribute('aria-hidden', 'true')
      expect(l.getAttribute('class')).toContain('size-[1.4rem]')
    }
  })

  it('preparado para el futuro: un proveedor habilitado con manejador deja de estar deshabilitado y responde', async () => {
    const alElegir = vi.fn()
    render(<AccesoSocial disponibles={new Set(['google'])} alElegir={alElegir} />)
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }))
    expect(alElegir).toHaveBeenCalledWith('google')
    expect(screen.getByRole('button', { name: 'Continuar con Facebook (no disponible por ahora)' })).toBeDisabled()
  })

  it('los dos botones comparten fila y tamaño (misma altura) y se apilan solo si no caben', () => {
    const { container } = render(<AccesoSocial />)
    const rejilla = container.querySelector('.grid') as HTMLElement
    expect(rejilla.className).toContain('@min-[17rem]:grid-cols-2')
    expect(rejilla.className).toContain('grid-cols-1')
    for (const b of container.querySelectorAll('button')) expect(b.className).toContain('h-[3.25rem]')
  })
})
