import {Data,Reservation,QueueEntry} from './types';
import {members} from './geometry';
import {partyLabel} from './party';
/** Guests actually here. Reservations default by state (BOOKED 0; ARRIVED/SEATED/QUEUED = everyone) unless a count was recorded; walk-ins default to everyone. */
export const hereRes=(r:Reservation)=>Math.max(0,Math.min(r.party_size,r.arrived_count??(r.status==='ARRIVED'||r.status==='SEATED'||r.status==='QUEUED'?r.party_size:0)));
export const hereQ=(q:QueueEntry)=>Math.max(0,Math.min(q.party_size,q.arrived_count??q.party_size));
export interface Expect{kind:'res'|'queue';id:string;name:string;label:string;size:number;here:number;missing:number;where:string;tid?:string;at:number}
/** Parties with some (not all) guests here: who to watch for / who a late guest may belong to. Promoted reservations are listed once (the reservation is canonical). */
export function expectingMore(d:Data):Expect[]{
  const tname=(tid:string)=>{const a=d.assocs.find(x=>members(x).includes(tid));return (a?members(a):[tid]).map(i=>d.tables.find(t=>t.id===i)?.label??i).join('+')};
  const slotFor=(pid:number)=>d.slots.find(s=>s.party_id===pid&&s.status!=='COMPLETED');
  const out:Expect[]=[];
  for(const r of d.reservations){const h=hereRes(r);if(r.status==='BOOKED'||r.status==='NO_SHOW'||h<=0||h>=r.party_size)continue;
    const sl=slotFor(r.party_id);if(r.status==='SEATED'&&!sl)continue;
    out.push({kind:'res',id:r.id,name:r.name,label:partyLabel(r.prefix,r.type,r.party_id),size:r.party_size,here:h,missing:r.party_size-h,at:Date.parse(r.time),tid:sl?.table_id??r.table_id??undefined,
      where:r.status==='SEATED'&&sl?`seated ${tname(sl.table_id)}`:r.status==='QUEUED'?'in queue':r.table_id?`held ${tname(r.table_id)}`:'arrived, waiting'})}
  for(const q of d.queue){if(q.origin_reservation_id)continue;const h=hereQ(q);if(h<=0||h>=q.party_size)continue;
    const sl=q.status==='SEATED'?slotFor(q.party_id):undefined;if(q.status==='SEATED'&&!sl)continue;
    out.push({kind:'queue',id:q.id,name:q.name,label:partyLabel(q.prefix,q.type,q.party_id),size:q.party_size,here:h,missing:q.party_size-h,at:Date.parse(q.queued_at),tid:sl?.table_id,where:sl?`seated ${tname(sl.table_id)}`:'in queue'})}
  return out.sort((a,b)=>a.at-b.at);
}
