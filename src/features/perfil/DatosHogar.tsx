import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { descargar } from '@/lib/csv'
import { mensajeDeError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useHogar } from '@/features/dashboard/useDashboard'
import { usePerfil } from './usePerfil'

const TABLAS = [
  'households', 'ambitos', 'categorias', 'subcategorias', 'medios_pago', 'funds', 'fund_scope_rules', 'fund_payment_rules',
  'budget_periods', 'fund_period_budgets', 'period_fund_snapshots', 'expense_templates', 'expenses', 'expense_fund_allocations',
] as const

/** Lee una tabla completa por páginas (RLS limita el resultado a tu hogar). */
async function leerTabla(tabla: (typeof TABLAS)[number]) {
  const filas: unknown[] = []
  for (let desde = 0; desde < 100_000; desde += 1000) {
    const { data, error } = await supabase.from(tabla).select('*').range(desde, desde + 999)
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return filas
}

const ENTIDADES: Record<string, string> = {
  expenses: 'Gasto', funds: 'Fondo', fund_period_budgets: 'Presupuesto de fondo', ambitos: 'Ámbito', categorias: 'Categoría',
  subcategorias: 'Subcategoría', medios_pago: 'Medio de pago', expense_templates: 'Plantilla', budget_periods: 'Período',
}
const ACCIONES: Record<string, string> = { insert: 'Creó', update: 'Editó', delete: 'Eliminó', annul: 'Anuló', restore: 'Restauró' }

export function DatosHogar() {
  const perfil = usePerfil()
  const hogar = useHogar()
  const qc = useQueryClient()
  const [nombre, setNombre] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  const renombrar = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('households').update({ name }).eq('id', hogar.data!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hogar'] }),
  })

  const actividad = useQuery({
    queryKey: ['auditoria'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs').select('id, entity, action, created_at, before_state, after_state').order('created_at', { ascending: false }).limit(25)
      if (error) throw error
      return data
    },
  })

  async function exportar() {
    setExportando(true)
    try {
      const salida: Record<string, unknown> = {
        aplicacion: 'Gasto Deejota',
        exportado_en: new Date().toISOString(),
        nota: 'Datos de tu hogar. No incluye contraseñas, tokens ni archivos de comprobantes.',
        perfil: perfil.data ? { display_name: perfil.data.display_name, timezone: perfil.data.timezone, date_format: perfil.data.date_format, theme: perfil.data.theme, display_currency: perfil.data.display_currency } : null,
      }
      for (const t of TABLAS) salida[t] = await leerTabla(t)
      descargar(`gasto-deejota_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(salida, null, 2), 'application/json')
      toast.success('Exportación lista.')
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo exportar tus datos.'))
    } finally {
      setExportando(false)
    }
  }

  const tz = perfil.data?.timezone ?? 'America/Lima'
  const fecha = (iso: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date(iso))
  const nombreActual = nombre ?? hogar.data?.name ?? ''

  const descripcion = (a: { before_state: unknown; after_state: unknown }) => {
    const s = (a.after_state ?? a.before_state) as { description?: string; name?: string } | null
    return s?.description ?? s?.name ?? ''
  }

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-bold">Hogar</h2>
        {hogar.isPending ? <Skeleton className="h-10" /> : hogar.isError ? <ErrorState message="No se pudo cargar el hogar." onRetry={() => hogar.refetch()} /> : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              renombrar.mutate(nombreActual.trim(), { onSuccess: () => { toast.success('Nombre del hogar guardado.'); setNombre(null) }, onError: (er) => toast.error(mensajeDeError(er)) })
            }}
          >
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <label htmlFor="hogar-nombre" className="text-sm font-medium">Nombre del hogar</label>
              <Input id="hogar-nombre" value={nombreActual} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <Button type="submit" loading={renombrar.isPending} disabled={!nombreActual.trim() || nombreActual.trim() === hogar.data?.name}>Guardar</Button>
          </form>
        )}
        {hogar.data?.is_demo && <Alert tone="info">Este hogar contiene <b>datos de demostración</b> solo para desarrollo local. Se reinician con <code>npm run db:reset</code>.</Alert>}
        <p className="text-sm text-muted">Hoy eres la única persona con acceso. El modelo de hogar permite añadir colaboración familiar más adelante.</p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-bold">Exportar mis datos</h2>
        <p className="text-sm text-muted">Descarga una copia en JSON de tu catálogo, fondos, períodos, plantillas y gastos. No incluye contraseñas ni tokens. Sirve como respaldo.</p>
        <Button variant="secondary" onClick={exportar} loading={exportando} className="w-fit"><Download className="size-4" aria-hidden="true" /> {exportando ? 'Preparando…' : 'Exportar datos (JSON)'}</Button>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-bold">Actividad reciente</h2>
        <p className="text-sm text-muted">Registro de cambios en tus datos (solo lectura). Horas en {tz}.</p>
        {actividad.isPending ? <Skeleton className="h-32" /> : actividad.isError ? <ErrorState message="No se pudo cargar la actividad." onRetry={() => actividad.refetch()} /> : actividad.data.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay actividad registrada.</p>
        ) : (
          <ul className="divide-y divide-line text-sm" aria-label="Actividad reciente">
            {actividad.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span><b>{ACCIONES[a.action] ?? a.action}</b> {ENTIDADES[a.entity] ?? a.entity}{descripcion(a) ? <span className="text-muted"> · {descripcion(a)}</span> : null}</span>
                <span className="num text-xs text-muted">{fecha(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
