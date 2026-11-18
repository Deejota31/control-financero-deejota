import { describe, expect, it } from 'vitest'
import { jsonDocument, priorDate, quoteFromBcrp, quotesBetween, validDate } from '../../../supabase/functions/_shared/bcrp'

const serie = (filas: [string, string][], nombre = 'Tipo de cambio - TC Sistema bancario SBS (S/ por US$) - Venta') =>
  JSON.stringify({ config: { title: 'Tipo de cambio', series: [{ name: nombre, dec: '3' }] }, periods: filas.map(([name, v]) => ({ name, values: [v] })) })

// Semana real de noviembre de 2026: el 14 y el 15 son fin de semana; el 17 y el 18 aún no se publican («n.d.»).
const SEMANA: [string, string][] = [['12.Nov.26', '3.407'], ['13.Nov.26', '3.404'], ['16.Nov.26', '3.419'], ['17.Nov.26', 'n.d.'], ['18.Nov.26', 'n.d.']]

describe('cotización oficial BCRP (serie SBS venta)', () => {
  it('usa la tasa del día cuando existe', () => {
    expect(quoteFromBcrp(serie(SEMANA), '2026-11-16')).toEqual({ rate: '3.419', reference_date: '2026-11-16', source: 'BCRP:PD04640PD' })
  })
  it('fin de semana: cae en el último día publicado anterior y dice cuál fue', () => {
    expect(quoteFromBcrp(serie(SEMANA), '2026-11-15')).toMatchObject({ rate: '3.404', reference_date: '2026-11-13' })
  })
  it('un día aún sin publicar («n.d.») usa el último dato válido, nunca un valor inventado', () => {
    expect(quoteFromBcrp(serie(SEMANA), '2026-11-18')).toMatchObject({ rate: '3.419', reference_date: '2026-11-16' })
  })
  it('nunca usa una cotización posterior a la fecha pedida', () => {
    expect(quoteFromBcrp(serie(SEMANA), '2026-11-13').reference_date).toBe('2026-11-13')
  })
  it('sin ningún dato dentro del margen pide una tasa manual', () => {
    expect(() => quoteFromBcrp(serie([['17.Nov.26', 'n.d.'], ['18.Nov.26', 'n.d.']]), '2026-11-18')).toThrow('tasa manual')
    expect(() => quoteFromBcrp(serie([['01.Oct.26', '3.40']]), '2026-11-18')).toThrow('tasa manual')
  })
  it('rechaza otra serie (compra, interbancario…) para no mezclar tipos de tasa', () => {
    expect(() => quoteFromBcrp(serie(SEMANA, 'Tipo de cambio - TC Interbancario (S/ por US$) - Compra'), '2026-11-16')).toThrow('Serie BCRP inesperada')
  })
  it('rechaza valores no numéricos o nulos', () => {
    expect(() => quoteFromBcrp(serie([['16.Nov.26', '0']]), '2026-11-16')).toThrow()
    expect(() => quoteFromBcrp(serie([['16.Nov.26', 'abc']]), '2026-11-16')).toThrow()
  })
  it('lee solo el JSON aunque BCRP agregue diagnósticos PHP después', () => {
    const texto = `${serie(SEMANA)}\n<br /><b>Warning</b>: tasa 9.999 en la línea 3`
    expect(quoteFromBcrp(texto, '2026-11-16').rate).toBe('3.419')
    expect(() => jsonDocument('<html>bloqueo</html>')).toThrow('inválida')
    expect(() => jsonDocument('{"a":')).toThrow('incompleta')
  })
  it('valida fechas y el margen de búsqueda hacia atrás (siete días)', () => {
    expect(validDate('2026-02-30')).toBe(false)
    expect(validDate('2026-11-18')).toBe(true)
    expect(validDate('18/11/2026')).toBe(false)
    expect(priorDate('2026-11-18')).toBe('2026-11-11')
  })
  it('interpreta años de dos cifras del siglo anterior', () => {
    expect(quoteFromBcrp(serie([['05.Ene.98', '2.7']]), '1998-01-05')).toMatchObject({ rate: '2.7', reference_date: '1998-01-05' })
  })
})

describe('cotizaciones de un mes completo (una consulta llena la caché de todos sus días)', () => {
  it('asigna a cada día su cotización: la propia o la del último día publicado', () => {
    const dias = quotesBetween(serie(SEMANA), '2026-11-12', '2026-11-18')
    expect(dias.map((d) => [d.date_requested, d.rate, d.reference_date])).toEqual([
      ['2026-11-12', '3.407', '2026-11-12'],
      ['2026-11-13', '3.404', '2026-11-13'],
      ['2026-11-14', '3.404', '2026-11-13'], // sábado
      ['2026-11-15', '3.404', '2026-11-13'], // domingo
      ['2026-11-16', '3.419', '2026-11-16'],
      ['2026-11-17', '3.419', '2026-11-16'], // aún sin publicar
      ['2026-11-18', '3.419', '2026-11-16'],
    ])
  })
  it('omite los días sin ninguna referencia dentro del margen en lugar de inventarla', () => {
    expect(quotesBetween(serie([['16.Nov.26', '3.419']]), '2026-11-01', '2026-11-10')).toEqual([])
  })
})
