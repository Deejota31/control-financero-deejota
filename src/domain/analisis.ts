/**
 * Cálculos de los gráficos de análisis del Dashboard. Son funciones puras: reciben filas agregadas (RPC `dashboard_analisis`) y los mismos
 * filtros cruzados del panel, así ranking y perfil comparten reglas y números con los KPIs.
 */
export type Dim = 'ambito' | 'categoria' | 'subcategoria' | 'medio'

export interface FilaAnalisis {
  fecha?: string
  mes?: string
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  medio_id: string
  tipo: 'fixed' | 'variable' | string
  monto: number
  cantidad?: number
}

export interface FiltrosAnalisis {
  ambito: string
  categoria: string
  subcategoria: string
  medio: string
  tipo: '' | 'fixed' | 'variable'
  dia: string
}

const CAMPO: Record<Dim, 'ambito_id' | 'categoria_id' | 'subcategoria_id' | 'medio_id'> = { ambito: 'ambito_id', categoria: 'categoria_id', subcategoria: 'subcategoria_id', medio: 'medio_id' }
const round2 = (n: number) => Math.round(n * 100) / 100

/** Filtros que una dimensión ignora para seguir mostrando sus alternativas (mismas reglas que la dona y el Top del panel). */
export function propios(dim: Dim): (keyof FiltrosAnalisis)[] {
  return dim === 'categoria' ? ['categoria', 'subcategoria'] : [dim]
}

/** Aplica los filtros cruzados; `excluir` deja fuera los de la propia dimensión del gráfico. El día solo afecta a filas con fecha. */
export function filtrar(filas: FilaAnalisis[], f: FiltrosAnalisis, excluir: (keyof FiltrosAnalisis)[] = []): FilaAnalisis[] {
  const usa = (k: keyof FiltrosAnalisis) => !excluir.includes(k) && Boolean(f[k])
  return filas.filter((r) =>
    (!usa('ambito') || r.ambito_id === f.ambito) && (!usa('categoria') || r.categoria_id === f.categoria) && (!usa('subcategoria') || r.subcategoria_id === f.subcategoria) &&
    (!usa('medio') || r.medio_id === f.medio) && (!usa('tipo') || r.tipo === f.tipo) && (!usa('dia') || !r.fecha || r.fecha === f.dia))
}

const suma = (filas: FilaAnalisis[]) => round2(filas.reduce((s, r) => s + Number(r.monto), 0))
const clave = (r: FilaAnalisis, dim: Dim) => r[CAMPO[dim]] ?? ''

/** Seis meses naturales (yyyy-MM-01) que terminan en el mes de `hasta`. */
export function seisMeses(hasta: string): string[] {
  const [y, m] = hasta.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1)); return d.toISOString().slice(0, 10) })
}

const finDeMes = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() }

export interface ItemRanking {
  id: string
  monto: number
  cantidad: number
  /** % sobre el total del ranking (el denominador es el total de la lista, no del gasto completo). */
  pct: number
  /** Total por mes de los seis meses. */
  serie: number[]
  /** Referencia comparable (promedio mensual anterior, prorrateado si el mes está en curso) o null si no existe. */
  referencia: number | null
  /** (monto − referencia) / referencia; null si no hay referencia (nunca se divide por cero). */
  variacion: number | null
}

export interface ResultadoRanking { items: ItemRanking[]; total: number; meses: string[]; comparable: boolean; parcial: boolean }

/**
 * Ranking de una dimensión para el rango elegido, con su tendencia de seis meses.
 * Referencia: promedio mensual de los meses ANTERIORES de los seis (ceros incluidos). Si el mes de `hasta` sigue en curso, la referencia se
 * prorratea por los días transcurridos para no comparar un mes parcial contra meses completos. Solo se compara cuando el rango es un mes
 * completo o el mes en curso; en otro caso `comparable` es false y no hay variación. Subir o bajar no se interpreta como bueno ni malo.
 */
export function ranking(actual: FilaAnalisis[], historico: FilaAnalisis[], dim: Dim, f: FiltrosAnalisis, ctx: { desde: string; hasta: string; hoy: string }): ResultadoRanking {
  const excl = propios(dim)
  const act = filtrar(actual, f, excl)
  const his = filtrar(historico, f, excl)
  const meses = seisMeses(ctx.hasta)
  const mesDeHasta = meses[5]
  const parcial = ctx.hoy.slice(0, 7) === ctx.hasta.slice(0, 7) && Number(ctx.hoy.slice(8)) < finDeMes(mesDeHasta)
  const mesCompleto = ctx.desde === mesDeHasta && (ctx.hasta === `${mesDeHasta.slice(0, 8)}${String(finDeMes(mesDeHasta)).padStart(2, '0')}` || parcial)
  const comparable = mesCompleto
  const fraccion = parcial ? Number(ctx.hoy.slice(8)) / finDeMes(mesDeHasta) : 1

  const grupos = new Map<string, FilaAnalisis[]>()
  for (const r of act) { const k = clave(r, dim); if (k) (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(r) }
  const total = suma(act.filter((r) => clave(r, dim)))
  const items = [...grupos.entries()].map(([id, filas]): ItemRanking => {
    const monto = suma(filas)
    const propiosHis = his.filter((r) => clave(r, dim) === id)
    const serie = meses.map((m) => suma(propiosHis.filter((r) => r.mes === m)))
    const previos = serie.slice(0, 5)
    const prom = previos.reduce((s, v) => s + v, 0) / 5
    const referencia = comparable && prom > 0 ? round2(prom * fraccion) : null
    return { id, monto, cantidad: filas.reduce((s, r) => s + Number(r.cantidad ?? 0), 0), pct: total > 0 ? (monto / total) * 100 : 0, serie, referencia, variacion: referencia !== null && referencia > 0 ? (monto - referencia) / referencia : null }
  }).sort((a, b) => b.monto - a.monto || a.id.localeCompare(b.id))
  return { items, total, meses, comparable, parcial }
}

export interface EjePerfil { id: string; pct: number; ref: number | null }
export interface Perfil { ejes: EjePerfil[]; max: number }

/**
 * Perfil de gasto: participación (%) de los `n` mayores grupos en el rango, frente a su participación histórica (promedio de los meses
 * anteriores de los seis). Los ejes (grupos) y la escala (hasta el siguiente múltiplo de 10 %) son estables mientras no cambie el conjunto.
 */
export function perfil(r: ResultadoRanking, historico: FilaAnalisis[], dim: Dim, f: FiltrosAnalisis, n = 6): Perfil {
  const top = r.items.slice(0, n)
  const his = filtrar(historico, f, propios(dim))
  const previos = r.meses.slice(0, 5)
  const totalesMes = previos.map((m) => suma(his.filter((x) => x.mes === m && clave(x, dim))))
  const ejes = top.map((it): EjePerfil => {
    const cuotas = previos.map((m, i) => (totalesMes[i] > 0 ? (suma(his.filter((x) => x.mes === m && clave(x, dim) === it.id)) / totalesMes[i]) * 100 : null)).filter((v): v is number => v !== null)
    return { id: it.id, pct: it.pct, ref: cuotas.length && r.comparable ? cuotas.reduce((s, v) => s + v, 0) / cuotas.length : null }
  })
  const mayor = Math.max(10, ...ejes.flatMap((e) => [e.pct, e.ref ?? 0]))
  return { ejes, max: Math.ceil(mayor / 10) * 10 }
}
