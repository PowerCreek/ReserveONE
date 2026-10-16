import {App} from './store';
import {seatParty,markAvailable,Req} from './seat';
import {selectionState} from '../selection';
import {enqueue} from '../door';
import {unseatToQueue,unqueueToDoor} from '../unseat';
import {expandIds} from '../geometry';
import {Reservation,QueueEntry,Data,Ref,PType} from '../types';
import {dayKey,fmtDay,fmtClock,partyLabel,MIN} from '../party';
import {hereRes,hereQ} from '../arrivals';
import {applyAhead,AheadPlan} from '../ahead';
/** mode 'selected' uses current selection; 'auto' uses reserved table (if any) else evaluator. */
export function seatReq(A:App,req:Req,mode:'selected'|'auto',resTable?:string|null){
  let sel=A.sel,m=mode;if(m==='auto'&&resTable){sel=[resTable];m='selected'}
  const r=seatParty(A.data,req,sel,A.floorId,Date.now(),m);
  if('err' in r)return A.flash(r.err,'warn');
  A.mutate(()=>r.d);A.setActiveQ(null);A.setActiveR(null);if(sel===A.sel)A.setSel([]);const sr=seatRefs(A.data,r.d,r.tone==='warn'),rv=req.resId?r.d.reservations.find(x=>x.id===req.resId):undefined;
  if(rv&&hereRes(rv)<rv.party_size)sr.refs.push({label:'Still to come',value:`${rv.party_size-hereRes(rv)} of ${rv.party_size}`,warn:true});A.receipt(`Seated ${sr.names.join('+')}`,sr.refs);
}
export const seatRes=(A:App,r:Reservation)=>dayKey(Date.parse(r.time))!==dayKey(Date.now())?A.flash(`Booked for ${fmtDay(dayKey(Date.parse(r.time)))}, not today`,'warn'):seatReq(A,resReq(r),seatModeFor(A,resReq(r)),r.table_id);
export const seatQueue=(A:App,q:QueueEntry)=>seatReq(A,queueReq(q),seatModeFor(A,queueReq(q)));
export const promote=(A:App,r:Reservation)=>{A.mutate(d=>({...d,
  reservations:d.reservations.map(x=>x.id===r.id?{...x,status:'QUEUED',arrived_count:hereRes(x)>0?hereRes(x):x.party_size,arrived_at:x.arrived_at??new Date().toISOString()}:x),
  queue:[...d.queue,{id:'q'+Date.now(),party_id:r.party_id,prefix:r.prefix,type:'P',name:r.name,party_size:r.party_size,queued_at:new Date().toISOString(),quoted_wait_min:10,notes:r.notes,origin_reservation_id:r.id,arrived_count:hereRes(r)>0?hereRes(r):r.party_size,status:'WAITING'}]}));
  A.receipt('Moved to priority queue',[{label:'Party',value:`${partyLabel(r.prefix,'P',r.party_id)} · ${r.party_size}`},{label:'Guest',value:r.name},{label:'Booked',value:fmtClock(Date.parse(r.time))},{label:'Late',value:`${Math.max(0,Math.round((Date.now()-Date.parse(r.time))/MIN))}m`,warn:true},...(r.table_id?[{label:'Held table',value:A.data.tables.find(t=>t.id===r.table_id)?.label??'',tid:r.table_id}]:[])])};
/** Any state can be set from any other (human-error recovery). Status only: seating/clearing tables stays a separate action. Leaving QUEUED withdraws its waiting priority entry.
 *  Arrival bookkeeping: ARRIVED = everyone here; BOOKED = nobody; SEATED/QUEUED keep a recorded partial count (else everyone). */
