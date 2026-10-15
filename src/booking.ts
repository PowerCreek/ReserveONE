import {Data,Table} from './types';
import {MIN,fmtClock} from './party';
const RESET=5*MIN;
/** Why a table can't take [start, start+dur): overlapping reservation, private event (incl. 30m prep) or a seated party. null = free. */
export function tableConflict(d:Data,tid:string,s:number,dur:number,ex?:string):string|null{
  const e=s+dur*MIN;
  for(const r of d.reservations){if(r.id===ex||r.table_id!==tid||!(r.status==='BOOKED'||r.status==='ARRIVED'))continue;
    const a=Date.parse(r.time),b=a+r.duration_min*MIN;if(s<b+RESET&&e+RESET>a)return `${r.name} ${fmtClock(a)}`}
  for(const v of d.events){if(v.reclaimed||!v.table_ids.includes(tid))continue;const a=Date.parse(v.start)-30*MIN,b=Date.parse(v.end);if(s<b&&e>a)return `🔒 ${v.name}`}
  for(const sl of d.slots){if(sl.status==='COMPLETED'||sl.table_id!==tid)continue;const b=Date.parse(sl.expected_turn_at);if(s<b+RESET&&Date.parse(sl.seated_at)<e)return `${sl.party_label} until ${fmtClock(b)}`}
  return null;
}
export const bestFit=(c:{t:Table;c:string|null}[])=>c.filter(x=>!x.c).sort((a,b)=>a.t.capacity-b.t.capacity||a.t.label.localeCompare(b.t.label))[0]?.t.id??null;
export const dayLoad=(d:Data,s:number,ex?:string)=>{const r=d.reservations.filter(x=>x.id!==ex&&(x.status==='BOOKED'||x.status==='ARRIVED')&&Math.abs(Date.parse(x.time)-s)<=60*MIN);
  return{parties:r.length,covers:r.reduce((n,x)=>n+x.party_size,0)}};
