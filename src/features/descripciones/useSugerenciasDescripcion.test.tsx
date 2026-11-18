import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextoDescripcion } from './contexto'
import { useSugerenciasDescripcion } from './useSugerenciasDescripcion'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), uid: 'usuario-a' }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.uid ? { id: mocks.uid } : null }) }))
// El debounce se prueba aparte; aquí interesa el ciclo de datos y la identidad.
vi.mock('@/lib/useDebounced', () => ({ useDebounced: <T,>(v: T) => v }))
const contexto: ContextoDescripcion = { tipo: 'expense', ambito_id: 'a', categoria_id: 'c', subcategoria_id: 's' }
const dato = { description: 'Agua', frequency: 2, last_used: '2026-11-16T10:00:00Z' }
function preparar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return { cliente, wrapper }
}
beforeEach(() => {
  mocks.uid = 'usuario-a'
  mocks.rpc.mockReset().mockReturnValue({ abortSignal: () => Promise.resolve({ data: [dato], error: null }) })
})

describe('consultas de sugerencias', () => {
  it('cachea por contexto y usuario, normaliza la búsqueda y no consulta en cada render', async () => {
    const { wrapper, cliente } = preparar()
    const { result, rerender, unmount } = renderHook(() => useSugerenciasDescripcion(contexto, ' ÁGUA '), { wrapper })
    await waitFor(() => expect(result.current).toEqual([dato]))
    expect(mocks.rpc).toHaveBeenCalledWith('sugerencias_descripciones', expect.objectContaining({ p_tipo: 'expense', p_busqueda: 'agua' }))
    rerender()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    mocks.uid = 'usuario-b'
    rerender()
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2))
    unmount(); cliente.clear()
  })
  it('no consulta sin clasificación ni con cobertura incompleta', () => {
    const { wrapper, cliente } = preparar()
    const { result, rerender, unmount } = renderHook(({ ctx }) => useSugerenciasDescripcion(ctx, ''), {
      wrapper, initialProps: { ctx: { ...contexto, categoria_id: '' } as ContextoDescripcion },
    })
    expect(result.current).toEqual([])
    rerender({ ctx: { tipo: 'fund', is_general: false, scope_rules: [], payment_rules: [], listo: true } })
    expect(result.current).toEqual([])
    expect(mocks.rpc).not.toHaveBeenCalled()
    unmount(); cliente.clear()
  })
  it('descarta la respuesta anterior al cambiar rápido de contexto y propaga cancelación', async () => {
    let resolver!: (v: unknown) => void
    let senal!: AbortSignal
    mocks.rpc.mockReturnValueOnce({ abortSignal: (signal: AbortSignal) => { senal = signal; return new Promise((r) => { resolver = r }) } })
    const { wrapper, cliente } = preparar()
    const { result, rerender, unmount } = renderHook(({ ctx }) => useSugerenciasDescripcion(ctx, ''), { wrapper, initialProps: { ctx: contexto } })
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1))
    rerender({ ctx: { ...contexto, subcategoria_id: 'otra' } })
    await waitFor(() => expect(result.current).toEqual([dato]))
    expect(senal.aborted).toBe(true)
    await act(async () => resolver({ data: [{ ...dato, description: 'Obsoleto' }], error: null }))
    expect(result.current).toEqual([dato])
    unmount(); cliente.clear()
  })
  it('una respuesta inválida o un error de red omite chips sin bloquear el campo', async () => {
    mocks.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ ...dato, frequency: 0 }], error: null }) })
    const { wrapper, cliente } = preparar()
    const { result, unmount } = renderHook(() => useSugerenciasDescripcion(contexto, ''), { wrapper })
    await waitFor(() => expect(cliente.getQueryCache().getAll()[0]?.state.status).toBe('error'))
    expect(result.current).toEqual([])
    unmount(); cliente.clear()
  })
  it('invalidar el historial recupera las nuevas frecuencias', async () => {
    const { wrapper, cliente } = preparar()
    const { result, unmount } = renderHook(() => useSugerenciasDescripcion(contexto, ''), { wrapper })
    await waitFor(() => expect(result.current[0]?.frequency).toBe(2))
    mocks.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ ...dato, frequency: 3 }], error: null }) })
    await act(async () => { await cliente.invalidateQueries({ queryKey: ['sugerencias-descripciones'] }) })
    await waitFor(() => expect(result.current[0]?.frequency).toBe(3))
    unmount(); cliente.clear()
  })
})
