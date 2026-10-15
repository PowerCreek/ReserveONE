import {useApp} from '../state/store';
import {expectingMore} from '../arrivals';
import {setArrived,addArrived} from '../state/entries';
import {Panel} from './Panel';
/** Partial-arrival controls on a reservation / walk-in card: here n/size with − ＋ all-here. */
export function HereRow({kind,id,here,size}:{kind:'res'|'queue';id:string;here:number;size:number}){
  const A=useApp(),t={kind,id},stop=(f:()=>void)=>(e:React.MouseEvent)=>{e.stopPropagation();f()};
  return <div className="row wrap hrow"><span className={'rchip'+(here<size?' warn':'')} title="Guests here / expected">here {here}/{size}</span>
    <button className="btn sm" title="One fewer here" disabled={here<=0} onClick={stop(()=>setArrived(A,t,here-1))}>−</button>
    <button className="btn sm" title="One more guest arrived" disabled={here>=size} onClick={stop(()=>setArrived(A,t,here+1))}>＋</button>
    {here<size&&<button className="btn sm" onClick={stop(()=>setArrived(A,t,size))}>all here</button>}{here>0&&here<size&&<span className="badge warn">{size-here} to come</span>}</div>;
}
/** Who to look out for: parties with some but not all guests here, where they are, and one-tap ＋1 when a late guest says they belong to one. */
export function Arrivals(){
  const A=useApp(),xs=expectingMore(A.data);
  return <Panel id="arrivals" title={`Expecting more guests (${xs.reduce((n,x)=>n+x.missing,0)})`}>
    {xs.map(x=><div key={x.kind+x.id} className="entry" style={{cursor:'default'}}><b>{x.name}</b><span>{x.label}</span><span className="rchip warn">here {x.here}/{x.size}</span><span className="badge warn">{x.missing} to come</span><span className="muted">{x.where}</span>
      {x.tid&&<button className="badge linkb" title="Show on canvas" onClick={()=>A.focusTable(x.tid!)}>📍</button>}
      <div className="row"><button className="btn sm" onClick={()=>addArrived(A,{kind:x.kind,id:x.id},1)}>＋1 here</button><button className="btn sm" onClick={()=>setArrived(A,{kind:x.kind,id:x.id},x.size)}>all here</button></div></div>)}
    {!xs.length&&<div className="muted">Everyone expected is here.</div>}</Panel>;
}
