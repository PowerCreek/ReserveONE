import {useApp} from '../state/store';
import {SimEntry} from '../types';
import {addToQueue,addArrived,seatRefs} from '../state/entries';
import {seatOrQueue,processDoor} from '../door';
import {Panel} from './Panel';
import {fmtClock} from '../party';
/** Simulation door list: guests at (or heading to) the door. Put them through the normal flow: walk-ins → Queue, reservation/queue guests → Arrive (+n here). Only shown while simulating. */
export function SimEntries(){
  const A=useApp(),{data,now,sim}=A;if(!sim)return null;
  const es=data.sim??[],rm=(id:string)=>A.mutate(d=>({...d,sim:(d.sim??[]).filter(e=>e.id!==id)}),false);
  const tgt=(e:SimEntry)=>!e.ref?undefined:e.ref.type==='res'?data.reservations.find(x=>x.id===e.ref!.id):data.queue.find(x=>x.id===e.ref!.id);
  const run=(e:SimEntry)=>{if(e.kind==='walkin')addToQueue(A,{id:'q_'+e.id,name:e.name,size:e.size,here:e.here,party_id:e.party_id,prefix:e.prefix,type:e.type});else if(e.ref&&tgt(e))addArrived(A,{kind:e.ref.type,id:e.ref.id},e.size);rm(e.id)};
  const queueAll=()=>{const due=es.filter(e=>e.kind==='walkin'&&Date.parse(e.at)<=now);due.forEach(e=>addToQueue(A,{id:'q_'+e.id,name:e.name,size:e.size,here:e.here,party_id:e.party_id,prefix:e.prefix,type:e.type,quiet:true}));
    A.mutate(d=>({...d,sim:(d.sim??[]).filter(e=>!due.some(x=>x.id===e.id))}),false);A.flash(`${due.length} walk-in${due.length===1?'':'s'} put in the queue`,'ok')};
  /** ⚡ seat at the best ready table when the whole party is here and nobody is waiting, otherwise queue. */
  const door=(e:SimEntry)=>{const r=seatOrQueue(A.data,{id:'q_'+e.id,name:e.name,size:e.size,here:e.here,party_id:e.party_id,prefix:e.prefix,type:e.type});A.mutate(()=>({...r.d,sim:(r.d.sim??[]).filter(x=>x.id!==e.id)}));
    A.receipt(r.seated?'Seated from the door':'Queued from the door',r.seated?seatRefs(A.data,r.d).refs:[{label:'Party',value:`${r.label} · ${e.size}`},{label:'Guest',value:e.name},{label:'Why queued',value:r.msg,warn:true}])};
  const doorAll=()=>{const r=processDoor(A.data,Date.now());if(!r.seated&&!r.queued)return A.flash('No walk-ins at the door yet','info');A.mutate(()=>r.d);A.flash(`${r.seated} seated · ${r.queued} queued`,'ok')};
  return <Panel id="simentries" title={`Door list (${es.length})`}>
    <div className="row wrap"><button className="btn sm primary" title="Seat each walk-in at the best ready table if the whole party is here and nobody is waiting; otherwise queue them" onClick={doorAll}>⚡ Process everyone at the door</button><button className="btn sm" onClick={queueAll}>Queue everyone at the door</button><button className="btn sm danger" onClick={()=>A.mutate(d=>({...d,sim:[]}),false)}>Clear</button></div>
    {es.map(e=>{const due=Date.parse(e.at)<=now,t=tgt(e),mins=Math.round((Date.parse(e.at)-now)/60000);
      return <div key={e.id} className={'entry'+(due?' due':'')} style={{cursor:'default'}}>
        <span className="muted">{due?'at the door':`in ${mins}m · ${fmtClock(Date.parse(e.at))}`}</span><b>{e.name}</b>
        <span>{e.kind==='walkin'?`walk-in ×${e.size}${e.here!==undefined&&e.here<e.size?` (${e.here} here)`:''}`:`+${e.size} guest${e.size>1?'s':''} for ${e.ref?.type==='res'?'reservation':'queued party'}`}</span>
        {e.kind==='arrive'&&!t&&<span className="badge warn">{e.ref?.type==='queue'?'not in queue yet':'reservation gone'}</span>}
        <div className="row">{e.kind==='walkin'&&<button className="btn sm" title="Seat at the best ready table if the whole party is here and nobody is waiting; otherwise queue" onClick={()=>door(e)}>⚡ Seat/Queue</button>}<button className="btn sm primary" disabled={e.kind==='arrive'&&!t} onClick={()=>run(e)}>{e.kind==='walkin'?'→ Queue':'Arrive'}</button>
          <button className="btn sm" title="Turn away / no-show" onClick={()=>rm(e.id)}>✕</button></div></div>})}
    {!es.length&&<div className="muted">No one at the door. Generate entries in the Simulation panel.</div>}</Panel>;
}
