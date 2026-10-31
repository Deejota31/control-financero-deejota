import { ArrowDown, ArrowUp, Check, CopyPlus, GripVertical, Pencil, Plus, Power, Save, Search, Trash2, WalletCards, WalletMinimal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FilaAcciones, GrupoAcciones, MenuDeAcciones, useAnchoMinimo, type AccionFila } from '@/components/ui/AccionesFila'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MesSelector } from '@/components/ui/MesSelector'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { agrupar, claveDeNombre, estadoSeleccion, moverAntes, moverDelta, ordenarSecciones, reordenarVisibles, type ClaveSeccion } from '@/domain/agrupacion'
import { resumirCobertura } from '@/domain/cobertura'
import { nombreCopia } from '@/domain/plantillas'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { errorImporte, formatSoles, parseMontoNoNegativo, sumarImportes } from '@/lib/format'
import { usePreferencia } from '@/lib/usePreferencia'
import { useCatalogo, type Catalogo } from '@/features/catalogo/useCatalogo'
import { CasillaTriestado, SeccionPlantillas } from '@/features/plantillas/comun'
import { FondoForm, type FondoInicial } from './FondoForm'
import { CeldaCobertura } from './TablaFondos'
import { inicialDePlantilla, textoResultadoAplicacion, usePlantillaFondoMutaciones, usePlantillasFondos, type PlantillaFondoConReglas } from './usePlantillasFondos'
import { mesDeFecha } from '@/domain/periodo'
import { usePeriodo } from '@/features/periodos/usePeriodo'
import { useFondos, usePresupuestosPeriodo } from './useFondos'
import { useSolicitudFondos } from './useSolicitudFondos'

const MES_ACTUAL = mesDeFecha(new Date())

/** Cobertura de una plantilla a partir de sus reglas reales y los nombres vigentes del catálogo. */
export function coberturaDe(x: PlantillaFondoConReglas, catalogo: Catalogo) {
  return resumirCobertura(x.plantilla.is_general, x.alcance, x.medios, {
    ambito: new Map(catalogo.ambitos.map((a) => [a.id, a.name])),
    categoria: new Map(catalogo.categorias.map((a) => [a.id, a.name])),
    subcategoria: new Map(catalogo.subcategorias.map((a) => [a.id, a.name])),
    medio: new Map(catalogo.medios.map((a) => [a.id, a.name])),
  })
}

type Agrupar = 'ninguno' | 'tipo' | 'grupo' | 'cobertura'
type Orden = 'manual' | 'nombre' | 'importe'
interface Prefs { agrupar: Agrupar; orden: Orden; secciones: Partial<Record<Agrupar, string[]>> }
const PREFS: Prefs = { agrupar: 'ninguno', orden: 'manual', secciones: {} }
interface Ajuste { amount?: string; priority?: string }

const OPCIONES_AGRUPAR: { value: Agrupar; label: string }[] = [
  { value: 'ninguno', label: 'Sin secciones' },
  { value: 'tipo', label: 'Agrupar por tipo (General / específico)' }, { value: 'grupo', label: 'Agrupar por grupo propio' }, { value: 'cobertura', label: 'Agrupar por cobertura principal' },
]
const OPCIONES_ORDEN: { value: Orden; label: string }[] = [
  { value: 'manual', label: 'Orden manual' }, { value: 'nombre', label: 'Orden por nombre' }, { value: 'importe', label: 'Orden por importe' },
]

/**
 * Sección de una plantilla. «Cobertura principal» usa el primer ámbito incluido de sus reglas: una plantilla puede cubrir varios ámbitos, categorías y medios,
 * así que es solo una vista de lectura; nunca asigna un fondo a una única categoría.
 */
function seccionDe(x: PlantillaFondoConReglas, modo: Agrupar, cat: Catalogo): ClaveSeccion {
  const p = x.plantilla
  if (modo === 'ninguno') return { clave: 'todas', titulo: 'Plantillas' }
  if (modo === 'tipo') return p.is_general ? { clave: 'general', titulo: 'Fondos generales', icono: 'wallet' } : { clave: 'especifico', titulo: 'Fondos específicos', icono: 'layers' }
  if (modo === 'grupo') return p.group_name?.trim() ? { clave: claveDeNombre(p.group_name), titulo: p.group_name.trim(), icono: 'folder' } : { clave: 'sin-grupo', titulo: 'Sin grupo', icono: 'folder' }
  if (p.is_general && !x.alcance.some((r) => r.effect === 'include')) return { clave: 'general', titulo: 'Cobertura general', icono: 'wallet' }
  const inc = x.alcance.find((r) => r.effect === 'include')
  const a = inc ? cat.ambitos.find((y) => y.id === (inc.ambito_id ?? cat.categorias.find((c) => c.id === inc.categoria_id)?.ambito_id ?? cat.subcategorias.find((s) => s.id === inc.subcategoria_id)?.categoria_id)) : undefined
  return a ? { clave: a.id, titulo: a.name, icono: a.icon_key, color: a.color_css } : { clave: 'sin-clasificacion', titulo: 'Sin clasificación incluida' }
}

