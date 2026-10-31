import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { AvisoConexion } from '@/features/pwa/AvisoConexion'
import { ThemeSwitch } from '@/features/tema/ThemeSwitch'
import { MARCA } from '@/lib/marca'
import { useTituloPagina } from '@/lib/useTituloPagina'
import { ComposicionFinanciera, PresupuestoMovil } from './escena/TarjetasFinancieras'
import { PresentacionMarca } from './escena/PresentacionMarca'

/**
 * Escena de las pantallas de acceso («Aurora Fintech»): un único escenario continuo, sin división entre paneles.
 *  - ≥ 1280 px: texto de marca · clúster de tarjetas financieras decorativas · tarjeta de acceso (la columna central nunca baja de 416 px: el clúster
 *    adapta su tipografía al ancho disponible, no se escala).
 *  - 1024–1279 px: texto de marca · tarjeta de acceso.
 *  - < 1024 px: cabecera compacta (logo, interruptor de tema y eslogan), UNA tarjeta de presupuesto y el formulario como hoja inferior.
 * El documento hace scroll (sin alturas fijas) y respeta las áreas seguras (notch, bordes curvos, modo standalone), así que funciona con teclado virtual,
 * poca altura y como PWA instalada. El interruptor de tema nunca sale del viewport: en escritorio va anclado a la esquina con las áreas seguras como
 * mínimo de margen; por debajo de 1024 px va dentro de la cabecera, en flujo normal. `tituloPestana` es la sección de la pestaña del navegador.
 */
export function AuthShell({ title, subtitle, tituloPestana, children }: { title: string; subtitle?: string; tituloPestana?: string; children: ReactNode }) {
  useTituloPagina(tituloPestana ?? title)
  return (
    <div className="login-escena relative min-h-dvh overflow-x-clip pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AvisoConexion />

      <div role="region" aria-label="Apariencia" className="absolute right-[max(2rem,env(safe-area-inset-right))] top-[max(1.5rem,env(safe-area-inset-top))] z-20 hidden lg:block">
        <ThemeSwitch guardarEnPerfil={false} />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-[96rem] flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,28rem)] lg:content-center lg:justify-center lg:gap-12 lg:px-10 lg:py-12 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,25rem)] xl:items-center xl:gap-8">
        <header className="flex flex-col gap-2.5 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <BrandLogo variante="compacto" tono="aurora" tamano={38} />
            <ThemeSwitch guardarEnPerfil={false} />
          </div>
          <p className="font-display text-xl font-semibold leading-tight">{MARCA.eslogan}</p>
        </header>
        <PresupuestoMovil className="mx-auto mt-4 w-full max-w-sm lg:hidden" />

        <aside aria-label="Presentación de Control Financiero" className="hidden lg:block"><PresentacionMarca /></aside>
        <div className="hidden xl:block"><ComposicionFinanciera /></div>

        <main className="mt-5 flex flex-1 flex-col sm:flex-none lg:mt-0">
          <section className="esc-tarjeta esc-entrada -mx-4 flex flex-1 flex-col gap-5 rounded-t-[2rem] px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-7 sm:mx-auto sm:w-full sm:max-w-md sm:flex-none sm:rounded-3xl sm:p-8 lg:max-w-none lg:p-9">
            <div className="hidden items-center lg:flex"><BrandLogo variante="compacto" tono="aurora" tamano={34} /></div>
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-[1.7rem] font-bold leading-tight lg:text-[2rem]">{title}</h1>
              {subtitle && <p className="text-sm text-[var(--esc-suave)]">{subtitle}</p>}
            </div>
            {children}
          </section>
        </main>
      </div>
    </div>
  )
}
