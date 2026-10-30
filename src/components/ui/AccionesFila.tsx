import * as Menu from '@radix-ui/react-dropdown-menu'
import { ChevronsLeft, MoreHorizontal, MoreVertical, X, type LucideIcon } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { arrastreVisible, clasificarEje, puedeIniciarGesto, resolverGesto, type Eje } from '@/domain/gesto'
import { cn } from '@/lib/cn'

/**
 * Acciones por elemento de una lista. Un solo catálogo de acciones por fila alimenta las dos presentaciones:
 *  - tarjeta (móvil o contenedor estrecho): deslizar a la izquierda o pulsar «Acciones» abre un panel con TODAS las acciones, con icono y texto;
 *  - tabla (escritorio): el menú desplegable de siempre, acotado a la pantalla.
 * Las reglas de negocio quedan en quien declara las acciones; aquí solo hay interacción, presentación, foco y accesibilidad.
 */

export interface AccionFila {
  clave: string
  /** Texto visible: «Editar fondo». */
  etiqueta: string
  /** Nombre accesible completo con el elemento: «Editar fondo General». Por defecto, «etiqueta + nombre». */
  nombreAccesible?: string
  icono: LucideIcon
  onSelect: () => void
  tono?: 'peligro' | 'ok'
  deshabilitada?: boolean
  /** Por qué no se puede ahora (se muestra bajo la acción deshabilitada). */
  motivo?: string
}

/* ------------------------------ Grupo: una sola fila abierta ------------------------------ */

interface Estado { id: string; clave: string }
const Contexto = createContext<{ abiertoId: string | null; abrir: (id: string) => void; cerrar: () => void } | null>(null)

/**
 * Agrupa las filas de una lista: solo una puede tener el panel abierto. `clave` resume lo que cambia el contenido (búsqueda, filtros, orden, página, período, sección):
 * si cambia, el panel abierto deja de contar como abierto sin necesidad de efectos.
 */
export function GrupoAcciones({ clave, children }: { clave: string; children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const abiertoId = estado && estado.clave === clave ? estado.id : null
  const valor = useMemo(() => ({ abiertoId, abrir: (id: string) => setEstado({ id, clave }), cerrar: () => setEstado(null) }), [abiertoId, clave])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

function useGrupo() {
  const c = useContext(Contexto)
  if (!c) throw new Error('FilaAcciones debe usarse dentro de GrupoAcciones')
  return c
}

/* ------------------------------ Medida del contenedor ------------------------------ */

/** `true` cuando el elemento medido mide al menos `minimo` px de ancho (se actualiza al redimensionar). Devuelve un ref de callback: el elemento puede montarse más tarde. */
export function useAnchoMinimo<T extends HTMLElement>(minimo: number): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null)
  const [ancha, setAncha] = useState(true)
  useLayoutEffect(() => {
    if (!el) return
    const medir = () => setAncha(el.clientWidth >= minimo)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, minimo])
  return [setEl, ancha]
}

/* ------------------------------ Menú de escritorio ------------------------------ */

const ITEM = 'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2'

/** Menú desplegable con las mismas acciones. Limita su altura al espacio libre y desplaza por dentro: nunca queda fuera de la pantalla. */
export function MenuDeAcciones({ nombre, acciones, etiquetaBoton, className }: { nombre: string; acciones: AccionFila[]; etiquetaBoton?: string; className?: string }) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" aria-label={etiquetaBoton ?? `Más acciones de ${nombre}`} className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-pri-soft hover:text-pri data-[state=open]:bg-pri-soft data-[state=open]:text-pri', className)}>
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={`Acciones de ${nombre}`}
          className="anim-pop z-[80] max-h-[min(var(--radix-dropdown-menu-content-available-height),30rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          {acciones.map((a) => (
            <div key={a.clave}>
              {a.tono === 'peligro' && <Menu.Separator className="my-1.5 h-px bg-line" />}
              <Menu.Item className={cn(ITEM, a.tono === 'peligro' && 'text-bad data-[highlighted]:bg-bad-soft')} disabled={a.deshabilitada} title={a.deshabilitada ? a.motivo : undefined} onSelect={a.onSelect}>
                <a.icono className="size-4 shrink-0" aria-hidden="true" /> {a.etiqueta}
              </Menu.Item>
            </div>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/* ------------------------------ Panel de acciones ------------------------------ */