/** Por qué una plantilla no se puede aplicar al mes (null = se puede). `generalElegida` es otra General ya elegida en esta misma operación. */
function conflicto(x: PlantillaFondoConReglas, fondosMes: { name: string; template_id: string | null; is_general: boolean; is_active: boolean }[], generalElegida: boolean, nombresElegidos: Set<string>): string | null {
  const p = x.plantilla
  if (!p.is_active) return 'Está inactiva'
  if (fondosMes.some((f) => f.template_id === p.id)) return 'Ya aplicada en este mes'
  if (fondosMes.some((f) => f.name.trim().toLowerCase() === p.name.trim().toLowerCase())) return 'Ya hay un fondo con este nombre en el mes'
  if (p.is_general && fondosMes.some((f) => f.is_general && f.is_active)) return 'Este mes ya tiene Fondo General'
  if (p.is_general && generalElegida) return 'Ya elegiste otro Fondo General para este mes'
  if (!p.is_general && !x.alcance.some((r) => r.effect === 'include')) return 'Sin clasificación incluida: edítala'
  if (nombresElegidos.has(p.name.trim().toLowerCase())) return 'Otra plantilla elegida tiene el mismo nombre'
  return null
}

/**
 * Gestor de plantillas de fondos: administra la biblioteca (crear, editar, duplicar, activar, eliminar, ordenar) y aplica varias al mes elegido.
 * Cada fila permite ajustar, solo para el fondo que se creará, el importe y la prioridad propuesta; la plantilla no cambia. El orden visual nunca altera la
 * prioridad financiera, que se edita y confirma de forma explícita. Se usa dentro de un diálogo (biblioteca) y dentro de la etapa Fondos de la planificación.
 */
