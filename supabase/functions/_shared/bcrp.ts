export const SOURCE = 'BCRP:PD04640PD'
export const MAX_LOOKBACK_DAYS = 7
const MONTHS: Record<string, string> = { ene:'01', feb:'02', mar:'03', abr:'04', may:'05', jun:'06', jul:'07', ago:'08', sep:'09', set:'09', oct:'10', nov:'11', dic:'12' }
export function validDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s
}
export function priorDate(date: string) { return new Date(Date.parse(date)-MAX_LOOKBACK_DAYS*86400000).toISOString().slice(0,10) }
/** BCRP sometimes appends PHP diagnostics AFTER its JSON. Read only the complete
 * structured JSON document; never extract rates from the diagnostic HTML. */
export function jsonDocument(text: string): unknown {
  let depth=0, quoted=false, escaped=false
  const s=text.trimStart()
  if (!s.startsWith('{')) throw new Error('Respuesta BCRP inválida.')
  for(let i=0;i<s.length;i++) {
    const c=s[i]
    if(quoted) { if(escaped) escaped=false; else if(c==='\\') escaped=true; else if(c==='"') quoted=false; continue }
    if(c==='"') quoted=true
    else if(c==='{' || c==='[') depth++
    else if(c==='}' || c===']') { depth--; if(depth===0) return JSON.parse(s.slice(0,i+1)) }
  }
  throw new Error('Respuesta BCRP incompleta.')
}
export interface BcrpRow { rate: string; reference_date: string }
/** Filas publicadas con tasa válida (descarta «n.d.»), de la más reciente a la más antigua. Solo se lee el JSON estructurado. */
export function seriesFromBcrp(text: string): BcrpRow[] {
  const data=jsonDocument(text) as {config?:{series?:{name?:string}[]};periods?:{name?:string;values?:unknown[]}[]}
  if(!Array.isArray(data.periods) || !/SBS.*Venta/i.test(data.config?.series?.[0]?.name ?? '')) throw new Error('Serie BCRP inesperada.')
  return data.periods.flatMap(p=>{
    const m=/^(\d{2})\.([a-z]{3})\.(\d{2}|\d{4})$/i.exec(p.name??'')
    if(!m) return []
    const year=m[3].length===4?m[3]:`${Number(m[3])>=97?'19':'20'}${m[3]}`
    const reference_date=`${year}-${MONTHS[m[2].toLowerCase()]}-${m[1]}`
    const rate=String(p.values?.[0]??'').trim()
    if(!validDate(reference_date)||!/^\d{1,8}(\.\d{1,12})?$/.test(rate)||Number(rate)<=0) return []
    return [{rate,reference_date}]
  }).sort((a,b)=>b.reference_date.localeCompare(a.reference_date))
}
/** Última tasa publicada hasta `date` (inclusive) dentro del margen de búsqueda: el día mismo o el anterior válido (fines de semana, feriados). */
export function quoteForDate(rows: BcrpRow[], date: string) {
  const start=priorDate(date)
  const r=rows.find(x=>x.reference_date<=date && x.reference_date>=start)
  return r ? {rate:r.rate,reference_date:r.reference_date,source:SOURCE} : null
}
export function quoteFromBcrp(text: string, date: string) {
  if(!validDate(date)) throw new Error('Serie BCRP inesperada.')
  const quote=quoteForDate(seriesFromBcrp(text),date)
  if(!quote) throw new Error('No hay cotización válida en los siete días anteriores. Ingresa una tasa manual.')
  return quote
}
/** Cotización de cada día entre `from` y `to`: permite llenar la caché de un mes con una sola consulta al proveedor. */
export function quotesBetween(text: string, from: string, to: string) {
  const rows=seriesFromBcrp(text), out: {date_requested:string;rate:string;reference_date:string;source:string}[]=[]
  for(let t=Date.parse(from); t<=Date.parse(to); t+=86400000) {
    const date=new Date(t).toISOString().slice(0,10), q=quoteForDate(rows,date)
    if(q) out.push({date_requested:date,...q})
  }
  return out
}
