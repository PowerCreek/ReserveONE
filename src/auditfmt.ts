import {Data} from './types';
import {fmtClock} from './party';
const LABEL:Record<string,string>={assigned_waiter_id:'server',section_id:'section',table_id:'table',floor_id:'floor',party_size:'party',expected_turn_at:'turn',seated_at:'seated',ended_at:'cleared',last_seated_at:'last seated',
  active_cover_count:'open covers',tally_covers:'tally',skip_penalty:'skip',quoted_wait_min:'quoted wait',duration_min:'duration',primary_table_id:'primary table',min_occupancy:'min occ',min_turns:'min turns',
  is_active:'active',origin_reservation_id:'from reservation',queued_at:'queued',party_id:'party #',locked_ids:'locked tables',table_ids:'tables',associated_table_ids:'linked tables',section_ids:'sections'};
export const fieldLabel=(f:string)=>LABEL[f]??f.replace(/_/g,' ');
/** Human-readable audit value: ids → names, null → 'none', ISO times → clock, id arrays → names. */
export function humanValue(f:string,v:string,d:Data):string{
  if(v==='null'||v==='undefined'||v==='—'||v==='')return 'none';
  const nm=(a:{id:string}[],k:string,id:string)=>(a.find(x=>x.id===id) as any)?.[k]??id;
  if(f==='assigned_waiter_id')return nm(d.waiters,'name',v);
  if(f==='section_id')return nm(d.sections,'name',v);
  if(f==='table_id'||f==='primary_table_id')return nm(d.tables,'label',v);
  if(f==='floor_id')return nm(d.floors,'name',v);
  if(f==='origin_reservation_id')return nm(d.reservations,'name',v);
  if(v.startsWith('[')){try{const a=JSON.parse(v);if(Array.isArray(a))return a.map((x:string)=>f==='section_ids'?nm(d.sections,'name',x):nm(d.tables,'label',x)).join(', ')||'none'}catch{}}
  if(/_at$|^time$|^start$|^end$/.test(f)&&/^\d{4}-\d\d-\d\dT/.test(v)){const ms=Date.parse(v);if(!isNaN(ms))return fmtClock(ms)}
  return v==='true'?'yes':v==='false'?'no':v;
}
