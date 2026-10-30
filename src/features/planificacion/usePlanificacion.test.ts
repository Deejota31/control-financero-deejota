import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { debeInvitar, estadosVisuales, mananaDe } from './usePlanificacion'

const base = { recordatorios: true, fondos: 0, plan: null, hoy: '2026-11-01' }

describe('debeInvitar', () => {
  it('invita a un mes nuevo sin fondos ni plan (primer día del mes)', () => expect(debeInvitar(base)).toBe(true))
  it('sigue invitando cualquier otro día del mes pendiente', () => expect(debeInvitar({ ...base, hoy: '2026-11-17' })).toBe(true))
  it('no invita con los recordatorios desactivados', () => expect(debeInvitar({ ...base, recordatorios: false })).toBe(false))
  it('no invita cuando la planificación está completada', () => expect(debeInvitar({ ...base, plan: { status: 'completed', remind_after: null } })).toBe(false))
  it('cerrar el aviso no completa nada: un plan en progreso sigue invitando', () => expect(debeInvitar({ ...base, fondos: 3, plan: { status: 'in_progress', remind_after: null } })).toBe(true))
  it('respeta el aplazamiento y vuelve a invitar al llegar la fecha', () => {
    const plan = { status: 'pending' as const, remind_after: '2026-11-02' }
    expect(debeInvitar({ ...base, plan })).toBe(false)
    expect(debeInvitar({ ...base, plan, hoy: '2026-11-02' })).toBe(true)
  })
  it('un mes que ya tiene fondos y ningún proceso empezado se considera preparado', () => expect(debeInvitar({ ...base, fondos: 4 })).toBe(false))
})

describe('estadosVisuales', () => {
  const plan = (status: 'pending' | 'in_progress' | 'completed', funds_stage: 'pending' | 'done' | 'skipped', expenses_stage: 'pending' | 'done' | 'skipped') => ({ status, funds_stage, expenses_stage })
  it('al iniciar: Fondos en progreso, Gastos pendiente, Resumen por finalizar', () => {
    expect(estadosVisuales(null)).toEqual({ fondos: 'in_progress', gastos: 'pending', resumen: 'por_finalizar' })
    expect(estadosVisuales(plan('pending', 'pending', 'pending'))).toEqual({ fondos: 'in_progress', gastos: 'pending', resumen: 'por_finalizar' })
  })
  it('tras confirmar fondos: Fondos completada, Gastos en progreso', () => {
    expect(estadosVisuales(plan('in_progress', 'done', 'pending'))).toEqual({ fondos: 'done', gastos: 'in_progress', resumen: 'por_finalizar' })
  })
  it('tras confirmar gastos el resumen sigue por finalizar', () => {
    expect(estadosVisuales(plan('in_progress', 'done', 'done'))).toEqual({ fondos: 'done', gastos: 'done', resumen: 'por_finalizar' })
  })
  it('al finalizar: el resumen queda finalizado', () => {
    expect(estadosVisuales(plan('completed', 'done', 'done')).resumen).toBe('finalizada')
  })
  it('una etapa omitida no se marca como completada y la siguiente pendiente pasa a progreso', () => {
    expect(estadosVisuales(plan('in_progress', 'skipped', 'pending'))).toEqual({ fondos: 'skipped', gastos: 'in_progress', resumen: 'por_finalizar' })
  })
  it('si se reabre una etapa completada, vuelve a progreso y las siguientes a pendiente', () => {
    expect(estadosVisuales(plan('in_progress', 'pending', 'done'))).toEqual({ fondos: 'in_progress', gastos: 'done', resumen: 'por_finalizar' })
  })
})

describe('mananaDe', () => {
  it('suma un día sin saltar de mes por zona horaria', () => {
    expect(mananaDe('2026-11-01')).toBe('2026-11-02')
    expect(mananaDe('2026-10-31')).toBe('2026-11-01')
    expect(mananaDe('2026-12-31')).toBe('2027-01-01')
  })
})
