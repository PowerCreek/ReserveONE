import {useMemo,useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {buildUnits} from '../geometry';
import {lookahead} from '../engines';
import {planSequence} from '../predict';
import {holdsFrom} from '../party';
import {seatReq,addToQueue} from '../state/entries';
import {rangeOf,queueOrder} from '../turnover';
import {Tally} from './Tally';
const cls=(c:string)=>c==='HOT_GREEN'?'ready':c==='WARM_AMBER'?'tight':c==='CAUTION_WAIT'?'wait':'none';
function useBase(){
  const A=useApp(),{data,floorId,now,seq}=A;
  const units=useMemo(()=>buildUnits(data.tables,data.assocs).filter(u=>u.floor_id===floorId),[data.tables,data.assocs,floorId]);
  const holds=useMemo(()=>holdsFrom(data.reservations,now,data.events),[data.reservations,data.events,now]);
  const plan=useMemo(()=>planSequence(data,seq,units,now,holds),[data,seq,units,now,holds]);
  const items=plan.items,pred={items:plan.preds,standings:plan.standings};
  return{A,data,now,seq,units,holds,items,pred};
}
/** One-line "what's next" shown in the drawer bar on the N-top tab: table, predicted server and their tally before→after. */
export function NtopSummary(){
  const {A,seq,items,pred}=useBase(),it=items[0],p=pred.items[0];
  const script=it?`Next: ${it.size}-top → ${it.label}${p?.server?` · ${p.server.name} ${p.from}→${p.to}`:''} · ${it.ready?'seat now':`wait ~${Math.round(it.wait)}m (${it.clock})`}`:'Tap an N-top tile to build a sequence';
  return <><span className="script">{script}</span>{seq.length>0&&<button className="btn sm" onClick={()=>A.setSeq([])}>Clear {seq.length}</button>}</>;
}
export function NtopWidget(){
  const {A,data,now,seq,units,holds,items,pred}=useBase(),[cn,setCn]=useState(8);
  const rm=(i:number)=>A.setSeq(seq.filter((_,j)=>j!==i));
  /** Tap a card: ready -> seat it at its planned table(s) now; otherwise -> add to the queue with the quote (queue ahead included), planned table and predicted server. */
  const act=(i:number)=>{const it=items[i];if(!it)return;
    const u=it.ready&&it.unitId?units.find(x=>x.id===it.unitId):undefined;
    if(u){seatReq(A,{size:it.size,prefix:data.prefix,type:'W'},'auto',u.tableIds[0]);return rm(i)}
    const ahead=queueOrder(data.queue).map(q=>q.party_size),pl=planSequence(data,[...ahead,it.size],buildUnits(data.tables,data.assocs),now,holds),k=pl.items.length-1,qi=pl.items[k],qp=pl.preds[k],r=rangeOf(qi.wait);
    const none=qi.code==='NO_TABLE',plan=none?'No single table fits: combine tables or wait':`Plan: ${qi.label} ~${qi.clock}${qp?.server?` · ${qp.server.name}`:''}`;
    addToQueue(A,{size:it.size,quoted:Math.round(qi.wait),notes:plan,refs:[{label:'Quote',value:none?'no single table':qi.ready?'ready now':`${r.lo}–${r.hi} min`,warn:none},
      ...(qi.tableId?[{label:'Planned table',value:`${qi.label} · ${qi.ready?'now':qi.clock}`,tid:qi.tableId}]:[]),...(qp?.server?[{label:'Server (predicted)',value:`${qp.server.name} ${qp.from}→${qp.to}`}]:[])]});
    rm(i)};
  const look=useMemo(()=>lookahead(units,data.slots,seq,now,holds,[1,2,3,4,5,6,cn]),[units,data.slots,seq,now,holds,cn]),c=look[cn];
  return <div><div className="tiles">{[6,5,4,3,2,1].map(n=>{const l=look[n];
    return <button key={n} className={'tile '+cls(l.code)} onClick={()=>A.setSeq([...seq,n])}><b>{n}-top</b><span>+{l.depth} | {l.time}</span><small>{l.msg}</small></button>})}
    <div className={'tile ctile '+cls(c.code)}><div className="row"><NumInput min={1} max={40} value={cn} label="Custom party size" onChange={setCn}/>
      <button className="btn sm" title="Add custom N-top" onClick={()=>A.setSeq([...seq,cn])}>＋</button></div><span>+{c.depth} | {c.time}</span><small>{c.msg}</small></div></div>
    <div className="tstrip"><span className="muted nw">Tally rotation {seq.length?'after sequence':'now'}</span>
      {pred.standings.map(s=><span key={s.w.id} className={'rchip'+(s.pos===1?' ok':'')} title={`${s.w.name}: ${s.tally} covers${s.delta?` (+${s.delta} predicted)`:''}`}>#{s.pos} {s.w.name} <Tally n={s.tally}/><b>{s.tally}</b>{s.delta>0&&<sup>+{s.delta}</sup>}</span>)}</div>
    <div className="seq-row">{items.map((it,i)=>{const p=pred.items[i];return <div key={i} className={'card '+cls(it.code)} onClick={()=>act(i)}>
      <div className="rail">{it.size}-TOP</div><div className="cbody"><b>{it.ready?'READY NOW':it.code==='NO_TABLE'?'NO TABLE':`Wait ${Math.round(it.wait)}m`}</b><div>{it.label} · {it.clock}</div>
      <div className="srv" title={p?.fallback?'No server covers this section: fallback pick':'Server by tally rotation (tally before→after)'}>{p?.server?<>→ {p.server.name} <b>{p.from}→{p.to}</b>{p.fallback?' fb':''}</>:it.code==='NO_TABLE'?'—':'no server'}</div>
      <div className="act">#{i+1} · {it.ready?'tap → seat':it.code==='NO_TABLE'?'tap → queue (no table fits)':'tap → add to queue'}</div>
      {it.tableId&&<button className="btn sm" onClick={e=>{e.stopPropagation();A.focusTable(it.tableId!)}}>📍</button>}</div><button className="pbtn num" title="Remove from sequence" onClick={e=>{e.stopPropagation();rm(i)}}>✕</button></div>})}</div></div>;
}
