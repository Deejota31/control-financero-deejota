import { subMonths, endOfMonth, startOfMonth } from 'date-fns'
import { ArrowDown, ArrowUp, Ban, ChevronLeft, ChevronRight, Copy, Download, Eye, FileStack, ListChecks, Pencil, Plus, Receipt, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Combobox, type ComboOption } from '@/components/ui/Combobox'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { aCsv, descargar } from '@/lib/csv'
import { mensajeDeError } from '@/lib/errors'
import { formatFecha, formatSoles, toIso } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useDebounced } from '@/lib/useDebounced'
import { opciones, useCatalogo, type Catalogo } from '@/features/catalogo/useCatalogo'
import { useFondos } from '@/features/fondos/useFondos'
import { usePerfil } from '@/features/perfil/usePerfil'
import { GastoForm, type ModoGasto } from './GastoForm'
import { LoteDialog, PlantillasDialog } from './Plantillas'
import { TAMANO_PAGINA, gastosParaExportar, useFiltrosGastos, useGastoMutaciones, useGastosPagina, type FiltrosGastos, type GastoConFondos } from './useGastos'

const TIPOS: ComboOption[] = [{ value: 'fixed', label: 'Fijo', icon: 'repeat' }, { value: 'variable', label: 'Variable', icon: 'tag' }]
const ESTADOS: ComboOption[] = [{ value: 'active', label: 'Activos', icon: 'receipt' }, { value: 'annulled', label: 'Anulados', icon: 'circle-ellipsis' }, { value: 'all', label: 'Todos', icon: 'tag' }]

function nombres(c: Catalogo) {
  return {
    ambito: new Map(c.ambitos.map((x) => [x.id, x])),
    categoria: new Map(c.categorias.map((x) => [x.id, x])),
    sub: new Map(c.subcategorias.map((x) => [x.id, x])),
    medio: new Map(c.medios.map((x) => [x.id, x])),
  }
}

