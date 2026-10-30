import type { ReactNode } from 'react'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-md bg-pri text-pri-fg">
            G
          </span>
          Gasto Deejota
        </div>
        <div className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}
