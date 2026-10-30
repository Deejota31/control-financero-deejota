import { describe, expect, it, vi } from 'vitest'
import { ResultadoIncompletoError, leerTodo } from './leerTodo'

/** Simula PostgREST con `max_rows`: nunca devuelve más de `maxRows` filas por respuesta. */
function servidor(total: number, maxRows: number) {
  const filas = Array.from({ length: total }, (_, i) => i)
  return vi.fn(async (desde: number, hasta: number) => ({
    data: filas.slice(desde, Math.min(hasta + 1, desde + maxRows)),
    error: null,
    count: total,
  }))
}

describe('leerTodo', () => {
  it('lee más de 5,000 filas en varias páginas sin perder ninguna', async () => {
    const pagina = servidor(6200, 1000)
    const r = await leerTodo(pagina)
    expect(r).toHaveLength(6200)
    expect(r[0]).toBe(0)
    expect(r.at(-1)).toBe(6199)
    expect(pagina).toHaveBeenCalledTimes(7)
  })

  it('con un total exacto múltiplo de la página no hace una página extra innecesaria', async () => {
    const pagina = servidor(2000, 1000)
    expect(await leerTodo(pagina)).toHaveLength(2000)
    expect(pagina).toHaveBeenCalledTimes(2)
  })

  it('devuelve vacío cuando no hay filas', async () => {
    expect(await leerTodo(servidor(0, 1000))).toEqual([])
  })

  it('se adapta a un máximo por respuesta menor que el tamaño de página', async () => {
    const r = await leerTodo(servidor(2500, 400), { tam: 1000 })
    expect(r).toHaveLength(2500)
    expect(new Set(r).size).toBe(2500)
  })

  it('falla en lugar de devolver un resultado parcial si el servidor declara más filas de las que entrega', async () => {
    const mentiroso = vi.fn(async (desde: number) => ({ data: desde < 2000 ? Array.from({ length: 1000 }, (_, i) => desde + i) : [], error: null, count: 3000 }))
    await expect(leerTodo(mentiroso)).rejects.toBeInstanceOf(ResultadoIncompletoError)
  })

  it('propaga los errores del servidor', async () => {
    const pagina = vi.fn(async () => ({ data: null, error: { message: 'boom' }, count: null }))
    await expect(leerTodo(pagina)).rejects.toMatchObject({ message: 'boom' })
  })

  it('aplica un máximo de seguridad en vez de leer sin fin', async () => {
    await expect(leerTodo(servidor(5000, 1000), { maximo: 3000 })).rejects.toBeInstanceOf(ResultadoIncompletoError)
  })
})
