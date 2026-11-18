import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))
const { consultarCotizacion, normalizarCotizacion, olvidarCotizaciones } = await import('./cotizaciones')

const buena = { rate: 3.419, reference_date: '2026-11-16', source: 'BCRP:PD04640PD', fetched_at: '2026-11-18T12:00:00Z' }

describe('normalizarCotizacion', () => {
  it('devuelve la tasa como texto aunque la base la entregue como número', () => {
    expect(normalizarCotizacion(buena, '2026-11-18')).toEqual({ ...buena, rate: '3.419' })
  })
  it('rechaza tasas inválidas, fechas posteriores a la pedida y respuestas sin fuente', () => {
    expect(() => normalizarCotizacion({ ...buena, rate: 0 }, '2026-11-18')).toThrow('cotización válida')
    expect(() => normalizarCotizacion({ ...buena, rate: 'n.d.' }, '2026-11-18')).toThrow()
    expect(() => normalizarCotizacion({ ...buena, rate: -3 }, '2026-11-18')).toThrow()
    expect(() => normalizarCotizacion({ ...buena, reference_date: '2026-11-19' }, '2026-11-18')).toThrow()
    expect(() => normalizarCotizacion({ ...buena, source: '' }, '2026-11-18')).toThrow()
    expect(() => normalizarCotizacion(null, '2026-11-18')).toThrow()
  })
})

describe('consultarCotizacion', () => {
  beforeEach(() => { invoke.mockReset(); olvidarCotizaciones() })
  it('deduplica consultas simultáneas y reutiliza la caché', async () => {
    invoke.mockResolvedValue({ data: buena, error: null })
    const [a, b] = await Promise.all([consultarCotizacion('2026-11-18'), consultarCotizacion('2026-11-18')])
    await consultarCotizacion('2026-11-18')
    expect(a).toEqual(b)
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('no cachea un error: el siguiente intento vuelve a consultar', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('offline') }).mockResolvedValueOnce({ data: buena, error: null })
    await expect(consultarCotizacion('2026-11-17')).rejects.toThrow('No se pudo consultar')
    await expect(consultarCotizacion('2026-11-17')).resolves.toMatchObject({ rate: '3.419' })
    expect(invoke).toHaveBeenCalledTimes(2)
  })
  it('una respuesta inválida del proveedor nunca llega a la pantalla', async () => {
    invoke.mockResolvedValue({ data: { ...buena, rate: 0 }, error: null })
    await expect(consultarCotizacion('2026-11-16')).rejects.toThrow('cotización válida')
  })
})
