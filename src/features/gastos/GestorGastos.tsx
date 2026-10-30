import { CalendarDays, Check, ChevronsDownUp, ChevronsUpDown, CircleDashed, CopyPlus, GripVertical, ListChecks, Pencil, Plus, Power, Receipt, Search, Square, Trash2, ArrowUp, ArrowDown, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FilaAcciones, GrupoAcciones, MenuDeAcciones, useAnchoMinimo, type AccionFila } from '@/components/ui/AccionesFila'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ChipK, TinteK } from '@/components/ui/ChipK'
import { Combobox } from '@/components/ui/Combobox'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { Hint } from '@/components/ui/Hint'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MesSelector } from '@/components/ui/MesSelector'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { agrupar, claveDeNombre, estadoSeleccion, moverAntes, moverDelta, ordenarSecciones, reordenarVisibles, type ClaveSeccion } from '@/domain/agrupacion'
import { fechaEfectiva, nombreCopia } from '@/domain/plantillas'
import { diferenciasConBase, problemasDeFila, valoresBase, type Ajuste, type ValoresFila } from '@/domain/registroPlantillas'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { formatMes, formatSoles, parseImporte, sumarImportes } from '@/lib/format'
import type { Plantilla } from '@/lib/tipos'
import { usePreferencia } from '@/lib/usePreferencia'
import { opciones, useCatalogo, type Catalogo } from '@/features/catalogo/useCatalogo'
import { finDeMes, mesDeFecha } from '@/domain/periodo'
import { usePeriodo } from '@/features/periodos/usePeriodo'
import { usePerfil } from '@/features/perfil/usePerfil'
import { CasillaTriestado, SeccionPlantillas } from '@/features/plantillas/comun'
import { claseDe } from '@/features/plantillas/clase'
import { GastoForm } from './GastoForm'
import { RevisionRegistro } from './RevisionRegistro'
import { useEstadoLote, usePlantillaMutaciones, usePlantillas, useUsosPlantillas, type PlantillaValores } from './usePlantillas'

const MES_ACTUAL = mesDeFecha(new Date())

type Agrupar = 'categoria' | 'ambito' | 'tipo' | 'medio'
type Orden = 'manual' | 'nombre' | 'importe'
interface Prefs { agrupar: Agrupar; orden: Orden; secciones: Partial<Record<Agrupar, string[]>> }
const PREFS: Prefs = { agrupar: 'categoria', orden: 'manual', secciones: {} }

const ACCION_SEC = 'inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40'

const OPCIONES_AGRUPAR: { value: Agrupar; label: string; corto: string }[] = [
  { value: 'categoria', label: 'Agrupar por categoría', corto: 'Por categoría' }, { value: 'ambito', label: 'Agrupar por ámbito', corto: 'Por ámbito' },
  { value: 'tipo', label: 'Agrupar por tipo (fijo / variable)', corto: 'Por tipo' }, { value: 'medio', label: 'Agrupar por medio de pago', corto: 'Por medio' },
]
const OPCIONES_ORDEN: { value: Orden; label: string; corto: string }[] = [
  { value: 'manual', label: 'Orden manual', corto: 'Ordenar' }, { value: 'nombre', label: 'Orden por nombre', corto: 'Por nombre' }, { value: 'importe', label: 'Orden por importe', corto: 'Por importe' },
]
const OPCIONES_ESTADO = [
  { value: 'todas', label: 'Todas', corto: 'Estado: todas' }, { value: 'activas', label: 'Activas', corto: 'Estado' }, { value: 'inactivas', label: 'Inactivas', corto: 'Estado: inactivas' },
]
/** Una sola definición de columnas para el encabezado y las filas (así siempre coinciden): selección · plantilla · clasificación · importe · medio · fecha · estado · acciones. */
const COLUMNAS = '@min-[58rem]:grid-cols-[3.25rem_minmax(0,1.6fr)_minmax(7rem,0.9fr)_6.5rem_10rem_8rem_6rem_2.25rem]'

