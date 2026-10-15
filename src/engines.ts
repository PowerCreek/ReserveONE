import {Slot,Unit,Waiter,Table,Reservation,QueueEntry,Heat} from './types';
import {MIN,fmtClock} from './party';
export const LAPSED_CLEAR=5,RESET=5,QUANTUM=5,CADENCE=3;
export interface Hold{table_id:string;start:number;end:number}
/** Optional rotation hook: pos(unit)=rank of the server who'd get it (lower = preferred); commit() is told each pick so the caller can simulate tallies. */
export interface Pref{pos:(u:Unit)=>number;commit:(k:number,u:Unit,size:number,wait:number)=>void}
export interface SeqItem{size:number;unitId:string|null;tableId:string|null;label:string;wait:number;clock:string;code:Heat;ready:boolean}
export function avgTurn(slots:Slot[]){
  const a=slots.filter(s=>s.status==='ACTIVE');if(!a.length)return 60;
  const m=a.reduce((x,s)=>x+(Date.parse(s.expected_turn_at)-Date.parse(s.seated_at))/MIN,0)/a.length;
  return Math.min(90,Math.max(45,m));
}
export function evaluateSequence(units:Unit[],slots:Slot[],sizes:number[],now:number,holds:Hold[],pref?:Pref):SeqItem[]{
  const turn=avgTurn(slots),need=(turn+RESET)*MIN,R=RESET*MIN;
  const turnAt=new Map<string,number>();
  for(const s of slots)if(s.status!=='COMPLETED')turnAt.set(s.table_id,Math.max(turnAt.get(s.table_id)??0,Date.parse(s.expected_turn_at)));
  const pool=units.filter(u=>u.status!=='blocked_private'),avail=new Map<string,number>();
  for(const u of pool){
    let a=now;
    if(u.status==='lapsed')a=now+5*MIN;
    else if(u.status==='occupied'){const t=Math.max(0,...u.tableIds.map(i=>turnAt.get(i)??0));a=t?Math.max(t+5*MIN,now+QUANTUM*MIN):now+(turn/2)*MIN}
    avail.set(u.id,a);
  }
  const adj=(u:Unit,at:number)=>{
    const hs=holds.filter(h=>u.tableIds.includes(h.table_id));
    for(let i=0;i<=hs.length;i++){let mv=false;for(const h of hs)if(at+need>h.start&&at<h.end+R){at=h.end+R;mv=true}if(!mv)break}
    return Math.max(at,now);
  };
  const tight=(xs:{u:Unit;at:number}[],byPos:boolean)=>xs.reduce((b,x)=>{if(x.u.capacity!==b.u.capacity)return x.u.capacity<b.u.capacity?x:b;
    if(byPos&&pref){const px=pref.pos(x.u),pb=pref.pos(b.u);if(px!==pb)return px<pb?x:b}return x.at<b.at?x:b});
  const out:SeqItem[]=[];let last=-Infinity;
  for(let k=0;k<sizes.length;k++){const size=sizes[k];
    const c=pool.filter(u=>u.capacity>=size).map(u=>({u,at:adj(u,avail.get(u.id)!)}));
    if(!c.length){out.push({size,unitId:null,tableId:null,label:'—',wait:0,clock:'—',code:'NO_TABLE',ready:false});continue}
    const free=c.filter(x=>x.at<=now),minAt=Math.min(...c.map(x=>x.at));
    const pick=free.length?tight(free,true):tight(c.filter(x=>x.at<=minAt+5*MIN),false);
    const rel=pick.at-now;let seat=rel<=0?now:now+Math.ceil(rel/(QUANTUM*MIN))*QUANTUM*MIN;
    if(seat>now)seat=Math.max(seat,last+CADENCE*MIN);
    last=seat;avail.set(pick.u.id,seat+need);pref?.commit(k,pick.u,size,(seat-now)/MIN);
    const wait=(seat-now)/MIN;
    out.push({size,unitId:pick.u.id,tableId:pick.u.tableIds[0],label:pick.u.label,wait,clock:fmtClock(seat),code:wait<=0?'HOT_GREEN':'CAUTION_WAIT',ready:wait<=0});
  }
  return out;
}
export interface Look{depth:number;code:Heat;msg:string;time:string}
export function lookahead(units:Unit[],slots:Slot[],sizes:number[],now:number,holds:Hold[],ns:number[]=[1,2,3,4,5,6]):Record<number,Look>{
  const r:Record<number,Look>={};
  for(const n of ns){
    const probes=evaluateSequence(units,slots,[...sizes,...Array(40).fill(n)],now,holds).slice(sizes.length);
    let d=0;while(d<probes.length&&probes[d].ready)d++;
    const code:Heat=probes[0].code==='NO_TABLE'?'NO_TABLE':d===0?'CAUTION_WAIT':d<3?'WARM_AMBER':'HOT_GREEN';
    const msg=code==='NO_TABLE'?'No table fits':d===0?'EXHAUSTED NOW':d<3?'Tight Runway':'Clear';
    r[n]={depth:d,code,msg,time:probes[d]?probes[d].clock:'—'};
  }
  return r;
}
/** Fair round robin by COVERS: lowest cumulative covers served (tally) goes next; a party of N counts as N. Ties = longest since last seated.
 *  Incoming reservations are deliberately ignored. There is NO cap on tables/covers per server; 'skip next' only demotes (still eligible as fallback). */
export function score(w:Waiter,now:number){
  if(!w.is_active)return -99999;
  const idle=w.last_seated_at?Math.min(600,(now-Date.parse(w.last_seated_at))/MIN):600;
  return -(w.tally_covers??0)+idle/1000-(w.skip_penalty??0);
}
export function rotation(ws:Waiter[],_t:Table[],_r:Reservation[],now:number){return ws.map(w=>({w,s:score(w,now)})).sort((a,b)=>b.s-a.s)}
export function pickServerFor(rank:{w:Waiter;s:number}[],tables:Table[]):{w:Waiter|null;fallback:boolean}{
  const secs=new Set(tables.map(t=>t.section_id).filter(Boolean) as string[]);
  const act=rank.filter(r=>r.s>-9000);
  const hit=act.find(r=>r.w.section_ids.some(s=>secs.has(s)));
  return hit?{w:hit.w,fallback:false}:{w:act[0]?.w??null,fallback:true};
}
/** Spec §6 formula demand*10 + 22.5 + 8, EXTENDED with the tally rotation: + 5 x (servers - rank position) for the server who would get the next party at that table,
 *  so tables whose server is next up are cleared first. Ties: longest dirty. */
export const busPriority=(tables:Table[],queue:QueueEntry[],slots:Slot[],now:number,rank:{w:Waiter;s:number}[]=[])=>
  tables.filter(t=>t.status==='lapsed').map(t=>{
    const s=slots.filter(x=>x.table_id===t.id&&x.status==='LAPSED').sort((a,b)=>Date.parse(a.expected_turn_at)-Date.parse(b.expected_turn_at))[0];
    const {w}=pickServerFor(rank,[t]),pos=w?rank.findIndex(r=>r.w.id===w.id):-1;
    return{t,w,pos,waited:s?Math.max(0,(now-Date.parse(s.expected_turn_at))/MIN):0,
      p:queue.filter(q=>q.status==='WAITING'&&q.party_size<=t.capacity).length*10+22.5+8+(pos>=0?(rank.length-pos)*5:0)};
  }).sort((a,b)=>b.p-a.p||b.waited-a.waited);
