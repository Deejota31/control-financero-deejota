import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarCambiosPendientes } from '@/lib/cambiosPendientes'

const toastMock = vi.hoisted(() => {
  const fn = Object.assign(vi.fn(), { warning: vi.fn(), dismiss: vi.fn() })
  return fn
})
vi.mock('sonner', () => ({ toast: toastMock }))
const pwa = vi.hoisted(() => ({ aplicarActualizacion: vi.fn(), disponible: true }))
vi.mock('@/lib/pwa', () => ({ aplicarActualizacion: pwa.aplicarActualizacion, useActualizacionDisponible: () => pwa.disponible }))

import { useActualizacionApp } from './useActualizacionApp'

const accionDelAviso = () => (toastMock.mock.calls[0][1] as { action: { onClick: (e: { preventDefault: () => void }) => void } }).action.onClick

describe('useActualizacionApp', () => {
  beforeEach(() => { vi.clearAllMocks(); pwa.disponible = true })

  it('ofrece la actualización sin aplicarla: nunca recarga por sorpresa', () => {
    renderHook(() => useActualizacionApp())
    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock.mock.calls[0][0]).toBe('Hay una nueva versión de Control Financiero')
    expect(pwa.aplicarActualizacion).not.toHaveBeenCalled()
  })

  it('no muestra nada si no hay una versión en espera', () => {
    pwa.disponible = false
    renderHook(() => useActualizacionApp())
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('con cambios sin guardar avisa y NO aplica la actualización; el aviso se queda abierto', () => {
    renderHook(() => useActualizacionApp())
    const liberar = registrarCambiosPendientes()
    const evento = { preventDefault: vi.fn() }
    accionDelAviso()(evento)
    expect(pwa.aplicarActualizacion).not.toHaveBeenCalled()
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringMatching(/cambios sin guardar/), expect.anything())
    expect(evento.preventDefault).toHaveBeenCalled() // el aviso de actualización no se cierra
    liberar()
  })

  it('sin cambios pendientes la actualización se aplica', () => {
    renderHook(() => useActualizacionApp())
    accionDelAviso()({ preventDefault: vi.fn() })
    expect(pwa.aplicarActualizacion).toHaveBeenCalledTimes(1)
  })

  it('al desmontarse retira el aviso', () => {
    const { unmount } = renderHook(() => useActualizacionApp())
    unmount()
    expect(toastMock.dismiss).toHaveBeenCalledWith('actualizacion-app')
  })
})
