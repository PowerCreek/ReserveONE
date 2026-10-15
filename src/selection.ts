import {Data} from './types';
import {expandIds} from './geometry';
export type SelKind='none'|'free'|'small'|'joining'|'occupied'|'lapsed'|'blocked';
export interface SelState{kind:SelKind;label:string;cap:number;ids:string[];party?:{label:string;size:number;slotId:string;partyId:number};msg:string}
/** What the current table selection means for seating a party of `size` (`partyId` = the party being seated, if it already has one). Single source for the Seat-at-selected button, its card and the quick Seat buttons. */
export function selectionState(d:Data,sel:string[],size:number,partyId?:number|null):SelState{
  const ids=expandIds(sel,d.assocs),ts=d.tables.filter(t=>ids.includes(t.id)),label=ts.map(t=>t.label).join('+'),cap=ts.reduce((s,t)=>s+t.capacity,0);
  if(!ts.length)return{kind:'none',label:'',cap:0,ids:[],msg:'No table selected'};
  const sl=d.slots.find(s=>s.status!=='COMPLETED'&&ids.includes(s.table_id)),party=sl?{label:sl.party_label,size:sl.party_size,slotId:sl.id,partyId:sl.party_id}:undefined,base={label,cap,ids,party};
  if(ts.some(t=>t.status==='blocked_private'))return{...base,kind:'blocked',msg:`${label} is blocked (private event)`};
  if(sl&&partyId!=null&&sl.party_id===partyId)return{...base,kind:'joining',msg:`${sl.party_label} is already seated at ${label}`};
  if(ts.some(t=>t.status==='lapsed'))return{...base,kind:'lapsed',msg:`${label} is past its turn${sl?` (${sl.party_label})`:''}: clear it first`};
  if(ts.some(t=>t.status==='occupied')||sl)return{...base,kind:'occupied',msg:`${label} is occupied${sl?` by ${sl.party_label}`:''}`};
  if(cap<size)return{...base,kind:'small',msg:`${label} seats ${cap}, party is ${size}`};
  return{...base,kind:'free',msg:`${label} (${cap}-top) is free`};
}
