import { describe, expect, it } from 'vitest'
import { tipoPorContenido } from './tipoArchivo'

const bytes = (...v: number[]) => new Uint8Array([...v, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
describe('tipoPorContenido', () => {
  it('reconoce JPG, PNG, WebP y PDF por sus bytes', () => {
    expect(tipoPorContenido(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(tipoPorContenido(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(tipoPorContenido(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp')
    expect(tipoPorContenido(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf')
  })
  it('rechaza HTML, SVG y archivos vacíos aunque declaren otro tipo', () => {
    expect(tipoPorContenido(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull()
    expect(tipoPorContenido(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(tipoPorContenido(new Uint8Array())).toBeNull()
  })
})