/** Clave y título de la sección de una plantilla según el modo de agrupación, con los datos reales del catálogo. */
function seccionDe(p: Plantilla, modo: Agrupar, cat: Catalogo): ClaveSeccion {
  if (modo === 'categoria') {
    const c = cat.categorias.find((x) => x.id === p.categoria_id)
    return c ? { clave: claveDeNombre(c.name), titulo: c.name, icono: c.icon_key, color: c.color_css } : { clave: 'sin-categoria', titulo: 'Sin categoría' }
  }
  if (modo === 'ambito') {
    const a = cat.ambitos.find((x) => x.id === p.ambito_id)
    return a ? { clave: a.id, titulo: a.name, icono: a.icon_key, color: a.color_css } : { clave: 'sin-ambito', titulo: 'Sin ámbito' }
  }
  if (modo === 'tipo') return p.expense_type === 'fixed' ? { clave: 'fixed', titulo: 'Gastos fijos', icono: 'repeat' } : { clave: 'variable', titulo: 'Gastos variables', icono: 'activity' }
  const m = cat.medios.find((x) => x.id === p.payment_method_id)
  return m ? { clave: m.id, titulo: m.name, icono: m.icon_key, color: m.color_css } : { clave: 'sin-medio', titulo: 'Sin medio sugerido' }
}

/**
 * Gestor de plantillas de gastos: administra la biblioteca (crear, editar, duplicar, activar, eliminar, ordenar) y prepara el registro de varias a la vez.
 * Secciones expandibles, selección múltiple, importe, fecha y medio editables por fila (solo para el registro, la plantilla no cambia), fecha general,
 * resumen y revisión previa. Los formularios se abren encima sin cerrar quien abrió el gestor (por ejemplo, la planificación).
 */
