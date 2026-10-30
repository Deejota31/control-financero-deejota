import { Ban, Download, FileStack, ListChecks, Plus, Receipt, Search, SlidersHorizontal, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Combobox, type ComboOption } from '@/components/ui/Combobox'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { aCsv, descargar } from '@/lib/csv'
import { mensajeDeError } from '@/lib/errors'
import { formatSoles } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { agruparPorNombre, idsDe, valorDeGrupo } from '@/domain/idsFiltro'
import { opciones, opcionesAgrupadas, useCatalogo, type Catalogo } from '@/features/catalogo/useCatalogo'
import { useFondosRango } from '@/features/fondos/useFondos'
import { usePerfil } from '@/features/perfil/usePerfil'
import { DetalleGasto } from './DetalleGasto'
import { GastoForm, type ModoGasto } from './GastoForm'
import { BarraFiltros, CeldaFiltro } from '@/components/ui/BarraFiltros'
import { FiltroFecha } from '@/components/ui/FiltroFecha'
import { useHoy } from '@/features/fondos/useHoy'
import * as Popover from '@radix-ui/react-popover'
import { useRegistroGasto } from './RegistroGasto'
import { TablaGastos } from './TablaGastos'
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
  const navigate = useNavigate()
  const catalogo = useCatalogo()
  const fondosQ = useFondosRango(filtros.desde, filtros.hasta)
  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const q = useGastosPagina(filtros)
  const mut = useGastoMutaciones()
  const nom = useMemo(() => nombres(catalogo), [catalogo])
  const fondoPorId = useMemo(() => new Map((fondosQ.data ?? []).map((f) => [f.id, f])), [fondosQ.data])
  // Cada fondo es de un solo mes: en un rango de varios meses se muestra una opción por nombre y filtra todas sus instancias.
  const opcionesFondo = useMemo(() => agruparPorNombre(fondosQ.data ?? [], filtros.fondo).map((g) => ({ value: g.valor, label: g.nombre, icon: g.primero.icon_key, color: g.primero.color_token })), [fondosQ.data, filtros.fondo])

  const [texto, setTexto] = useState(filtros.q)
  const textoDebounced = useDebounced(texto, 350)
  useEffect(() => {
    if (textoDebounced !== filtros.q) cambiar({ q: textoDebounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoDebounced])

  const [form, setForm] = useState<{ modo: Exclude<ModoGasto, 'nuevo'>; gasto?: GastoConFondos } | null>(null)
  const { abrir: abrirNuevo } = useRegistroGasto()
  // Filtros avanzados activos (los de período y la búsqueda se ven siempre o tienen su propio control).
  const nActivos = [filtros.ambito, filtros.categoria, filtros.subcategoria, filtros.medio, filtros.fondo, filtros.tipo].filter(Boolean).length + (filtros.estado !== 'active' ? 1 : 0)
  const [lote, setLote] = useState(() => params.get('lote') === '1')
  const [plantillas, setPlantillas] = useState(false)
  const [detalle, setDetalle] = useState<GastoConFondos | null>(null)
  const [confirmar, setConfirmar] = useState<{ tipo: 'anular' | 'restaurar'; gastos: GastoConFondos[] } | null>(null)
  const [seleccion, setSeleccion] = useState<Map<string, GastoConFondos>>(new Map())
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    if (params.get('lote')) {
      setParams((p) => { const o = new URLSearchParams(p); o.delete('lote'); return o }, { replace: true })
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
  const subsFiltro = useMemo(() => { const cats = idsDe(filtros.categoria); return catalogo.subcategorias.filter((s) => cats.includes(s.categoria_id)) }, [catalogo.subcategorias, filtros.categoria])
  // Una opción por nombre: elegir «Alimentación» filtra todas las clasificaciones con ese nombre (ver domain/idsFiltro).
  const gruposCat = useMemo(() => agruparPorNombre(categoriasFiltro, filtros.categoria), [categoriasFiltro, filtros.categoria])
  const gruposSub = useMemo(() => agruparPorNombre(subsFiltro, filtros.subcategoria), [subsFiltro, filtros.subcategoria])

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
  const hoyZona = useHoy()

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">{q.isPending ? 'Cargando…' : `${total} ${total === 1 ? 'movimiento' : 'movimientos'} con los filtros aplicados`}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 w-52 max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-pri xl:w-64">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Buscar</span>
            <input id="buscar" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar descripción…" aria-label="Buscar" className="sin-anillo min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted" />
          </label>
          <Button variant="secondary" onClick={() => setPlantillas(true)}><FileStack className="size-4" aria-hidden="true" /> Plantillas</Button>
          <Button variant="secondary" onClick={() => setLote(true)}><ListChecks className="size-4" aria-hidden="true" /> Registrar mensuales</Button>
          <Button variant="secondary" onClick={exportarFiltro} loading={exportando}><Download className="size-4" aria-hidden="true" /> Exportar CSV</Button>
          <Button onClick={abrirNuevo}><Plus className="size-4" aria-hidden="true" /> Nuevo gasto</Button>
        </div>
      </div>

      <BarraFiltros contador={nActivos + (filtros.medio ? 0 : 0)}
        acciones={hayFiltros ? <Button variant="ghost" aria-label="Limpiar filtros" title="Limpiar filtros" onClick={() => { setTexto(''); limpiar() }} className="shrink-0 px-2.5"><X className="size-4" aria-hidden="true" /></Button> : undefined}>
        <CeldaFiltro peso={1.4} min="16rem" completa><FiltroFecha modo="rango" desde={filtros.desde} hasta={filtros.hasta} formato={formato} hoy={hoyZona} onAplicar={(d, h) => cambiar({ desde: d, hasta: h })} /></CeldaFiltro>
        <CeldaFiltro peso={1.2} min="9.5rem"><Combobox id="f-medio" aria-label="Medio de pago" value={filtros.medio || null} clearable searchable={false} options={opciones(catalogo.medios, filtros.medio)} placeholder="Medio de pago" onChange={(v) => cambiar({ medio: v ?? '' })} /></CeldaFiltro>
        <CeldaFiltro peso={0.8} min="6.5rem"><Combobox id="f-ambito" aria-label="Ámbito" value={filtros.ambito || null} clearable searchable={false} options={opciones(catalogo.ambitos, filtros.ambito)} placeholder="Ámbito" onChange={(v) => cambiar({ ambito: v ?? '', categoria: '', subcategoria: '' })} /></CeldaFiltro>
        <CeldaFiltro peso={1} min="8rem"><Combobox id="f-categoria" aria-label="Categoría" value={valorDeGrupo(gruposCat, filtros.categoria)} clearable options={opcionesAgrupadas(categoriasFiltro, filtros.categoria)} placeholder="Categoría" onChange={(v) => cambiar({ categoria: v ?? '', subcategoria: '' })} /></CeldaFiltro>
        <CeldaFiltro peso={1.05} min="8.5rem"><Combobox id="f-sub" aria-label="Subcategoría" value={valorDeGrupo(gruposSub, filtros.subcategoria)} clearable disabled={!filtros.categoria} options={opcionesAgrupadas(subsFiltro, filtros.subcategoria)} placeholder="Subcategoría" onChange={(v) => cambiar({ subcategoria: v ?? '' })} /></CeldaFiltro>
        <CeldaFiltro peso={0.7} min="6rem"><Combobox id="f-tipo" aria-label="Tipo" value={filtros.tipo || null} clearable searchable={false} options={TIPOS} placeholder="Tipo" onChange={(v) => cambiar({ tipo: (v ?? '') as FiltrosGastos['tipo'] })} /></CeldaFiltro>
        <CeldaFiltro peso={0.7} min="7.5rem"><Combobox id="f-estado" aria-label="Estado" value={filtros.estado} searchable={false} options={ESTADOS} onChange={(v) => cambiar({ estado: (v ?? 'active') as FiltrosGastos['estado'] })} /></CeldaFiltro>
        <CeldaFiltro peso={0} min="2.5rem">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button type="button" aria-label={filtros.fondo ? 'Más filtros (1 activo)' : 'Más filtros'} title="Más filtros: fondo" className="relative grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2">
                <SlidersHorizontal className="size-4" aria-hidden="true" />{filtros.fondo && <span aria-hidden="true" className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-surface bg-pri" />}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} collisionPadding={12} aria-label="Filtros adicionales" className="anim-pop z-[80] w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-4 shadow-pop">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f-fondo" className="text-sm font-medium">Fondo</label>
                  <Combobox id="f-fondo" value={filtros.fondo || null} clearable searchable={false} options={opcionesFondo} placeholder="Todos los fondos" onChange={(v) => cambiar({ fondo: v ?? '' })} />
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </CeldaFiltro>
      </BarraFiltros>

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
          catalogo.ambitos.length === 0 || catalogo.medios.length === 0 ? (
            <EmptyState icon={Receipt} title="Primero configura tu catálogo" description="Para registrar un gasto necesitas al menos un ámbito, una categoría y un medio de pago (Catálogo) y un fondo que lo cubra (Fondos)."
              action={<div className="flex gap-2"><Button onClick={() => navigate('/catalogo')}>Ir al Catálogo</Button><Button variant="secondary" onClick={() => navigate('/fondos')}>Ir a Fondos</Button></div>} />
          ) : (
            <EmptyState icon={Receipt} title="Aún no hay gastos en este período" description="Registra el primero o crea gastos desde tus plantillas mensuales." action={<Button onClick={abrirNuevo}>Nuevo gasto</Button>} />
          )
        )
      ) : (
        <TablaGastos
          filas={filas} filtros={filtros} nom={nom} fondoPorId={fondoPorId} formato={formato} seleccion={seleccion} total={total} paginas={paginas}
          cargando={q.isFetching} recargando={q.isPlaceholderData}
          onAlternar={alternar} onAlternarTodas={alternarTodas} onOrdenar={ordenarPor} onCambiar={cambiar}
          onDetalle={setDetalle} onEditar={(g) => setForm({ modo: 'editar', gasto: g })} onClonar={(g) => setForm({ modo: 'clonar', gasto: g })}
          onConfirmar={(tipo, g) => setConfirmar({ tipo, gastos: [g] })}
        />
      )}

      {form && <GastoForm modo={form.modo} gasto={form.gasto} onClose={() => setForm(null)} />}
      {plantillas && <PlantillasDialog onClose={() => setPlantillas(false)} />}
      {lote && <LoteDialog onClose={() => setLote(false)} />}
            {detalle && <DetalleGasto g={detalle} nom={nom} fondoPorId={fondoPorId} formato={formato} onClose={() => setDetalle(null)} onEditar={(g) => { setDetalle(null); setForm({ modo: 'editar', gasto: g }) }} onClonar={(g) => { setDetalle(null); setForm({ modo: 'clonar', gasto: g }) }} />}

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
