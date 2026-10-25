import { endOfMonth, startOfMonth } from 'date-fns'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { aplicarSeleccion, conPeriodo, limpiarCruzados, type ClaveFiltro, type FiltrosDashboard, type RelacionesCatalogo } from '@/domain/filtrosCruzados'
import { toIso } from '@/lib/format'
import type { Catalogo } from '@/features/catalogo/useCatalogo'

const INICIO = toIso(startOfMonth(new Date()))
const FIN = toIso(endOfMonth(new Date()))

export const FILTROS_PERIODO_ACTUAL: FiltrosDashboard = { desde: INICIO, hasta: FIN, ambito: '', categoria: '', subcategoria: '', medio: '', tipo: '', dia: '' }

const CLAVES = Object.keys(FILTROS_PERIODO_ACTUAL) as (keyof FiltrosDashboard)[]

function leer(p: URLSearchParams): FiltrosDashboard {
  const tipo = p.get('tipo')
  return {
    desde: p.get('desde') ?? INICIO,
    hasta: p.get('hasta') ?? FIN,
    ambito: p.get('ambito') ?? '',
    categoria: p.get('categoria') ?? '',
    subcategoria: p.get('subcategoria') ?? '',
    medio: p.get('medio') ?? '',
    tipo: tipo === 'fixed' || tipo === 'variable' ? tipo : '',
    dia: p.get('dia') ?? '',
  }
}

/**
 * Única fuente de verdad de los filtros del Dashboard (período + selección cruzada), guardada en la URL:
 * se puede recargar, compartir y volver atrás sin perder el contexto.
 */
export function useFiltrosDashboard(catalogo: Catalogo) {
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => leer(params), [params])

  const rel = useMemo<RelacionesCatalogo>(
    () => ({
      ambitoDeCategoria: new Map(catalogo.categorias.map((c) => [c.id, c.ambito_id])),
      categoriaDeSubcategoria: new Map(catalogo.subcategorias.map((s) => [s.id, s.categoria_id])),
    }),
    [catalogo.categorias, catalogo.subcategorias],
  )

  const escribir = useCallback(
    (f: FiltrosDashboard) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          for (const k of CLAVES) {
            if (f[k] === '' || f[k] === FILTROS_PERIODO_ACTUAL[k]) out.delete(k)
            else out.set(k, f[k])
          }
          return out
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return {
    filtros,
    /** Selecciona o, si ya estaba activo, deselecciona. */
    seleccionar: (clave: ClaveFiltro, valor: string) => escribir(aplicarSeleccion(filtros, clave, valor, rel)),
    fijarPeriodo: (desde: string, hasta: string) => escribir(conPeriodo(filtros, desde, hasta)),
    limpiar: () => escribir(limpiarCruzados(filtros)),
  }
}