export const setResStatus=(A:App,id:string,status:Reservation['status'])=>{const r=A.data.reservations.find(x=>x.id===id);if(!r||r.status===status)return;
  const withdraw=r.status==='QUEUED'&&A.data.queue.some(q=>q.origin_reservation_id===id&&q.status==='WAITING'),at=new Date().toISOString();
  const arr=(x:Reservation):Partial<Reservation>=>status==='ARRIVED'?{arrived_count:x.party_size,arrived_at:x.arrived_at??at}:status==='BOOKED'?{arrived_count:0,arrived_at:undefined}:status==='NO_SHOW'?{}:{arrived_count:hereRes(x)>0?hereRes(x):x.party_size,arrived_at:x.arrived_at??at};
  A.mutate(d=>({...d,reservations:d.reservations.map(x=>x.id===id?{...x,status,...arr(x)}:x),queue:withdraw?d.queue.filter(q=>!(q.origin_reservation_id===id&&q.status==='WAITING')):d.queue}));
  A.receipt(`Reservation: ${r.status.replace('_','-')} → ${status.replace('_','-')}`,[{label:'Party',value:`${partyLabel(r.prefix,r.type,r.party_id)} · ${r.party_size}`},{label:'Guest',value:r.name},{label:'Booked',value:fmtClock(Date.parse(r.time))},
    ...(r.table_id?[{label:'Table',value:A.data.tables.find(t=>t.id===r.table_id)?.label??'',tid:r.table_id}]:[]),
    ...(withdraw?[{label:'Queue',value:'priority entry withdrawn'}]:[]),
    ...(status==='SEATED'||r.status==='SEATED'?[{label:'Note',value:'status only — table/server unchanged',warn:true}]:[])])};
export function assignRes(A:App,r:Reservation){
  if(!A.sel.length)return A.mutate(d=>({...d,reservations:d.reservations.map(x=>x.id===r.id?{...x,table_id:null}:x)}));
  const t=A.data.tables.find(x=>x.id===A.sel[0])!;
  if(t.capacity<r.party_size)return A.flash(`${t.label} seats ${t.capacity} < party of ${r.party_size}`,'warn');
  A.mutate(d=>({...d,reservations:d.reservations.map(x=>x.id===r.id?{...x,table_id:t.id}:x)}));A.receipt('Table assigned',[{label:'Guest',value:r.name},{label:'Party',value:`${r.party_size}-top`},{label:'Table',value:`${t.label} (${t.capacity}-top)`,tid:t.id},{label:'Booked',value:fmtClock(Date.parse(r.time))}]);
}

export const resReq=(r:Reservation):Req=>({size:r.party_size,prefix:r.prefix,type:r.type,party_id:r.party_id,resId:r.id,duration:r.duration_min});
export const queueReq=(q:QueueEntry):Req=>({size:q.party_size,prefix:q.prefix,type:q.type,party_id:q.party_id,queueId:q.id,resId:q.origin_reservation_id??undefined});
/** Human-readable references for a completed/previewed seating, derived from before/after state. */
export function seatRefs(before:Data,after:Data,fallback=false){
  const slot=after.slots[after.slots.length-1],ts=after.tables.filter(t=>t.status==='occupied'&&before.tables.find(x=>x.id===t.id)?.status!=='occupied');
  const w=after.waiters.find(x=>x.id===ts[0]?.assigned_waiter_id),sec=after.sections.find(x=>x.id===ts[0]?.section_id),names=ts.map(t=>t.label);
  const refs:Ref[]=[{label:'Party',value:`${slot.party_label} · ${slot.party_size}`},...ts.map(t=>({label:'Table',value:`${t.label} (${t.capacity}-top)`,tid:t.id})),
    {label:'Server',value:w?(fallback?`${w.name} (fallback)`:w.name):'none',warn:fallback||!w},...(sec?[{label:'Section',value:sec.name}]:[]),
    {label:'Turn',value:`${fmtClock(Date.parse(slot.expected_turn_at))} (${Math.round((Date.parse(slot.expected_turn_at)-Date.parse(slot.seated_at))/MIN)}m)`}];
  return{refs,ids:ts.map(t=>t.id),names};
}
export type Preview={ok:true;refs:Ref[];ids:string[];label:string}|{ok:false;err:string};
/** Dry-run of seatReq: same pure seatParty, nothing is applied. */
export function previewSeat(A:App,req:Req,mode:'selected'|'auto',resTable?:string|null):Preview{
  let sel=A.sel,m=mode;if(m==='auto'&&resTable){sel=[resTable];m='selected'}
  const r=seatParty(A.data,req,sel,A.floorId,Date.now(),m);if('err' in r)return{ok:false,err:r.err};
  const s=seatRefs(A.data,r.d,r.tone==='warn');return{ok:true,refs:s.refs,ids:s.ids,label:s.names.join('+')};
}

