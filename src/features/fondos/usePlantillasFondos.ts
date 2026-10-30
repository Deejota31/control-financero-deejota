import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DOMINIOS, invalidar } from '@/lib/consultas'
import { leerRpc, resultadoAplicacion } from '@/lib/contratos'
import type { Json } from '@/lib/database.types'
import type { Fila } from '@/lib/tipos'
import type { FondoBase, FondoInicial } from './FondoForm'
import type { FondoPayload } from './useFondos'

export type PlantillaFondo = Fila<'fund_templates'>

export interface PlantillaFondoConReglas {
  plantilla: PlantillaFondo
  alcance: Fila<'fund_template_scope_rules'>[]
  medios: Fila<'fund_template_payment_rules'>[]
}

/** Biblioteca global de plantillas de fondo del hogar (no pertenecen a ningún mes), con sus reglas. */
export function usePlantillasFondos() {
  return useQuery({
    queryKey: ['plantillas-fondos'],
    queryFn: async () => {
      const [p, s, m] = await Promise.all([
        supabase.from('fund_templates').select('*').order('sort_order').order('name'),
        supabase.from('fund_template_scope_rules').select('*'),
        supabase.from('fund_template_payment_rules').select('*'),
      ])
      if (p.error) throw p.error
      if (s.error) throw s.error
      if (m.error) throw m.error
      return p.data.map((plantilla): PlantillaFondoConReglas => ({
        plantilla,
        alcance: s.data.filter((r) => r.template_id === plantilla.id),
        medios: m.data.filter((r) => r.template_id === plantilla.id),
      }))
    },
  })
}

export interface ResultadoAplicacion {
  created: { template_id: string; id: string; name: string; amount: number }[]
  skipped: { template_id: string; name: string | null; reason: 'not_found' | 'inactive' | 'already_applied' | 'name_exists' | 'general_exists' | 'invalid_rules' }[]
}

export const MOTIVO_OMITIDA: Record<ResultadoAplicacion['skipped'][number]['reason'], string> = {
  not_found: 'ya no existe',
  inactive: 'está inactiva',
  already_applied: 'ya está aplicada en este mes',
  name_exists: 'ya hay un fondo con ese nombre en el mes',
  general_exists: 'el mes ya tiene un Fondo General activo',
  invalid_rules: 'no tiene ningún ámbito, categoría o subcategoría incluido',
}

/** Resumen en una frase de lo que hizo «aplicar plantillas» (creadas y omitidas con su motivo). */
export function textoResultadoAplicacion(r: ResultadoAplicacion): string {
  const c = r.created.length
  const base = c === 0 ? 'No se creó ningún fondo.' : `Se ${c === 1 ? 'creó 1 fondo' : `crearon ${c} fondos`}.`
  const omit = r.skipped.map((o) => `«${o.name ?? 'Plantilla'}» ${MOTIVO_OMITIDA[o.reason]}`)
  return omit.length ? `${base} Omitidas: ${omit.join('; ')}.` : base
}

export function usePlantillaFondoMutaciones() {
  const qc = useQueryClient()
  const refrescar = () => {
    void invalidar(qc, DOMINIOS.plantillasFondos)
  }
  /** Crea o edita una plantilla. Nunca toca fondos de ningún mes. */
  const guardar = useMutation({
    mutationFn: async (p: FondoPayload) => {
      const { default_amount, period_id: _p, period_amount: _a, template_id: _t, group_name, ...resto } = p
      const { data, error } = await supabase.rpc('save_fund_template', { p: { ...resto, suggested_amount: default_amount } as unknown as Json })
      if (error) throw error
      // El grupo solo organiza la biblioteca: se guarda aparte de las reglas financieras.
      if (group_name !== undefined) {
        const g = await supabase.from('fund_templates').update({ group_name }).eq('id', data as string)
        if (g.error) throw g.error
      }
      return data as string
    },
    onSettled: refrescar,
  })
  const activar = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('fund_templates').update({ is_active: v.is_active }).eq('id', v.id)
      if (error) throw error
    },
    onSettled: refrescar,
  })
  /** Eliminar una plantilla no elimina los fondos que salieron de ella: solo se desvinculan. */
  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fund_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: refrescar,
  })
  /** Crea los fondos del mes a partir de varias plantillas, en una sola operación atómica. */
  const aplicar = useMutation({
    mutationFn: async (v: { periodId: string; items: { template_id: string; amount: number; priority?: number }[] }) => {
      const { data, error } = await supabase.rpc('apply_fund_templates', { p_period: v.periodId, p_items: v.items as unknown as Json })
      if (error) throw error
      return leerRpc(resultadoAplicacion, data, 'apply_fund_templates')
    },
    onSettled: refrescar,
  })
  /** Orden manual de la biblioteca (solo presentación: no cambia la prioridad financiera). */
  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_templates', { p_kind: 'fund', p_ids: ids })
      if (error) throw error
    },
    onMutate: (ids) => {
      qc.setQueryData<PlantillaFondoConReglas[]>(['plantillas-fondos'], (old) => (old ? [...ids.map((id) => old.find((x) => x.plantilla.id === id)).filter((x): x is PlantillaFondoConReglas => Boolean(x)), ...old.filter((x) => !ids.includes(x.plantilla.id))] : old))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['plantillas-fondos'] }),
  })
  /** Cambia la configuración ORIGINAL de la plantilla (importe sugerido y prioridad): acción explícita y confirmada. */
  const actualizarBase = useMutation({
    mutationFn: async (v: { id: string; valores: { suggested_amount?: number; priority?: number } }) => {
      const { error } = await supabase.from('fund_templates').update(v.valores).eq('id', v.id)
      if (error) throw error
    },
    onSettled: refrescar,
  })
  return { guardar, activar, eliminar, aplicar, reordenar, actualizarBase }
}

/** Pasa una plantilla al formato del formulario de fondos (para editarla o para crear un fondo del mes desde ella). */
export function inicialDePlantilla(x: PlantillaFondoConReglas, opciones: { comoFondo?: boolean } = {}): FondoInicial {
  const fondo: FondoBase = {
    id: x.plantilla.id, name: x.plantilla.name, description: x.plantilla.description, icon_key: x.plantilla.icon_key, color_token: x.plantilla.color_token,
    is_general: x.plantilla.is_general, is_active: x.plantilla.is_active, default_amount: x.plantilla.suggested_amount, priority: x.plantilla.priority,
  }
  return {
    fondo, alcance: x.alcance, medios: x.medios, grupo: x.plantilla.group_name,
    ...(opciones.comoFondo ? { clon: true, conservarNombre: true, plantillaId: x.plantilla.id } : {}),
  }
}

/** Pasa un fondo del mes al formulario de plantilla: copia su configuración y su importe como sugerencia, nunca su consumo, saldo, gastos ni período. */
export function inicialDesdeFondo(fondo: FondoBase, alcance: FondoInicial['alcance'], medios: FondoInicial['medios'], importe: number): FondoInicial {
  return { fondo: { ...fondo, default_amount: importe }, alcance, medios, clon: true, conservarNombre: true }
}