export function GestorPlantillasGastos({ mes: mesInicial = MES_ACTUAL, embebido = false, onCerrar, onCambio, onSucio }: {
  mes?: string
  /** Dentro de la planificación: el mes lo fija el asistente (sin selector) y el gestor es parte de la etapa. */
  embebido?: boolean
  onCerrar?: () => void
  /** Se registraron gastos (para que quien lo contiene actualice sus contadores). */
  onCambio?: () => void
  /** Hay selecciones o ajustes sin registrar. */
  onSucio?: (v: boolean) => void
}) {
  const q = usePlantillas()
  const catalogo = useCatalogo()
  const mut = usePlantillaMutaciones()
  const usos = useUsosPlantillas()
  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'

  const [mesLocal, setMes] = useState(mesInicial)
  const mes = embebido ? mesInicial : mesLocal
  const periodo = usePeriodo(mes)
  const estadoLote = useEstadoLote(periodo.data?.id, mes, finDeMes(mes))
  const cerrado = periodo.data?.status === 'closed'

  const [prefs, setPrefs] = usePreferencia<Prefs>('gd.plantillas-gastos.v1', PREFS)
  const [abiertas, setAbiertas] = usePreferencia<Record<string, boolean>>('gd.plantillas-gastos.abiertas', {}, 'session')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'activas' | 'inactivas' | 'todas'>('activas')
  const [tipo, setTipo] = useState<'todos' | 'fixed' | 'variable'>('todos')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({})
  const [editando, setEditando] = useState<Plantilla | 'nueva' | null>(null)
  const [registrando, setRegistrando] = useState<Plantilla | null>(null)
  const [borrar, setBorrar] = useState<Plantilla | null>(null)
  const [actualizar, setActualizar] = useState<Plantilla | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [intento, setIntento] = useState(false)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [refRaiz, tabla] = useAnchoMinimo<HTMLDivElement>(928) // 58 rem: desde aquí caben las columnas; por debajo, tarjetas con panel de acciones
  const idBusqueda = embebido ? 'busqueda-plantillas-gastos-etapa' : 'busqueda-plantillas-gastos'
  const sucio = sel.size > 0 && Object.keys(ajustes).length > 0
  useEffect(() => { onSucio?.(sucio) }, [sucio, onSucio])

  const lista = useMemo(() => q.data ?? [], [q.data])
  const registradas = useMemo(() => estadoLote.data?.registradas ?? new Set<string>(), [estadoLote.data])

  const base = (p: Plantilla): ValoresFila => valoresBase(p, mes)
  const fila = (p: Plantilla): ValoresFila => ({ ...base(p), ...ajustes[p.id] })
  const ajustar = (id: string, patch: Ajuste) => {
    setAjustes((a) => ({ ...a, [id]: { ...a[id], ...patch } }))
    setSel((s) => new Set(s).add(id)) // editar un valor es querer registrar esa plantilla
    setIntento(false)
  }

  const busca = texto.trim().toLowerCase()
  const visibles = useMemo(() => {
    const v = lista.filter((p) => (estado === 'todas' || (estado === 'activas') === p.is_active) && (tipo === 'todos' || p.expense_type === tipo)
      && (!soloPendientes || !registradas.has(p.id)) && (!busca || `${p.name} ${p.description}`.toLowerCase().includes(busca)))
    if (prefs.orden === 'nombre') return [...v].sort((a, b) => a.name.localeCompare(b.name))
    if (prefs.orden === 'importe') return [...v].sort((a, b) => Number(b.default_amount ?? 0) - Number(a.default_amount ?? 0))
    return v
  }, [lista, estado, tipo, soloPendientes, registradas, busca, prefs.orden])

  const secciones = useMemo(
    () => ordenarSecciones(agrupar(visibles, (p) => seccionDe(p, prefs.agrupar, catalogo)), prefs.secciones[prefs.agrupar] ?? []),
    [visibles, prefs.agrupar, prefs.secciones, catalogo],
  )
  const manual = prefs.orden === 'manual'
  const puedeOrdenarSecciones = manual && prefs.agrupar !== 'tipo' && !busca

  // ---- selección ----
  const idsVisibles = visibles.filter((p) => p.is_active).map((p) => p.id)
  const marcar = (ids: string[], marcarlas: boolean) => setSel((s) => { const n = new Set(s); for (const id of ids) { if (marcarlas) n.add(id); else n.delete(id) } return n })
  const elegidas = lista.filter((p) => sel.has(p.id))
  const importeDe = (p: Plantilla) => parseImporte(fila(p).amount) ?? 0
  const total = sumarImportes(elegidas.map(importeDe))
  const ocultas = elegidas.filter((p) => !visibles.some((v) => v.id === p.id)).length

  const problemas = (p: Plantilla): string[] => problemasDeFila(fila(p), mes)
  const conProblemas = elegidas.filter((p) => problemas(p).length > 0)

  // ---- fechas ----
  // Cada fila edita su propia fecha; al cambiar de mes se descartan las del mes anterior.
  function cambiarMes(m: string) {
    setMes(m)
    setAjustes((a) => Object.fromEntries(Object.entries(a).map(([id, v]) => { const { date: _d, ...resto } = v; return [id, resto] }))) // las fechas eran del mes anterior
  }

  // ---- orden manual (solo presentación) ----
  const idsTodos = lista.map((p) => p.id)
  const guardarOrden = (ids: string[]) => mut.reordenar.mutate(ids, { onError: (e) => toast.error(mensajeDeError(e, 'No se pudo guardar el orden.')) })
  function soltar(destino: string, origen: string) {
    setArrastrando(null)
    if (!manual || origen === destino) return
    guardarOrden(moverAntes(idsTodos, origen, destino))
  }
  function moverFila(id: string, delta: -1 | 1) {
    const sec = secciones.find((s) => s.items.some((x) => x.id === id))
    if (!sec) return
    const ids = sec.items.map((x) => x.id)
    guardarOrden(reordenarVisibles(idsTodos, ids, moverDelta(ids, id, delta)))
  }
  function moverSeccion(clave: string, delta: -1 | 1) {
    const claves = secciones.map((s) => s.clave)
    setPrefs({ ...prefs, secciones: { ...prefs.secciones, [prefs.agrupar]: moverDelta(claves, clave, delta) } })
  }

  // ---- acciones de la biblioteca ----
  function duplicar(p: Plantilla) {
    const valores: PlantillaValores = {
      name: nombreCopia(p.name, lista.map((x) => x.name)), description: p.description, notes: p.notes, default_amount: p.default_amount === null ? null : Number(p.default_amount),
      is_amount_variable: p.is_amount_variable, ambito_id: p.ambito_id, categoria_id: p.categoria_id, subcategoria_id: p.subcategoria_id,
      payment_method_id: p.payment_method_id, default_fund_id: p.default_fund_id, expense_type: p.expense_type as 'fixed' | 'variable', day_of_month: p.day_of_month,
    }
    mut.guardar.mutate({ valores, orden: lista.length + 1 }, { onSuccess: () => toast.success('Plantilla duplicada.'), onError: (e) => toast.error(mensajeDeError(e)) })
  }
  const diferencias = (p: Plantilla) => diferenciasConBase(fila(p), base(p))

  /** Todas las acciones de la biblioteca para una plantilla; alimentan el menú de escritorio y el panel de tarjeta. */
  const accionesDe = (p: Plantilla, puedeActualizar: boolean): AccionFila[] => {
    const orden = manual && !busca
    return [
      { clave: 'registrar', etiqueta: 'Registrar solo esta (formulario)', nombreAccesible: `Registrar solo esta (formulario) ${p.name}`, icono: Receipt, deshabilitada: !p.is_active, motivo: 'Plantilla inactiva: actívala para registrarla', onSelect: () => setRegistrando(p) },
      { clave: 'editar', etiqueta: 'Editar plantilla', nombreAccesible: `Editar plantilla ${p.name}`, icono: Pencil, onSelect: () => setEditando(p) },
      { clave: 'actualizar', etiqueta: 'Actualizar plantilla con estos valores', nombreAccesible: `Actualizar plantilla con estos valores de ${p.name}`, icono: Save, deshabilitada: !puedeActualizar, motivo: 'Aún no cambiaste importe, fecha ni medio', onSelect: () => setActualizar(p) },
      { clave: 'duplicar', etiqueta: 'Duplicar', nombreAccesible: `Duplicar plantilla ${p.name}`, icono: CopyPlus, onSelect: () => duplicar(p) },
      { clave: 'activar', etiqueta: p.is_active ? 'Desactivar' : 'Activar', nombreAccesible: `${p.is_active ? 'Desactivar' : 'Activar'} plantilla ${p.name}`, icono: Power, onSelect: () => mut.activar.mutate({ id: p.id, is_active: !p.is_active }, { onError: (e) => toast.error(mensajeDeError(e)) }) },
      { clave: 'subir', etiqueta: 'Subir en la sección', nombreAccesible: `Subir en la sección ${p.name}`, icono: ArrowUp, deshabilitada: !orden, motivo: 'Solo con orden manual y sin búsqueda', onSelect: () => moverFila(p.id, -1) },
      { clave: 'bajar', etiqueta: 'Bajar en la sección', nombreAccesible: `Bajar en la sección ${p.name}`, icono: ArrowDown, deshabilitada: !orden, motivo: 'Solo con orden manual y sin búsqueda', onSelect: () => moverFila(p.id, 1) },
      { clave: 'eliminar', etiqueta: 'Eliminar', nombreAccesible: `Eliminar plantilla ${p.name}`, icono: Trash2, tono: 'peligro', onSelect: () => setBorrar(p) },
    ]
  }

  const cargando = q.isPending || catalogo.isPending
  const seccionAbierta = (clave: string, items: number) => (busca ? items > 0 : (abiertas[`${prefs.agrupar}:${clave}`] ?? true))
  const todasAbiertas = secciones.every((s) => seccionAbierta(s.clave, s.items.length))
  function alternarTodas() {
    const n = { ...abiertas }
    for (const s of secciones) n[`${prefs.agrupar}:${s.clave}`] = !todasAbiertas
    setAbiertas(n)
  }

  return (
    <>
      <div ref={refRaiz} className="@container flex min-w-0 flex-col gap-3">
        {/* Encabezado: período destino, fecha general, búsqueda y filtros */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {embebido ? <span className="text-sm font-semibold">{formatMes(mes)}</span> : <MesSelector mes={mes} onChange={cambiarMes} />}
            {cerrado && <Pill tone="warn">Período cerrado</Pill>}
          </div>
          <Button onClick={() => setEditando('nueva')}><Plus className="size-4" aria-hidden="true" /> Nueva plantilla</Button>
        </div>
        {cerrado && <Alert tone="info">{formatMes(mes)} está cerrado: no se pueden registrar gastos en él. Puedes seguir administrando tus plantillas.</Alert>}

        {/* Filtros principales: una sola fila de controles de igual altura */}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={idBusqueda} className="sr-only">Buscar plantilla</label>
          <div className="flex h-8 min-w-0 flex-[2_1_10rem] items-center gap-2 rounded-md border border-line bg-surface px-2 text-muted focus-within:border-pri">
            <Search className="size-3.5 shrink-0" aria-hidden="true" />
            <input id={idBusqueda} type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar plantilla..." className="sin-anillo min-w-0 flex-1 bg-transparent text-xs text-fg placeholder:text-muted [&::-webkit-search-cancel-button]:hidden" />
            {texto && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setTexto('')} className="grid size-5 shrink-0 place-items-center rounded hover:bg-surface-2"><X className="size-3.5" aria-hidden="true" /></button>}
          </div>
          <div className="min-w-0 flex-[1_1_7.5rem] sm:max-w-40"><Combobox compacto aria-label="Agrupación" value={prefs.agrupar} searchable={false} options={OPCIONES_AGRUPAR} onChange={(v) => setPrefs({ ...prefs, agrupar: (v ?? 'categoria') as Agrupar })} /></div>
          <div className="min-w-0 flex-[1_1_6.5rem] sm:max-w-32"><Combobox compacto aria-label="Orden" value={prefs.orden} searchable={false} options={OPCIONES_ORDEN} onChange={(v) => setPrefs({ ...prefs, orden: (v ?? 'manual') as Orden })} /></div>
          <div className="min-w-0 flex-[1_1_6.5rem] sm:max-w-32"><Combobox compacto aria-label="Estado" value={estado} searchable={false} options={OPCIONES_ESTADO} onChange={(v) => setEstado((v ?? 'activas') as typeof estado)} /></div>
          <div className="min-w-0 flex-[1_1_6rem] sm:max-w-28"><Combobox compacto aria-label="Tipo" value={tipo} searchable={false} options={[{ value: 'todos', label: 'Todos los tipos', corto: 'Tipo' }, { value: 'fixed', label: 'Fijos', corto: 'Fijos' }, { value: 'variable', label: 'Variables', corto: 'Variables' }]} onChange={(v) => setTipo((v ?? 'todos') as typeof tipo)} /></div>
          <Hint contenido={`Mostrar únicamente plantillas pendientes de registrar en ${formatMes(mes)}`}>
            <button type="button" aria-pressed={soloPendientes} onClick={() => setSoloPendientes(!soloPendientes)}
              className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors', soloPendientes ? 'border-pri bg-pri-soft text-pri' : 'border-line bg-surface text-muted hover:text-fg')}>
              <CircleDashed className="size-3.5" aria-hidden="true" /> Pendientes {soloPendientes && <Check className="size-3" aria-hidden="true" />}
            </button>
          </Hint>
        </div>

        {/* Acciones de selección: barra secundaria discreta */}
        <div className="-mt-1 flex flex-wrap items-center gap-0.5 text-xs">
          <button type="button" onClick={() => marcar(idsVisibles, true)} disabled={idsVisibles.length === 0} className={ACCION_SEC}><ListChecks className="size-3.5" aria-hidden="true" /> Seleccionar visibles</button>
          <button type="button" onClick={() => marcar(lista.map((p) => p.id), false)} disabled={sel.size === 0} className={ACCION_SEC}><Square className="size-3.5" aria-hidden="true" /> Deseleccionar todas</button>
          <button type="button" onClick={alternarTodas} disabled={secciones.length === 0} className={ACCION_SEC}>{todasAbiertas ? <ChevronsDownUp className="size-3.5" aria-hidden="true" /> : <ChevronsUpDown className="size-3.5" aria-hidden="true" />} {todasAbiertas ? 'Contraer secciones' : 'Expandir secciones'}</button>
        </div>

        {cargando ? <Skeleton className="h-40" /> : q.isError ? <ErrorState message="No se pudieron cargar las plantillas." onRetry={() => q.refetch()} /> : lista.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aún no tienes plantillas" description="Crea una para gastos que se repiten, como alquiler, internet o suscripciones, o guarda un gasto existente como plantilla."
            action={<Button onClick={() => setEditando('nueva')}><Plus className="size-4" aria-hidden="true" /> Crear la primera</Button>} />
        ) : visibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Ninguna plantilla coincide con la búsqueda o los filtros.</p>
        ) : (
          <GrupoAcciones clave={JSON.stringify([texto, estado, tipo, soloPendientes, prefs.agrupar, prefs.orden, mes])}>
          <div className="flex flex-col gap-3" aria-label="Plantillas agrupadas">
            <div className={cn('hidden gap-x-2.5 px-[18px] text-[11px] font-semibold uppercase tracking-wider text-muted @min-[58rem]:grid', COLUMNAS)} aria-hidden="true">
              <span /><span>Plantilla</span><span>Clasificación</span><span>Importe</span><span>Medio</span><span>Fecha</span><span>Estado</span><span />
            </div>
            {secciones.map((s) => {
              const ids = s.items.filter((p) => p.is_active).map((p) => p.id)
              const elegidasSec = s.items.filter((p) => sel.has(p.id))
              return (
                <SeccionPlantillas key={s.clave} titulo={s.titulo} icono={s.icono} color={s.color} total={s.items.length} seleccionadas={elegidasSec.length}
                  subtotal={sumarImportes(elegidasSec.map(importeDe))} estado={estadoSeleccion(ids, sel)} abierta={seccionAbierta(s.clave, s.items.length)}
                  onAbrir={() => setAbiertas({ ...abiertas, [`${prefs.agrupar}:${s.clave}`]: !seccionAbierta(s.clave, s.items.length) })}
                  onSeleccionar={(m) => marcar(ids, m)} onMover={puedeOrdenarSecciones ? (d) => moverSeccion(s.clave, d) : undefined}>
                  {s.items.map((p) => {
                    const f = fila(p)
                    const c = claseDe(catalogo, p)
                    const probs = intento && sel.has(p.id) ? problemas(p) : []
                    const sugerida = fechaEfectiva(p.day_of_month, mes)
                    const uso = usos.data?.get(p.id)
                    const dif = diferencias(p)
                    const hayDif = Object.keys(dif).length > 0
                    const reg = registradas.has(p.id)
                    const omitida = !reg && Boolean(estadoLote.data?.noAplica.has(p.id))
                    const est = reg ? { t: 'Registrada', tono: 'ok' as const } : probs.length > 0 ? { t: 'Error', tono: 'bad' as const } : sel.has(p.id) ? { t: 'Seleccionada', tono: 'pri' as const } : omitida ? { t: 'Omitida', tono: 'neutral' as const } : { t: 'Pendiente', tono: 'warn' as const }
                    const estadoPill = <Pill tone={est.tono}>{reg && <Check className="size-3" aria-hidden="true" />}{est.t}</Pill>
                    return (
                      <FilaAcciones key={p.id} id={p.id} nombre={p.name} acciones={accionesDe(p, hayDif)} activo={!tabla} permitirRaton={!(manual && !busca)} botonCompacto
                        className={cn('rounded-lg border', sel.has(p.id) ? 'border-pri/50 bg-pri-soft/30' : 'border-line', !p.is_active && 'bg-surface-2/40', arrastrando === p.id && 'opacity-50')}
                        tarjetaClassName={cn('grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 px-2 py-2', COLUMNAS, '@min-[58rem]:items-center @min-[58rem]:gap-x-2.5 @min-[58rem]:py-1.5')}
                        tarjetaProps={{
                          draggable: manual && !busca,
                          onDragStart: (e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(p.id) },
                          onDragOver: (e) => { if (manual && arrastrando && arrastrando !== p.id) e.preventDefault() },
                          onDrop: (e) => { e.preventDefault(); const o = e.dataTransfer.getData('text/plain'); if (o) soltar(p.id, o) },
                          onDragEnd: () => setArrastrando(null),
                          'data-plantilla': p.id,
                        }}>
                        {(boton) => (
                      <>
                        <div className="flex items-center gap-1 pt-1 @min-[58rem]:pt-0">
                          {manual && !busca ? <GripVertical data-sin-gesto className="size-4 shrink-0 cursor-grab text-muted" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
                          <CasillaTriestado estado={sel.has(p.id) ? 'all' : 'none'} etiqueta={`Seleccionar ${p.name}`} disabled={!p.is_active} onChange={(m) => marcar([p.id], m)} />
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                          <TinteK color={c.color} className={cn('size-8 shrink-0 rounded-lg', !p.is_active && 'opacity-60')}><ItemIcon name={c.icono} color={c.color} className="size-4" /></TinteK>
                          <div className="min-w-0">
                            <p title={p.name} className={cn('line-clamp-2 font-semibold leading-tight [overflow-wrap:normal] @min-[58rem]:line-clamp-1', !p.is_active && 'text-muted')}>{p.name}</p>
                            {p.description.trim().toLowerCase() !== p.name.trim().toLowerCase() && <p className="truncate text-xs text-muted" title={p.description}>{p.description}</p>}
                            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted @min-[58rem]:hidden">{estadoPill}{!p.is_active && <Pill>Inactiva</Pill>}</p>
                          </div>
                        </div>

                        {/* Clasificación: categoría › subcategoría y, debajo, ámbito y tipo (el resto, para lectores de pantalla y tooltip) */}
                        <div className="col-start-2 col-span-2 row-start-2 flex min-w-0 flex-col items-start gap-0.5 text-xs @min-[58rem]:col-span-1 @min-[58rem]:col-start-3 @min-[58rem]:row-start-1"
                          title={`Mensual${p.day_of_month ? ` · día ${p.day_of_month}` : ''}${p.is_amount_variable ? ' · Importe variable' : ''}${uso ? ` · Usada ${uso.veces} ${uso.veces === 1 ? 'vez' : 'veces'}` : ''}`}>
                          {c.c && <ChipK color={c.color} className="max-w-full" title={`${c.c.name}${c.s ? ` › ${c.s.name}` : ''}`}><span className="truncate">{c.c.name}{c.s ? ` › ${c.s.name}` : ''}</span></ChipK>}
                          <span className="max-w-full truncate text-muted" title={`${c.a?.name ?? ''} · ${p.expense_type === 'fixed' ? 'Fijo' : 'Variable'}`}>{c.a?.name} · {p.expense_type === 'fixed' ? 'Fijo' : 'Variable'}{p.is_amount_variable ? ' · variable' : ''}</span>
                          <span className="sr-only">Mensual{p.day_of_month ? ` · día ${p.day_of_month}` : ''}{p.is_amount_variable ? ' · Importe variable' : ''}{uso ? ` · Usada ${uso.veces} ${uso.veces === 1 ? 'vez' : 'veces'}` : ''}</span>
                          {p.is_amount_variable && sel.has(p.id) && !f.confirmado && <Pill tone="warn">Revisar importe</Pill>}
                        </div>

                        <div className="col-start-3 row-start-1 @min-[58rem]:col-start-8">{boton ?? <MenuDeAcciones nombre={p.name} acciones={accionesDe(p, hayDif)} className="size-9" />}</div>

                        {p.is_active ? (
                          <div className="col-span-3 grid min-w-0 grid-cols-2 gap-2 @min-[40rem]:grid-cols-3 @min-[58rem]:contents">
                            <div className="min-w-0">
                              <MoneyInput aria-label={`Importe de ${p.name}`} value={f.amount} onChange={(x) => ajustar(p.id, { amount: x, confirmado: true })}
                                invalid={probs.some((m) => /importe|número|decimal|signo|máximo|mayor|Usa|Formato|Ingresa/i.test(m))} />
                              {p.is_amount_variable && sel.has(p.id) && !f.confirmado && f.amount !== '' && (
                                <button type="button" onClick={() => ajustar(p.id, { confirmado: true })} className="mt-1 text-xs font-semibold text-pri hover:underline">Confirmar {formatSoles(parseImporte(f.amount) ?? 0)}</button>
                              )}
                            </div>
                            <div className="col-span-2 min-w-0 @min-[40rem]:col-span-1">
                              <Combobox aria-label={`Medio de pago de ${p.name}`} value={f.method} searchable={false} options={opciones(catalogo.medios, f.method)} placeholder="Elegir medio"
                                onChange={(x) => ajustar(p.id, { method: x ?? '' })} invalid={probs.includes('Elige el medio de pago.')} />
                            </div>
                            <div className="min-w-0 col-start-2 row-start-1 @min-[40rem]:col-start-auto @min-[40rem]:row-start-auto">
                              <DatePicker aria-label={`Fecha de ${p.name}`} value={f.date} onChange={(x) => ajustar(p.id, { date: x })} min={mes} max={finDeMes(mes)} formato={formato} />
                              {sugerida.ajustada && f.date === sugerida.iso && <p className="mt-0.5 text-[11px] text-muted">Mes corto: día {p.day_of_month} → {sugerida.iso.slice(8, 10)}</p>}
                            </div>
                            {probs.length > 0 && <p role="alert" className="col-span-2 text-xs font-medium text-bad @min-[40rem]:col-span-3 @min-[58rem]:col-span-8">{probs.join(' ')}</p>}
                          </div>
                        ) : (
                          <p className="col-span-3 text-xs text-muted @min-[58rem]:col-span-3">Inactiva: actívala para poder registrarla.</p>
                        )}
                        <div className="hidden @min-[58rem]:flex @min-[58rem]:items-center">{estadoPill}</div>
                        {sel.has(p.id) && hayDif && <p className="col-span-3 text-[11px] text-muted @min-[58rem]:col-span-8">Ajustes solo para este registro: la plantilla conserva {p.is_amount_variable ? 'su referencia' : formatSoles(Number(p.default_amount ?? 0))}.</p>}
                      </>
                        )}
                      </FilaAcciones>
                    )
                  })}
                </SeccionPlantillas>
              )
            })}
          </div>
          </GrupoAcciones>
        )}
        <div className="sticky -bottom-4 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-3 sm:-bottom-5 sm:-mx-6 sm:px-6 [@media(max-height:520px)]:py-1.5">
          <p className="mr-auto min-w-0 text-sm" aria-live="polite">
            <b>{elegidas.length}</b> {elegidas.length === 1 ? 'seleccionada' : 'seleccionadas'} · <b className="num">{formatSoles(total)}</b> <span className="text-muted">(S/, soles)</span>
            {ocultas > 0 && <span className="text-muted"> · {ocultas} oculta{ocultas === 1 ? '' : 's'} por filtros</span>}
            {intento && conProblemas.length > 0 && <span className="text-bad"> · {conProblemas.length} con datos pendientes</span>}
          </p>
          {onCerrar && <Button variant="secondary" onClick={onCerrar}>Cerrar</Button>}
          <Button disabled={cerrado || elegidas.length === 0} onClick={() => { setIntento(true); if (conProblemas.length === 0) setRevisando(true) }}>
            {elegidas.length === 0 ? 'Revisar y registrar' : `Revisar y registrar ${elegidas.length} ${elegidas.length === 1 ? 'gasto' : 'gastos'}`}
          </Button>
        </div>
      </div>

      {editando && <GastoForm modo={editando === 'nueva' ? 'plantilla' : 'plantilla-editar'} plantilla={editando === 'nueva' ? undefined : editando} orden={lista.length + 1} onClose={() => setEditando(null)} />}
      {registrando && <GastoForm modo="desde-plantilla" plantilla={registrando} mes={mes} onClose={() => setRegistrando(null)} />}
      {revisando && (
        <RevisionRegistro
          filas={elegidas.map((p) => ({ plantilla: p, ...fila(p) }))} mes={mes} formato={formato} registradas={registradas} catalogo={catalogo}
          onClose={() => setRevisando(false)}
          onRegistrados={(ids) => {
            setSel((s) => { const n = new Set(s); for (const id of ids) n.delete(id); return n })
            setAjustes((a) => { const n = { ...a }; for (const id of ids) delete n[id]; return n })
            void estadoLote.refetch()
            onCambio?.()
          }} />
      )}
      <ConfirmDialog open={Boolean(borrar)} onOpenChange={(o) => !o && setBorrar(null)} title={`¿Eliminar "${borrar?.name ?? ''}"?`}
        description="Los gastos ya registrados con esta plantilla se conservan; solo se desvincula la plantilla." confirmLabel="Eliminar" danger loading={mut.eliminar.isPending}
        onConfirm={() => borrar && mut.eliminar.mutate(borrar.id, { onSuccess: () => { toast.success('Plantilla eliminada.'); setSel((s) => { const n = new Set(s); n.delete(borrar.id); return n }); setBorrar(null) }, onError: (e) => { toast.error(mensajeDeError(e)); setBorrar(null) } })} />
      {actualizar && (
        <ConfirmDialog open onOpenChange={(o) => !o && setActualizar(null)} title={`¿Actualizar la plantilla "${actualizar.name}"?`} confirmLabel="Actualizar plantilla" loading={mut.actualizarBase.isPending}
          description={
            <div className="flex flex-col gap-2">
              <p>Esto cambia la configuración ORIGINAL de la plantilla; los próximos registros partirán de estos valores. Los gastos ya registrados no cambian.</p>
              <ul className="list-disc pl-5">
                {diferencias(actualizar).importe !== undefined && <li>Importe: {actualizar.default_amount ? formatSoles(Number(actualizar.default_amount)) : 'sin importe'} → <b>{formatSoles(diferencias(actualizar).importe!)}</b></li>}
                {diferencias(actualizar).medio !== undefined && <li>Medio de pago: {catalogo.medios.find((m) => m.id === actualizar.payment_method_id)?.name ?? 'ninguno'} → <b>{catalogo.medios.find((m) => m.id === diferencias(actualizar).medio)?.name}</b></li>}
                {diferencias(actualizar).dia !== undefined && <li>Día del mes: {actualizar.day_of_month ?? 'sin día'} → <b>{diferencias(actualizar).dia}</b></li>}
              </ul>
            </div>
          }
          onConfirm={() => {
            const d = diferencias(actualizar)
            mut.actualizarBase.mutate({ id: actualizar.id, valores: { ...(d.importe !== undefined ? { default_amount: d.importe } : {}), ...(d.medio !== undefined ? { payment_method_id: d.medio } : {}), ...(d.dia !== undefined ? { day_of_month: d.dia } : {}) } }, {
              onSuccess: () => { toast.success('Plantilla actualizada.'); setAjustes((a) => { const n = { ...a }; delete n[actualizar.id]; return n }); setActualizar(null) },
              onError: (e) => { toast.error(mensajeDeError(e)); setActualizar(null) },
            })
          }} />
      )}
    </>
  )
}

/** Biblioteca de plantillas de gastos como diálogo (se abre desde Gastos y desde la planificación). */
export function PlantillasDialog({ onClose, mes }: { onClose: () => void; mes?: string }) {
  const [sucio, setSucio] = useState(false)
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Plantillas mensuales" size="2xl" sucio={sucio} footer={null}
      description="Prepara varios gastos habituales de una vez. Los ajustes de importe, fecha y medio solo valen para lo que registres: las plantillas no cambian.">
      <GestorPlantillasGastos mes={mes} onCerrar={onClose} onSucio={setSucio} />
    </Modal>
  )
}
