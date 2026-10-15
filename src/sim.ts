import {Data,Reservation,SimEntry} from './types';
import {seatParty,markAvailable} from './state/seat';
import {MIN} from './party';
import {buildUnits} from './geometry';
import {tableConflict,bestFit} from './booking';
/** Seeded PRNG (mulberry32) so a role-play scenario can be replayed. */
export const rng=(seed:number)=>{let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
const NAMES=['Garcia','Chen','Okafor','Smith','Kim','Patel','Nguyen','Silva','Cohen','Rossi','Lindqvist','Tanaka','Moreau','Haddad','Walker','Novak','Reyes','Dubois','Ivanov','Sato','Bell','Cruz','Ford','Lopez'];
const W:[number,number][]=[[1,6],[2,40],[3,12],[4,25],[5,6],[6,6],[8,3],[10,2]];
/** Party size from a realistic mix (mostly 2s and 4s) clamped to [min,max]. */
export function pickSize(r:()=>number,min:number,max:number){
  const ws=W.filter(([s])=>s>=min&&s<=max);if(!ws.length)return Math.max(1,Math.round(min+r()*(max-min)));
  let x=r()*ws.reduce((n,[,w])=>n+w,0);for(const [s,w] of ws){x-=w;if(x<=0)return s}return ws[ws.length-1][0];
}
const name=(r:()=>number)=>NAMES[Math.floor(r()*NAMES.length)];
/** Stages walk-in parties on the DOOR LIST (not the queue): arrivals spread over `spread` minutes; `partialPct`% of parties of 2+ arrive in waves (some here now, the rest join the queued party later). */
export function genDoorWalkins(d:Data,now:number,o:{count:number;minSize:number;maxSize:number;spread:number;partialPct:number;seed:number}):Data{
  const r=rng(o.seed),es:SimEntry[]=[];
  for(let i=0;i<o.count;i++){
    const size=pickSize(r,o.minSize,o.maxSize),at=now+Math.floor(r()*(o.spread+1))*MIN,id=`se_${at}_${i}_${Math.floor(r()*1e6)}`,partial=size>=2&&r()*100<o.partialPct,here=partial?Math.ceil(size/2):size,nm=name(r);
    es.push({id,at:new Date(at).toISOString(),kind:'walkin',name:nm,size,here});
    if(here<size)es.push({id:id+'_j',at:new Date(at+(5+Math.floor(r()*11))*MIN).toISOString(),kind:'arrive',name:nm,size:size-here,ref:{type:'queue',id:'q_'+id}});
  }
  return{...d,sim:[...(d.sim??[]),...es].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))};
}
/** Stages arrival events for BOOKED reservations due within `windowMin` (and up to 60m late): full arrival or two waves; `noShowPct`% never come. Idempotent per reservation. */
export function genArrivals(d:Data,now:number,o:{windowMin:number;partialPct:number;noShowPct:number;seed:number}):Data{
  const r=rng(o.seed),es:SimEntry[]=[];
  for(const x of d.reservations){if(x.status!=='BOOKED')continue;const t=Date.parse(x.time);if(t>now+o.windowMin*MIN||t<now-60*MIN)continue;if(r()*100<o.noShowPct)continue;
    const at=Math.max(now,t+Math.floor(r()*15-5)*MIN),n1=x.party_size>=2&&r()*100<o.partialPct?Math.ceil(x.party_size/2):x.party_size,ref={type:'res' as const,id:x.id};
    es.push({id:`se_${x.id}_a`,at:new Date(at).toISOString(),kind:'arrive',name:x.name,size:n1,ref});
    if(n1<x.party_size)es.push({id:`se_${x.id}_b`,at:new Date(at+(5+Math.floor(r()*16))*MIN).toISOString(),kind:'arrive',name:x.name,size:x.party_size-n1,ref});
  }
  const have=new Set((d.sim??[]).map(e=>e.id));
  return{...d,sim:[...(d.sim??[]),...es.filter(e=>!have.has(e.id))].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))};
}
/** What entering the simulation auto-populates: a door list of walk-ins plus arrivals for upcoming reservations. */
export const genStarter=(d:Data,now:number,seed:number)=>genArrivals(genDoorWalkins(d,now,{count:6,minSize:1,maxSize:6,spread:40,partialPct:30,seed}),now,{windowMin:90,partialPct:40,noShowPct:10,seed:seed+1});

