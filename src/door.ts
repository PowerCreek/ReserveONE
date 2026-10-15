import {Data,QueueEntry,PType} from './types';
import {partyLabel} from './party';
import {hereQ} from './arrivals';
import {seatParty} from './state/seat';
export interface QOpts{id?:string;name?:string;size:number;type?:PType;prefix?:string;here?:number;quoted?:number;notes?:string}
/** THE queue-entry constructor (pure). Fast seating, N-top cards and the door list all go through it. */
export function enqueue(d:Data,o:QOpts,now=Date.now()):{d:Data;entry:QueueEntry;pos:number;label:string}{
  const type=o.type??'W',prefix=o.prefix??d.prefix,here=Math.max(0,Math.min(o.size,o.here??o.size)),pid=d.nextPartyId,label=partyLabel(prefix,type,pid);
  const entry:QueueEntry={id:o.id??'q'+now+Math.random().toString(36).slice(2,5),party_id:pid,prefix,type,name:o.name?.trim()||label,party_size:o.size,queued_at:new Date(now).toISOString(),
    quoted_wait_min:o.quoted??15,notes:o.notes??'',origin_reservation_id:null,arrived_count:here,status:'WAITING'};
  return{d:{...d,nextPartyId:pid+1,queue:[...d.queue,entry]},entry,pos:d.queue.filter(x=>x.status==='WAITING').length+1,label};
}
/** Door walk-in: seat straight away at the best ready table when the whole party is here and nobody is waiting; otherwise queue. The seated party keeps a SEATED queue record (name, label). */
export function seatOrQueue(d:Data,o:QOpts,now=Date.now()):{d:Data;seated:boolean;label:string;msg:string}{
  const q=enqueue(d,o,now),complete=hereQ(q.entry)>=q.entry.party_size,idle=!d.queue.some(x=>x.status==='WAITING');
  if(complete&&idle)for(const f of d.floors){
    const r=seatParty(q.d,{size:q.entry.party_size,prefix:q.entry.prefix,type:q.entry.type,party_id:q.entry.party_id,queueId:q.entry.id},[],f.id,now,'auto');
    if(!('err' in r))return{d:r.d,seated:true,label:q.label,msg:r.msg}}
  return{d:q.d,seated:false,label:q.label,msg:!complete?'waiting for the rest of the party':!idle?'queue is not empty':'no table ready'};
}
/** Door list ⚡: run every walk-in that is at the door through seatOrQueue and drop them from the list. */
export function processDoor(d:Data,now:number):{d:Data;seated:number;queued:number}{
  let cur=d,seated=0,queued=0;
  for(const e of d.sim??[]){if(e.kind!=='walkin'||Date.parse(e.at)>now)continue;
    const r=seatOrQueue(cur,{id:'q_'+e.id,name:e.name,size:e.size,here:e.here},now);cur={...r.d,sim:(cur.sim??[]).filter(x=>x.id!==e.id)};r.seated?seated++:queued++}
  return{d:cur,seated,queued};
}
