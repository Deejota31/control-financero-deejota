import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { inicialDePlantilla, inicialDesdeFondo, textoResultadoAplicacion, type PlantillaFondoConReglas } from './usePlantillasFondos'

const plantilla = {
  plantilla: { id: 't1', household_id: 'h', name: 'Sodexo', description: 'Almuerzos', icon_key: 'wallet', color_token: 'c2', is_general: false, suggested_amount: 280, priority: 10, is_active: true, sort_order: 1, created_at: '', updated_at: '' },
  alcance: [{ id: 'r1', household_id: 'h', template_id: 't1', ambito_id: 'a1', categoria_id: null, subcategoria_id: null, effect: 'include', created_at: '' }],
  medios: [{ id: 'm1', household_id: 'h', template_id: 't1', payment_method_id: 'p1', effect: 'include', created_at: '' }],
} as PlantillaFondoConReglas

describe('inicialDePlantilla', () => {
  it('para editar la plantilla: su importe sugerido va como importe y no se vincula a ningún mes', () => {
    const i = inicialDePlantilla(plantilla)
    expect(i.fondo).toMatchObject({ id: 't1', name: 'Sodexo', default_amount: 280, priority: 10 })
    expect(i.clon).toBeUndefined()
    expect(i.plantillaId).toBeUndefined()
    expect(i.alcance).toHaveLength(1)
    expect(i.medios).toHaveLength(1)
  })
  it('para crear el fondo del mes: conserva el nombre, no es una edición y queda vinculado a la plantilla', () => {
    const i = inicialDePlantilla(plantilla, { comoFondo: true })
    expect(i).toMatchObject({ clon: true, conservarNombre: true, plantillaId: 't1' })
  })
})

describe('inicialDesdeFondo', () => {
  it('toma el importe del mes como sugerencia y nunca arrastra el id de instancia como plantilla existente', () => {
    const fondo = { id: 'f1', name: 'Hogar', description: null, icon_key: 'home', color_token: 'c1', is_general: false, is_active: true, default_amount: 0, priority: 20 }
    const i = inicialDesdeFondo(fondo, [], [], 700)
    expect(i.fondo?.default_amount).toBe(700)
    expect(i).toMatchObject({ clon: true, conservarNombre: true })
    expect(i.plantillaId).toBeUndefined()
  })
})

describe('textoResultadoAplicacion', () => {
  it('cuenta lo creado en singular y plural', () => {
    expect(textoResultadoAplicacion({ created: [{ template_id: 'a', id: 'x', name: 'A', amount: 1 }], skipped: [] })).toBe('Se creó 1 fondo.')
    expect(textoResultadoAplicacion({ created: [{ template_id: 'a', id: 'x', name: 'A', amount: 1 }, { template_id: 'b', id: 'y', name: 'B', amount: 1 }], skipped: [] })).toBe('Se crearon 2 fondos.')
  })
  it('explica cada omitida con su motivo', () => {
    const t = textoResultadoAplicacion({ created: [], skipped: [{ template_id: 'a', name: 'General', reason: 'general_exists' }, { template_id: 'b', name: 'Sodexo', reason: 'already_applied' }] })
    expect(t).toContain('No se creó ningún fondo.')
    expect(t).toContain('«General» el mes ya tiene un Fondo General activo')
    expect(t).toContain('«Sodexo» ya está aplicada en este mes')
  })
})
