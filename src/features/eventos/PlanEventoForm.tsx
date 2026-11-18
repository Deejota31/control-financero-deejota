import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { errorImporte, parseMontoNoNegativo } from '@/lib/format'
import { mensajeDeError } from '@/lib/errors'
import { estiloSelect } from './EventoForm'
import { useMutacionesEvento } from './useEventos'
import type { Compromiso, Concepto, Evento } from './modelo'
import { ImporteMoneda } from '@/features/moneda/ImporteMoneda'
import { toIso } from '@/lib/format'
import type { Conversion, Moneda } from '@/domain/moneda'

export function PlanEventoForm({ evento, tipo, item, contrato, conceptos, onClose }: { evento: Evento; tipo: 'concepto' | 'compromiso'; item?: Concepto; contrato?: Compromiso; conceptos: Concepto[]; onClose: () => void }) {
  const base = tipo === 'concepto' ? item : contrato
  const mut = useMutacionesEvento()
  const [hoy] = useState(() => toIso(new Date()))
  const [id] = useState(() => base?.id ?? crypto.randomUUID())
  const [name, setName] = useState(base?.name ?? '')
  const pen = String(tipo === 'concepto' ? item?.planned_amount ?? 0 : contrato?.contracted_amount ?? 0)
  const enDolares = base?.original_currency === 'USD'
  /** Conversión congelada del registro: se conserva al editar; la cotización nueva solo se consulta si el usuario la pide. */
  const congelada: Conversion | undefined = base && enDolares ? {
    original_currency: 'USD', original_amount: String(base.original_amount), amount: pen, exchange_rate: String(base.exchange_rate), exchange_rate_source: base.exchange_rate_source,
    exchange_rate_reference_date: base.exchange_rate_reference_date, conversion_method: base.conversion_method as Conversion['conversion_method'], exchange_rate_fetched_at: base.exchange_rate_fetched_at, conversion_snapshot_version: 1,
  } : undefined
  const [currency, setCurrency] = useState<Moneda>(enDolares ? 'USD' : 'PEN')
  const [amount, setAmount] = useState(enDolares ? Number(base?.original_amount).toFixed(2) : Number(pen).toFixed(2))
  const [conversion, setConversion] = useState<Conversion | null>(null)
  const [concepto, setConcepto] = useState(contrato?.event_item_id ?? '')
  const [fecha, setFecha] = useState(contrato?.due_date ?? '')
  const [notes, setNotes] = useState(contrato?.notes ?? '')
  const [cancelado, setCancelado] = useState(Boolean(contrato?.cancelled_at))
  const [error, setError] = useState('')
  const [sucio, setSucio] = useState(false)
  const idForm = useId()
  const pendiente = mut.concepto.isPending || mut.compromiso.isPending
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const err = errorImporte(amount, { permitirCero: true })
    if (!name.trim() || name.trim().length > 100 || notes.length > 1000 || err) { setError(err ?? 'Escribe un concepto de hasta 100 caracteres y notas de hasta 1000.'); return }
    if (currency === 'USD' && !conversion) { setError('Completa una conversión válida en soles.'); return }
    try {
      // PEN: el servidor fija la identidad. USD: se envía la instantánea validada y el servidor la comprueba de nuevo.
      const usd = currency === 'USD' && conversion
      const importePen = usd ? parseMontoNoNegativo(conversion.amount)! : parseMontoNoNegativo(amount)!
      const monetario = usd ? {
        original_currency: 'USD' as const, original_amount: Number(conversion.original_amount), exchange_rate: Number(conversion.exchange_rate), exchange_rate_source: conversion.exchange_rate_source ?? 'Usuario',
        exchange_rate_reference_date: conversion.exchange_rate_reference_date, conversion_method: conversion.conversion_method, exchange_rate_fetched_at: conversion.exchange_rate_fetched_at, conversion_snapshot_version: 1,
      } : { original_currency: 'PEN' as const, original_amount: importePen }
      const comun = { id, event_id: evento.id, household_id: evento.household_id, name: name.trim(), created_at: base?.created_at ?? new Date().toISOString(), ...monetario }
      if (tipo === 'concepto') await mut.concepto.mutateAsync({ ...comun, planned_amount: importePen, sort_order: item?.sort_order ?? conceptos.length })
      else await mut.compromiso.mutateAsync({ ...comun, contracted_amount: importePen, currency: evento.currency, event_item_id: concepto || null, due_date: fecha || null, notes: notes.trim(), cancelled_at: cancelado ? contrato?.cancelled_at ?? new Date().toISOString() : null, updated_at: contrato?.updated_at ?? new Date().toISOString() })
      toast.success(tipo === 'concepto' ? 'Concepto guardado.' : 'Compromiso guardado.')
      onClose()
    } catch (e) { setError(mensajeDeError(e)) }
  }
  return <Modal open onOpenChange={(o) => !o && !pendiente && onClose()} title={`${base ? 'Editar' : 'Nuevo'} ${tipo}`} sucio={sucio} size="md" footer={(cerrar) => <><Button variant="secondary" onClick={cerrar} disabled={pendiente}>Cancelar</Button><Button type="submit" form={idForm} loading={pendiente}>Guardar {tipo}</Button></>}>
    <form id={idForm} onSubmit={guardar} onChange={() => setSucio(true)} className="flex min-w-0 flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={tipo === 'concepto' ? 'Concepto' : 'Concepto contratado'}>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus className="text-base" />}</Field>
      <Field label={tipo === 'concepto' ? 'Presupuesto del concepto' : 'Importe contratado'}>{(p) => <ImporteMoneda {...p} currency={currency} onCurrencyChange={v => { setCurrency(v); setConversion(null); setSucio(true) }} amount={amount} onAmountChange={v => { setAmount(v); setSucio(true) }} date={hoy} initial={congelada} onConversionChange={setConversion} disabled={pendiente} />}</Field>
      {currency === 'USD' && <p className="text-xs text-muted">Estimación en soles con la cotización de hoy. Cada pago conserva su propia conversión.</p>}
      {tipo === 'compromiso' && <>
        <Field label="Concepto planificado (opcional)">{(p) => <select {...p} value={concepto} onChange={(e) => setConcepto(e.target.value)} className={estiloSelect}><option value="">Sin concepto</option>{conceptos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</Field>
        <Field label="Fecha prevista de pago (opcional)">{(p) => <Input {...p} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />}</Field>
        <Field label="Notas (opcional)">{(p) => <textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className={estiloSelect} />}</Field>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={cancelado} onChange={(e) => setCancelado(e.target.checked)} className="mt-1" /><span>Compromiso cancelado<span className="mt-1 block text-xs text-muted">Deja de generar saldo pendiente. Los pagos realizados se conservan.</span></span></label>
      </>}
    </form>
  </Modal>
}
