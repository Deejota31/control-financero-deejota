import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { PasswordInput } from './PasswordInput'

function Campo() {
  const [v, setV] = useState('')
  return <PasswordInput aria-label="Contraseña" value={v} onChange={(e) => setV(e.target.value)} />
}

describe('PasswordInput', () => {
  it('está enmascarado por defecto y el botón lo muestra y oculta sin perder el valor ni el foco', async () => {
    render(<Campo />)
    const campo = screen.getByLabelText('Contraseña', { exact: true })
    expect(campo).toHaveAttribute('type', 'password')
    await userEvent.type(campo, 'secreto123')
    const boton = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(boton).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(boton)
    expect(campo).toHaveAttribute('type', 'text')
    expect(campo).toHaveValue('secreto123')
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
    expect(campo).toHaveValue('secreto123')
  })

  it('el botón es de tipo button: no envía el formulario', async () => {
    let enviado = false
    render(<form onSubmit={(e) => { e.preventDefault(); enviado = true }}><PasswordInput aria-label="Contraseña" /></form>)
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(enviado).toBe(false)
  })
})
