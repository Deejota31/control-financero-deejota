import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Ban, Cog, FilePlus2, Pencil, RotateCcw, Tag, Trash2, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Combobox, type ComboOption } from '@/components/ui/Combobox'
import { DatePicker } from '@/components/ui/DatePicker'
import { Modal } from '@/components/ui/Dialog'
import { Paginacion } from '@/components/ui/Paginacion'
import { ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { ACCIONES, clasificar, ENTIDADES, ETIQUETA_CATEGORIA, nombreDeEvento, type CategoriaActividad } from '@/domain/actividad'
import { supabase } from '@/lib/supabase'
import { usePerfil } from './usePerfil'

const ICONOS: Record<CategoriaActividad, LucideIcon> = {
  creacion: FilePlus2, edicion: Pencil, anulacion: Ban, restauracion: RotateCcw, eliminacion: Trash2, catalogo: Tag, presupuesto: Wallet, sistema: Cog,
}
const TONOS: Record<CategoriaActividad, 'neutral' | 'ok' | 'warn' | 'bad' | 'pri'> = {
  creacion: 'ok', edicion: 'neutral', anulacion: 'bad', restauracion: 'ok', eliminacion: 'bad', catalogo: 'pri', presupuesto: 'pri', sistema: 'neutral',
}

interface FiltroActividad { desde: string; hasta: string; entidad: string; accion: string; sistema: boolean; pagina: number }
const SIN_FILTROS: FiltroActividad = { desde: '', hasta: '', entidad: '', accion: '', sistema: false, pagina: 1 }

/**
 * Solo lectura: las filas de auditoría nunca se borran ni se editan desde la aplicación (no hay política de escritura).
 * Se lee con la sesión del usuario, de modo que RLS limita el resultado a su hogar.
 */
function useActividad(f: FiltroActividad, tam: number) {
  return useQuery({
    queryKey: ['auditoria', f, tam],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      let q = supabase.from('audit_logs').select('id, entity, action, user_id, created_at, before_state, after_state', { count: 'exact' })
      if (!f.sistema) q = q.not('user_id', 'is', null)
      if (f.entidad) q = q.eq('entity', f.entidad)
      if (f.accion) q = q.eq('action', f.accion)
      if (f.desde) q = q.gte('created_at', new Date(`${f.desde}T00:00:00`).toISOString())
      if (f.hasta) q = q.lt('created_at', new Date(new Date(`${f.hasta}T00:00:00`).getTime() + 86_400_000).toISOString())
      const { data, error, count } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).range((f.pagina - 1) * tam, f.pagina * tam - 1).abortSignal(signal)
      if (error) throw error
      return { filas: data ?? [], total: count ?? 0 }
    },
  })
}

type Evento = NonNullable<ReturnType<typeof useActividad>['data']>['filas'][number]

function Fila({ e, tz }: { e: Evento; tz: string }) {
  const cat = clasificar(e.entity, e.action, e.user_id)
  const Icono = ICONOS[cat]
  const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date(e.created_at))
  const nombre = nombreDeEvento(e.before_state, e.after_state)
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"><Icono className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate"><b>{ACCIONES[e.action] ?? e.action}</b> {ENTIDADES[e.entity] ?? e.entity}{nombre && <span className="text-muted"> · {nombre}</span>}</p>
        <p className="num text-xs text-muted">{fecha}</p>
      </div>
      <Pill tone={TONOS[cat]}>{ETIQUETA_CATEGORIA[cat]}</Pill>
    </li>
  )
}

const OPC_ENTIDAD: ComboOption[] = Object.entries(ENTIDADES).map(([value, label]) => ({ value, label }))
const OPC_ACCION: ComboOption[] = Object.entries(ACCIONES).map(([value, label]) => ({ value, label }))

