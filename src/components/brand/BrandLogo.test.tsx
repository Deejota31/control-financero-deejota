import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MARCA, tituloPagina } from '@/lib/marca'
import { BrandLogo } from './BrandLogo'

describe('BrandLogo', () => {
  it('completo: muestra el nombre oficial y el isotipo es decorativo (no se lee dos veces)', () => {
    const { container } = render(<BrandLogo variante="completo" />)
    expect(screen.getByText('Control Financiero')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('isotipo solo: lleva el nombre accesible y no muestra texto', () => {
    render(<BrandLogo variante="isotipo" tamano={28} />)
    const img = screen.getByRole('img', { name: MARCA.nombre })
    expect(img).toHaveAttribute('width', '28')
    expect(img).toHaveAttribute('height', '28') // proporción 1:1: nunca se deforma
    expect(screen.queryByText('Control Financiero')).toBeNull()
  })

  it('los colores salen de los tokens del tema (claro y oscuro sin versiones aparte); mono hereda el color del texto', () => {
    const { container, rerender } = render(<BrandLogo variante="isotipo" tono="color" />)
    expect(container.querySelector('rect')).toHaveAttribute('fill', 'var(--pri)')
    expect(container.querySelector('path')).toHaveAttribute('stroke', 'var(--pri-fg)')
    rerender(<BrandLogo variante="isotipo" tono="aurora" />)
    expect(container.querySelector('rect')?.getAttribute('fill')).toMatch(/^url\(#.+\)$/) // azulejo degradado con id único
    expect(container.querySelector('linearGradient')).not.toBeNull()
    rerender(<BrandLogo variante="isotipo" tono="mono" />)
    expect(container.querySelector('path')).toHaveAttribute('stroke', 'currentColor')
  })

  it('el tamaño configurable escala el isotipo y el nombre a la vez', () => {
    const { container } = render(<BrandLogo variante="completo" tamano={60} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '60')
    expect((screen.getByText('Control Financiero') as HTMLElement).style.fontSize).toBe('33px')
  })
})

describe('marca', () => {
  it('el nombre oficial es Control Financiero y los títulos de pestaña lo llevan', () => {
    expect(MARCA.nombre).toBe('Control Financiero')
    expect(tituloPagina()).toBe('Control Financiero')
    expect(tituloPagina('Gastos')).toBe('Gastos | Control Financiero')
    expect(tituloPagina('Iniciar sesión')).toBe('Iniciar sesión | Control Financiero')
  })
  it('no conserva ningún nombre anterior', () => {
    expect(JSON.stringify(MARCA)).not.toMatch(/deejota|gasto deejota/i)
  })
})
