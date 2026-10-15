import {Data,Unit,Waiter} from './types';
import {rotation,pickServerFor,evaluateSequence,SeqItem,Hold} from './engines';
import {MIN} from './party';
export interface Pred{server:Waiter|null;fallback:boolean;from:number;to:number}
/** Plans an N-top sequence WITH the tally rotation. Tightest fit still wins; among equally-tight tables the one whose server is next up in the rotation is picked
 *  (unsectioned/fallback tables last), so 1:1 section stations share parties fairly. Each pick then adds the party's covers to that server's simulated tally
 *  (skip-next cleared), so later parties see earlier ones. Mirrors seatParty; waits are unaffected by the tie-break. */
export function planSequence(d:Data,sizes:number[],units:Unit[],now:number,holds:Hold[]){
  let ws=d.waiters.map(w=>({...w}));const base=new Map(ws.map(w=>[w.id,w.tally_covers??0])),got=new Map<number,Pred>();
  let rank=rotation(ws,d.tables,d.reservations,now);
  const tablesOf=(u:Unit)=>d.tables.filter(x=>u.tableIds.includes(x.id));
  const items:SeqItem[]=evaluateSequence(units,d.slots,sizes,now,holds,{
    pos:u=>{const {w,fallback}=pickServerFor(rank,tablesOf(u));return !w||fallback?100:rank.findIndex(r=>r.w.id===w.id)},
    commit:(k,u,size,wait)=>{const t=now+Math.max(0,wait)*MIN,{w,fallback}=pickServerFor(rotation(ws,d.tables,d.reservations,t),tablesOf(u));
      if(!w){got.set(k,{server:null,fallback,from:0,to:0});return}
      const from=w.tally_covers??0;
      ws=ws.map(x=>({...x,skip_penalty:0,...(x.id===w.id?{tally_covers:from+size,last_seated_at:new Date(t).toISOString(),active_cover_count:x.active_cover_count+size}:{})}));
      rank=rotation(ws,d.tables,d.reservations,now);got.set(k,{server:w,fallback,from,to:from+size})}});
  const last=items.reduce((m,i)=>Math.max(m,i.wait),0);
  return{items,preds:items.map((_,k)=>got.get(k)??null),
    standings:rotation(ws,d.tables,d.reservations,now+Math.max(0,last)*MIN).map(({w},i)=>({w,pos:i+1,tally:w.tally_covers??0,delta:(w.tally_covers??0)-(base.get(w.id)??0)}))};
}
