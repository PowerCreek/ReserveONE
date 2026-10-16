import {useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {seatReq,previewSeat,addToQueue,markAhead,clearAndSeat,clearTables,unseat,addArrived} from '../state/entries';
import {selectionState} from '../selection';
import {planAhead,AheadPlan} from '../ahead';
import {PreviewLine,AheadLine} from './Receipt';
import {Panel} from './Panel';
import {partyLabel,sanitizePrefix,loc} from '../party';
import {PType} from '../types';
type Pv=ReturnType<typeof previewSeat>;
/** Seat now (auto best / selected) OR mark a table ahead (hours or days) for a new party or the active reservation. */
export function FastSeating(){
  const A=useApp(),{data}=A,[nm,setNm]=useState(''),[ahead,setAhead]=useState(false),[at,setAt]=useState(()=>loc(Date.now()+2*3600e3)),[dur,setDur]=useState(90),[touched,setTouched]=useState(false),[reason,setReason]=useState('');
  const q=data.queue.find(x=>x.id===A.activeQ),r=data.reservations.find(x=>x.id===A.activeR);
  const ap=q?{size:q.party_size,prefix:q.prefix,type:q.type,party_id:q.party_id,queueId:q.id,resId:q.origin_reservation_id??undefined}:r?{size:r.party_size,prefix:r.prefix,type:r.type,party_id:r.party_id,resId:r.id,duration:r.duration_min}:null;
  const type=(ap?.type??A.ptype) as PType,size=ap?.size??A.size,prefix=ap?.prefix??data.prefix;
  const needsReason=!ap&&(type==='P'||type==='V'),reasonOk=!needsReason||reason.trim().length>0;
  const label=ap?partyLabel(ap.prefix,ap.type,ap.party_id):partyLabel(prefix,type,data.nextPartyId);
  const req=()=>ap??{size,prefix,type};
  const aheadOn=ahead&&!q,whenMs=r&&!touched?Date.parse(r.time):new Date(at).getTime(),len=r&&!touched?r.duration_min:dur,okAt=!isNaN(whenMs);
  const ss=selectionState(data,A.sel,size,ap?.party_id),free=ss.kind==='free',tg=r?{kind:'res' as const,id:r.id}:q?{kind:'queue' as const,id:q.id}:null;
  const autoP=aheadOn?null:previewSeat(A,req(),'auto',r?.table_id),selP=!aheadOn&&free?previewSeat(A,req(),'selected'):null;
  /** Names the selected table and what it can do; when it cannot take this party, says why and offers the way out (auto-allocate is always the plain alternative). */
  const selCard=!aheadOn&&A.sel.length>0&&<div className={'selcard '+ss.kind}>
    <div className="row wrap" style={{overflow:'visible'}}><b className="nw">Selected {ss.label}</b><span className="muted nw">{ss.cap}-top</span><span className={'badge '+(free?'ok':ss.kind==='lapsed'?'late':'warn')}>{free?'free':ss.kind==='small'?'too small':ss.kind==='lapsed'?'past turn':ss.kind}</span>
      <button className="pbtn" title="Show on canvas" onClick={()=>A.focusTable(ss.ids[0])}>📍</button><button className="pbtn" title="Deselect" onClick={()=>A.setSel([])}>✕</button></div>
    {!free&&<div className="muted">{ss.msg}</div>}
    <div className="row wrap" style={{overflow:'visible'}}>
      {ss.kind==='occupied'&&ss.party&&<><button className="btn sm" onClick={()=>unseat(A,ss.party!.slotId)}>↩ Unseat {ss.party.label} → queue</button><button className="btn sm" onClick={()=>clearTables(A,A.sel)}>🧹 Clear (left)</button></>}
      {ss.kind==='lapsed'&&<><button className="btn sm primary" onClick={()=>clearAndSeat(A,req())}>🧹 Clear &amp; seat here</button><button className="btn sm" onClick={()=>clearTables(A,A.sel)}>Clear only</button></>}
      {ss.kind==='joining'&&tg&&<><button className="btn sm" onClick={()=>addArrived(A,tg,1)}>＋1 here</button><button className="btn sm" onClick={()=>addArrived(A,tg,size)}>All here</button></>}
      {!free&&ss.kind!=='joining'&&<span className="muted">{ss.kind==='small'?'Link tables or pick a bigger one — or':'Or'} Auto-allocate picks another table.</span>}</div></div>;
  const hv=(p:Pv|null)=>({onMouseEnter:()=>A.setPv(p&&p.ok?p.ids:[]),onMouseLeave:()=>A.setPv([])});
  const ahA=aheadOn&&okAt?planAhead(data,{size,whenMs,dur:len,sel:null,exceptRes:r?.id}):null,ahS=aheadOn&&okAt&&A.sel.length?planAhead(data,{size,whenMs,dur:len,sel:A.sel,exceptRes:r?.id}):null;
  const hvA=(p:AheadPlan|null)=>({onMouseEnter:()=>A.setPv(p&&p.ok?p.tableIds:[]),onMouseLeave:()=>A.setPv([])});
  const enqueue=()=>{addToQueue(A,{name:nm,size,type,prefix,notes:reason.trim()||undefined});setNm('');setReason('')};
  const mark=(p:AheadPlan|null)=>{if(!p||!p.ok)return A.flash(p?p.err:'Pick a valid date and time','warn');markAhead(A,p,{size,name:nm||undefined,whenMs,dur:len,resId:r?.id});if(!r)setNm('');A.setActiveR(null)};
  const when=(ms:number)=>{setAt(loc(ms));setTouched(true)};
  return <Panel id="fast" title="Fast seating">
    <div className="muted">{ap?`Active party ${label}`:`New party → ${aheadOn?partyLabel(prefix,'R',data.nextPartyId):label}`}{ap&&<button className="btn sm" style={{marginLeft:8}} onClick={()=>{A.setActiveQ(null);A.setActiveR(null)}}>clear</button>}</div>
    <div className="row"><input className="inp" style={{width:70}} value={data.prefix} maxLength={4} onChange={e=>A.mutate(d=>({...d,prefix:sanitizePrefix(e.target.value)}),false)} disabled={!!ap}/>
      {(['W','P','V'] as PType[]).map(t=><button key={t} className={'chip'+(type===t?' on':'')} disabled={!!ap} title={t==='P'?'Priority: active service recovery (host error, over-quoted wait, accessibility need)':t==='V'?'VIP: a recognized guest, at host discretion':'Ordinary walk-in'} onClick={()=>{A.setPtype(t);if(t==='W')setReason('')}}>{t}</button>)}</div>
    <div className="row"><button className="btn" disabled={!!ap} onClick={()=>A.setSize(Math.max(1,size-1))}>−</button><span className="cap">{size}</span><button className="btn" disabled={!!ap} onClick={()=>A.setSize(Math.min(12,size+1))}>＋</button></div>
    <div className="row"><input className="inp" placeholder="Name (optional)" value={nm} disabled={!!ap} onChange={e=>setNm(e.target.value)}/></div>
    {needsReason&&<div className="row"><input className="inp" placeholder={type==='P'?'Reason (required) — what happened?':'Reason (required) — who, and why?'} value={reason} onChange={e=>setReason(e.target.value)}/></div>}
    <div className="row"><button className={'chip'+(!aheadOn?' on':'')} onClick={()=>setAhead(false)}>Seat now</button>
      <button className={'chip'+(aheadOn?' on':'')} disabled={!!q} title={q?'Queued parties are seated now':'Hold a table for later today or another day'} onClick={()=>setAhead(true)}>Mark ahead</button></div>
    {aheadOn?<>
      <div className="row wrap"><input className="inp" type="datetime-local" value={r&&!touched?loc(whenMs):at} onChange={e=>{setAt(e.target.value);setTouched(true)}}/>
        <NumInput style={{maxWidth:70}} min={15} max={720} value={len} label="Duration minutes" onChange={n=>{setDur(n);setTouched(true)}}/></div>
      <div className="row wrap"><button className="chip sm" onClick={()=>when(Date.now()+3600e3)}>+1h</button><button className="chip sm" onClick={()=>when(Date.now()+3*3600e3)}>+3h</button>
        <button className="chip sm" onClick={()=>{const t=new Date();t.setDate(t.getDate()+1);t.setHours(19,0,0,0);when(t.getTime())}}>Tomorrow 7pm</button></div>
      <div className="pvbox"><div className="muted nw">{r?`Assign a table for ${r.name} →`:'Auto-mark will hold →'}</div><AheadLine p={ahA}/>{ahS&&<><div className="muted nw">Mark selected will hold →</div><AheadLine p={ahS}/></>}</div>
      <div className="row wrap"><button className="btn primary" disabled={!ahA||!ahA.ok} {...hvA(ahA)} onClick={()=>mark(ahA)}>Auto-mark best table</button>
        <button className="btn" disabled={!ahS||!ahS.ok} {...hvA(ahS)} onClick={()=>mark(ahS)}>Mark selected table</button></div></>
    :<>
      {selCard}<div className="pvbox"><div className="muted nw">Auto-allocate will seat →</div><PreviewLine p={autoP!}/>{selP&&<><div className="muted nw">Seat at {ss.label} →</div><PreviewLine p={selP}/></>}</div>
      <div className="row wrap"><button className="btn primary" {...hv(autoP)} onClick={()=>seatReq(A,req(),'auto',r?.table_id)}>Auto-allocate &amp; seat</button><button className="btn" disabled={!free} title={free?undefined:ss.kind==='none'?'Select a table first':ss.msg} {...hv(selP)} onClick={()=>seatReq(A,req(),'selected')}>{ss.kind==='none'?'Seat at selected (pick a table)':free?`Seat at ${ss.label} (${ss.cap}-top)`:`Seat at ${ss.label} ✕`}</button>
        <button className="btn" disabled={!!ap||!reasonOk} title={reasonOk?undefined:'Priority/VIP needs a reason, for accountability'} onClick={enqueue}>Add to queue</button></div></>}</Panel>;
}
