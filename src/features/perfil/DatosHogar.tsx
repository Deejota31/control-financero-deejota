import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { mensajeDeError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useHogar } from '@/features/dashboard/useDashboard'

export function DatosHogar() {
  const hogar = useHogar()
  const qc = useQueryClient()
  const [nombre, setNombre] = useState<string | null>(null)

  const renombrar = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('households').update({ name }).eq('id', hogar.data!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hogar'] }),
  })
  const nombreActual = nombre ?? hogar.data?.name ?? ''

  return (
    <div className="flex flex-col gap-4">
      {hogar.isPending ? <Skeleton className="h-10" /> : hogar.isError ? <ErrorState message="No se pudo cargar el hogar." onRetry={() => hogar.refetch()} /> : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            renombrar.mutate(nombreActual.trim(), { onSuccess: () => { toast.success('Nombre del hogar guardado.'); setNombre(null) }, onError: (er) => toast.error(mensajeDeError(er)) })
          }}
        >
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <label htmlFor="hogar-nombre" className="text-sm font-medium">Nombre del hogar</label>
            <Input id="hogar-nombre" value={nombreActual} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <Button type="submit" loading={renombrar.isPending} disabled={!nombreActual.trim() || nombreActual.trim() === hogar.data?.name}>Guardar</Button>
        </form>
      )}
      {hogar.data?.is_demo && <Alert tone="info">Este hogar contiene <b>datos de demostración</b> solo para desarrollo local. Se reinician con <code>npm run db:reset</code>.</Alert>}
      <p className="text-sm text-muted">Hoy eres la única persona con acceso. El modelo de hogar permite añadir colaboración familiar más adelante.</p>
    </div>
  )
}
