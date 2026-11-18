import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DescripcionInteligente } from './DescripcionInteligente'
import { claveContexto, normalizarDescripcion, type ContextoDescripcion } from './contexto'

const mocks = vi.hoisted(() => ({ sugerencias: vi.fn() }))
vi.mock('./useSugerenciasDescripcion', () => ({ useSugerenciasDescripcion: mocks.sugerencias }))
const contexto: ContextoDescripcion = { tipo: 'expense', ambito_id: 'a', categoria_id: 'c', subcategoria_id: 's' }
function Formulario({ ctx = contexto, inicial = '' }: { ctx?: ContextoDescripcion; inicial?: string }) {
  const [valor, setValor] = useState(inicial)
  return <form onSubmit={(e) => { e.preventDefault(); throw new Error('No debe guardar al elegir un chip') }}>
    <DescripcionInteligente aria-label="Descripción" contexto={ctx} value={valor} onValueChange={setValor} />
    <input aria-label="Importe" defaultValue="25.00" />
  </form>
}
beforeEach(() => mocks.sugerencias.mockReturnValue(Array.from({ length: 10 }, (_, i) => ({ description: `Descripción ${i}`, frequency: 20 - i, last_used: '2026-11-16' }))))

describe('descripciones inteligentes', () => {
  it('muestra cinco, permite expandir diez y volver a cinco', () => {
    render(<Formulario />)
    const grupo = screen.getByRole('group', { name: 'Tus descripciones frecuentes' })
    expect(within(grupo).getAllByRole('button', { name: /^Usar / })).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(within(grupo).getAllByRole('button', { name: /^Usar / })).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Ver menos' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }))
    expect(within(grupo).getAllByRole('button', { name: /^Usar / })).toHaveLength(5)
  })
  it('seleccionar un chip cambia solo la descripción y permite seguir editando', () => {
    render(<Formulario inicial="Original" />)
    fireEvent.click(screen.getByRole('button', { name: 'Usar Descripción 0 20 registros' }))
    expect(screen.getByLabelText('Descripción')).toHaveValue('Descripción 0')
    expect(screen.getByLabelText('Importe')).toHaveValue('25.00')
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Otra' } })
    expect(screen.getByLabelText('Descripción')).toHaveValue('Otra')
    expect(screen.getByLabelText('Descripción')).toHaveAttribute('autocomplete', 'off')
  })
  it('sin sugerencias o con servicio fallido el input conserva su valor y no deja encabezados vacíos', () => {
    mocks.sugerencias.mockReturnValue([])
    render(<Formulario inicial="Conservar" />)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.queryByText('Tus descripciones frecuentes:')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Descripción')).toHaveValue('Conservar')
  })
  it('cambiar de contexto conserva el texto y contrae las sugerencias', () => {
    const { rerender } = render(<Formulario inicial="Conservar" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }))
    rerender(<Formulario ctx={{ ...contexto, subcategoria_id: 'otra' }} inicial="Conservar" />)
    expect(screen.getByLabelText('Descripción')).toHaveValue('Conservar')
    expect(screen.getAllByRole('button', { name: /^Usar / })).toHaveLength(5)
  })
  it('con una sola sugerencia no ofrece expansión', () => {
    mocks.sugerencias.mockReturnValue([{ description: 'Agua', frequency: 1 }])
    render(<Formulario />)
    expect(screen.getByRole('button', { name: 'Usar Agua 1 registro' })).toHaveAttribute('type', 'button')
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
  })
})

describe('normalización y contexto', () => {
  it('unifica espacios, vocales acentuadas y Unicode sin unir conceptos distintos', () => {
    expect(normalizarDescripcion(' \t ÁGUA   mineral \n')).toBe('agua mineral')
    expect(normalizarDescripcion('Cafe\u0301')).toBe('cafe')
    expect(normalizarDescripcion('Año')).not.toBe(normalizarDescripcion('Ano'))
    expect(normalizarDescripcion('Gas')).not.toBe(normalizarDescripcion('Gasolina'))
  })
  it('el orden de reglas no cambia la caché de fondos', () => {
    const ctx: ContextoDescripcion = { tipo: 'fund', is_general: false, listo: true, scope_rules: [
      { kind: 'ambito', ref: 'a', effect: 'include' }, { kind: 'categoria', ref: 'c', effect: 'exclude' },
    ], payment_rules: [{ method: 'm', effect: 'include' }] }
    expect(claveContexto(ctx)).toBe(claveContexto({ ...ctx, scope_rules: [...ctx.scope_rules].reverse() }))
    expect(claveContexto(ctx)).not.toBe(claveContexto({ ...ctx, is_general: true }))
  })
})
