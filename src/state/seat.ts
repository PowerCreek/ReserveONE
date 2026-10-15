import {Data,PType} from '../types';
import {buildUnits,expandIds} from '../geometry';
import {rotation,pickServerFor} from '../engines';
import {planSequence} from '../predict';
import {hereRes} from '../arrivals';
import {holdsFrom,partyLabel,MIN} from '../party';
export interface Req{size:number;prefix:string;type:PType;party_id?:number;queueId?:string;resId?:string;duration?:number}
export type SeatRes={d:Data;msg:string;tone:'ok'|'warn'}|{err:string};
export function seatParty(d:Data,req:Req,sel:string[],floorId:string,now:number,mode:'selected'|'auto'):SeatRes{
  let ids:string[];
  if(mode==='selected'){ids=expandIds(sel,d.assocs);if(!ids.length)return{err:'Select a table first'}}
  else{
    const us=buildUnits(d.tables,d.assocs).filter(u=>u.floor_id===floorId);
    const holds=holdsFrom(d.reservations.filter(r=>r.id!==req.resId),now,d.events);
    const it=planSequence(d,[req.size],us,now,holds).items[0];
    if(!it.ready||!it.unitId)return{err:it.code==='NO_TABLE'?`No ${req.size}-top fits on this floor`:`No ${req.size}-top ready now (wait ${Math.round(it.wait)}m)`};
    ids=us.find(u=>u.id===it.unitId)!.tableIds;
  }
  const ts=d.tables.filter(t=>ids.includes(t.id));
  const bl=ts.find(t=>t.status==='blocked_private');if(bl)return{err:`${bl.label} is blocked (private event)`};
  const busy=ts.find(t=>t.status==='occupied'||t.status==='lapsed');if(busy)return{err:busy.status==='lapsed'?`${busy.label} is past its turn: clear it first`:`${busy.label} is occupied by another party`};
  if(ts.reduce((s,t)=>s+t.capacity,0)<req.size)return{err:`Capacity too small for party of ${req.size}`};
  const pid=req.party_id??d.nextPartyId,label=partyLabel(req.prefix,req.type,pid);
  const {w,fallback}=pickServerFor(rotation(d.waiters,d.tables,d.reservations,now),ts);
  const nowIso=new Date(now).toISOString(),dur=req.duration??60;
  return{d:{...d,
    nextPartyId:req.party_id==null?d.nextPartyId+1:d.nextPartyId,
    tables:d.tables.map(t=>ids.includes(t.id)?{...t,status:'occupied',assigned_waiter_id:w?.id??null}:t),
    slots:[...d.slots,{id:'s'+Date.now()+pid,table_id:ids[0],party_id:pid,party_label:label,party_size:req.size,seated_at:nowIso,expected_turn_at:new Date(now+dur*MIN).toISOString(),status:'ACTIVE'}],
    waiters:d.waiters.map(x=>{const b=x.skip_penalty?{...x,skip_penalty:0}:x;return x.id===w?.id?{...b,last_seated_at:nowIso,active_cover_count:x.active_cover_count+req.size,tally_covers:(x.tally_covers??0)+req.size}:b}),
    reservations:req.resId?d.reservations.map(r=>r.id===req.resId?{...r,status:'SEATED',arrived_count:hereRes(r)>0?hereRes(r):r.party_size,arrived_at:r.arrived_at??nowIso}:r):d.reservations,
    queue:req.queueId?d.queue.map(q=>q.id===req.queueId?{...q,status:'SEATED'}:q):d.queue},
    msg:`${label} → ${ts.map(t=>t.label).join('+')} · ${w?.name??'no server'}${fallback?' (fallback server)':''}`,tone:fallback?'warn':'ok'};
}
export function markAvailable(d:Data,sel:string[],endedAt?:string):Data{
  const ids=new Set(expandIds(sel,d.assocs)),dec=new Map<string,number>();
  const slots=d.slots.map(s=>{
    if(!ids.has(s.table_id)||s.status==='COMPLETED')return s;
    const w=d.tables.find(t=>t.id===s.table_id)?.assigned_waiter_id;if(w)dec.set(w,(dec.get(w)??0)+s.party_size);
    return{...s,status:'COMPLETED' as const,ended_at:endedAt??new Date().toISOString()};
  });
  return{...d,slots,tables:d.tables.map(t=>ids.has(t.id)?{...t,status:'available',assigned_waiter_id:null}:t),
    waiters:d.waiters.map(w=>dec.has(w.id)?{...w,active_cover_count:Math.max(0,w.active_cover_count-dec.get(w.id)!)}:w)};
}
