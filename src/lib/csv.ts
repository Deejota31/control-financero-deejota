/** Celda CSV segura: escapa comillas y neutraliza fórmulas (=, +, -, @) que Excel interpretaría. */
export function celdaCsv(valor: string | number | boolean | null | undefined): string {
  let s = valor === null || valor === undefined ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function aCsv(encabezados: string[], filas: (string | number | boolean | null | undefined)[][]): string {
  const lineas = [encabezados, ...filas].map((f) => f.map(celdaCsv).join(','))
  return `﻿${lineas.join('\r\n')}\r\n`
}

export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
