import { getDaysInMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { FiltroFecha } from '@/components/ui/FiltroFecha'
import { useHoy } from '@/features/fondos/useHoy'
import { usePerfil } from '@/features/perfil/usePerfil'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { resumirFondo, round2 } from '@/domain/fondos'
import { total, type GastoBasico } from '@/domain/dashboard'
import { ahorroPosible, compromisosMensuales, reservaSugerida, tendencias, totalCompromisos, variablesReducibles } from '@/domain/salud'
import { cn } from '@/lib/cn'
import { formatMes, formatSoles, fromIso, toIso } from '@/lib/format'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { usePresupuestoRango } from '@/features/dashboard/useDashboard'
import { finDeMes, mesDeFecha, sumarMeses } from '@/domain/periodo'
import { usePeriodo } from '@/features/periodos/usePeriodo'
import { useFondos } from '@/features/fondos/useFondos'
import { useGastosRango } from '@/features/gastos/useGastosRango'
import { useEstadoLote, usePlantillas } from '@/features/gastos/usePlantillas'

const HOY = toIso(new Date())
const MES_ACTUAL = mesDeFecha(new Date())
const MESES_BASE = 3

function Seccion({ pregunta, etiqueta, tono, periodo, explicacion, children }: { pregunta: string; etiqueta: string; tono: 'ok' | 'warn' | 'neutral'; periodo: string; explicacion: string; children: React.ReactNode }) {
  return (
    <section aria-label={pregunta} className="flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">{pregunta}</h2>
          <p className="text-sm text-muted">Período analizado: {periodo}</p>
        </div>
        <Pill tone={tono}>{etiqueta}</Pill>
      </div>
      {children}
      <details className="text-sm text-muted">
        <summary className="cursor-pointer font-medium text-fg">Cómo se calcula</summary>
        <p className="mt-1">{explicacion}</p>
      </details>
    </section>
  )
}

function Dato({ etiqueta, valor, tono, nota }: { etiqueta: string; valor: string; tono?: 'bad' | 'ok'; nota?: string }) {
  return (
    <div className="flex flex-col rounded-md bg-surface-2 px-4 py-3">
      <span className="text-sm text-muted">{etiqueta}</span>
      <span className={cn('num text-xl font-medium', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok')}>{valor}</span>
      {nota && <span className="text-xs text-muted">{nota}</span>}
    </div>
  )
}

function Insuficiente({ texto }: { texto: string }) {
  return <Alert tone="info"><b>Datos insuficientes.</b> {texto}</Alert>
}

export function SaludPage() {
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? MES_ACTUAL
  const esActual = mes === MES_ACTUAL
  const finMes = finDeMes(mes)
  const hoyZona = useHoy()
  const formato = usePerfil().data?.date_format ?? 'dd/MM/yyyy'
  const desdeHist = sumarMeses(mes, -MESES_BASE)

  const catalogo = useCatalogo()
  const periodoFondos = usePeriodo(mes)
  const fondosQ = useFondos(periodoFondos.data?.id)
  const gastosQ = useGastosRango(desdeHist, finMes)
  const presupuestoQ = usePresupuestoRango(mes, finMes)
  const plantillasQ = usePlantillas()
  const periodo = usePeriodo(mes)
  const loteQ = useEstadoLote(periodo.data?.id, mes, finMes)
  const [pctAhorro, setPctAhorro] = useState(10)

  const consultas = [catalogo, fondosQ, gastosQ, presupuestoQ, plantillasQ, periodo, loteQ]
  const cargando = consultas.some((q) => q.isPending)
  const falla = consultas.some((q) => q.isError)

  const diasMes = getDaysInMonth(fromIso(mes))
  const diaCorte = esActual ? Math.min(Number(HOY.slice(8)), diasMes) : diasMes

  const analisis = useMemo(() => {
    const todos: GastoBasico[] = gastosQ.data ?? []
    const delMes = todos.filter((g) => g.expense_date >= mes && g.expense_date <= finMes)
    const tramoActual = delMes.filter((g) => Number(g.expense_date.slice(8)) <= diaCorte)
    const previosCompletos: GastoBasico[][] = []
    const previosTramo: GastoBasico[][] = []
    for (let k = 1; k <= MESES_BASE; k++) {
      const ini = sumarMeses(mes, -k)
      const fin = finDeMes(ini)
      const mesGastos = todos.filter((g) => g.expense_date >= ini && g.expense_date <= fin)
      previosCompletos.push(mesGastos)
      previosTramo.push(mesGastos.filter((g) => Number(g.expense_date.slice(8)) <= diaCorte))
    }
    return {
      delMes, tramoActual, previosCompletos,
      porCategoria: tendencias(tramoActual, previosTramo, 'categoria_id'),
      porSub: tendencias(tramoActual.filter((g) => g.subcategoria_id), previosTramo.map((m) => m.filter((g) => g.subcategoria_id)), 'subcategoria_id'),
      variables: variablesReducibles(previosCompletos),
      compromisos: compromisosMensuales(previosCompletos),
    }
  }, [gastosQ.data, mes, finMes, diaCorte])

  const presupuesto = useMemo(() => {
    const p = presupuestoQ.data
    const activos = new Set((fondosQ.data?.fondos ?? []).filter((f) => f.is_active).map((f) => f.id))
    if (!p || p.periodos.length === 0) return null
    return round2(p.presupuestos.filter((b) => activos.has(b.fund_id)).reduce((s, b) => s + Number(b.assigned_amount), 0))
  }, [presupuestoQ.data, fondosQ.data])

  const fondosEnRojo = useMemo(() => {
    const p = presupuestoQ.data
    if (!p || !fondosQ.data) return []
    return fondosQ.data.fondos.filter((f) => f.is_active).map((f) => ({
      f, r: resumirFondo(
        round2(p.presupuestos.filter((b) => b.fund_id === f.id).reduce((s, b) => s + Number(b.assigned_amount), 0)),
        round2(p.asignaciones.filter((a) => a.fund_id === f.id).reduce((s, a) => s + Number(a.amount), 0)),
      ),
    })).filter((x) => x.r.estado === 'negativo' || x.r.estado === 'agotado')
  }, [presupuestoQ.data, fondosQ.data])

  const pendientesPlantillas = useMemo(() => {
    const reg = loteQ.data?.registradas ?? new Set<string>()
    const na = loteQ.data?.noAplica ?? new Set<string>()
    const pend = (plantillasQ.data ?? []).filter((p) => p.is_active && !reg.has(p.id) && !na.has(p.id))
    return { cantidad: pend.length, monto: round2(pend.reduce((s, p) => s + Number(p.default_amount ?? 0), 0)), variables: pend.filter((p) => p.is_amount_variable || !p.default_amount).length }
  }, [plantillasQ.data, loteQ.data])

  const nombreCat = (id: string) => catalogo.categorias.find((c) => c.id === id)
  const etiquetaCat = (id: string) => {
    const c = nombreCat(id)
    const a = catalogo.ambitos.find((x) => x.id === c?.ambito_id)
    return c ? `${c.name} · ${a?.name ?? ''}` : 'Categoría'
  }
  const nombreSub = (id: string) => catalogo.subcategorias.find((s) => s.id === id)

  if (cargando) return <div role="status" aria-label="Cargando salud financiera" className="flex w-full min-w-0 flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>
  if (falla) return <ErrorState message="No se pudo calcular la salud financiera." onRetry={() => consultas.forEach((q) => q.refetch())} />

  const gastado = total(analisis.delMes)
  const disponible = presupuesto === null ? null : round2(presupuesto - gastado)
  const restantes = esActual ? diasMes - diaCorte : 0
  const hayDatos = (gastosQ.data?.length ?? 0) > 0
  const etiquetaMes = formatMes(mes)
  const tramoTxt = esActual ? `${etiquetaMes} hasta el día ${diaCorte}, contra el promedio de ${MESES_BASE} meses anteriores en el mismo tramo` : `${etiquetaMes} completo, contra el promedio de ${MESES_BASE} meses anteriores`
  const reserva = reservaSugerida(analisis.compromisos, pendientesPlantillas.monto)
  const compromisosMes = totalCompromisos(analisis.delMes)

  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-2 xl:[&>:not(section)]:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-md"><FiltroFecha modo="mes" desde={mes} hasta={finDeMes(mes)} formato={formato} hoy={hoyZona} maximo={MES_ACTUAL} onAplicar={(d) => setParams({ mes: d }, { replace: true })} /></div>
        <p className="max-w-2xl text-sm text-muted">Las cifras se calculan con tus gastos reales. Lo marcado como <b>Sugerencia</b> o <b>Estimación</b> es orientativo, no una certeza.</p>
      </div>

      {!hayDatos ? (
        <EmptyState title="Aún no hay gastos para analizar" description="Registra gastos de al menos un mes para ver tendencias y recomendaciones. Con más historial, el análisis mejora." />
      ) : (
        <>
          <Seccion pregunta="¿Cuánto presupuesto queda?" etiqueta="Calculado" tono="ok" periodo={etiquetaMes} explicacion="Presupuesto asignado a los fondos activos del mes menos todos los gastos activos del mes. El disponible por día divide lo que queda entre los días restantes del mes.">
            {presupuesto === null ? (
              <Insuficiente texto="No hay presupuesto asignado a fondos activos en este mes." />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Dato etiqueta="Presupuesto asignado" valor={formatSoles(presupuesto)} />
                  <Dato etiqueta="Gastado" valor={formatSoles(gastado)} nota={`${analisis.delMes.length} movimientos`} />
                  <Dato etiqueta="Disponible" valor={formatSoles(disponible!)} tono={disponible! < 0 ? 'bad' : 'ok'} />
                  {esActual && restantes > 0 && disponible! > 0
                    ? <Dato etiqueta="Disponible por día restante" valor={formatSoles(round2(disponible! / restantes))} nota={`${restantes} días hasta fin de mes`} />
                    : <Dato etiqueta={esActual ? 'Días restantes' : 'Mes finalizado'} valor={esActual ? String(restantes) : '—'} />}
                </div>
                {disponible! < 0 && <Alert tone="error">Superaste el presupuesto del mes en <b className="num">{formatSoles(Math.abs(disponible!))}</b>. Un saldo negativo no impide registrar gastos, pero conviene revisar los fondos.</Alert>}
                {fondosEnRojo.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Fondos agotados o en negativo</h3>
                    <ul className="flex flex-wrap gap-2">{fondosEnRojo.map(({ f, r }) => <li key={f.id}><Pill tone={r.estado === 'negativo' ? 'bad' : 'warn'}>{f.name}: <span className="num">{formatSoles(r.disponible)}</span></Pill></li>)}</ul>
                  </div>
                )}
              </>
            )}
          </Seccion>

          <Seccion pregunta="¿Qué categorías y subcategorías están aumentando?" etiqueta="Calculado" tono="ok" periodo={tramoTxt} explicacion={`Se compara el gasto de cada categoría en el tramo del mes actual con el promedio de los meses anteriores que tienen gasto (hasta ${MESES_BASE}), en el mismo tramo de días. Se marca como aumento lo que sube al menos 10% y 30 soles.`}>
            {analisis.porCategoria.mesesBase === 0 ? (
              <Insuficiente texto="Se necesita al menos un mes anterior con gastos para comparar. Cuando haya más meses registrados verás qué categorías suben." />
            ) : (
              <>
                <p className="text-sm text-muted">Base de comparación: {analisis.porCategoria.mesesBase} {analisis.porCategoria.mesesBase === 1 ? 'mes anterior' : 'meses anteriores'} con datos.</p>
                {analisis.porCategoria.aumentando.length === 0 ? <Alert tone="success">Ninguna categoría sube de forma notable frente a tu promedio.</Alert> : (
                  <TablaTendencia titulo="Categorías" filas={analisis.porCategoria.aumentando.map((f) => ({ ...f, nombre: etiquetaCat(f.id), icono: nombreCat(f.id)?.icon_key, color: nombreCat(f.id)?.color_css }))} />
                )}
                {analisis.porSub.aumentando.length > 0 && (
                  <TablaTendencia titulo="Subcategorías" filas={analisis.porSub.aumentando.slice(0, 5).map((f) => ({ ...f, nombre: nombreSub(f.id)?.name ?? 'Subcategoría', icono: nombreSub(f.id)?.icon_key, color: undefined }))} />
                )}
              </>
            )}
          </Seccion>

          <Seccion pregunta="¿Qué gastos variables podrían reducirse?" etiqueta="Sugerencia" tono="warn" periodo={`promedio de ${MESES_BASE} meses anteriores`} explicacion="Se promedian por mes los gastos de tipo variable de los meses anteriores con datos y se listan los de mayor monto. El ahorro es hipotético: aplica el porcentaje elegido a ese promedio y no garantiza que sea posible reducirlo.">
            {analisis.variables.mesesBase === 0 ? (
              <Insuficiente texto="No hay gastos variables en meses anteriores para estimar un promedio." />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span id="pct-lbl" className="font-medium">Reducción supuesta</span>
                  <div role="radiogroup" aria-labelledby="pct-lbl" className="inline-flex rounded-md bg-surface-2 p-0.5 font-semibold">
                    {[5, 10, 15, 20].map((p) => <button key={p} type="button" role="radio" aria-checked={pctAhorro === p} onClick={() => setPctAhorro(p)} className={cn('rounded px-3 py-1', pctAhorro === p ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{p}%</button>)}
                  </div>
                </div>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Ahorro posible por categoría">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead><tr className="text-xs uppercase tracking-wide text-muted"><th className="py-2">Categoría</th><th className="py-2 text-right">Promedio mensual</th><th className="py-2 text-right">% de lo variable</th><th className="py-2 text-right">Ahorro posible al {pctAhorro}%</th></tr></thead>
                    <tbody>
                      {analisis.variables.filas.map((f) => (
                        <tr key={f.id} className="border-t border-line">
                          <td className="py-2"><span className="inline-flex items-center gap-2"><ItemIcon name={nombreCat(f.id)?.icon_key} color={nombreCat(f.id)?.color_css} />{etiquetaCat(f.id)}</span></td>
                          <td className="num py-2 text-right">{formatSoles(f.promedio)}</td>
                          <td className="num py-2 text-right">{f.participacion.toFixed(1)}%</td>
                          <td className="num py-2 text-right font-medium">{formatSoles(ahorroPosible(f.promedio, pctAhorro))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm">Reducir {pctAhorro}% en estas categorías liberaría unos <b className="num">{formatSoles(round2(analisis.variables.filas.reduce((s, f) => s + ahorroPosible(f.promedio, pctAhorro), 0)))}</b> al mes <span className="text-muted">(sugerencia basada en {analisis.variables.mesesBase} {analisis.variables.mesesBase === 1 ? 'mes' : 'meses'} de datos).</span></p>
              </>
            )}
          </Seccion>

          <Seccion pregunta="¿Cuánto presupuesto conviene reservar para compromisos mensuales?" etiqueta="Sugerencia" tono="warn" periodo={`${etiquetaMes} y promedio de ${MESES_BASE} meses anteriores`} explicacion="Los compromisos son gastos marcados como recurrentes o de tipo fijo. Se promedian los meses anteriores y se compara con lo esperado por tus plantillas pendientes; la reserva sugerida es el mayor de ambos, redondeado hacia arriba a 10 soles. Las plantillas de importe variable usan su importe sugerido, que puede diferir del real.">
            {analisis.compromisos.mesesBase === 0 && pendientesPlantillas.cantidad === 0 && compromisosMes === 0 ? (
              <Insuficiente texto="Aún no hay gastos recurrentes o fijos ni plantillas mensuales. Marca tus gastos fijos como recurrentes o crea plantillas para estimar la reserva." />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Dato etiqueta="Compromisos de este mes" valor={formatSoles(compromisosMes)} nota="Ya registrados (calculado)" />
                  <Dato etiqueta="Promedio histórico" valor={analisis.compromisos.promedio === null ? '—' : formatSoles(analisis.compromisos.promedio)} nota={analisis.compromisos.mesesBase ? `${analisis.compromisos.mesesBase} meses con datos` : 'Sin historial'} />
                  <Dato etiqueta="Pendiente por plantillas" valor={formatSoles(pendientesPlantillas.monto)} nota={`${pendientesPlantillas.cantidad} sin registrar${pendientesPlantillas.variables ? ` · ${pendientesPlantillas.variables} de importe variable` : ''}`} />
                  <Dato etiqueta="Reserva sugerida" valor={reserva === null ? '—' : formatSoles(reserva)} nota={reserva !== null && presupuesto ? `${((reserva / presupuesto) * 100).toFixed(0)}% del presupuesto del mes` : undefined} />
                </div>
                {reserva !== null && <Alert tone="info"><b>Sugerencia:</b> reserva alrededor de <b className="num">{formatSoles(reserva)}</b> cada mes para tus compromisos. Es una estimación a partir de tu historial; revísala si cambian tus gastos fijos.</Alert>}
              </>
            )}
          </Seccion>
        </>
      )}
    </div>
  )
}

function TablaTendencia({ titulo, filas }: { titulo: string; filas: { id: string; nombre: string; icono?: string; color?: string | null; actual: number; promedio: number; diferencia: number; pct: number | null }[] }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${titulo} que suben`}>
      <h3 className="mb-1 text-sm font-semibold">{titulo} que suben</h3>
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead><tr className="text-xs uppercase tracking-wide text-muted"><th className="py-2">{titulo.slice(0, -1)}</th><th className="py-2 text-right">Este mes</th><th className="py-2 text-right">Promedio anterior</th><th className="py-2 text-right">Diferencia</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-t border-line">
              <td className="py-2"><span className="inline-flex items-center gap-2"><ItemIcon name={f.icono} color={f.color} />{f.nombre}</span></td>
              <td className="num py-2 text-right">{formatSoles(f.actual)}</td>
              <td className="num py-2 text-right">{formatSoles(f.promedio)}</td>
              <td className="num py-2 text-right font-medium text-bad">+{formatSoles(f.diferencia)}{f.pct !== null ? ` (${f.pct.toFixed(0)}%)` : ' (nuevo)'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
