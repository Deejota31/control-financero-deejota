import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  remove: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ remove: h.remove }) }, rpc: h.rpc },
}))

import { borrarArchivo, procesarLimpieza, registrarLimpieza } from './comprobantes'

beforeEach(() => {
  h.remove.mockReset()
  h.rpc.mockReset()
  localStorage.clear()
})

describe('borrarArchivo', () => {
  it('borra el archivo y no deja tareas pendientes', async () => {
    h.remove.mockResolvedValue({ data: [], error: null })
    expect(await borrarArchivo('h/g/a.pdf')).toBe(true)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('si el borrado falla, registra una tarea de limpieza en el servidor', async () => {
    h.remove.mockResolvedValue({ data: null, error: new Error('fallo') })
    h.rpc.mockResolvedValue({ data: 1, error: null })
    expect(await borrarArchivo('h/g/a.pdf')).toBe(false)
    expect(h.rpc).toHaveBeenCalledWith('registrar_limpieza', { p_paths: ['h/g/a.pdf'], p_reason: 'compensacion', p_demora_min: 0 })
  })

  it('si tampoco se puede registrar en el servidor, queda en una cola local reintentable', async () => {
    h.remove.mockRejectedValue(new TypeError('Failed to fetch'))
    h.rpc.mockRejectedValue(new TypeError('Failed to fetch'))
    await borrarArchivo('h/g/a.pdf')
    expect(JSON.parse(localStorage.getItem('gd-limpieza-pendiente')!)).toEqual(['h/g/a.pdf'])
  })
})

describe('registrarLimpieza', () => {
  it('una intención que no se pudo registrar no ensucia la cola local', async () => {
    h.rpc.mockRejectedValue(new Error('sin red'))
    expect(await registrarLimpieza(['h/g/b.pdf'], 'intencion', 10)).toBe(false)
    expect(localStorage.getItem('gd-limpieza-pendiente')).toBeNull()
  })
})

describe('procesarLimpieza', () => {
  it('vuelca la cola local, borra lo huérfano y completa las tareas', async () => {
    localStorage.setItem('gd-limpieza-pendiente', JSON.stringify(['h/g/local.pdf']))
    h.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'listar_limpieza') return { data: [{ id: 't1', path: 'h/g/a.pdf' }, { id: 't2', path: 'h/g/b.pdf' }], error: null }
      return { data: 1, error: null }
    })
    h.remove.mockResolvedValue({ data: [], error: null })
    const r = await procesarLimpieza()
    expect(r).toEqual({ borrados: 2, fallidos: 0 })
    expect(h.rpc).toHaveBeenCalledWith('registrar_limpieza', expect.objectContaining({ p_paths: ['h/g/local.pdf'] }))
    expect(h.rpc).toHaveBeenCalledWith('completar_limpieza', { p_ids: ['t1', 't2'] })
    expect(localStorage.getItem('gd-limpieza-pendiente')).toBe('[]')
  })

  it('un borrado que falla se reporta para reintentar y no se marca como completado', async () => {
    h.rpc.mockImplementation(async (fn: string) => (fn === 'listar_limpieza' ? { data: [{ id: 't1', path: 'h/g/a.pdf' }], error: null } : { data: 1, error: null }))
    h.remove.mockResolvedValue({ data: null, error: new Error('storage caído') })
    expect(await procesarLimpieza()).toEqual({ borrados: 0, fallidos: 1 })
    expect(h.rpc).toHaveBeenCalledWith('fallo_limpieza', { p_ids: ['t1'], p_error: 'storage caído' })
    expect(h.rpc).not.toHaveBeenCalledWith('completar_limpieza', expect.anything())
  })

  it('no hace nada si no hay tareas', async () => {
    h.rpc.mockResolvedValue({ data: [], error: null })
    expect(await procesarLimpieza()).toEqual({ borrados: 0, fallidos: 0 })
    expect(h.remove).not.toHaveBeenCalled()
  })
})
