import {Data,QueueEntry} from './types';
import {MIN,dayKey,dayStartMs,holdsFrom} from './party';
import {buildUnits} from './geometry';
import {planSequence} from './predict';
const TIER:Record<string,number>={P:0,V:1,W:2,R:2};
/** Single source of queue order (priority/VIP first, then oldest). Used by the Queue panel and walk-in quotes. */
export const queueOrder=(q:QueueEntry[])=>q.filter(x=>x.status==='WAITING').sort((a,b)=>TIER[a.type]-TIER[b.type]||Date.parse(a.queued_at)-Date.parse(b.queued_at));
export interface TEvent{at:number;kind:'in'|'out';covers:number;proj:boolean}
/** Covers in/out events: observed (seated_at / ended_at <= now) and projected (turn times of occupied tables, reservation arrivals). Overdue turns/late arrivals project to 'now'. */
export function turnoverEvents(d:Data,now:number):TEvent[]{
  const out:TEvent[]=[];
  for(const s of d.slots){const a=Date.parse(s.seated_at);if(a<=now)out.push({at:a,kind:'in',covers:s.party_size,proj:false});
    if(s.ended_at)out.push({at:Date.parse(s.ended_at),kind:'out',covers:s.party_size,proj:false});
    else if(s.status!=='COMPLETED')out.push({at:Math.max(Date.parse(s.expected_turn_at),now),kind:'out',covers:s.party_size,proj:true})}
  for(const r of d.reservations)if(r.status==='BOOKED'||r.status==='ARRIVED')out.push({at:Math.max(Date.parse(r.time),now),kind:'in',covers:r.party_size,proj:true});
  return out;
}
const sum=(xs:TEvent[])=>xs.reduce((s,x)=>s+x.covers,0);
/** Rows of `iv`-minute buckets aligned to local midnight: `past` before, the current one, `future` after. Tables = number of parties (seating units). */
export function bucketTurnover(ev:TEvent[],iv:number,now:number,past=3,future=5){
  const ivm=iv*MIN,d0=dayStartMs(dayKey(now)),cur=Math.floor((now-d0)/ivm),rows=[];
  for(let k=cur-past;k<=cur+future;k++){const s=d0+k*ivm,e=s+ivm,es=ev.filter(x=>x.at>=s&&x.at<e),i=es.filter(x=>x.kind==='in'),o=es.filter(x=>x.kind==='out');
    rows.push({start:s,end:e,now:k===cur,proj:es.some(x=>x.proj),inC:sum(i),inT:i.length,outC:sum(o),outT:o.length,net:sum(i)-sum(o)})}
  return rows;
}
/** Projected activity in the next `iv` minutes from now (not bucket-aligned). */
export function nextWindow(ev:TEvent[],now:number,iv:number){
  const w=ev.filter(x=>x.proj&&x.at>=now&&x.at<=now+iv*MIN),o=w.filter(x=>x.kind==='out'),i=w.filter(x=>x.kind==='in');
  return{outT:o.length,outC:sum(o),inT:i.length,inC:sum(i)};
}
/** 10-minute quotable window starting on the 5-minute floor of the wait. */
export const rangeOf=(w:number)=>w<=0?{lo:0,hi:0}:{lo:Math.floor(w/5)*5,hi:Math.floor(w/5)*5+10};
/** Wait for a NEW walk-in of `size` behind everyone already queued (all floors, honours reservation/event holds). */
export function walkinQuote(d:Data,now:number,size:number){
  const waiting=queueOrder(d.queue),seq=planSequence(d,[...waiting.map(q=>q.party_size),size],buildUnits(d.tables,d.assocs),now,holdsFrom(d.reservations,now,d.events)).items,it=seq[seq.length-1],r=rangeOf(it.wait);
  return{size,ahead:waiting.length,ready:it.ready,none:it.code==='NO_TABLE',wait:it.wait,lo:r.lo,hi:r.hi,label:it.label,clock:it.clock,tableId:it.tableId};
}