/** Resumen de los últimos 8 movimientos del usuario (sin eventos de sistema) y acceso a la vista completa. */
export function ActividadReciente() {
  const perfil = usePerfil()
  const tz = perfil.data?.timezone ?? 'America/Lima'
  const q = useActividad(SIN_FILTROS, 8)
  const [completa, setCompleta] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      {q.isPending ? <Skeleton className="h-40" /> : q.isError ? <ErrorState message="No se pudo cargar la actividad." onRetry={() => q.refetch()} /> : q.data.filas.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay actividad registrada por ti.</p>
      ) : (
        <ul className="divide-y divide-line" aria-label="Actividad reciente">{q.data.filas.map((e) => <Fila key={e.id} e={e} tz={tz} />)}</ul>
      )}
      <p className="text-xs text-muted">Solo lectura. Horas en {tz}. Las cargas iniciales y procesos internos no se muestran aquí.</p>
      <Button variant="secondary" className="w-fit" onClick={() => setCompleta(true)}>Ver toda la actividad</Button>
      {completa && <ActividadCompleta open onOpenChange={setCompleta} tz={tz} formato={perfil.data?.date_format ?? 'dd/MM/yyyy'} />}
    </div>
  )
}

const TAM = 15

function ActividadCompleta({ open, onOpenChange, tz, formato }: { open: boolean; onOpenChange: (o: boolean) => void; tz: string; formato: string }) {
  const [f, setF] = useState<FiltroActividad>(SIN_FILTROS)
  const q = useActividad(f, TAM)
  const cambiar = (p: Partial<FiltroActividad>) => setF((x) => ({ ...x, pagina: 1, ...p }))
  const total = q.data?.total ?? 0
  const hayFiltros = f.desde || f.hasta || f.entidad || f.accion || f.sistema

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Toda la actividad" description="Registro de cambios en tus datos. Solo lectura: no se puede editar ni borrar." size="xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-40 flex-col gap-1.5"><label htmlFor="act-desde" className="text-sm font-medium">Desde</label><DatePicker id="act-desde" value={f.desde} onChange={(v) => cambiar({ desde: v })} formato={formato} placeholder="Sin límite" max={f.hasta || undefined} /></div>
          <div className="flex w-40 flex-col gap-1.5"><label htmlFor="act-hasta" className="text-sm font-medium">Hasta</label><DatePicker id="act-hasta" value={f.hasta} onChange={(v) => cambiar({ hasta: v })} formato={formato} placeholder="Sin límite" min={f.desde || undefined} /></div>
          <div className="flex w-48 flex-col gap-1.5"><label htmlFor="act-ent" className="text-sm font-medium">Entidad</label><Combobox id="act-ent" value={f.entidad || null} options={OPC_ENTIDAD} placeholder="Todas" clearable searchable={false} onChange={(v) => cambiar({ entidad: v ?? '' })} /></div>
          <div className="flex w-40 flex-col gap-1.5"><label htmlFor="act-acc" className="text-sm font-medium">Acción</label><Combobox id="act-acc" value={f.accion || null} options={OPC_ACCION} placeholder="Todas" clearable searchable={false} onChange={(v) => cambiar({ accion: v ?? '' })} /></div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--pri)]" checked={f.sistema} onChange={(e) => cambiar({ sistema: e.target.checked })} /> Incluir eventos de sistema</label>
          {hayFiltros && <Button variant="ghost" onClick={() => setF(SIN_FILTROS)}>Limpiar filtros</Button>}
        </div>

        {q.isPending ? <Skeleton className="h-64" /> : q.isError ? <ErrorState message="No se pudo cargar la actividad." onRetry={() => q.refetch()} /> : q.data.filas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No hay actividad con estos filtros.</p>
        ) : (
          <ul className="divide-y divide-line" aria-label="Actividad" aria-busy={q.isPlaceholderData}>{q.data.filas.map((e) => <Fila key={e.id} e={e} tz={tz} />)}</ul>
        )}

        <Paginacion pagina={f.pagina} total={total} tamano={TAM} onPagina={(n) => setF((x) => ({ ...x, pagina: n }))} cargando={q.isPlaceholderData} etiqueta="Paginación de la actividad" />
      </div>
    </Modal>
  )
}