function PanelAcciones({ id, nombre, acciones, onCerrar, onElegir, refPanel }: {
  id: string; nombre: string; acciones: AccionFila[]; onCerrar: () => void; onElegir: (a: AccionFila) => void; refPanel: RefObject<HTMLDivElement | null>
}) {
  return (
    // data-captura-escape: mientras el panel está abierto, Escape lo cierra a él y no al diálogo que lo contiene.
    <div ref={refPanel} id={id} role="group" aria-label={`Acciones de ${nombre}`} data-captura-escape="" data-panel-acciones
      className="@container flex max-h-[min(30rem,60dvh)] scroll-mb-28 flex-col border-t border-pri/30 bg-surface-2/80 px-3 pb-3 pt-1.5">
      <div className="flex shrink-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">Acciones de <span className="text-fg">{nombre}</span></p>
        <button type="button" aria-label={`Cerrar acciones de ${nombre}`} onClick={onCerrar} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid min-h-0 grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain @min-[24rem]:grid-cols-2">
        {acciones.map((a) => {
          const idMotivo = `${id}-${a.clave}-motivo`
          return (
            <button key={a.clave} type="button" data-accion={a.clave} aria-label={a.nombreAccesible ?? `${a.etiqueta} ${nombre}`} aria-disabled={a.deshabilitada || undefined}
              aria-describedby={a.deshabilitada && a.motivo ? idMotivo : undefined}
              onClick={() => { if (!a.deshabilitada) onElegir(a) }}
              className={cn('flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-lg border bg-surface px-3 py-2 text-left text-sm font-medium transition-colors',
                a.deshabilitada ? 'cursor-not-allowed border-line text-muted' : a.tono === 'peligro' ? 'border-bad/30 text-bad hover:bg-bad-soft' : a.tono === 'ok' ? 'border-line text-ok hover:bg-ok-soft' : 'border-line hover:bg-pri-soft hover:text-pri')}>
              <a.icono className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 leading-snug">
                {a.etiqueta}
                {a.deshabilitada && a.motivo && <span id={idMotivo} className="block text-xs font-normal text-muted">{a.motivo}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------ Gesto ------------------------------ */

function useGesto({ habilitado, abierto, permitirRaton, onAbrir, onCerrar }: { habilitado: boolean; abierto: boolean; permitirRaton: boolean; onAbrir: () => void; onCerrar: () => void }) {
  const sesion = useRef<{ x: number; y: number; id: number; eje: Eje; dx: number } | null>(null)
  const suprimir = useRef(false)
  const [arrastre, setArrastre] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)

  const terminar = useCallback(() => { sesion.current = null; setArrastre(0); setArrastrando(false) }, [])

  const props: HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (!habilitado || !e.isPrimary) return
      if (e.pointerType === 'mouse' && (!permitirRaton || e.button !== 0)) return
      if (!puedeIniciarGesto(e.target as Element, e.currentTarget)) return
      sesion.current = { x: e.clientX, y: e.clientY, id: e.pointerId, eje: 'pendiente', dx: 0 }
    },
    onPointerMove: (e) => {
      const s = sesion.current
      if (!s || e.pointerId !== s.id) return
      const dx = e.clientX - s.x, dy = e.clientY - s.y
      if (s.eje === 'pendiente') {
        s.eje = clasificarEje(dx, dy)
        if (s.eje === 'vertical') { sesion.current = null; return } // el desplazamiento vertical es de la página
        if (s.eje === 'horizontal') { try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sin captura: el gesto sigue mientras el puntero esté sobre la fila */ } setArrastrando(true) }
      }
      if (s.eje === 'horizontal') { s.dx = dx; setArrastre(arrastreVisible(dx, abierto)) }
    },
    onPointerUp: (e) => {
      const s = sesion.current
      if (!s || e.pointerId !== s.id) return
      if (s.eje === 'horizontal') {
        if (e.pointerType === 'mouse') { // con ratón, al soltar sobre el mismo elemento llega un clic que no debe activar el contenido
          suprimir.current = true
          setTimeout(() => { suprimir.current = false }, 400)
        }
        const r = resolverGesto(s.dx, abierto)
        if (r === 'abrir') onAbrir()
        else if (r === 'cerrar') onCerrar()
      }
      terminar()
    },
    onPointerCancel: terminar,
    onClickCapture: (e) => {
      if (suprimir.current) { e.preventDefault(); e.stopPropagation(); suprimir.current = false }
    },
  }
  return { props, arrastre, arrastrando }
}

/* ------------------------------ Fila ------------------------------ */

interface FilaProps {
  id: string
  /** Nombre del elemento: identifica el panel y las acciones. */
  nombre: string
  acciones: AccionFila[]
  /** Presentación de tarjeta (gesto + panel). En escritorio es `false` y la fila pinta su propio menú. */
  activo: boolean
  as?: 'li' | 'div'
  /** Clases del contenedor externo (bordes entre filas) en modo tarjeta; en modo tabla se suman a las de la tarjeta. */
  className?: string
  /** Clases de la tarjeta (la fila propiamente dicha). */
  tarjetaClassName?: string
  tarjetaProps?: HTMLAttributes<HTMLDivElement> & Record<string, unknown>
  tarjetaStyle?: React.CSSProperties
  /** Botón «Acciones» solo con icono (el nombre accesible no cambia): para filas donde el nombre necesita todo el ancho. */
  botonCompacto?: boolean
  /** Las filas arrastrables (orden manual) no usan el gesto con el ratón, que ya es de arrastrar y soltar. */
  permitirRaton?: boolean
  children: (botonAcciones: ReactNode) => ReactNode
}

/** Fila con acciones. En modo tarjeta recibe el botón «Acciones» para colocarlo donde convenga; en modo tabla lo recibe `null`. */
export function FilaAcciones({ id, nombre, acciones, activo, as: Tag = 'div', className, tarjetaClassName, tarjetaProps, tarjetaStyle, permitirRaton = true, botonCompacto, children }: FilaProps) {
  const grupo = useGrupo()
  const abierto = activo && grupo.abiertoId === id
  const idPanel = useId()
  const raiz = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const enfocarPrimero = useRef(false)
  const { abrir, cerrar } = grupo

  const gesto = useGesto({ habilitado: activo, abierto, permitirRaton, onAbrir: () => abrir(id), onCerrar: cerrar })

  // Abierto: Escape o un toque fuera lo cierran; al abrirlo se lleva a la vista (por encima de la barra inferior y del pie del diálogo).
  useEffect(() => {
    if (!abierto) return
    const alTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const dentro = raiz.current?.contains(document.activeElement)
      cerrar()
      if (dentro || document.activeElement === document.body) boton.current?.focus()
    }
    const alToque = (e: PointerEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) cerrar() }
    document.addEventListener('keydown', alTecla)
    document.addEventListener('pointerdown', alToque)
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    panel.current?.scrollIntoView?.({ block: 'nearest', behavior: reducir ? 'auto' : 'smooth' })
    if (enfocarPrimero.current) {
      enfocarPrimero.current = false
      panel.current?.querySelector<HTMLElement>('button[data-accion]:not([aria-disabled="true"])')?.focus({ preventScroll: true })
    }
    return () => { document.removeEventListener('keydown', alTecla); document.removeEventListener('pointerdown', alToque) }
  }, [abierto, cerrar])

  if (!activo) {
    return <Tag className={cn(className, tarjetaClassName)} style={tarjetaStyle} {...(tarjetaProps as object)}>{children(null)}</Tag>
  }

  const alternar = () => { if (abierto) cerrar(); else { enfocarPrimero.current = true; abrir(id) } }
  const cerrarYEnfocar = () => { cerrar(); boton.current?.focus() }
  const elegir = (a: AccionFila) => {
    boton.current?.focus({ preventScroll: true }) // el foco vuelve al botón que abrió el panel antes de que la acción abra su diálogo
    cerrar()
    a.onSelect()
  }
  const botonAcciones = (
    <button ref={boton} type="button" aria-label={`Más acciones de ${nombre}`} aria-expanded={abierto} aria-controls={idPanel} onClick={alternar}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-fg transition-colors hover:bg-pri-soft hover:text-pri aria-expanded:border-pri aria-expanded:bg-pri-soft aria-expanded:text-pri">
      <MoreHorizontal className="size-4" aria-hidden="true" /> <span className={cn(botonCompacto && 'sr-only')}>Acciones</span>
    </button>
  )
  const ancho = -gesto.arrastre
  return (
    <Tag ref={raiz as never} className={cn('relative min-w-0', className)} data-fila-acciones={id}>
      <div className="relative overflow-hidden rounded-[inherit] bg-surface">
        {ancho > 0 && (
          <div aria-hidden="true" className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 overflow-hidden bg-pri-soft text-xs font-bold text-pri" style={{ width: ancho }}>
            <ChevronsLeft className="size-4 shrink-0" />{ancho > 78 && <span>Acciones</span>}
          </div>
        )}
        <div {...gesto.props} {...(tarjetaProps as object)} data-abierta={abierto} data-gesto-fila
          className={cn('relative data-[abierta=true]:outline-2 data-[abierta=true]:-outline-offset-2 data-[abierta=true]:outline-pri/40 data-[abierta=true]:outline', !gesto.arrastrando && 'transition-transform duration-200 motion-reduce:transition-none', gesto.arrastrando && 'select-none', tarjetaClassName)}
          style={{ ...tarjetaStyle, transform: gesto.arrastre ? `translateX(${gesto.arrastre}px)` : undefined, touchAction: 'pan-y' }}>
          {children(botonAcciones)}
        </div>
      </div>
      {abierto && <PanelAcciones id={idPanel} nombre={nombre} acciones={acciones} refPanel={panel} onCerrar={cerrarYEnfocar} onElegir={elegir} />}
    </Tag>
  )
}
