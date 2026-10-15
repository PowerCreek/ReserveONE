import {Data,QueueEntry,SimEntry} from './types';
import {expandIds} from './geometry';
import {hereRes,hereQ} from './arrivals';
/** Undo a seating: tables freed, server covers + tally returned, the slot is removed (it never happened) and the party goes back to the queue (reservations become a QUEUED priority entry). */
export function unseatToQueue(d:Data,slotId:string,now:number):{d:Data;label:string;size:number}|null{
  const s=d.slots.find(x=>x.id===slotId&&x.status!=='COMPLETED');if(!s)return null;
  const ids=new Set(expandIds([s.table_id],d.assocs)),w=d.tables.find(t=>t.id===s.table_id)?.assigned_waiter_id,at=new Date(now).toISOString();
  const res=d.reservations.find(r=>r.party_id===s.party_id),seatedQ=d.queue.find(q=>q.party_id===s.party_id&&q.status==='SEATED');
  let queue=d.queue;
  if(seatedQ)queue=queue.map(q=>q===seatedQ?{...q,status:'WAITING' as const}:q);
  else queue=[...queue,{id:'q'+now+'u',party_id:s.party_id,prefix:res?.prefix??d.prefix,type:res?'P':(['W','P','R','V'].includes(s.party_label.split('-').slice(-2)[0])?s.party_label.split('-').slice(-2)[0]:'W'),name:res?.name??s.party_label,party_size:s.party_size,queued_at:at,quoted_wait_min:10,notes:res?.notes??'',origin_reservation_id:res?.id??null,
    arrived_count:res?hereRes(res):s.party_size,status:'WAITING'} as QueueEntry];
  return{label:s.party_label,size:s.party_size,d:{...d,slots:d.slots.filter(x=>x.id!==s.id),queue,
    tables:d.tables.map(t=>ids.has(t.id)?{...t,status:'available',assigned_waiter_id:null}:t),
    waiters:d.waiters.map(x=>x.id===w?{...x,active_cover_count:Math.max(0,x.active_cover_count-s.party_size),tally_covers:Math.max(0,(x.tally_covers??0)-s.party_size)}:x),
    reservations:res?d.reservations.map(r=>r===res?{...r,status:'QUEUED'}:r):d.reservations}};
}
/** Simulation: send a queued party back to the door (reservation guests become "not arrived", walk-ins a fresh door entry). */
export function unqueueToDoor(d:Data,qid:string,now:number):Data|null{
  const q=d.queue.find(x=>x.id===qid&&x.status==='WAITING');if(!q)return null;
  const res=q.origin_reservation_id?d.reservations.find(r=>r.id===q.origin_reservation_id):undefined,at=new Date(now).toISOString();
  const e:SimEntry=res?{id:`se_back_${q.id}`,at,kind:'arrive',name:res.name,size:res.party_size,ref:{type:'res',id:res.id}}:{id:`se_back_${q.id}`,at,kind:'walkin',name:q.name,size:q.party_size,here:hereQ(q)};
  return{...d,queue:d.queue.filter(x=>x.id!==q.id),sim:[...(d.sim??[]),e],
    reservations:res?d.reservations.map(r=>r===res?{...r,status:'BOOKED',arrived_count:0,arrived_at:undefined}:r):d.reservations};
}
