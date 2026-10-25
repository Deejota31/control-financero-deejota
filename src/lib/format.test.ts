import { describe, expect, it } from 'vitest'
import { formatSoles } from './format'

describe('formatSoles', () => {
  it('usa S/ con dos decimales', () => {
    expect(formatSoles(1284.5)).toBe('S/ 1,284.50')
    expect(formatSoles(0)).toBe('S/ 0.00')
  })
})
