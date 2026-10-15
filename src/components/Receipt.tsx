import {useApp} from '../state/store';
import {Preview,previewSeat,seatModeFor} from '../state/entries';
import {Req} from '../state/seat';
import {Ref} from '../types';
import {AheadPlan} from '../ahead';
const Chip=({x,onPin}:{x:Ref;onPin:(id:string)=>void})=><span className={'rchip'+(x.warn?' warn':'')} data-tid={x.tid}><small className="muted">{x.label}</small> {x.value}{x.tid&&<button className="pbtn" title="Show on canvas" onClick={()=>onPin(x.tid!)}>📍</button>}</span>;
/** What the last action touched: party, table(s), server, section, turn… with 📍 jump + Undo. */
export function ReceiptBar(){
  const A=useApp(),r=A.rcpt;if(!r)return null;
  return <div className="rcpt"><b className="nw">✓ {r.title}</b>{r.refs.map((x,i)=><Chip key={i} x={x} onPin={A.focusTable}/>)}
    <button className="btn sm" title="Undo this action" onClick={()=>{A.undo();A.setRcpt(null)}}>↶ Undo</button><button className="pbtn" title="Dismiss" onClick={()=>A.setRcpt(null)}>✕</button></div>;
}
/** Dry-run result of an auto/selected seat: where it WOULD go. */
export function PreviewLine({p}:{p:Preview}){
  const A=useApp();
  if(!p.ok)return <div className="pv"><span className="rchip warn">✕ {p.err}</span></div>;
  return <div className="pv">{p.refs.filter(x=>x.label!=='Party').map((x,i)=><Chip key={i} x={x} onPin={A.focusTable}/>)}</div>;
}
/** Seat quick-action that names its target (table · server) and pulses it on the canvas on hover. */
export function SeatBtn({req,resTable,onSeat,off}:{req:Req;resTable?:string|null;onSeat:()=>void;off?:string}){
  const A=useApp(),p=off?null:previewSeat(A,req,seatModeFor(A,req),resTable);
  const srv=p&&p.ok?p.refs.find(x=>x.label==='Server')?.value:'';
  return <button className="btn sm" title={off??(p&&p.ok?p.refs.map(x=>`${x.label}: ${x.value}`).join(' · '):p?p.err:'')}
    onMouseEnter={()=>A.setPv(p&&p.ok?p.ids:[])} onMouseLeave={()=>A.setPv([])} onClick={e=>{e.stopPropagation();onSeat()}}>Seat{p&&p.ok?` → ${p.label} · ${srv}`:p?' ✕':''}</button>;
}
/** Dry-run result of marking a table ahead (which table would be held for that window). */
export function AheadLine({p}:{p:AheadPlan|null}){
  const A=useApp();if(!p)return null;
  return p.ok?<div className="pv"><span className="rchip">Table {p.label} ({p.cap}-top)</span><button className="pbtn" title="Show on canvas" onClick={()=>A.focusTable(p.primary)}>📍</button></div>
    :<div className="pv"><span className="rchip warn">✕ {p.err}</span></div>;
}
