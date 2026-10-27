import { Check, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { createElement, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { buscarIconos, nombreDe, SECCIONES_ICONOS, type Sugerencia } from '@/domain/iconos'
import { ICONOS_CATALOGO } from '@/domain/iconosCatalogo'
import { cn } from '@/lib/cn'
import { claveIcono, colorVar, iconFor, nombreIcono } from '@/lib/icons'

interface Props {
  value: string
  onChange: (id: string) => void
  /** Sugerencias según el nombre (el componente solo las muestra). */
  sugerencias: Sugerencia[]
  /** Color del elemento (HEX o token) para teñir el ícono elegido. */
  color?: string | null
  /** Texto bajo el ícono cuando el valor viene de una sugerencia automática. */
  nota?: string
}

const Icono = ({ id, className, color }: { id: string; className?: string; color?: string | null }) =>
  createElement(iconFor(id), { className, 'aria-hidden': true, style: color ? { color: colorVar(color) } : undefined })

type Vista = 'sugeridos' | 'todos' | string

/**
 * Selector de ícono único para Ámbitos, Categorías, Subcategorías y Medios de pago. Contraído muestra el ícono actual y
 * sugerencias; expandido abre un explorador de altura fija con búsqueda y secciones: los resultados se desplazan dentro
 * del bloque y nunca alargan el formulario. Elegir un ícono solo cambia el borrador.
 */
export function SelectorIcono({ value, onChange, sugerencias, color, nota }: Props) {
  const idBloque = useId()
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [vista, setVista] = useState<Vista>('sugeridos')
  const botonRef = useRef<HTMLButtonElement>(null)
  const busquedaRef = useRef<HTMLInputElement>(null)
  const rejillaRef = useRef<HTMLDivElement>(null)
  const actual = claveIcono(value)

  const resultados = useMemo(() => {
    if (consulta.trim()) return buscarIconos(consulta, vista === 'sugeridos' || vista === 'todos' ? null : vista).map((i) => ({ id: i.id, nombre: i.nombre }))
    if (vista === 'sugeridos') return sugerencias.map((s) => ({ id: s.id, nombre: s.nombre }))
    if (vista === 'todos') return ICONOS_CATALOGO.map((i) => ({ id: i.id, nombre: i.nombre }))
    return ICONOS_CATALOGO.filter((i) => i.seccion === vista).map((i) => ({ id: i.id, nombre: i.nombre }))
  }, [consulta, vista, sugerencias])

  const reales = sugerencias.filter((s) => s.puntaje > 0)

  function expandir() {
    setAbierto(true)
    setTimeout(() => busquedaRef.current?.focus(), 0)
  }
  function contraer() {
    setAbierto(false)
    setConsulta('')
    setTimeout(() => botonRef.current?.focus(), 0)
  }

  // Escape contrae el explorador estando donde esté el foco (el diálogo que lo contiene no se cierra mientras esté abierto).
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') contraer() }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  /** Flechas: mueve el foco por la rejilla (izquierda/derecha por orden; arriba/abajo por columna). */
  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    const botones = Array.from(rejillaRef.current?.querySelectorAll<HTMLButtonElement>('button[data-ico]') ?? [])
    const i = botones.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    let destino = i
    if (e.key === 'ArrowLeft') destino = Math.max(0, i - 1)
    else if (e.key === 'ArrowRight') destino = Math.min(botones.length - 1, i + 1)
    else {
      const dir = e.key === 'ArrowDown' ? 1 : -1
      const y = botones[i].offsetTop, x = botones[i].offsetLeft
      const candidatos = botones.filter((b) => (dir > 0 ? b.offsetTop > y : b.offsetTop < y))
      if (candidatos.length) {
        const filaY = dir > 0 ? Math.min(...candidatos.map((b) => b.offsetTop)) : Math.max(...candidatos.map((b) => b.offsetTop))
        destino = botones.indexOf(candidatos.filter((b) => b.offsetTop === filaY).sort((a, b) => Math.abs(a.offsetLeft - x) - Math.abs(b.offsetLeft - x))[0])
      }
    }
    botones[destino]?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2"><Icono id={actual} className="size-5" color={color} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" aria-live="polite">Ícono seleccionado: {nombreIcono(actual)}</p>
          {nota && <p className="text-xs text-muted">{nota}</p>}
        </div>
        <button
          ref={botonRef}
          type="button"
          aria-expanded={abierto}
          aria-controls={idBloque}
          onClick={() => (abierto ? contraer() : expandir())}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
        >
          {abierto ? 'Contraer' : 'Cambiar icono'}
          {abierto ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
        </button>
      </div>

      {!abierto && reales.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Íconos sugeridos">
          <span className="text-xs text-muted">Sugeridos:</span>
          {reales.map((s) => (
            <button key={s.id} type="button" aria-pressed={actual === s.id} onClick={() => onChange(s.id)} title={s.nombre}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', actual === s.id ? 'border-pri bg-pri-soft text-pri' : 'border-line hover:bg-surface-2')}>
              <Icono id={s.id} className="size-3.5" /> {s.nombre}
            </button>
          ))}
        </div>
      )}

      {abierto && (
        <div id={idBloque} role="group" aria-label="Explorador de íconos" data-captura-escape onKeyDown={teclas}
          className="flex h-[clamp(260px,40vh,320px)] flex-col overflow-hidden rounded-lg border border-line bg-surface-2/40">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface p-2">
            <label className="flex min-w-0 flex-1 basis-28 items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 focus-within:border-pri">
              <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <input ref={busquedaRef} value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Buscar ícono…" aria-label="Buscar ícono" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
              {consulta && <button type="button" aria-label="Borrar búsqueda" onClick={() => { setConsulta(''); busquedaRef.current?.focus() }} className="text-muted hover:text-fg"><X className="size-3.5" aria-hidden="true" /></button>}
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="sr-only">Sección</span>
              <select value={vista} onChange={(e) => setVista(e.target.value)} aria-label="Sección de íconos" className="max-w-40 rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
                <option value="sugeridos">Sugeridos</option>
                <option value="todos">Todos</option>
                {SECCIONES_ICONOS.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
            <button type="button" onClick={contraer} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold text-pri hover:bg-pri-soft">Listo <Check className="size-4" aria-hidden="true" /></button>
          </div>
          <div ref={rejillaRef} role="radiogroup" aria-label={consulta ? 'Resultados de la búsqueda' : 'Íconos'} className="min-h-0 flex-1 overflow-y-auto p-2">
            {resultados.length === 0 ? (
              <p className="grid h-full place-items-center px-4 text-center text-sm text-muted">No hay íconos para «{consulta}». Prueba con otra palabra o elige una sección.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
                {resultados.map((r) => (
                  <button key={r.id} type="button" role="radio" data-ico={r.id} aria-checked={actual === r.id} aria-label={r.nombre} title={r.nombre}
                    onClick={() => onChange(r.id)}
                    className={cn('grid aspect-square place-items-center rounded-lg border', actual === r.id ? 'border-pri bg-pri-soft text-pri' : 'border-line bg-surface hover:bg-surface-2')}>
                    <Icono id={r.id} className="size-[18px]" color={actual === r.id ? color : null} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="border-t border-line bg-surface px-3 py-1 text-[11px] text-muted" aria-live="polite">
            {resultados.length} {resultados.length === 1 ? 'ícono' : 'íconos'} · {actual ? nombreDe(actual) : ''}
          </p>
        </div>
      )}
    </div>
  )
}
