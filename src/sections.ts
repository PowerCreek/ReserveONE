import {Data,Section} from './types';
import {MIN} from './party';
/** Sections are server-earmarked table groups. Underflow = low occupancy AND too few turns due in the next 30m (dynamic need: min_turns, else 25% of tables, >=1). */
export function sectionStats(s:Section,d:Data,now:number){
  const ts=d.tables.filter(t=>t.section_id===s.id&&t.status!=='blocked_private'),ids=new Set(ts.map(t=>t.id));
  const occ=ts.length?ts.filter(t=>t.status!=='available').length/ts.length:0;
  const turns=d.slots.filter(x=>x.status!=='COMPLETED'&&ids.has(x.table_id)&&Date.parse(x.expected_turn_at)<=now+30*MIN).length;
  const need=(s.min_turns??0)>0?s.min_turns!:Math.max(1,Math.round(ts.length*.25));
  return{n:ts.length,occ,turns,need,under:ts.length>0&&occ<(s.min_occupancy??.2)&&turns<need,ids:[...ids]};
}
