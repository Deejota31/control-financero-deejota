import { errorImporte, formatMes, parseImporte } from '@/lib/format'
import { convertirPen, importeATexto, type Conversion } from './moneda'
import type { PayloadGasto } from '@/features/gastos/useGastos'
import type { Plantilla } from '@/lib/tipos'
import { finDeMes } from './periodo'
import { fechaEfectiva } from './plantillas'

/**
 * Preparación del registro de gastos desde plantillas (reglas puras, sin pantalla): qué valores propone cada plantilla en un mes,
 * qué cambió la persona respecto a la plantilla y qué datos faltan. Los ajustes valen solo para lo que se registre; la plantilla no cambia.
 */

/** Lo que se ajusta al preparar un registro. */
export interface Ajuste { amount?: string; date?: string; method?: string; confirmado?: boolean }
export type ValoresFila = Required<Ajuste>

/** Valores de partida: la plantilla y el día sugerido dentro del mes destino (en meses cortos, su último día). */
export function valoresBase(p: Plantilla, mes: string): ValoresFila {
  return {
    amount: p.default_amount ? Number(p.default_amount).toFixed(2) : '',
    date: fechaEfectiva(p.day_of_month, mes).iso,
    method: p.payment_method_id ?? '',
    confirmado: !p.is_amount_variable,
  }
}

/** Datos que faltan o están mal. La fecha debe estar dentro del mes destino y un importe variable debe confirmarse. */
export function problemasDeFila(f: ValoresFila, mes: string): string[] {
  const out: string[] = []
  const ei = errorImporte(f.amount)
  if (ei) out.push(ei)
  else if (!f.confirmado) out.push('Revisa y confirma el importe de este mes.')
  if (!f.method) out.push('Elige el medio de pago.')
  if (!f.date) out.push('Elige la fecha.')
  else if (f.date < mes || f.date > finDeMes(mes)) out.push(`La fecha debe estar en ${formatMes(mes)}.`)
  return out
}

/** Diferencias entre lo que se va a registrar y la configuración original de la plantilla (para «Actualizar plantilla con estos valores»). */
export function diferenciasConBase(f: ValoresFila, b: ValoresFila): { importe?: number; medio?: string; dia?: number } {
  const d: { importe?: number; medio?: string; dia?: number } = {}
  const importe = parseImporte(f.amount)
  if (importe !== null && importe !== parseImporte(b.amount)) d.importe = importe
  if (f.method && f.method !== b.method) d.medio = f.method
  if (f.date && f.date !== b.date) d.dia = Number(f.date.slice(8, 10))
  return d
}

/** Cotización de una fecha, tal como la entrega el servicio de tipos de cambio. */
export interface CotizacionPlantilla { rate: string; reference_date: string; source: string; fetched_at: string }

/** Una plantilla en USD se registra con la cotización oficial de la fecha del gasto. PEN no necesita conversión (devuelve null). */
export function conversionDePlantilla(p: Pick<Plantilla, 'original_currency'>, importe: string, cot: CotizacionPlantilla | null | undefined): Conversion | null {
  if (p.original_currency !== 'USD' || !cot) return null
  const original = importeATexto(importe)
  if (!original) return null
  return {
    original_currency: 'USD', original_amount: original, amount: convertirPen(original, cot.rate), exchange_rate: cot.rate, exchange_rate_source: cot.source,
    exchange_rate_reference_date: cot.reference_date, conversion_method: 'automatic', exchange_rate_fetched_at: cot.fetched_at, conversion_snapshot_version: 1,
  }
}

/** Importe contable en soles de una fila: el de la plantilla si es PEN, el convertido si es USD (null mientras falte la cotización). */
export function importePenDeFila(p: Pick<Plantilla, 'original_currency'>, importe: string, conversion: Conversion | null): number | null {
  if (p.original_currency === 'USD') return conversion ? Number(conversion.amount) : null
  return parseImporte(importe)
}

/** Carga útil de `create_expense` para una plantilla con sus valores del mes (con su conversión si está en USD). */
export function payloadDePlantilla(p: Plantilla, f: Pick<ValoresFila, 'amount' | 'date' | 'method'>, conversion: Conversion | null = null): PayloadGasto {
  return {
    ...(conversion ?? {}),
    expense_date: f.date, amount: conversion ? Number(conversion.amount) : parseImporte(f.amount)!, description: p.description, ambito_id: p.ambito_id, categoria_id: p.categoria_id, subcategoria_id: p.subcategoria_id,
    payment_method_id: f.method, expense_type: p.expense_type as 'fixed' | 'variable', is_recurring: true, notes: p.notes ?? '', template_id: p.id,
  }
}