const arrRec=(A:App,name:string,label:string,m:number,size:number,where:string,state?:string)=>A.receipt('Arrivals',[{label:'Guest',value:name},{label:'Party',value:`${label} · ${size}`},{label:'Here',value:`${m}/${size}`,warn:m<size},
  ...(m<size?[{label:'Still to come',value:String(size-m),warn:true}]:[]),...(state?[{label:'State',value:state}]:[]),{label:'Where',value:where}]);
/** Set how many guests of a reservation / queued party are here. Reservations auto-sync state (first guest → ARRIVED, back to 0 → BOOKED, a no-show who turns up → ARRIVED); a promoted queue entry delegates to its reservation. */
export function setArrived(A:App,t:{kind:'res'|'queue';id:string},n:number){
  const d=A.data;
  if(t.kind==='queue'){const q=d.queue.find(x=>x.id===t.id);if(!q)return;if(q.origin_reservation_id)return setArrived(A,{kind:'res',id:q.origin_reservation_id},n);
    const m=Math.max(0,Math.min(q.party_size,Math.round(n)));if(m===hereQ(q))return;
    A.mutate(x=>({...x,queue:x.queue.map(y=>y.id===q.id?{...y,arrived_count:m}:y)}));return arrRec(A,q.name,partyLabel(q.prefix,q.type,q.party_id),m,q.party_size,q.status==='SEATED'?'seated':'in queue')}
  const r=d.reservations.find(x=>x.id===t.id);if(!r)return;const m=Math.max(0,Math.min(r.party_size,Math.round(n)));if(m===hereRes(r))return;
  const status=m>0&&(r.status==='BOOKED'||r.status==='NO_SHOW')?'ARRIVED':m===0&&r.status==='ARRIVED'?'BOOKED':r.status,at=new Date().toISOString();
  A.mutate(x=>({...x,reservations:x.reservations.map(y=>y.id===r.id?{...y,status,arrived_count:m,arrived_at:m>0?(y.arrived_at??at):status==='BOOKED'?undefined:y.arrived_at}:y),queue:x.queue.map(y=>y.origin_reservation_id===r.id?{...y,arrived_count:m}:y)}));
  arrRec(A,r.name,partyLabel(r.prefix,r.type,r.party_id),m,r.party_size,`${status.toLowerCase().replace('_','-')}${r.table_id?' · table held':''}`,status!==r.status?status.toLowerCase():undefined);
}
export const addArrived=(A:App,t:{kind:'res'|'queue';id:string},delta:number)=>{const d=A.data;let cur=0;
  if(t.kind==='res'){const r=d.reservations.find(x=>x.id===t.id);cur=r?hereRes(r):0}
  else{const q=d.queue.find(x=>x.id===t.id),r=q?.origin_reservation_id?d.reservations.find(x=>x.id===q.origin_reservation_id):undefined;cur=r?hereRes(r):q?hereQ(q):0}
  setArrived(A,t,cur+delta)};
