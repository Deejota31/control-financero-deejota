import { MAX_LOOKBACK_DAYS, priorDate, quotesBetween, validDate } from '../_shared/bcrp.ts'

// Cotización oficial USD/PEN (BCRP, serie PD04640PD: tipo de cambio SBS, venta). Orientativa: no es la tasa de un banco o tarjeta.
// Con sesión válida devuelve la tasa del día pedido o, si no se publicó, la última anterior (máximo siete días) con su fecha real.
// La respuesta queda en `exchange_rate_quotes`: la base solo acepta guardar cotizaciones automáticas que coincidan con esa caché.
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
const pending=new Map<string,Promise<unknown>>()
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const monthOf=(date:string)=>({from:`${date.slice(0,8)}01`,to:new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0)).toISOString().slice(0,10)})

/** El cortafuegos del BCRP a veces responde una página HTML de verificación en lugar del JSON: se reintenta con pausa creciente. */
async function fetchBcrp(from:string,to:string):Promise<string> {
  const url=`https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04640PD/json/${from}/${to}/esp`
  for(let attempt=0;attempt<3;attempt++) {
    if(attempt>0) await wait(800*attempt)
    const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}})
    const text=await response.text()
    if(response.ok && text.trimStart().startsWith('{')) return text
  }
  throw new Error('BCRP no está disponible. Puedes ingresar una tasa manual.')
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response(null,{headers})
  if(req.method!=='POST') return reply({error:'Método no permitido.'},405)
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization=req.headers.get('authorization')??''
  if(!/^Bearer \S+$/.test(authorization)) return reply({error:'Inicia sesión.'},401)
  try {
    const auth=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,authorization},signal:AbortSignal.timeout(10000)})
    if(!auth.ok) return reply({error:'Sesión no válida.'},401)
    const body=await req.json()
    const date=body.date
    const today=new Date().toISOString().slice(0,10)
    if(!validDate(date) || date<'1997-01-02' || date>today) return reply({error:'Fecha de cotización inválida.'},400)
    const dbHeaders={apikey:secret,authorization:`Bearer ${secret}`,'Content-Type':'application/json'}
    const work=async()=>{
      const cache=await fetch(`${url}/rest/v1/exchange_rate_quotes?date_requested=eq.${date}&select=*`,{headers:dbHeaders,signal:AbortSignal.timeout(10000)})
      if(!cache.ok) throw new Error('No se pudo consultar la caché de cotizaciones.')
      const guardada=(await cache.json())[0]
      // Una fecha ya cerrada (más de una semana atrás) no cambia: se reutiliza. Las recientes se refrescan cada hora.
      const cerrada=date<new Date(Date.now()-MAX_LOOKBACK_DAYS*86400000).toISOString().slice(0,10)
      if(guardada && (cerrada || Date.now()-Date.parse(guardada.fetched_at)<3600000)) return guardada
      try {
        // Una sola consulta por mes llena la caché de todos sus días: pocas llamadas al proveedor, menos bloqueos.
        const mes=monthOf(date), hasta=mes.to<today?mes.to:today
        const filas=quotesBetween(await fetchBcrp(priorDate(mes.from),hasta),mes.from,hasta)
        const fetched_at=new Date().toISOString()
        const propia=filas.find(f=>f.date_requested===date)
        if(!propia) throw new Error('No hay cotización válida en los siete días anteriores. Ingresa una tasa manual.')
        const write=await fetch(`${url}/rest/v1/exchange_rate_quotes?on_conflict=date_requested`,{method:'POST',headers:{...dbHeaders,Prefer:'resolution=merge-duplicates'},body:JSON.stringify(filas.map(f=>({...f,fetched_at}))),signal:AbortSignal.timeout(10000)})
        if(!write.ok) throw new Error('No se pudo validar la cotización en el servidor.')
        return {...propia,fetched_at,max_lookback_days:MAX_LOOKBACK_DAYS}
      } catch(e) {
        // Con el proveedor caído, una cotización ya verificada de esa fecha es preferible a no tener ninguna.
        if(guardada) return guardada
        throw e
      }
    }
    let promise=pending.get(date)
    if(!promise) {promise=work().finally(()=>pending.delete(date));pending.set(date,promise)}
    return reply(await promise)
  } catch(e) {return reply({error:e instanceof Error?e.message:'No se pudo consultar la cotización.'},503)}
})
