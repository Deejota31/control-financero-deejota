import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { parseImporte } from '@/lib/format'
import { MoneyInput } from './MoneyInput'

function Campo({ inicial = '' }: { inicial?: string }) {
  const [v, setV] = useState(inicial)
  return (
    <>
      <MoneyInput aria-label="Importe" value={v} onChange={setV} />
      <output data-testid="guardado">{String(parseImporte(v))}</output>
    </>
  )
}

async function escribirYSalir(texto: string) {
  const u = userEvent.setup()
  render(<Campo />)
  const campo = screen.getByLabelText('Importe')
  await u.type(campo, texto)
  await u.tab()
  return campo as HTMLInputElement
}

describe('MoneyInput: lo mostrado coincide con lo que se guardaría', () => {
  it.each([
    ['12,50', '12.50', '12.5'],
    ['12.50', '12.50', '12.5'],
    ['12,5', '12.50', '12.5'],
    ['1.234,56', '1234.56', '1234.56'],
    ['1,234.56', '1234.56', '1234.56'],
    ['S/ 7', '7.00', '7'],
  ])('%s se normaliza a %s y se guarda como %s (nunca ×100)', async (escrito, mostrado, guardado) => {
    const campo = await escribirYSalir(escrito)
    expect(campo.value).toBe(mostrado)
    expect(screen.getByTestId('guardado').textContent).toBe(guardado)
  })

  it.each(['1,250', '12,3456', '1,23,456', 'abc', '-5', '0'])('%s no se transforma al salir: el texto queda para corregirlo', async (escrito) => {
    const campo = await escribirYSalir(escrito)
    expect(campo.value).toBe(escrito)
    expect(screen.getByTestId('guardado').textContent).toBe('null')
  })
})