export function GestorPlantillasFondos({ mes, onCambio, onCerrar, onAdministrar }: { mes: string; onCambio?: () => void; onCerrar?: () => void; onAdministrar?: () => void }) {
  const catalogo = useCatalogo()
  const periodo = usePeriodo(mes)
  const delMes = useFondos(periodo.data?.id)
  const plantillas = usePlantillasFondos()
  const mut = usePlantillaFondoMutaciones()
  const solicitud = useSolicitudFondos(delMes.data?.fondos ?? [])

  const [prefs, setPrefs] = usePreferencia<Prefs>('gd.plantillas-fondos.v1', PREFS)
  const [abiertas, setAbiertas] = usePreferencia<Record<string, boolean>>('gd.plantillas-fondos.abiertas', {}, 'session')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'activas' | 'inactivas' | 'todas'>('activas')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({})
  const [form, setForm] = useState<{ modo: 'plantilla' | 'fondo'; inicial: FondoInicial } | null>(null)
  const [borrar, setBorrar] = useState<PlantillaFondoConReglas | null>(null)
  const [actualizar, setActualizar] = useState<PlantillaFondoConReglas | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)

  const lista = useMemo(() => plantillas.data ?? [], [plantillas.data])
  const fondosMes = useMemo(() => delMes.data?.fondos ?? [], [delMes.data])
  const presupuestos = usePresupuestosPeriodo(periodo.data?.id)
  const asignado = useMemo(() => new Map((presupuestos.data ?? []).map((b) => [b.fund_id, Number(b.assigned_amount)])), [presupuestos.data])
  const cerrado = periodo.data?.status === 'closed'
  const busca = texto.trim().toLowerCase()
  const manual = prefs.orden === 'manual'

  const importeFila = (x: PlantillaFondoConReglas) => ajustes[x.plantilla.id]?.amount ?? Number(x.plantilla.suggested_amount).toFixed(2)
  const prioridadFila = (x: PlantillaFondoConReglas) => ajustes[x.plantilla.id]?.priority ?? String(x.plantilla.priority)
  const ajustar = (id: string, patch: Ajuste) => { setAjustes((a) => ({ ...a, [id]: { ...a[id], ...patch } })); setSel((s) => new Set(s).add(id)) }

  const visibles = useMemo(() => {
    const v = lista.filter((x) => (estado === 'todas' || (estado === 'activas') === x.plantilla.is_active)
      && (!busca || `${x.plantilla.name} ${x.plantilla.description ?? ''} ${x.plantilla.group_name ?? ''}`.toLowerCase().includes(busca)))
    if (prefs.orden === 'nombre') return [...v].sort((a, b) => a.plantilla.name.localeCompare(b.plantilla.name))
    if (prefs.orden === 'importe') return [...v].sort((a, b) => Number(b.plantilla.suggested_amount) - Number(a.plantilla.suggested_amount))
    return v
  }, [lista, estado, busca, prefs.orden])
  const secciones = useMemo(
    () => ordenarSecciones(agrupar(visibles, (x) => seccionDe(x, prefs.agrupar, catalogo)), prefs.secciones[prefs.agrupar] ?? []),
    [visibles, prefs.agrupar, prefs.secciones, catalogo],
  )
  const puedeOrdenarSecciones = manual && prefs.agrupar === 'cobertura' && !busca || manual && prefs.agrupar === 'grupo' && !busca

  // ---- selección y conflictos ----
  const elegidas = lista.filter((x) => sel.has(x.plantilla.id))
  const estadosConflicto = useMemo(() => {
    // Se evalúan en orden: la primera General elegida pasa y las siguientes quedan bloqueadas.
    const out = new Map<string, string | null>()
    let general = false
    const nombres = new Set<string>()
    for (const x of lista) {
      const c = conflicto(x, fondosMes, general, nombres)
      out.set(x.plantilla.id, sel.has(x.plantilla.id) ? c : conflicto(x, fondosMes, false, new Set()))
      if (sel.has(x.plantilla.id) && !c) { if (x.plantilla.is_general) general = true; nombres.add(x.plantilla.name.trim().toLowerCase()) }
    }
    return out
  }, [lista, fondosMes, sel])
  const aplicables = elegidas.filter((x) => !estadosConflicto.get(x.plantilla.id))
  const importeInvalido = aplicables.some((x) => errorImporte(importeFila(x), { permitirCero: true }) || !/^\d{1,3}$/.test(prioridadFila(x).trim()))
  const total = sumarImportes(aplicables.map((x) => parseMontoNoNegativo(importeFila(x)) ?? 0))
  const idsVisiblesAplicables = visibles.filter((x) => !conflicto(x, fondosMes, false, new Set())).map((x) => x.plantilla.id)
  const marcar = (ids: string[], m: boolean) => setSel((s) => { const n = new Set(s); for (const id of ids) { if (m) n.add(id); else n.delete(id) } return n })

  // ---- orden manual (solo presentación) ----
  const idsTodos = lista.map((x) => x.plantilla.id)
  const guardarOrden = (ids: string[]) => mut.reordenar.mutate(ids, { onError: (e) => toast.error(mensajeDeError(e, 'No se pudo guardar el orden.')) })
  function soltar(destino: string, origen: string) {
    setArrastrando(null)
    if (manual && origen !== destino) guardarOrden(moverAntes(idsTodos, origen, destino))
  }
  function moverFila(id: string, delta: -1 | 1) {
    const sec = secciones.find((s) => s.items.some((x) => x.plantilla.id === id))
    if (!sec) return
    const ids = sec.items.map((x) => x.plantilla.id)
    guardarOrden(reordenarVisibles(idsTodos, ids, moverDelta(ids, id, delta)))
  }
  function moverSeccion(clave: string, delta: -1 | 1) {
    setPrefs({ ...prefs, secciones: { ...prefs.secciones, [prefs.agrupar]: moverDelta(secciones.map((s) => s.clave), clave, delta) } })
  }

  function duplicar(x: PlantillaFondoConReglas) {
    const p = x.plantilla
    mut.guardar.mutate({
      name: nombreCopia(p.name, lista.map((y) => y.plantilla.name), 60), description: p.description ?? '', icon_key: p.icon_key ?? 'wallet', color_token: p.color_token ?? 'c1',
      is_general: p.is_general, default_amount: Number(p.suggested_amount), is_active: true, priority: p.priority, group_name: p.group_name,
      scope_rules: x.alcance.map((r) => ({ kind: r.ambito_id ? 'ambito' : r.categoria_id ? 'categoria' : 'subcategoria', ref: (r.ambito_id ?? r.categoria_id ?? r.subcategoria_id)!, effect: r.effect as 'include' | 'exclude' })),
      payment_rules: x.medios.map((r) => ({ method: r.payment_method_id, effect: r.effect as 'include' | 'exclude' })),
    }, { onSuccess: () => toast.success('Plantilla duplicada.'), onError: (e) => toast.error(mensajeDeError(e)) })
  }
  /** Prepara el fondo del mes con el formulario completo de siempre (para cambiar reglas de cobertura, que no caben en una fila). */
  const prepararInstancia = (x: PlantillaFondoConReglas) => setForm({ modo: 'fondo', inicial: { ...inicialDePlantilla(x, { comoFondo: true }), presupuestoPeriodo: parseMontoNoNegativo(importeFila(x)) ?? Number(x.plantilla.suggested_amount) } })

  const diferencias = (x: PlantillaFondoConReglas) => {
    const d: { suggested_amount?: number; priority?: number } = {}
    const imp = parseMontoNoNegativo(importeFila(x))
    if (imp !== null && imp !== Number(x.plantilla.suggested_amount)) d.suggested_amount = imp
    const pr = /^\d{1,3}$/.test(prioridadFila(x).trim()) ? Number(prioridadFila(x)) : null
    if (pr !== null && pr !== x.plantilla.priority) d.priority = pr
    return d
  }

  const seccionAbierta = (clave: string, items: number) => (busca ? items > 0 : (abiertas[`${prefs.agrupar}:${clave}`] ?? true))
  const todasAbiertas = secciones.every((s) => seccionAbierta(s.clave, s.items.length))
  const cargando = plantillas.isPending || periodo.isPending || delMes.isPending || catalogo.isPending

  async function aplicar() {
    if (!periodo.data || aplicables.length === 0 || mut.aplicar.isPending) return
    try {
      const r = await mut.aplicar.mutateAsync({
        periodId: periodo.data.id,
        items: aplicables.map((x) => ({
          template_id: x.plantilla.id, amount: parseMontoNoNegativo(importeFila(x)) ?? 0,
          // La prioridad solo se envía si la persona la cambió: así la sugerida se resuelve contra las del mes.
          ...(ajustes[x.plantilla.id]?.priority !== undefined && !x.plantilla.is_general ? { priority: Number(prioridadFila(x)) } : {}),
        })),
      })
      toast[r.created.length ? 'success' : 'info'](textoResultadoAplicacion(r))
      const creadas = new Set(r.created.map((c) => c.template_id))
      marcar([...creadas], false)
      setAjustes((a) => { const n = { ...a }; for (const id of creadas) delete n[id]; return n })
      if (r.created.length) onCambio?.()
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudieron aplicar las plantillas. No se creó ningún fondo.'))
    }
  }

  const nAplicadas = lista.filter((x) => fondosMes.some((fm) => fm.template_id === x.plantilla.id)).length
  const nDisponibles = lista.filter((x) => !estadosConflicto.get(x.plantilla.id)).length
  const [refRaiz, tabla] = useAnchoMinimo<HTMLDivElement>(832) // 52 rem: desde aquí caben las columnas; por debajo, tarjetas con panel de acciones
  const compacto = Boolean(onAdministrar) && lista.length <= 5 && !busca // dentro de la planificación, con pocas plantillas, solo lo esencial

  /** Todas las acciones de una plantilla de fondo; alimentan el menú de escritorio y el panel de tarjeta. Una plantilla ya aplicada no se puede preparar otra vez. */
  const accionesDe = (x: PlantillaFondoConReglas, e: { motivo: string | null; aplicado: boolean; hayDif: boolean }): AccionFila[] => {
    const p = x.plantilla
    const orden = manual && !busca
    const noPreparable = e.aplicado ? 'Ya aplicada en este mes' : (e.motivo ?? (cerrado ? 'Período cerrado' : undefined))
    return [
      { clave: 'preparar', etiqueta: 'Preparar fondo con el formulario', nombreAccesible: `Preparar fondo con el formulario ${p.name}`, icono: WalletMinimal, deshabilitada: Boolean(noPreparable), motivo: noPreparable, onSelect: () => prepararInstancia(x) },
      { clave: 'editar', etiqueta: 'Editar plantilla', nombreAccesible: `Editar plantilla ${p.name}`, icono: Pencil, onSelect: () => setForm({ modo: 'plantilla', inicial: inicialDePlantilla(x) }) },
      { clave: 'actualizar', etiqueta: 'Actualizar plantilla con estos valores', nombreAccesible: `Actualizar plantilla con estos valores de ${p.name}`, icono: Save, deshabilitada: !e.hayDif, motivo: 'Aún no cambiaste importe ni prioridad', onSelect: () => setActualizar(x) },
      { clave: 'duplicar', etiqueta: 'Duplicar', nombreAccesible: `Duplicar plantilla ${p.name}`, icono: CopyPlus, onSelect: () => duplicar(x) },
      { clave: 'activar', etiqueta: p.is_active ? 'Desactivar' : 'Activar', nombreAccesible: `${p.is_active ? 'Desactivar' : 'Activar'} plantilla ${p.name}`, icono: Power, onSelect: () => mut.activar.mutate({ id: p.id, is_active: !p.is_active }, { onError: (err) => toast.error(mensajeDeError(err)) }) },
      { clave: 'subir', etiqueta: 'Subir en la lista', nombreAccesible: `Subir en la lista ${p.name}`, icono: ArrowUp, deshabilitada: !orden, motivo: 'Solo con orden manual y sin búsqueda', onSelect: () => moverFila(p.id, -1) },
      { clave: 'bajar', etiqueta: 'Bajar en la lista', nombreAccesible: `Bajar en la lista ${p.name}`, icono: ArrowDown, deshabilitada: !orden, motivo: 'Solo con orden manual y sin búsqueda', onSelect: () => moverFila(p.id, 1) },
      { clave: 'eliminar', etiqueta: 'Eliminar', nombreAccesible: `Eliminar plantilla ${p.name}`, icono: Trash2, tono: 'peligro', onSelect: () => setBorrar(x) },
    ]
  }

  const resumen = (
    <p className="min-w-0 text-sm" aria-live="polite">
      <b>{elegidas.length}</b> {elegidas.length === 1 ? 'seleccionada' : 'seleccionadas'} · <b className="num">{formatSoles(total)}</b>
      {elegidas.length > aplicables.length && <span className="text-bad"> · {elegidas.length - aplicables.length} no aplicable{elegidas.length - aplicables.length === 1 ? '' : 's'}</span>}
    </p>
  )
  const botonAplicar = (
    <Button onClick={aplicar} loading={mut.aplicar.isPending} disabled={cerrado || aplicables.length === 0 || importeInvalido}>
      {aplicables.length === 0 ? 'Aplicar plantillas' : `Aplicar ${aplicables.length} ${aplicables.length === 1 ? 'plantilla' : 'plantillas'}`}
    </Button>
  )

  const cuerpo = (
    <div ref={refRaiz} className="@container flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Resumen de plantillas">
          <Pill>{nDisponibles} {nDisponibles === 1 ? 'disponible' : 'disponibles'}</Pill>
          <Pill tone="ok">{nAplicadas} {nAplicadas === 1 ? 'aplicada' : 'aplicadas'}</Pill>
          <Pill tone={elegidas.length ? 'pri' : 'neutral'}>{elegidas.length} {elegidas.length === 1 ? 'seleccionada' : 'seleccionadas'}</Pill>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {compacto && <Button variant="secondary" onClick={() => marcar(idsVisiblesAplicables, true)} disabled={idsVisiblesAplicables.length === 0 || cerrado}>Seleccionar todas</Button>}
          {compacto && sel.size > 0 && <Button variant="ghost" onClick={() => marcar(idsTodos, false)}>Deseleccionar</Button>}
          <Button variant="secondary" onClick={() => setForm({ modo: 'plantilla', inicial: { fondo: null, alcance: [], medios: [] } })}><Plus className="size-4" aria-hidden="true" /> Nueva plantilla</Button>
          {onAdministrar && <Button variant="secondary" onClick={onAdministrar}>Administrar plantillas</Button>}
        </div>
      </div>
      {!compacto && (
        <>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="busq-pf" className="sr-only">Buscar plantilla de fondo</label>
        <div className="flex min-w-0 flex-1 basis-44 items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 focus-within:border-pri">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <input id="busq-pf" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar plantilla…" className="sin-anillo min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted" />
        </div>
        <div className="min-w-0 grow basis-40 sm:max-w-64"><Combobox aria-label="Agrupación de plantillas de fondos" value={prefs.agrupar} searchable={false} options={OPCIONES_AGRUPAR} onChange={(v) => setPrefs({ ...prefs, agrupar: (v ?? 'tipo') as Agrupar })} /></div>
        <div className="min-w-0 grow basis-36 sm:max-w-44"><Combobox aria-label="Orden de plantillas de fondos" value={prefs.orden} searchable={false} options={OPCIONES_ORDEN} onChange={(v) => setPrefs({ ...prefs, orden: (v ?? 'manual') as Orden })} /></div>
        <div className="min-w-0 grow basis-28 sm:max-w-36"><Combobox aria-label="Estado de plantillas de fondos" value={estado} searchable={false} options={[{ value: 'activas', label: 'Activas' }, { value: 'inactivas', label: 'Inactivas' }, { value: 'todas', label: 'Todas' }]} onChange={(v) => setEstado((v ?? 'activas') as typeof estado)} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="secondary" onClick={() => marcar(idsVisiblesAplicables, true)} disabled={idsVisiblesAplicables.length === 0 || cerrado}>Seleccionar visibles</Button>
        <Button variant="secondary" onClick={() => marcar(idsTodos, false)} disabled={sel.size === 0}>Deseleccionar todas</Button>
        <Button variant="ghost" onClick={() => { const n = { ...abiertas }; for (const s of secciones) n[`${prefs.agrupar}:${s.clave}`] = !todasAbiertas; setAbiertas(n) }} disabled={secciones.length === 0}>{todasAbiertas ? 'Contraer secciones' : 'Expandir secciones'}</Button>
      </div>


        </>
      )}
      {cargando ? <Skeleton className="h-32" /> : plantillas.isError || delMes.isError ? <ErrorState message="No se pudieron cargar las plantillas de fondos." onRetry={() => { plantillas.refetch(); delMes.refetch() }} /> : lista.length === 0 ? (
        <EmptyState icon={WalletCards} title="Aún no tienes plantillas de fondos" description="Crea una con el formulario de siempre (importe, cobertura y medios) o guarda un fondo existente como plantilla."
          action={<Button onClick={() => setForm({ modo: 'plantilla', inicial: { fondo: null, alcance: [], medios: [] } })}><Plus className="size-4" aria-hidden="true" /> Crear la primera</Button>} />
      ) : visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Ninguna plantilla coincide con la búsqueda o los filtros.</p>
      ) : (
        <GrupoAcciones clave={JSON.stringify([texto, estado, prefs.agrupar, prefs.orden, mes])}>
        <div className="flex flex-col gap-2">
          <div className="hidden grid-cols-[3rem_minmax(0,1.3fr)_minmax(0,1.2fr)_8rem_5.5rem_7.5rem_2.25rem] gap-x-3 px-[11px] text-[11px] font-semibold uppercase tracking-wider text-muted @min-[52rem]:grid" aria-hidden="true">
            <span /><span>Plantilla</span><span>Cobertura</span><span className="text-right">Importe</span><span className="text-center">Prioridad</span><span>Estado</span><span />
          </div>
          {secciones.map((sec) => {
            const ids = sec.items.filter((x) => !conflicto(x, fondosMes, false, new Set())).map((x) => x.plantilla.id)
            const elegidasSec = sec.items.filter((x) => sel.has(x.plantilla.id))
            const filas = sec.items.map((x) => {
              const p = x.plantilla
              const aplicado = fondosMes.find((fm) => fm.template_id === p.id)
              const motivo = estadosConflicto.get(p.id) ?? null
              const elegida = sel.has(p.id)
              const dif = diferencias(x)
              const hayDif = Object.keys(dif).length > 0
              const errImporte = elegida && Boolean(errorImporte(importeFila(x), { permitirCero: true }))
              const errPrioridad = elegida && !p.is_general && !/^\d{1,3}$/.test(prioridadFila(x).trim())
              const bloqueado = Boolean(motivo) && !elegida
              const estadoPill = aplicado ? <Pill tone="ok"><Check className="size-3" aria-hidden="true" />Aplicada</Pill>
                : !p.is_active ? <Pill>Inactiva</Pill> : elegida ? <Pill tone="pri">Seleccionada</Pill> : motivo ? <span title={motivo}><Pill tone="warn">No disponible</Pill></span> : <Pill>Disponible</Pill>
              return (
                <FilaAcciones key={p.id} id={p.id} nombre={p.name} acciones={accionesDe(x, { motivo, aplicado: Boolean(aplicado), hayDif })} activo={!tabla} permitirRaton={!(manual && !busca && !aplicado)} botonCompacto
                  className={cn('rounded-lg border transition-colors', aplicado ? 'border-ok/40 bg-ok-soft/20' : elegida ? 'border-pri/50 bg-pri-soft/30' : 'border-line hover:bg-surface-2/50', arrastrando === p.id && 'opacity-50')}
                  tarjetaClassName="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 px-2.5 py-2 @min-[52rem]:grid-cols-[3rem_minmax(0,1.3fr)_minmax(0,1.2fr)_8rem_5.5rem_7.5rem_2.25rem] @min-[52rem]:gap-x-3 @min-[52rem]:py-1.5"
                  tarjetaProps={{
                    draggable: manual && !busca && !aplicado,
                    onDragStart: (e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(p.id) },
                    onDragOver: (e) => { if (manual && arrastrando && arrastrando !== p.id) e.preventDefault() },
                    onDrop: (e) => { e.preventDefault(); const o = e.dataTransfer.getData('text/plain'); if (o) soltar(p.id, o) },
                    onDragEnd: () => setArrastrando(null),
                    'data-plantilla-fondo': p.id, 'data-nombre': p.name,
                  }}>
                  {(boton) => (
                  <>
                  <div className="flex items-center gap-1">
                    {manual && !busca && !aplicado ? <GripVertical data-sin-gesto className="size-4 shrink-0 cursor-grab text-muted" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
                    {aplicado
                      ? <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ok text-pri-fg" role="img" aria-label={`${p.name} ya aplicada en este mes`}><Check className="size-3" aria-hidden="true" /></span>
                      : <CasillaTriestado estado={elegida ? 'all' : 'none'} etiqueta={`Usar ${p.name}`} disabled={bloqueado || cerrado} onChange={(m) => marcar([p.id], m)} />}
                  </div>
                  <div className="flex min-w-0 items-center gap-2" title={p.description ?? undefined}>
                    <span className={cn('shrink-0', !p.is_active && 'opacity-60')}><ItemIcon name={p.icon_key ?? 'wallet'} color={p.color_token ?? 'c1'} className="size-5" /></span>
                    <div className="min-w-0">
                      <p className={cn('truncate font-semibold leading-tight', !p.is_active && 'text-muted')}>{p.name}{p.is_general && <span className="ml-1.5 text-xs font-normal text-muted">General</span>}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 @min-[52rem]:hidden">{estadoPill}</p>
                      {motivo && !aplicado && <p className={cn('truncate text-[11px] font-medium', elegida ? 'text-bad' : 'text-warn')}>{motivo}</p>}
                    </div>
                  </div>
                  <div className="col-start-3 row-start-1 @min-[52rem]:col-start-7">{boton ?? <MenuDeAcciones nombre={p.name} etiquetaBoton={`Más acciones de la plantilla ${p.name}`} acciones={accionesDe(x, { motivo, aplicado: Boolean(aplicado), hayDif })} />}</div>
                  <div className="col-span-3 min-w-0 @min-[52rem]:col-span-1 @min-[52rem]:col-start-3 @min-[52rem]:row-start-1"><CeldaCobertura c={coberturaDe(x, catalogo)} nombre={p.name} /></div>
                  {aplicado ? (
                    <>
                      <p className="num col-span-3 flex items-baseline justify-between gap-2 text-sm font-semibold @min-[52rem]:col-span-1 @min-[52rem]:block @min-[52rem]:text-right" title={`Importe del fondo de este mes. La plantilla sugiere ${formatSoles(Number(p.suggested_amount))}.`}><span className="text-xs font-normal text-muted @min-[52rem]:hidden">Importe aplicado</span>{formatSoles(asignado.get(aplicado.id) ?? Number(aplicado.default_amount))}</p>
                      <p className="num col-span-3 flex items-baseline justify-between gap-2 text-sm text-muted @min-[52rem]:col-span-1 @min-[52rem]:block @min-[52rem]:text-center"><span className="text-xs @min-[52rem]:hidden">Prioridad</span>{p.is_general ? '—' : aplicado.priority}</p>
                    </>
                  ) : (
                    <div className="col-span-3 grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2 @min-[52rem]:contents">
                      <div className="min-w-0 @min-[52rem]:contents">
                        <label className="mb-0.5 block text-[11px] text-muted @min-[52rem]:hidden" aria-hidden="true">Importe (S/)</label>
                        <MoneyInput aria-label={`Importe de ${p.name}`} value={importeFila(x)} disabled={bloqueado || cerrado} invalid={errImporte} onChange={(v) => ajustar(p.id, { amount: v })} />
                      </div>
                      <div className="min-w-0 @min-[52rem]:contents">
                      <span className="mb-0.5 block text-[11px] text-muted @min-[52rem]:hidden" aria-hidden="true">Prioridad</span>
                      {p.is_general ? (
                        <span className="grid h-10 place-items-center rounded-md border border-dashed border-line text-xs text-muted">Sin prioridad</span>
                      ) : (
                        <input type="text" inputMode="numeric" aria-label={`Prioridad propuesta de ${p.name}`} title="Prioridad propuesta (1 = primero). Solo para este fondo." value={prioridadFila(x)}
                          disabled={bloqueado || cerrado} aria-invalid={errPrioridad || undefined} onChange={(e) => ajustar(p.id, { priority: e.target.value })}
                          className={cn('h-10 w-full min-w-0 rounded-lg border bg-surface px-2 text-center text-sm', errPrioridad ? 'border-bad' : 'border-line')} />
                      )}
                      </div>
                    </div>
                  )}
                  <div className="hidden @min-[52rem]:flex @min-[52rem]:items-center">{estadoPill}</div>
                  {elegida && hayDif && <p className="col-span-3 text-[11px] text-muted @min-[52rem]:col-span-7">Ajustes solo para el fondo de este mes: la plantilla conserva {formatSoles(Number(p.suggested_amount))}{p.is_general ? '' : ` y prioridad ${p.priority}`}.</p>}
                  </>
                  )}
                </FilaAcciones>
              )
            })
            return prefs.agrupar === 'ninguno' ? (
              <div key={sec.clave} className="flex flex-col gap-1.5">{filas}</div>
            ) : (
              <SeccionPlantillas key={sec.clave} titulo={sec.titulo} icono={sec.icono} color={sec.color} total={sec.items.length} seleccionadas={elegidasSec.length}
                subtotal={sumarImportes(elegidasSec.map((x) => parseMontoNoNegativo(importeFila(x)) ?? 0))} estado={estadoSeleccion(ids, sel)} abierta={seccionAbierta(sec.clave, sec.items.length)}
                onAbrir={() => setAbiertas({ ...abiertas, [`${prefs.agrupar}:${sec.clave}`]: !seccionAbierta(sec.clave, sec.items.length) })}
                onSeleccionar={(m) => marcar(ids, m)} onMover={puedeOrdenarSecciones ? (d) => moverSeccion(sec.clave, d) : undefined}>
                {filas}
              </SeccionPlantillas>
            )
          })}
        </div>
        </GrupoAcciones>
      )}

      <div className="sticky -bottom-4 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-4 py-3 sm:-bottom-5 sm:-mx-6 sm:px-6 [@media(max-height:520px)]:py-1.5">{resumen}<div className="ml-auto flex flex-wrap gap-2">{onCerrar && <Button variant="secondary" onClick={onCerrar}>Cerrar</Button>}{botonAplicar}</div></div>

      {form && (
        <FondoForm
          modo={form.modo}
          catalogo={catalogo}
          inicial={form.inicial}
          hayGeneralActivo={fondosMes.some((f) => f.is_general && f.is_active)}
          periodoAbierto={periodo.data?.status === 'open'}
          periodId={form.modo === 'fondo' ? periodo.data?.id : undefined}
          cargando={form.modo === 'plantilla' ? mut.guardar.isPending : solicitud.ocupado}
          onClose={() => setForm(null)}
          onSubmit={(payload) => {
            if (form.modo === 'plantilla') {
              mut.guardar.mutate(payload, { onSuccess: () => { toast.success(payload.id ? 'Plantilla actualizada.' : 'Plantilla guardada.'); setForm(null) }, onError: (e) => toast.error(mensajeDeError(e)) })
            } else {
              void solicitud.guardarFondo(payload, () => { setForm(null); onCambio?.() })
            }
          }}
        />
      )}
      <ConfirmDialog open={Boolean(borrar)} onOpenChange={(o) => !o && setBorrar(null)} title={`¿Eliminar la plantilla «${borrar?.plantilla.name ?? ''}»?`}
        description="Los fondos que ya se crearon con esta plantilla se conservan tal cual; solo se desvinculan de ella." confirmLabel="Eliminar" danger loading={mut.eliminar.isPending}
        onConfirm={() => borrar && mut.eliminar.mutate(borrar.plantilla.id, { onSuccess: () => { toast.success('Plantilla eliminada.'); marcar([borrar.plantilla.id], false); setBorrar(null) }, onError: (e) => { toast.error(mensajeDeError(e)); setBorrar(null) } })} />
      {actualizar && (
        <ConfirmDialog open onOpenChange={(o) => !o && setActualizar(null)} title={`¿Actualizar la plantilla «${actualizar.plantilla.name}»?`} confirmLabel="Actualizar plantilla" loading={mut.actualizarBase.isPending}
          description={
            <div className="flex flex-col gap-2">
              <p>Esto cambia la configuración ORIGINAL de la plantilla; los próximos fondos partirán de estos valores. Los fondos ya creados no cambian.</p>
              <ul className="list-disc pl-5">
                {diferencias(actualizar).suggested_amount !== undefined && <li>Importe sugerido: {formatSoles(Number(actualizar.plantilla.suggested_amount))} → <b>{formatSoles(diferencias(actualizar).suggested_amount!)}</b></li>}
                {diferencias(actualizar).priority !== undefined && <li>Prioridad sugerida: {actualizar.plantilla.priority} → <b>{diferencias(actualizar).priority}</b></li>}
              </ul>
            </div>
          }
          onConfirm={() => mut.actualizarBase.mutate({ id: actualizar.plantilla.id, valores: diferencias(actualizar) }, {
            onSuccess: () => { toast.success('Plantilla actualizada.'); setAjustes((a) => { const n = { ...a }; delete n[actualizar.plantilla.id]; return n }); setActualizar(null) },
            onError: (e) => { toast.error(mensajeDeError(e)); setActualizar(null) },
          })} />
      )}
      {solicitud.modales}
    </div>
  )

  return cuerpo
}

/** Biblioteca de plantillas de fondos como diálogo (se abre desde Fondos y desde la planificación). El mes destino se elige arriba. */
export function PlantillasFondosDialog({ mes: mesInicial = MES_ACTUAL, onClose, onCambio }: { mes?: string; onClose: () => void; onCambio?: () => void }) {
  const [mes, setMes] = useState(mesInicial)
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Plantillas de fondos" size="xl"
      description="Configuraciones reutilizables para preparar cada mes. Una plantilla no es un fondo: cada mes tiene sus propios fondos y cambiarlos no modifica la plantilla."
      footer={null}>
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm text-muted">Período destino</span><MesSelector mes={mes} onChange={setMes} /></div>
      <GestorPlantillasFondos key={mes} mes={mes} onCambio={onCambio} onCerrar={onClose} />
    </Modal>
  )
}
