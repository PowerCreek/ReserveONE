import {Data} from './types';
import {MIN,dayKey} from './party';
import {buildUnits,members} from './geometry';
export interface LEvent{at:number;kind:'in'|'out';label:string;covers:number;tid:string}
/** Seat (+covers) and clear (-covers) events for one day, from slots. Linked groups are labelled A1+A2. */
export function ledgerEvents(d:Data,day:string):LEvent[]{
  const name=(tid:string)=>{const a=d.assocs.find(x=>members(x).includes(tid));return (a?members(a):[tid]).map(i=>d.tables.find(t=>t.id===i)?.label??i).join('+')};
  const out:LEvent[]=[];
  for(const s of d.slots){const a=Date.parse(s.seated_at);if(dayKey(a)===day)out.push({at:a,kind:'in',label:name(s.table_id),covers:s.party_size,tid:s.table_id});
    if(s.ended_at){const b=Date.parse(s.ended_at);if(dayKey(b)===day)out.push({at:b,kind:'out',label:name(s.table_id),covers:s.party_size,tid:s.table_id})}}
  return out.sort((x,y)=>x.at-y.at);
}
/** Groups events into N-minute buckets, newest first; net = covers in - covers out. */
export function bucketEvents(ev:LEvent[],n:number){
  const m=new Map<number,LEvent[]>();for(const e of ev){const k=Math.floor(e.at/(n*MIN));m.set(k,[...(m.get(k)??[]),e])}
  return [...m].sort((a,b)=>b[0]-a[0]).map(([k,es])=>({start:k*n*MIN,end:(k+1)*n*MIN,es,net:es.reduce((s,e)=>s+(e.kind==='in'?e.covers:-e.covers),0)}));
}
/** Every seating unit classified: open (unreserved) / reserved / seated / lapsed / blocked. All floors together (one establishment) unless `floor` narrows it to one. */
export function tableStates(d:Data,now:number,floor?:string){
  return buildUnits(d.tables,d.assocs).filter(u=>!floor||u.floor_id===floor).map(u=>{
    const sl=d.slots.find(s=>s.status!=='COMPLETED'&&u.tableIds.includes(s.table_id));
    const res=d.reservations.filter(r=>(r.status==='BOOKED'||r.status==='ARRIVED')&&r.table_id&&u.tableIds.includes(r.table_id)&&dayKey(Date.parse(r.time))===dayKey(now)&&Date.parse(r.time)+r.duration_min*MIN>now)
      .sort((a,b)=>Date.parse(a.time)-Date.parse(b.time))[0];
    const state=u.status==='blocked_private'?'blocked':u.status==='occupied'?'seated':u.status==='lapsed'?'lapsed':res?'reserved':'open';
    return{unit:u,state,covers:sl?.party_size,res};
  });
}
