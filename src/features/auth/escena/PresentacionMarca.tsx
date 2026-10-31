import { ChartNoAxesColumn, Coins, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { MARCA } from '@/lib/marca'

const BENEFICIOS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  { icono: ChartNoAxesColumn, titulo: 'Controla tus gastos', texto: 'Visualiza en qué usas tu dinero.' },
  { icono: Coins, titulo: 'Planifica tus presupuestos', texto: 'Organiza tus fondos mensuales.' },
  { icono: ShieldCheck, titulo: 'Construye tu futuro', texto: 'Ahorra y alcanza tus metas.' },
]

/** Columna izquierda de escritorio: marca, etiqueta, titular con degradado, descripción y tres beneficios. */
export function PresentacionMarca() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BrandLogo tono="aurora" tamano={48} />
      <span className="esc-chip inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium">
        <Sparkles className="size-3.5" aria-hidden="true" /> Tu vida financiera, más simple
      </span>
      <h2 className="font-display text-[2.6rem] font-bold leading-[1.06] xl:text-[2.9rem] 2xl:text-[3.2rem]">
        Tus finanzas,<br />
        <span className="esc-titulo">bajo control.</span>
      </h2>
      <p className="max-w-sm text-base leading-relaxed text-[var(--esc-suave)]">{MARCA.descripcion}</p>
      <ul className="mt-1 flex flex-col gap-4 [@media(max-height:760px)]:hidden">
        {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo} className="flex items-center gap-3.5">
            <span className="esc-icono grid size-12 shrink-0 place-items-center rounded-2xl"><Icono className="size-5" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-[0.95rem] font-semibold">{titulo}</span>
              <span className="block text-sm text-[var(--esc-suave)]">{texto}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