/** Adds reservations spread over [now+fromMin, now+toMin] (5-min aligned); optionally assigns the tightest conflict-free table. */
export function genReservations(d:Data,now:number,o:{count:number;minSize:number;maxSize:number;fromMin:number;toMin:number;duration:number;assign:boolean;seed:number}):Data{
  const r=rng(o.seed);let nd=d;
  for(let i=0;i<o.count;i++){
    const size=pickSize(r,o.minSize,o.maxSize),ms=Math.round((now+(o.fromMin+r()*(o.toMin-o.fromMin))*MIN)/(5*MIN))*5*MIN;
    const table=o.assign?bestFit(nd.tables.filter(x=>x.capacity>=size).map(x=>({t:x,c:tableConflict(nd,x.id,ms,o.duration)}))):null;
    const res:Reservation={id:`r_sim${ms}_${i}_${Math.floor(r()*1e6)}`,party_id:nd.nextPartyId,prefix:nd.prefix,type:'R',name:name(r),party_size:size,time:new Date(ms).toISOString(),duration_min:o.duration,phone:'',notes:'sim',table_id:table,status:'BOOKED'};
    nd={...nd,nextPartyId:nd.nextPartyId+1,reservations:[...nd.reservations,res]};
  }
  return nd;
}
/** Seats parties via the real smart allocator until `pct`% of units are occupied; seat times are staggered into the past so turn times differ (a mid-service snapshot). */
export function fillSeated(d:Data,now:number,o:{pct:number;minSize:number;maxSize:number;seed:number}):Data{
  const r=rng(o.seed);let nd=d;
  const occ=()=>{const us=buildUnits(nd.tables,nd.assocs).filter(u=>u.status!=='blocked_private');return us.length?us.filter(u=>u.status==='occupied'||u.status==='lapsed').length/us.length:1};
  for(let tries=0;tries<300&&occ()<o.pct/100;tries++){
    const res=seatParty(nd,{size:pickSize(r,o.minSize,o.maxSize),prefix:nd.prefix,type:'W'},[],nd.floors[tries%nd.floors.length].id,now,'auto');
    if('err' in res)continue;
    const dur=50+Math.floor(r()*40),seated=now-Math.floor(r()*(dur-10))*MIN,k=res.d.slots.length-1;
    nd={...res.d,slots:res.d.slots.map((s,i)=>i===k?{...s,seated_at:new Date(seated).toISOString(),expected_turn_at:new Date(seated+dur*MIN).toISOString()}:s)};
  }
  const last=new Map<string,number>();
  for(const s of nd.slots)if(s.status!=='COMPLETED'){const w=nd.tables.find(t=>t.id===s.table_id)?.assigned_waiter_id;if(w)last.set(w,Math.max(last.get(w)??0,Date.parse(s.seated_at)))}
  return{...nd,waiters:nd.waiters.map(w=>last.has(w.id)?{...w,last_seated_at:new Date(last.get(w.id)!).toISOString()}:w)};
}
/** Staff clearing: parties past turn + grace leave at that moment (ended_at = turn + grace), tables free up. */
export function settleOverdue(d:Data,now:number,grace=5):Data{
  let nd=d;
  for(const s of d.slots){if(s.status==='COMPLETED')continue;const at=Date.parse(s.expected_turn_at)+grace*MIN;if(at<=now)nd=markAvailable(nd,[s.table_id],new Date(at).toISOString())}
  return nd;
}
