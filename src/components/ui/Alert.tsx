import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'error' | 'success' | 'info'

const tones: Record<Tone, { box: string; icon: typeof Info }> = {
  error: { box: 'border-bad bg-bad-soft text-bad', icon: AlertCircle },
  success: { box: 'border-ok bg-pri-soft text-ok', icon: CheckCircle2 },
  info: { box: 'border-line bg-surface-2 text-fg', icon: Info },
}

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const { box, icon: Icon } = tones[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', box)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
