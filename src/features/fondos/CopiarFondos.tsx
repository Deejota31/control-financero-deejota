import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { Modal } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { Skeleton } from '@/components/ui/States'
import { mensajeDeError } from '@/lib/errors'
import { errorImporte, formatMes, formatSoles, parseMontoNoNegativo } from '@/lib/format'
import { sumarMeses, useCopiarFondos, useFondos, usePeriodo, usePresupuestosPeriodo, type ResultadoCopia } from './useFondos'

export const MOTIVOS_OMISION: Record<ResultadoCopia['skipped'][number]['reason'], string> = {
  already_copied: 'ya se había copiado',
  name_exists: 'ya existe un fondo con ese nombre',
  general_exists: 'este mes ya tiene Fondo General',
  not_in_source: 'no pertenece al mes de origen',
}

/**
 * Estado de una copia de fondos entre meses: qué fondos del mes de origen se proponen, cuáles se marcan y con qué importe.
 * Nada se crea hasta `confirmar`; allí se generan instancias independientes en el mes destino y nunca se sobrescribe nada.
 */
export function useCopiaFondos(destino: string, origenInicial?: string) {
  const [origen, setOrigen] = useState(origenInicial ?? sumarMeses(destino, -1))
  const periodoDestino = usePeriodo(destino)
  const periodoOrigen = usePeriodo(origen)
  const fondosOrigen = useFondos(periodoOrigen.data?.id)
  const presupuestosOrigen = usePresupuestosPeriodo(periodoOrigen.data?.id)
  const fondosDestino = useFondos(periodoDestino.data?.id)
  const copiar = useCopiarFondos()

  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [importes, setImportes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  // Traer todo seleccionado por defecto no es un cambio de la persona: solo cuenta lo que toca (sirve para avisar al cancelar).
  const [tocado, setTocado] = useState(false)
  const marcar = (fn: (s: Set<string>) => Set<string>) => { setTocado(true); setMarcados(fn) }
  const cambiarImporte = (id: string, v: string) => { setTocado(true); setImportes((s) => ({ ...s, [id]: v })) }

  const meses = useMemo(() => Array.from({ length: 25 }, (_, i) => sumarMeses(destino, i - 12)).filter((m) => m !== destino).map((m) => ({ value: m, label: formatMes(m) })), [destino])

  // Todos los fondos del origen; los que el destino ya tiene quedan marcados como omitidos (no se pueden copiar de nuevo).
  const filas = useMemo(() => {
    const asignado = new Map((presupuestosOrigen.data ?? []).map((b) => [b.fund_id, Number(b.assigned_amount)]))
    const enDestino = fondosDestino.data?.fondos ?? []
    // Como en la página Fondos: el General primero y luego por prioridad.
    const ordenados = [...(fondosOrigen.data?.fondos ?? [])].sort((a, b) => Number(b.is_general) - Number(a.is_general) || a.priority - b.priority || a.name.localeCompare(b.name))
    return ordenados.map((f) => {
      const yaCopiado = enDestino.some((d) => d.copied_from === f.id)
      const mismoNombre = enDestino.some((d) => d.name.trim().toLowerCase() === f.name.trim().toLowerCase())
      const generalExiste = f.is_general && f.is_active && enDestino.some((d) => d.is_general && d.is_active)
      return { fondo: f, importe: asignado.get(f.id) ?? Number(f.default_amount), omitido: yaCopiado ? 'ya se había copiado' : mismoNombre ? 'ya existe en este mes' : generalExiste ? 'este mes ya tiene Fondo General' : null }
    })
  }, [fondosOrigen.data, presupuestosOrigen.data, fondosDestino.data])

  // Al cambiar de mes de origen o cargar sus datos se proponen todos los copiables con su importe.
  useEffect(() => {
    setMarcados(new Set(filas.filter((f) => !f.omitido).map((f) => f.fondo.id)))
    setImportes(Object.fromEntries(filas.map((f) => [f.fondo.id, f.importe.toFixed(2)])))
    setError(null)
    setTocado(false)
  }, [filas])

  const cargando = periodoOrigen.isPending || fondosOrigen.isPending || presupuestosOrigen.isPending || fondosDestino.isPending || periodoDestino.isPending
  const copiables = filas.filter((f) => !f.omitido)
  const seleccionados = copiables.filter((f) => marcados.has(f.fondo.id))
  const importeInvalido = seleccionados.some((f) => errorImporte(importes[f.fondo.id] ?? '', { permitirCero: true }))
  const total = seleccionados.reduce((s, f) => s + (parseMontoNoNegativo(importes[f.fondo.id] ?? '') ?? 0), 0)

  /** Crea las instancias elegidas en el mes destino. Devuelve el resultado o null si falló (el error queda en `error`). */
  async function confirmar(): Promise<ResultadoCopia | null> {
    if (!periodoOrigen.data || !periodoDestino.data) return null
    setError(null)
    try {
      return await copiar.mutateAsync({
        origen: periodoOrigen.data.id,
        destino: periodoDestino.data.id,
        items: seleccionados.map((f) => ({ fund_id: f.fondo.id, amount: parseMontoNoNegativo(importes[f.fondo.id])! })),
      })
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudieron copiar los fondos. No se creó ninguno.'))
      return null
    }
  }

  return {
    destino, origen, setOrigen, meses, filas, marcados, marcar, importes, cambiarImporte, tocado, error, cargando,
    copiables, seleccionados, importeInvalido, total, confirmar, copiando: copiar.isPending, copiado: copiar.isSuccess,
  }
}

export type CopiaFondos = ReturnType<typeof useCopiaFondos>

/** Resumen legible de una copia (creados y omitidos con su motivo). */
export function textoResultadoCopia(r: ResultadoCopia, destino: string): string {
  const omitidos = r.skipped.map((s) => `${s.name ?? 'Fondo'} (${MOTIVOS_OMISION[s.reason]})`)
  return `${r.created.length} ${r.created.length === 1 ? 'fondo copiado' : 'fondos copiados'} a ${formatMes(destino)}.${omitidos.length ? ` Omitidos: ${omitidos.join(', ')}.` : ''}`
}

/** Selector de mes de origen + lista de fondos con checkbox e importe editable. */
export function ListaCopiaFondos({ copia, mostrarOrigen = true }: { copia: CopiaFondos; mostrarOrigen?: boolean }) {
  const { origen, filas, marcados, importes, cargando, copiables } = copia
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {copia.error && <Alert tone="error">{copia.error}</Alert>}
      {mostrarOrigen && (
        <Field label="Copiar desde">
          {(p) => <Combobox id={p.id} value={origen} searchable={false} options={copia.meses} placeholder="Elegir mes" onChange={(v) => v && copia.setOrigen(v)} />}
        </Field>
      )}

      {cargando ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Cargando fondos"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : filas.length === 0 ? (
        <p className="rounded-md border border-dashed border-line p-4 text-sm text-muted">{formatMes(origen)} no tiene fondos. Elige otro mes de origen.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="secondary" onClick={() => copia.marcar(() => new Set(copiables.map((f) => f.fondo.id)))}>Seleccionar todos</Button>
            <Button variant="secondary" onClick={() => copia.marcar(() => new Set())}>Deseleccionar todos</Button>
          </div>
          <ul className="flex flex-col gap-2" aria-label={`Fondos de ${formatMes(origen)}`}>
            {filas.map(({ fondo, omitido }) => {
              const marcado = marcados.has(fondo.id)
              return (
                <li key={fondo.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border border-line p-2.5 sm:grid-cols-[auto_minmax(0,1fr)_9rem]">
                  <input type="checkbox" className="size-5" checked={marcado} disabled={Boolean(omitido)} aria-label={`Copiar ${fondo.name}`}
                    onChange={(e) => copia.marcar((s) => { const n = new Set(s); if (e.target.checked) n.add(fondo.id); else n.delete(fondo.id); return n })} />
                  <span className="flex min-w-0 items-center gap-2">
                    <ItemIcon name={fondo.icon_key ?? 'wallet'} color={fondo.color_token ?? 'c1'} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{fondo.name}{fondo.is_general && <span className="ml-1.5 text-xs font-normal text-muted">General</span>}{!fondo.is_active && <span className="ml-1.5 text-xs font-normal text-muted">Inactivo</span>}</span>
                      {omitido && <span className="block text-xs text-muted">No se copiará: {omitido}.</span>}
                    </span>
                  </span>
                  <div className="col-span-2 sm:col-span-1">
                    <MoneyInput id={`importe-${fondo.id}`} aria-label={`Importe de ${fondo.name}`} value={importes[fondo.id] ?? ''} disabled={Boolean(omitido) || !marcado}
                      invalid={marcado && Boolean(errorImporte(importes[fondo.id] ?? '', { permitirCero: true }))}
                      onChange={(v) => copia.cambiarImporte(fondo.id, v)} />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

/** Diálogo «Copiar fondos de otro mes»: se crean fondos nuevos e independientes; no se copian gastos ni consumo ni se toca el origen. */
export function CopiarFondos({ destino, origenInicial, onClose, onCopiado }: { destino: string; origenInicial?: string; onClose: () => void; onCopiado?: (r: ResultadoCopia) => void }) {
  const copia = useCopiaFondos(destino, origenInicial)
  const { seleccionados, copiables } = copia

  async function aceptar() {
    const r = await copia.confirmar()
    if (!r) return
    toast.success(textoResultadoCopia(r, destino))
    onCopiado?.(r)
    onClose()
  }

  return (
    <Modal open onOpenChange={(o) => !o && !copia.copiando && onClose()} title="Copiar fondos de otro mes" size="lg"
      description={`Se crean fondos nuevos e independientes en ${formatMes(destino)}. No se copian gastos ni consumo, y no se modifica el mes de origen.`}
      sucio={copia.tocado && !copia.copiado}
      footer={(cerrar) => (
        <>
          <p className="mr-auto min-w-0 truncate text-sm text-muted" aria-live="polite">{seleccionados.length} de {copiables.length} · <b className="num text-fg">{formatSoles(copia.total)}</b></p>
          <Button variant="secondary" onClick={cerrar} disabled={copia.copiando}>Cancelar</Button>
          <Button onClick={aceptar} loading={copia.copiando} disabled={seleccionados.length === 0 || copia.importeInvalido || copia.cargando}>
            {copia.copiando ? 'Copiando…' : seleccionados.length === 1 ? 'Copiar 1 fondo' : `Copiar ${seleccionados.length} fondos`}
          </Button>
        </>
      )}>
      <ListaCopiaFondos copia={copia} />
    </Modal>
  )
}
