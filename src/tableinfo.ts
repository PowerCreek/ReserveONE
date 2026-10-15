import {Data,Table} from './types';
import {members} from './geometry';
import {hereRes,hereQ} from './arrivals';
import {MIN} from './party';
export interface PartyInfo{label:string;name:string;size:number;here:number;kind:'res'|'queue'|'walkin';arrivedAt?:number;seatedAt:number;turnAt:number;resTime?:number;slotId:string}
export interface HeldInfo{label:string;name:string;size:number;here:number;at:number;dur:number}
export interface TableInfo{id:string;tag:string;label:string;cap:number;section?:string;server?:string;state:'open'|'held'|'seated'|'lapsed'|'blocked';party?:PartyInfo;held?:HeldInfo;owner:boolean}
/** Everything worth knowing about a table (as its whole link group): state, seated party with arrival/seat/turn times, or the reservation holding it. */
export function tableInfo(d:Data,t:Table,now:number):TableInfo{
  const a=d.assocs.find(x=>members(x).includes(t.id)),ids=a?members(a):[t.id],ts=ids.map(i=>d.tables.find(x=>x.id===i)).filter(Boolean) as Table[];
  const label=ts.map(x=>x.label).join('+'),cap=ts.reduce((s,x)=>s+x.capacity,0),sec=d.sections.find(s=>s.id===t.section_id)?.name,srv=d.waiters.find(w=>w.id===t.assigned_waiter_id)?.name;
  const base={id:t.id,tag:t.label,label,cap,section:sec,server:srv};
  if(ts.some(x=>x.status==='blocked_private'))return{...base,state:'blocked',owner:false};
  const sl=d.slots.find(s=>s.status!=='COMPLETED'&&ids.includes(s.table_id));
  if(sl){const r=d.reservations.find(x=>x.party_id===sl.party_id),q=d.queue.find(x=>x.party_id===sl.party_id);
    const party:PartyInfo={label:sl.party_label,name:r?.name??q?.name??sl.party_label,size:sl.party_size,here:r?hereRes(r):q?hereQ(q):sl.party_size,kind:r?'res':q?'queue':'walkin',
      arrivedAt:r?.arrived_at?Date.parse(r.arrived_at):q?Date.parse(q.queued_at):undefined,seatedAt:Date.parse(sl.seated_at),turnAt:Date.parse(sl.expected_turn_at),resTime:r?Date.parse(r.time):undefined,slotId:sl.id};
    return{...base,state:sl.status==='LAPSED'||ts.some(x=>x.status==='lapsed')?'lapsed':'seated',party,owner:sl.table_id===t.id}}
  if(ts.some(x=>x.status==='occupied'||x.status==='lapsed'))return{...base,state:ts.some(x=>x.status==='lapsed')?'lapsed':'seated',owner:false};
  const r=d.reservations.filter(x=>ids.includes(x.table_id??'')&&(x.status==='BOOKED'||x.status==='ARRIVED')&&Date.parse(x.time)+x.duration_min*MIN>now).sort((x,y)=>Date.parse(x.time)-Date.parse(y.time))[0];
  if(r)return{...base,state:'held',held:{label:`${r.prefix?r.prefix+'-':''}${r.type}-${r.party_id}`,name:r.name,size:r.party_size,here:hereRes(r),at:Date.parse(r.time),dur:r.duration_min},owner:r.table_id===t.id};
  return{...base,state:'open',owner:false};
}
