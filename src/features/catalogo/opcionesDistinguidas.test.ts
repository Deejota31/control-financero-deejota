import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/features/perfil/usePerfil', () => ({ usePerfil: () => ({ data: null }) }))

import { opcionesDistinguidas } from './useCatalogo'

const item = (id: string, name: string, ambito: string) => ({ id, name, icon_key: 'tag', is_active: true, ambito })

describe('opcionesDistinguidas', () => {
  const items = [item('1', 'Alimentación', 'Personal'), item('2', 'Alimentación', 'Familia'), item('3', 'Salud', 'Familia')]
  it('añade el contexto solo a los nombres repetidos y conserva cada ID', () => {
    const o = opcionesDistinguidas(items, null, (i) => i.ambito)
    expect(o.map((x) => x.label)).toEqual(['Alimentación · Personal', 'Alimentación · Familia', 'Salud'])
    expect(o.map((x) => x.value)).toEqual(['1', '2', '3'])
  })
  it('sin repetidos no cambia nada', () => {
    expect(opcionesDistinguidas(items.slice(2), null, (i) => i.ambito).map((x) => x.label)).toEqual(['Salud'])
  })
})
