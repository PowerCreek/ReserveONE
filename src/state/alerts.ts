import {useEffect,useRef} from 'react';
import {Data,PrivateEvent,TStatus} from '../types';
import {expandIds} from '../geometry';
import {sectionStats} from '../sections';
import {chime} from '../audio';
import {MIN,isLate,PREP_MIN} from '../party';
import {LAPSED_CLEAR} from '../engines';
export const PREP=PREP_MIN,WARN=15;
export type EvState='RESERVED_PENDING'|'BLOCKED_PREP'|'ACTIVE_EVENT'|'EXPIRING_WARNING'|'EXPIRED_RECLAIMED';
export function eventState(e:PrivateEvent,now:number):EvState{
  const s=Date.parse(e.start),x=Date.parse(e.end);
  return now<s-PREP*MIN?'RESERVED_PENDING':now<s?'BLOCKED_PREP':now<x-WARN*MIN?'ACTIVE_EVENT':now<x?'EXPIRING_WARNING':'EXPIRED_RECLAIMED';
}
export const locking=(s:EvState)=>s==='BLOCKED_PREP'||s==='ACTIVE_EVENT'||s==='EXPIRING_WARNING';
/** Idempotent: auto-lapse overdue slots; lock/unlock private-event tables. Returns same ref if nothing changed. */
export function reconcile(d:Data,now:number):Data{
  let tables=d.tables,slots=d.slots,changed=false;
  const lapse=slots.filter(s=>s.status==='ACTIVE'&&Date.parse(s.expected_turn_at)<now);
  if(lapse.length){const L=new Set(lapse.map(s=>s.id)),ids=new Set(lapse.flatMap(s=>expandIds([s.table_id],d.assocs)));
    slots=slots.map(s=>L.has(s.id)?{...s,status:'LAPSED' as const}:s);tables=tables.map(t=>ids.has(t.id)&&t.status==='occupied'?{...t,status:'lapsed' as const}:t);changed=true}
  const setSt=(ids:Set<string>,st:TStatus)=>{tables=tables.map(t=>ids.has(t.id)?{...t,status:st}:t);changed=true};
  const events=d.events.map(ev=>{
    const st=eventState(ev,now);
    if(locking(st)){
      const add=ev.table_ids.filter(id=>{const t=tables.find(x=>x.id===id);return t&&(t.status==='available'||t.status==='lapsed')});
      if(!add.length)return ev;setSt(new Set(add),'blocked_private');return{...ev,locked_ids:[...new Set([...ev.locked_ids,...add])]};
    }
    if(st==='EXPIRED_RECLAIMED'&&!ev.reclaimed){
      const ok=new Set(ev.locked_ids.filter(id=>tables.find(t=>t.id===id)?.status==='blocked_private'&&!d.events.some(o=>o.id!==ev.id&&!o.reclaimed&&locking(eventState(o,now))&&o.table_ids.includes(id))));
      if(ok.size)setSt(ok,'available');return{...ev,locked_ids:[],reclaimed:true};
    }
    return ev;
  });
  const evChanged=events.some((e,i)=>e!==d.events[i]);
  return changed||evChanged?{...d,tables,slots,events}:d;
}
/** Reconciles on each tick/data change; edge-triggers one flash (+chime if enabled) for newly-true alert conditions. */
export function useAlerts(d:Data,now:number,flash:(m:string,t?:'ok'|'warn'|'info')=>void,sound:boolean,mutate:(fn:(d:Data)=>Data,push?:boolean,actor?:'host'|'system')=>void){
  const prev=useRef<{ev:Record<string,EvState>;zu:Set<string>;late:Set<string>;clr:Set<string>}|null>(null);
  useEffect(()=>{
    const n=reconcile(d,now);if(n!==d){mutate(()=>n,false,'system');return}
    const cur={ev:{} as Record<string,EvState>,zu:new Set<string>(),late:new Set<string>(),clr:new Set<string>()};
    d.events.forEach(e=>{cur.ev[e.id]=eventState(e,now)});
    d.sections.forEach(s=>{if(sectionStats(s,d,now).under)cur.zu.add(s.id)});
    d.reservations.forEach(r=>{if(isLate(r,now))cur.late.add(r.id)});
    d.slots.forEach(s=>{if(s.status==='LAPSED'&&now-Date.parse(s.expected_turn_at)>=LAPSED_CLEAR*MIN)cur.clr.add(s.id)});
    const p=prev.current;prev.current=cur;if(!p)return;// first pass = baseline only
    const m:string[]=[];
    d.events.forEach(e=>{const a=p.ev[e.id],b=cur.ev[e.id];if(a&&a!==b){if(b==='BLOCKED_PREP')m.push(`${e.name}: prep lock`);if(b==='EXPIRING_WARNING')m.push(`${e.name} ends in ≤${WARN}m`);if(b==='EXPIRED_RECLAIMED')m.push(`${e.name} ended — tables reclaimed`)}});
    d.sections.forEach(s=>{if(cur.zu.has(s.id)&&!p.zu.has(s.id))m.push(`Section ${s.name}: underflow`)});
    d.reservations.forEach(r=>{if(cur.late.has(r.id)&&!p.late.has(r.id))m.push(`${r.name} is late`)});
    d.slots.forEach(s=>{if(cur.clr.has(s.id)&&!p.clr.has(s.id))m.push(`${d.tables.find(t=>t.id===s.table_id)?.label??'Table'} lapsed ${LAPSED_CLEAR}m — clear it`)});
    if(m.length){flash(m.join(' · '),'warn');if(sound)chime()}
  },[d,now]);// eslint-disable-line
}
