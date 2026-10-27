import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { usePerfil } from '@/features/perfil/usePerfil'
import { supabase } from '@/lib/supabase'
import type { Ambito, Categoria, MedioPago, Subcategoria } from '@/lib/tipos'
import type { ComboOption } from '@/components/ui/Combobox'
import { colorEfectivo, hexPropio } from '@/domain/color'

export type CatalogoKind = 'ambitos' | 'categorias' | 'subcategorias' | 'medios_pago'

async function leer<T extends CatalogoKind>(kind: T) {
  const { data, error } = await supabase.from(kind).select('*').order('sort_order').order('name')
  if (error) throw error
  return data
}

export function useCatalogo() {
  const results = useQueries({
    queries: [
      { queryKey: ['catalogo', 'ambitos'], queryFn: () => leer('ambitos') },
      { queryKey: ['catalogo', 'categorias'], queryFn: () => leer('categorias') },
      { queryKey: ['catalogo', 'subcategorias'], queryFn: () => leer('subcategorias') },
      { queryKey: ['catalogo', 'medios_pago'], queryFn: () => leer('medios_pago') },
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

export interface CatalogoValores {
  name: string
  icon_key: string
  color_token?: string
  color_hex?: string | null
  color_mode?: 'own' | 'inherit'
  ambito_id?: string
  categoria_id?: string
}

const esOtros = (n: string) => /^otros?$/i.test(n.trim())

export function useCatalogoMutaciones(kind: CatalogoKind) {
  const qc = useQueryClient()
  const perfil = usePerfil()
  const invalidar = () => qc.invalidateQueries({ queryKey: ['catalogo'] })
  const tabla = () => supabase.from(kind as 'ambitos')

  const guardar = useMutation({
    mutationFn: async (v: { id?: string; values: CatalogoValores; hermanos: { id: string; name: string }[] }) => {
      if (v.id) {
        const { error } = await tabla().update(v.values as never).eq('id', v.id)
        if (error) throw error
        return
      }
      const hid = perfil.data?.household_id
      if (!hid) throw new Error('Perfil sin hogar')
      const orden = v.hermanos.length + 1
      const { data, error } = await tabla().insert({ ...v.values, household_id: hid, sort_order: orden } as never).select('id').single()
      if (error) throw error
      // "Otros" siempre al final, salvo que el usuario lo cambie después a propósito.
      const otros = v.hermanos.filter((h) => esOtros(h.name)).map((h) => h.id)
      if (otros.length && !esOtros(v.values.name)) {
        const resto = v.hermanos.filter((h) => !esOtros(h.name)).map((h) => h.id)
        const { error: e2 } = await supabase.rpc('reorder_catalog', { p_kind: kind, p_ids: [...resto, data.id, ...otros] })
        if (e2) throw e2
      }
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