/** THE way to add a party to the queue (Fast seating, N-top cards, simulation door list). `here` < size = a partial walk-in party (rest still coming). */
export function addToQueue(A:App,o:{name?:string;size:number;type?:PType;prefix?:string;here?:number;quoted?:number;notes?:string;id?:string;party_id?:number;refs?:Ref[];quiet?:boolean}){
  const r=enqueue(A.data,o),here=r.entry.arrived_count??o.size;
  A.mutate(d=>enqueue(d,{...o,id:r.entry.id}).d);
  if(!o.quiet)A.receipt('Added to queue',[{label:'Party',value:`${r.label} · ${o.size}`},{label:'Guest',value:r.entry.name},{label:'Position',value:'#'+r.pos},...(here<o.size?[{label:'Here',value:`${here}/${o.size}`,warn:true}]:[]),...(o.refs??[])]);
}
/** The selected table(s) are used only when they are FREE and big enough; anything else (occupied, past turn, blocked, too small, nothing selected) falls back to the smart allocator, and the preview names the result. */
export const seatModeFor=(A:App,req:Req):'selected'|'auto'=>A.sel.length&&selectionState(A.data,A.sel,req.size,req.party_id).kind==='free'?'selected':'auto';
/** Mark table(s) cleared (party left): closes the slot, frees the server's covers. The ONE clearing action (Inspector, table card, bus list). */
export function clearTables(A:App,sel:string[]){
  const d=A.data,ids=expandIds(sel,d.assocs),sl=d.slots.filter(x=>ids.includes(x.table_id)&&x.status!=='COMPLETED'),cov=new Map<string,number>();
  sl.forEach(x=>{const w=d.tables.find(t=>t.id===x.table_id)?.assigned_waiter_id;if(w)cov.set(w,(cov.get(w)??0)+x.party_size)});
  A.mutate(x=>markAvailable(x,sel));
  A.receipt('Table cleared',[...ids.map(id=>({label:'Table',value:d.tables.find(t=>t.id===id)?.label??id,tid:id})),...sl.map(x=>({label:'Closed',value:`${x.party_label} · ${x.party_size}`})),
    ...[...cov].map(([w,n])=>({label:'Server',value:`${d.waiters.find(x=>x.id===w)?.name??'?'} −${n} covers`}))]);
}
/** Selected table is past its turn: clear it and seat the party there in one undoable step. */
export function clearAndSeat(A:App,req:Req){
  const d1=markAvailable(A.data,A.sel,new Date().toISOString()),r=seatParty(d1,req,A.sel,A.floorId,Date.now(),'selected');if('err' in r)return A.flash(r.err,'warn');
  A.mutate(()=>r.d);A.setActiveQ(null);A.setActiveR(null);A.setSel([]);const sr=seatRefs(d1,r.d,r.tone==='warn');A.receipt(`Cleared & seated ${sr.names.join('+')}`,sr.refs);
}
/** Take a seated party back off its table and into the queue (reservations return as a priority entry). */
export function unseat(A:App,slotId:string){
  const s=A.data.slots.find(x=>x.id===slotId);if(!s)return;const ids=expandIds([s.table_id],A.data.assocs),now=Date.now();
  if(!unseatToQueue(A.data,slotId,now))return A.flash('Nothing to unseat','warn');
  A.mutate(d=>unseatToQueue(d,slotId,now)?.d??d);
  A.receipt('Unseated → queue',[{label:'Party',value:`${s.party_label} · ${s.party_size}`},...ids.map(id=>({label:'Freed',value:A.data.tables.find(t=>t.id===id)?.label??id,tid:id})),{label:'Queue',value:'back in line, covers returned to the server'}]);
}
/** Simulation: a queued party goes back to the door list. */
export function unqueue(A:App,qid:string){
  const q=A.data.queue.find(x=>x.id===qid);if(!q)return;
  A.mutate(d=>unqueueToDoor(d,qid,Date.now())??d);A.receipt('Back to the door',[{label:'Party',value:`${partyLabel(q.prefix,q.type,q.party_id)} · ${q.party_size}`},{label:'Guest',value:q.name}]);
}
/** Hold a table ahead (hours/days): new held reservation, or table/time for an existing one. */
export function markAhead(A:App,plan:Extract<AheadPlan,{ok:true}>,o:{size:number;name?:string;whenMs:number;dur:number;resId?:string}){
  A.mutate(d=>applyAhead(d,plan,o));
  const r=o.resId?A.data.reservations.find(x=>x.id===o.resId):undefined,day=dayKey(o.whenMs)===dayKey(Date.now())?'':fmtDay(dayKey(o.whenMs))+' ';
  A.receipt('Table marked ahead',[{label:'Guest',value:r?.name??(o.name?.trim()||'new reservation')},{label:'Party',value:`${o.size}-top`},{label:'When',value:`${day}${fmtClock(o.whenMs)}–${fmtClock(o.whenMs+o.dur*MIN)}`},{label:'Table',value:`${plan.label} (${plan.cap}-top)`,tid:plan.primary}]);
}
