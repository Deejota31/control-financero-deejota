const pen = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formato peruano de soles: S/ 1,284.50 */
export function formatSoles(value: number): string {
  return pen.format(value).replace(/\s/g, ' ').replace('S/', 'S/ ').replace('S/  ', 'S/ ')
}
