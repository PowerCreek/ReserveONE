import {Data} from './types';
import {buildUnits,expandIds} from './geometry';
import {tableConflict} from './booking';
import {partyLabel} from './party';
export type AheadPlan={ok:true;tableIds:string[];primary:string;label:string;cap:number}|{ok:false;err:string};
/** Choose (sel=null: tightest conflict-free unit, any floor) or validate (sel given) the table(s) to hold for a party at a future time. Conflicts = reservations, private events, seated parties. */
export function planAhead(d:Data,o:{size:number;whenMs:number;dur:number;sel:string[]|null;exceptRes?:string}):AheadPlan{
  const clash=(ids:string[])=>{for(const id of ids){const c=tableConflict(d,id,o.whenMs,o.dur,o.exceptRes);if(c)return c}return null};
  if(o.sel&&o.sel.length){const ids=expandIds(o.sel,d.assocs),ts=d.tables.filter(t=>ids.includes(t.id)),cap=ts.reduce((n,t)=>n+t.capacity,0),label=ts.map(t=>t.label).join('+');
    if(cap<o.size)return{ok:false,err:`${label} seats ${cap}, party is ${o.size}`};
    const c=clash(ids);return c?{ok:false,err:`${label} conflicts: ${c}`}:{ok:true,tableIds:ids,primary:ids[0],label,cap}}
  const evLocked=new Set(d.events.flatMap(e=>e.locked_ids));
  const best=buildUnits(d.tables,d.assocs).filter(u=>u.capacity>=o.size&&(u.status!=='blocked_private'||u.tableIds.some(i=>evLocked.has(i)))&&!clash(u.tableIds))
    .sort((a,b)=>a.capacity-b.capacity||a.label.localeCompare(b.label))[0];
  return best?{ok:true,tableIds:best.tableIds,primary:best.tableIds[0],label:best.label,cap:best.capacity}:{ok:false,err:'no table is free for that window'};
}
/** Applies a plan: updates the given reservation (table/time/length) or creates a held reservation for a new party. */
export function applyAhead(d:Data,plan:Extract<AheadPlan,{ok:true}>,o:{size:number;name?:string;whenMs:number;dur:number;resId?:string}):Data{
  const time=new Date(o.whenMs).toISOString();
  if(o.resId)return{...d,reservations:d.reservations.map(r=>r.id===o.resId?{...r,table_id:plan.primary,time,duration_min:o.dur}:r)};
  const id=d.nextPartyId;
  return{...d,nextPartyId:id+1,reservations:[...d.reservations,{id:`r${o.whenMs}_${id}`,party_id:id,prefix:d.prefix,type:'R',name:o.name?.trim()||partyLabel(d.prefix,'R',id),party_size:o.size,time,duration_min:o.dur,phone:'',notes:'marked ahead',table_id:plan.primary,status:'BOOKED',arrived_count:0}]};
}