export function GastosPage() {
  const { filtros, cambiar, limpiar, hayFiltros } = useFiltrosGastos()
  const [params, setParams] = useSearchParams()
  const catalogo = useCatalogo()
  const fondosQ = useFondos()
  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const q = useGastosPagina(filtros)
  const mut = useGastoMutaciones()
  const nom = useMemo(() => nombres(catalogo), [catalogo])
  const fondoPorId = useMemo(() => new Map((fondosQ.data?.fondos ?? []).map((f) => [f.id, f])), [fondosQ.data])

  const [texto, setTexto] = useState(filtros.q)
  const textoDebounced = useDebounced(texto, 350)
  useEffect(() => {
    if (textoDebounced !== filtros.q) cambiar({ q: textoDebounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoDebounced])

  const [form, setForm] = useState<{ modo: ModoGasto; gasto?: GastoConFondos } | null>(() => (params.get('nuevo') === '1' ? { modo: 'nuevo' } : null))
  const [lote, setLote] = useState(() => params.get('lote') === '1')
  const [plantillas, setPlantillas] = useState(false)
  const [detalle, setDetalle] = useState<GastoConFondos | null>(null)
  const [confirmar, setConfirmar] = useState<{ tipo: 'anular' | 'restaurar'; gastos: GastoConFondos[] } | null>(null)
  const [seleccion, setSeleccion] = useState<Map<string, GastoConFondos>>(new Map())
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    if (params.get('nuevo') || params.get('lote')) {
      setParams((p) => { const o = new URLSearchParams(p); o.delete('nuevo'); o.delete('lote'); return o }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filas = q.data?.filas ?? []
  const total = q.data?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA))
  const todasSeleccionadas = filas.length > 0 && filas.every((f) => seleccion.has(f.id))
  const selArr = [...seleccion.values()]
  const selTotal = selArr.reduce((s, g) => s + Number(g.amount), 0)

  const categoriasFiltro = useMemo(() => (filtros.ambito ? catalogo.categorias.filter((c) => c.ambito_id === filtros.ambito) : catalogo.categorias), [catalogo.categorias, filtros.ambito])
  const subsFiltro = useMemo(() => catalogo.subcategorias.filter((s) => s.categoria_id === filtros.categoria), [catalogo.subcategorias, filtros.categoria])

  function alternar(g: GastoConFondos) {
    setSeleccion((m) => { const n = new Map(m); if (n.has(g.id)) n.delete(g.id); else n.set(g.id, g); return n })
  }
  function alternarTodas() {
    setSeleccion((m) => { const n = new Map(m); if (todasSeleccionadas) filas.forEach((f) => n.delete(f.id)); else filas.forEach((f) => n.set(f.id, f)); return n })
  }
  function ordenarPor(col: FiltrosGastos['orden']) {
    cambiar(filtros.orden === col ? { dir: filtros.dir === 'asc' ? 'desc' : 'asc' } : { orden: col, dir: col === 'fecha' || col === 'monto' ? 'desc' : 'asc' })
  }

  function exportarFilas(rows: GastoConFondos[], nombre: string) {
    const csv = aCsv(
      ['Fecha', 'Descripción', 'Ámbito', 'Categoría', 'Subcategoría', 'Medio de pago', 'Tipo', 'Recurrente', 'Estado', 'Importe (PEN)', 'Fondos', 'Notas'],
      rows.map((g) => [
        g.expense_date, g.description, nom.ambito.get(g.ambito_id)?.name, nom.categoria.get(g.categoria_id)?.name, g.subcategoria_id ? nom.sub.get(g.subcategoria_id)?.name : '',
        nom.medio.get(g.payment_method_id)?.name, g.expense_type === 'fixed' ? 'Fijo' : 'Variable', g.is_recurring ? 'Sí' : 'No', g.status === 'active' ? 'Activo' : 'Anulado',
        Number(g.amount).toFixed(2), g.expense_fund_allocations.map((a) => `${fondoPorId.get(a.fund_id)?.name ?? 'Fondo'}: ${Number(a.amount).toFixed(2)}`).join('; '), g.notes ?? '',
      ]),
    )
    descargar(nombre, csv)
  }
  async function exportarFiltro() {
    setExportando(true)
    try {
      const rows = await gastosParaExportar(filtros)
      exportarFilas(rows, `gastos_${filtros.desde}_${filtros.hasta}.csv`)
      toast.success(`Se exportaron ${rows.length} gastos.`)
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo exportar.'))
    } finally {
      setExportando(false)
    }
  }

  function ejecutar() {
    if (!confirmar) return
    const ids = confirmar.gastos.map((g) => g.id)
    const op = confirmar.tipo === 'anular' ? mut.anular : mut.restaurar
    op.mutate(ids, {
      onSuccess: () => {
        toast.success(confirmar.tipo === 'anular' ? `${ids.length} ${ids.length === 1 ? 'gasto anulado' : 'gastos anulados'}.` : `${ids.length} ${ids.length === 1 ? 'gasto restaurado' : 'gastos restaurados'}.`)
        setSeleccion((m) => { const n = new Map(m); ids.forEach((id) => n.delete(id)); return n })
        setConfirmar(null)
      },
      onError: (e) => { toast.error(mensajeDeError(e)); setConfirmar(null) },
    })
  }

  const pendiente = mut.anular.isPending || mut.restaurar.isPending
  const hoy = new Date()

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Gastos</h1>
          <p className="text-sm text-muted" aria-live="polite">{q.isPending ? 'Cargando…' : `${total} ${total === 1 ? 'movimiento' : 'movimientos'} con los filtros aplicados`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPlantillas(true)}><FileStack className="size-4" aria-hidden="true" /> Plantillas</Button>
          <Button variant="secondary" onClick={() => setLote(true)}><ListChecks className="size-4" aria-hidden="true" /> Registrar mensuales</Button>
          <Button variant="secondary" onClick={exportarFiltro} loading={exportando}><Download className="size-4" aria-hidden="true" /> Exportar CSV</Button>
          <Button onClick={() => setForm({ modo: 'nuevo' })}><Plus className="size-4" aria-hidden="true" /> Nuevo gasto</Button>
        </div>
      </div>

      <section aria-label="Filtros" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <label htmlFor="buscar" className="text-sm font-medium">Buscar</label>
            <input id="buscar" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Descripción…" className="rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted" />
          </div>
          <div className="flex w-44 flex-col gap-1.5"><label htmlFor="f-desde" className="text-sm font-medium">Desde</label><DatePicker id="f-desde" value={filtros.desde} onChange={(d) => cambiar({ desde: d })} formato={formato} /></div>
          <div className="flex w-44 flex-col gap-1.5"><label htmlFor="f-hasta" className="text-sm font-medium">Hasta</label><DatePicker id="f-hasta" value={filtros.hasta} onChange={(d) => cambiar({ hasta: d })} formato={formato} /></div>
          <div className="flex gap-1.5">
            <Button variant="secondary" onClick={() => cambiar({ desde: toIso(startOfMonth(hoy)), hasta: toIso(endOfMonth(hoy)) })}>Este mes</Button>
            <Button variant="secondary" onClick={() => cambiar({ desde: toIso(startOfMonth(subMonths(hoy, 1))), hasta: toIso(endOfMonth(subMonths(hoy, 1))) })}>Mes anterior</Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Filtro etiqueta="Ámbito" id="f-ambito"><Combobox id="f-ambito" value={filtros.ambito || null} clearable searchable={false} options={opciones(catalogo.ambitos, filtros.ambito)} placeholder="Todos" onChange={(v) => cambiar({ ambito: v ?? '', categoria: '', subcategoria: '' })} /></Filtro>
          <Filtro etiqueta="Categoría" id="f-categoria"><Combobox id="f-categoria" value={filtros.categoria || null} clearable options={opciones(categoriasFiltro, filtros.categoria)} placeholder="Todas" onChange={(v) => cambiar({ categoria: v ?? '', subcategoria: '' })} /></Filtro>
          <Filtro etiqueta="Subcategoría" id="f-sub"><Combobox id="f-sub" value={filtros.subcategoria || null} clearable disabled={!filtros.categoria} options={opciones(subsFiltro, filtros.subcategoria)} placeholder={filtros.categoria ? 'Todas' : 'Elige categoría'} onChange={(v) => cambiar({ subcategoria: v ?? '' })} /></Filtro>
          <Filtro etiqueta="Medio de pago" id="f-medio"><Combobox id="f-medio" value={filtros.medio || null} clearable searchable={false} options={opciones(catalogo.medios, filtros.medio)} placeholder="Todos" onChange={(v) => cambiar({ medio: v ?? '' })} /></Filtro>
          <Filtro etiqueta="Fondo" id="f-fondo"><Combobox id="f-fondo" value={filtros.fondo || null} clearable searchable={false} options={(fondosQ.data?.fondos ?? []).map((f) => ({ value: f.id, label: f.name, icon: f.icon_key, color: f.color_token }))} placeholder="Todos" onChange={(v) => cambiar({ fondo: v ?? '' })} /></Filtro>
          <Filtro etiqueta="Tipo" id="f-tipo"><Combobox id="f-tipo" value={filtros.tipo || null} clearable searchable={false} options={TIPOS} placeholder="Todos" onChange={(v) => cambiar({ tipo: (v ?? '') as FiltrosGastos['tipo'] })} /></Filtro>
          <Filtro etiqueta="Estado" id="f-estado"><Combobox id="f-estado" value={filtros.estado} searchable={false} options={ESTADOS} onChange={(v) => cambiar({ estado: (v ?? 'active') as FiltrosGastos['estado'] })} /></Filtro>
        </div>
        {hayFiltros && <div><Button variant="ghost" onClick={() => { setTexto(''); limpiar() }}><X className="size-4" aria-hidden="true" /> Limpiar filtros</Button></div>}
      </section>

      {seleccion.size > 0 && (
        <div role="region" aria-label="Selección" className="flex flex-wrap items-center gap-3 rounded-lg border border-pri bg-pri-soft px-4 py-3">
          <p className="flex-1 text-sm"><b>{seleccion.size}</b> {seleccion.size === 1 ? 'seleccionado' : 'seleccionados'} · total <b className="num">{formatSoles(selTotal)}</b></p>
          {selArr.some((g) => g.status === 'active') && <Button variant="secondary" onClick={() => setConfirmar({ tipo: 'anular', gastos: selArr.filter((g) => g.status === 'active') })}><Ban className="size-4" aria-hidden="true" /> Anular seleccionados</Button>}
          {selArr.some((g) => g.status === 'annulled') && <Button variant="secondary" onClick={() => setConfirmar({ tipo: 'restaurar', gastos: selArr.filter((g) => g.status === 'annulled') })}><Undo2 className="size-4" aria-hidden="true" /> Restaurar seleccionados</Button>}
          <Button variant="secondary" onClick={() => exportarFilas(selArr, 'gastos_seleccion.csv')}><Download className="size-4" aria-hidden="true" /> Exportar selección</Button>
          <Button variant="ghost" onClick={() => setSeleccion(new Map())}>Quitar selección</Button>
        </div>
      )}

      {q.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Cargando gastos">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : q.isError ? (
        <ErrorState message="No se pudieron cargar los gastos." onRetry={() => q.refetch()} />
      ) : filas.length === 0 ? (
        hayFiltros ? (
          <EmptyState icon={Receipt} title="Ningún gasto coincide con los filtros" description="Prueba con otro período o quita algún filtro." action={<Button variant="secondary" onClick={() => { setTexto(''); limpiar() }}>Limpiar filtros</Button>} />
        ) : (
          <EmptyState icon={Receipt} title="Aún no hay gastos en este período" description="Registra el primero o crea gastos desde tus plantillas mensuales." action={<Button onClick={() => setForm({ modo: 'nuevo' })}>Nuevo gasto</Button>} />
        )
      ) : (
        <div className={cn('overflow-x-auto rounded-lg border border-line bg-surface transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching}>
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Seleccionar todos los de esta página" checked={todasSeleccionadas} onChange={alternarTodas} /></th>
                <Th activo={filtros.orden === 'fecha'} dir={filtros.dir} onClick={() => ordenarPor('fecha')}>Fecha</Th>
                <Th activo={filtros.orden === 'descripcion'} dir={filtros.dir} onClick={() => ordenarPor('descripcion')}>Descripción</Th>
                <th className="px-3 py-3">Clasificación</th>
                <th className="px-3 py-3">Ámbito</th>
                <th className="px-3 py-3">Medio</th>
                <th className="px-3 py-3">Fondos</th>
                <Th activo={filtros.orden === 'monto'} dir={filtros.dir} onClick={() => ordenarPor('monto')} alinear="right">Importe</Th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((g) => {
                const amb = nom.ambito.get(g.ambito_id); const cat = nom.categoria.get(g.categoria_id); const sub = g.subcategoria_id ? nom.sub.get(g.subcategoria_id) : null; const med = nom.medio.get(g.payment_method_id)
                const anulado = g.status === 'annulled'
                return (
                  <tr key={g.id} className={cn('border-b border-line last:border-0', seleccion.has(g.id) && 'bg-pri-soft/40', anulado && 'text-muted')}>
                    <td className="px-3 py-3"><input type="checkbox" aria-label={`Seleccionar ${g.description}`} checked={seleccion.has(g.id)} onChange={() => alternar(g)} /></td>
                    <td className="num whitespace-nowrap px-3 py-3">{formatFecha(g.expense_date, formato)}</td>
                    <td className="max-w-64 px-3 py-3"><p className={cn('truncate font-medium', anulado && 'line-through')}>{g.description}</p><p className="text-xs text-muted">{g.expense_type === 'fixed' ? 'Fijo' : 'Variable'}{g.is_recurring ? ' · recurrente' : ''}{g.receipt_path ? ' · con comprobante' : ''}</p></td>
                    <td className="px-3 py-3"><div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={cat?.icon_key} color={cat?.color_token} /></span><div className="min-w-0"><p className="truncate">{cat?.name}</p><p className="truncate text-xs text-muted">{sub?.name ?? '—'}</p></div></div></td>
                    <td className="px-3 py-3"><Pill tone="neutral"><ItemIcon name={amb?.icon_key} color={amb?.color_token} className="size-3" /> {amb?.name}</Pill></td>
                    <td className="whitespace-nowrap px-3 py-3"><span className="inline-flex items-center gap-1.5"><ItemIcon name={med?.icon_key} color={med?.color_token} />{med?.name}</span></td>
                    <td className="px-3 py-3">{anulado ? <Pill tone="bad">Anulado</Pill> : <div className="flex flex-wrap gap-1">{g.expense_fund_allocations.map((a) => <Pill key={a.fund_id} tone={a.allocation_kind === 'general' ? 'warn' : 'pri'}>{fondoPorId.get(a.fund_id)?.name ?? 'Fondo'}{g.expense_fund_allocations.length > 1 ? ` ${formatSoles(Number(a.amount))}` : ''}</Pill>)}</div>}</td>
                    <td className={cn('num whitespace-nowrap px-3 py-3 text-right font-medium', anulado && 'line-through')}>{formatSoles(Number(g.amount))}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-0.5">
                        <Accion label={`Ver detalle de ${g.description}`} onClick={() => setDetalle(g)}><Eye className="size-4" aria-hidden="true" /></Accion>
                        <Accion label={`Editar ${g.description}`} disabled={anulado} onClick={() => setForm({ modo: 'editar', gasto: g })}><Pencil className="size-4" aria-hidden="true" /></Accion>
                        <Accion label={`Clonar ${g.description}`} onClick={() => setForm({ modo: 'clonar', gasto: g })}><Copy className="size-4" aria-hidden="true" /></Accion>
                        {anulado
                          ? <Accion label={`Restaurar ${g.description}`} onClick={() => setConfirmar({ tipo: 'restaurar', gastos: [g] })}><Undo2 className="size-4" aria-hidden="true" /></Accion>
                          : <Accion label={`Anular ${g.description}`} onClick={() => setConfirmar({ tipo: 'anular', gastos: [g] })}><Ban className="size-4" aria-hidden="true" /></Accion>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">Mostrando <b className="num text-fg">{(filtros.pagina - 1) * TAMANO_PAGINA + 1}–{Math.min(total, filtros.pagina * TAMANO_PAGINA)}</b> de <b className="num text-fg">{total}</b></span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={filtros.pagina <= 1} onClick={() => cambiar({ pagina: filtros.pagina - 1 })}><ChevronLeft className="size-4" aria-hidden="true" /> Anterior</Button>
              <span className="num text-muted">Página {filtros.pagina} de {paginas}</span>
              <Button variant="secondary" disabled={filtros.pagina >= paginas} onClick={() => cambiar({ pagina: filtros.pagina + 1 })}>Siguiente <ChevronRight className="size-4" aria-hidden="true" /></Button>
            </div>
          </nav>
        </div>
      )}

      {form && <GastoForm modo={form.modo} gasto={form.gasto} onClose={() => setForm(null)} />}
      {plantillas && <PlantillasDialog onClose={() => setPlantillas(false)} />}
      {lote && <LoteDialog onClose={() => setLote(false)} />}
      {detalle && <DetalleGasto g={detalle} nom={nom} fondoPorId={fondoPorId} formato={formato} onClose={() => setDetalle(null)} />}

      <ConfirmDialog
        open={Boolean(confirmar)}
        onOpenChange={(o) => !o && !pendiente && setConfirmar(null)}
        title={confirmar ? `${confirmar.tipo === 'anular' ? 'Anular' : 'Restaurar'} ${confirmar.gastos.length} ${confirmar.gastos.length === 1 ? 'gasto' : 'gastos'}` : ''}
        confirmLabel={confirmar?.tipo === 'anular' ? 'Anular' : 'Restaurar'}
        danger={confirmar?.tipo === 'anular'}
        loading={pendiente}
        onConfirm={ejecutar}
        description={confirmar && <EfectoAnulacion tipo={confirmar.tipo} gastos={confirmar.gastos} fondoPorId={fondoPorId} />}
      />
    </div>
  )
}

function Filtro({ etiqueta, id, children }: { etiqueta: string; id: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label htmlFor={id} className="text-sm font-medium">{etiqueta}</label>{children}</div>
}

function Th({ children, activo, dir, onClick, alinear }: { children: React.ReactNode; activo: boolean; dir: 'asc' | 'desc'; onClick: () => void; alinear?: 'right' }) {
  return (
    <th className={cn('px-3 py-3', alinear === 'right' && 'text-right')} aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-fg', activo && 'text-fg')}>
        {children}{activo && (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />)}
      </button>
    </th>
  )
}

function Accion({ label, children, ...p }: { label: string; children: React.ReactNode } & React.ComponentProps<'button'>) {
  return <button type="button" aria-label={label} title={label} className="grid size-8 place-items-center rounded-md hover:bg-surface-2 disabled:opacity-30" {...p}>{children}</button>
}

function EfectoAnulacion({ tipo, gastos, fondoPorId }: { tipo: 'anular' | 'restaurar'; gastos: GastoConFondos[]; fondoPorId: Map<string, { name: string }> }) {
  const total = gastos.reduce((s, g) => s + Number(g.amount), 0)
  const porFondo = new Map<string, number>()
  for (const g of gastos) for (const a of g.expense_fund_allocations) porFondo.set(a.fund_id, (porFondo.get(a.fund_id) ?? 0) + Number(a.amount))
  return (
    <div className="flex flex-col gap-3">
      <p>{tipo === 'anular' ? 'Los gastos anulados dejan de consumir presupuesto, pero se conservan y puedes restaurarlos.' : 'Cada gasto se volverá a imputar a los fondos según las reglas vigentes. Si ningún fondo lo admite, no podrá restaurarse.'}</p>
      <p>Total: <b className="num">{formatSoles(total)}</b> en {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}.</p>
      {tipo === 'anular' && porFondo.size > 0 && (
        <div>
          <p className="mb-1 font-medium text-fg">Se liberará en los fondos:</p>
          <ul className="flex flex-col gap-0.5">{[...porFondo].map(([id, m]) => <li key={id} className="flex justify-between"><span>{fondoPorId.get(id)?.name ?? 'Fondo'}</span><span className="num">{formatSoles(m)}</span></li>)}</ul>
        </div>
      )}
      <p className="text-xs">Los períodos cerrados no se pueden modificar.</p>
    </div>
  )
}

function DetalleGasto({ g, nom, fondoPorId, formato, onClose }: { g: GastoConFondos; nom: ReturnType<typeof nombres>; fondoPorId: Map<string, { name: string }>; formato: string; onClose: () => void }) {
  const [abriendo, setAbriendo] = useState(false)
  async function verComprobante() {
    setAbriendo(true)
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(g.receipt_path!, 60)
    setAbriendo(false)
    if (error || !data) return void toast.error('No se pudo abrir el comprobante.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  const filas: [string, React.ReactNode][] = [
    ['Fecha', <span className="num" key="f">{formatFecha(g.expense_date, formato)}</span>],
    ['Importe', <b className="num" key="i">{formatSoles(Number(g.amount))}</b>],
    ['Ámbito', nom.ambito.get(g.ambito_id)?.name], ['Categoría', nom.categoria.get(g.categoria_id)?.name], ['Subcategoría', g.subcategoria_id ? nom.sub.get(g.subcategoria_id)?.name : '—'],
    ['Medio de pago', nom.medio.get(g.payment_method_id)?.name], ['Tipo', g.expense_type === 'fixed' ? 'Fijo' : 'Variable'], ['Recurrente', g.is_recurring ? 'Sí' : 'No'],
    ['Estado', g.status === 'active' ? 'Activo' : 'Anulado'], ['Notas', g.notes || '—'],
  ]
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={g.description} size="md">
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">{filas.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}</dl>
        {g.status === 'active' && (
          <div>
            <h3 className="mb-1 font-display text-base font-bold">Fondos que lo cubren</h3>
            <ul className="divide-y divide-line rounded-md border border-line">
              {g.expense_fund_allocations.map((a) => <li key={a.fund_id} className="flex items-center justify-between px-3 py-2 text-sm"><span>{fondoPorId.get(a.fund_id)?.name ?? 'Fondo'} {a.allocation_kind === 'general' && <Pill tone="warn">General</Pill>}</span><span className="num">{formatSoles(Number(a.amount))}</span></li>)}
            </ul>
          </div>
        )}
        {g.receipt_path ? <Button variant="secondary" loading={abriendo} onClick={verComprobante} className="w-fit">Ver comprobante</Button> : <Alert tone="info">Sin comprobante.</Alert>}
      </div>
    </Modal>
  )
}
