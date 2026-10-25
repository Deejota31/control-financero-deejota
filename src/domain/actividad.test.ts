import { describe, expect, it } from 'vitest'
import { clasificar, nombreDeEvento } from './actividad'

describe('actividad', () => {
  it('los eventos sin usuario son de sistema, sin importar la entidad', () => {
    expect(clasificar('expenses', 'insert', null)).toBe('sistema')
  })
  it('distingue creación, edición, anulación, restauración, catálogo y presupuesto', () => {
    expect(clasificar('expenses', 'insert', 'u')).toBe('creacion')
    expect(clasificar('expenses', 'update', 'u')).toBe('edicion')
    expect(clasificar('expenses', 'annul', 'u')).toBe('anulacion')
    expect(clasificar('expenses', 'restore', 'u')).toBe('restauracion')
    expect(clasificar('categorias', 'update', 'u')).toBe('catalogo')
    expect(clasificar('fund_period_budgets', 'update', 'u')).toBe('presupuesto')
    expect(clasificar('funds', 'insert', 'u')).toBe('presupuesto')
  })
  it('toma el nombre del estado posterior o, si se eliminó, del anterior', () => {
    expect(nombreDeEvento(null, { description: 'Menú' })).toBe('Menú')
    expect(nombreDeEvento({ name: 'Yape' }, null)).toBe('Yape')
    expect(nombreDeEvento(null, null)).toBe('')
  })
})
