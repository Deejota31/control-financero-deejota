import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Json } from '@/lib/database.types'
import { leerTodo } from '@/lib/leerTodo'
import { supabase } from '@/lib/supabase'
import type { Ambito, Categoria, MedioPago, Subcategoria } from '@/lib/tipos'
import type { ComboOption } from '@/components/ui/Combobox'
import { colorEfectivo, hexPropio } from '@/domain/color'
import { agruparPorNombre } from '@/domain/idsFiltro'

export type CatalogoKind = 'ambitos' | 'categorias' | 'subcategorias' | 'medios_pago'

/** Catálogo completo (nombres e iconos de todos los gastos): se lee entero y en orden determinista, sin depender del límite por respuesta. */
function leer<T extends CatalogoKind>(kind: T, signal?: AbortSignal) {
  return leerTodo((d, h) => supabase.from(kind).select('*', { count: 'exact' }).order('sort_order').order('name').order('id').range(d, h).abortSignal(signal as AbortSignal))
}

export function useCatalogo() {
  const results = useQueries({
    queries: [
      { queryKey: ['catalogo', 'ambitos'], queryFn: ({ signal }) => leer('ambitos', signal) },
      { queryKey: ['catalogo', 'categorias'], queryFn: ({ signal }) => leer('categorias', signal) },
      { queryKey: ['catalogo', 'subcategorias'], queryFn: ({ signal }) => leer('subcategorias', signal) },
      { queryKey: ['catalogo', 'medios_pago'], queryFn: ({ signal }) => leer('medios_pago', signal) },
    ],
  })
  const [a, c, s, m] = results
  const refetch = () => results.forEach((r) => r.refetch())
  return useMemo(
    () => {
      // Color efectivo ya resuelto (#RRGGBB): propio, heredado del ámbito (categorías) o equivalente del token antiguo.
      const ambitos = ((a.data ?? []) as Ambito[]).map((x) => ({ ...x, color_css: hexPropio(x) }))
      const porAmbito = new Map(ambitos.map((x) => [x.id, x]))
      const categorias = ((c.data ?? []) as Categoria[]).map((x) => ({ ...x, color_css: colorEfectivo(x, porAmbito.get(x.ambito_id)).hex }))
      const porCategoria = new Map(categorias.map((x) => [x.id, x]))
      // Subcategoría: hereda el color efectivo de su categoría o usa el suyo (se guarda el modo, no una copia del HEX heredado).
      const subcategorias = ((s.data ?? []) as Subcategoria[]).map((x) => ({ ...x, color_css: colorEfectivo(x, { color_hex: porCategoria.get(x.categoria_id)?.color_css ?? null }).hex }))
      const medios = ((m.data ?? []) as MedioPago[]).map((x) => ({ ...x, color_css: hexPropio(x) }))
      return {
        ambitos, categorias, subcategorias, medios,
        isPending: results.some((r) => r.isPending),
        isError: results.some((r) => r.isError),
        refetch,
      }
    },
    // `results` es un arreglo nuevo en cada render; el resultado depende solo de los datos y estados listados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.data, c.data, s.data, m.data, a.status, c.status, s.status, m.status],
  )
}

export type Catalogo = ReturnType<typeof useCatalogo>

/** Opciones para un selector: solo activas, más la opción actual aunque esté desactivada. */
export function opciones(
  items: { id: string; name: string; icon_key: string; color_token?: string | null; color_css?: string; is_active: boolean }[],
  actual?: string | null,
): ComboOption[] {
  return items
    .filter((i) => i.is_active || i.id === actual)
    .map((i) => ({ value: i.id, label: i.is_active ? i.name : `${i.name} (inactivo)`, icon: i.icon_key, color: i.color_css ?? i.color_token }))
}

/**
 * Opciones agrupadas por nombre (una sola «Alimentación» aunque exista en varios ámbitos): el valor de cada opción son todos los IDs del
 * grupo unidos por coma (ver domain/idsFiltro), así elegirla filtra todas las clasificaciones con ese nombre. Icono y color: los del primero.
 */
export function opcionesAgrupadas<T extends { id: string; name: string; icon_key: string; color_token?: string | null; color_css?: string; is_active: boolean }>(
  items: T[],
  actual?: string | null,
): ComboOption[] {
  return agruparPorNombre(items, actual).map((g) => ({
    value: g.valor,
    label: g.ids.every((id) => items.find((x) => x.id === id)?.is_active === false) ? `${g.nombre} (inactivo)` : g.nombre,
    icon: g.primero.icon_key,
    color: g.primero.color_css ?? g.primero.color_token,
  }))
}

export interface CatalogoValores {
  name: string
  icon_key: string
  color_token?: string
  color_hex?: string | null
  color_mode?: 'own' | 'inherit'
  ambito_id?: string
  categoria_id?: string
}


export function useCatalogoMutaciones(kind: CatalogoKind) {
  const qc = useQueryClient()
  const invalidar = () => qc.invalidateQueries({ queryKey: ['catalogo'] })
  const tabla = () => supabase.from(kind as 'ambitos')

  const guardar = useMutation({
    mutationFn: async (v: { id?: string; values: CatalogoValores; hermanos: { id: string; name: string }[] }) => {
      if (v.id) {
        const { error } = await tabla().update(v.values as never).eq('id', v.id)
        if (error) throw error
        return
      }
      // Alta y colocación de «Otros» al final: una sola RPC transaccional (todo o nada); el hogar sale de la sesión, no del cliente.
      const { error } = await supabase.rpc('create_catalog_item', { p_kind: kind, p_values: v.values as unknown as Json, p_siblings: v.hermanos.map((h) => h.id) })
      if (error) throw error
    },
    onSettled: invalidar,
  })

  const activar = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => {
      const { error } = await tabla().update({ is_active: v.is_active } as never).eq('id', v.id)
      if (error) throw error
    },
    onSettled: invalidar,
  })

  const ordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_catalog', { p_kind: kind, p_ids: ids })
      if (error) throw error
    },
    onSettled: invalidar,
  })

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tabla().delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidar,
  })

  /** Cambia el color de varios elementos a la vez (Armonizar y su deshacer). */
  const colorear = useMutation({
    mutationFn: async (cambios: { id: string; values: { color_hex: string | null; color_mode?: 'own' | 'inherit' } }[]) => {
      const res = await Promise.all(cambios.map((c) => tabla().update(c.values as never).eq('id', c.id)))
      const err = res.find((r) => r.error)?.error
      if (err) throw err
    },
    onSettled: invalidar,
  })

  return { guardar, activar, ordenar, eliminar, colorear }
}
