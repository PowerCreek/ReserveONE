import {useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {expandIds} from '../geometry';
import {Data,PrivateEvent} from '../types';
import {eventState,locking,EvState} from '../state/alerts';
import {fmtClock,fmtWait,loc,MIN} from '../party';
import {Panel} from './Panel';
const stCls:Record<EvState,string>={RESERVED_PENDING:'',BLOCKED_PREP:'warn',ACTIVE_EVENT:'ok',EXPIRING_WARNING:'late',EXPIRED_RECLAIMED:''};
const unlockFor=(d:Data,ev:PrivateEvent,now:number):Data=>({...d,events:d.events.filter(e=>e.id!==ev.id),
  tables:d.tables.map(t=>ev.locked_ids.includes(t.id)&&t.status==='blocked_private'&&!d.events.some(o=>o.id!==ev.id&&!o.reclaimed&&locking(eventState(o,now))&&o.table_ids.includes(t.id))?{...t,status:'available'}:t)});
export function EventsPanel(){
  const A=useApp(),{data,now,sel,floorId}=A,[f,setF]=useState({name:'',start:loc(Date.now()+3600e3),dur:120,target:'sel'}),[open,setOpen]=useState(false);
  const targets=()=>f.target==='sel'?expandIds(sel,data.assocs):f.target==='floor'?data.tables.filter(t=>t.floor_id===floorId).map(t=>t.id):data.tables.filter(t=>t.section_id===f.target.slice(4)).map(t=>t.id);
  const add=()=>{const ids=targets();if(!ids.length)return A.flash('Select tables, a section, or choose whole floor','warn');
    const s=new Date(f.start).getTime();if(isNaN(s))return A.flash('Pick a start time','warn');
    A.mutate(d=>({...d,events:[...d.events,{id:'e'+Date.now(),name:f.name.trim()||'Private event',table_ids:ids,start:new Date(s).toISOString(),end:new Date(s+f.dur*MIN).toISOString(),locked_ids:[],reclaimed:false}]}));
    A.flash(`Event on ${ids.length} tables`,'ok');setOpen(false)};
  const live=data.events.filter(e=>!e.reclaimed),done=data.events.length-live.length;
  const when=(e:PrivateEvent,st:EvState)=>st==='RESERVED_PENDING'||st==='BLOCKED_PREP'?`starts ${fmtClock(Date.parse(e.start))} (in ${fmtWait((Date.parse(e.start)-now)/MIN)})`:`ends ${fmtClock(Date.parse(e.end))} (in ${fmtWait((Date.parse(e.end)-now)/MIN)})`;
  return <Panel id="events" title="Private events">
    <div className="row"><button className="btn sm" onClick={()=>setOpen(!open)}>{open?'Close':'＋ Event'}</button>{done>0&&<button className="btn sm" onClick={()=>A.mutate(d=>({...d,events:d.events.filter(e=>!e.reclaimed)}),false)}>Clear {done} finished</button>}</div>
    {open&&<div className="form"><input className="inp" placeholder="Event name" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/>
      <div className="row"><input className="inp" type="datetime-local" value={f.start} onChange={e=>setF({...f,start:e.target.value})}/><NumInput style={{maxWidth:80}} min={15} max={1440} value={f.dur} label="Event minutes" onChange={n=>setF({...f,dur:n})}/></div>
      <select className="inp" value={f.target} onChange={e=>setF({...f,target:e.target.value})}><option value="sel">Selected tables ({sel.length})</option><option value="floor">Whole floor</option>{data.sections.map(s=><option key={s.id} value={'sec:'+s.id}>Section: {s.name}</option>)}</select>
      <button className="btn primary" onClick={add}>Add event (locks 30m before)</button></div>}
    {live.map(e=>{const st=eventState(e,now);return <div key={e.id} className="entry" style={{cursor:'default'}}><b>{e.name}</b> <span className={'badge '+stCls[st]}>{st.replace('_',' ')}</span>
      <div className="muted">{e.table_ids.length} tables · {when(e,st)}</div>
      <div className="row"><button className="btn sm" onClick={()=>A.mutate(d=>({...d,events:d.events.map(x=>x.id===e.id?{...x,start:new Date(Math.min(Date.parse(x.start),Date.now()-60000)).toISOString(),end:new Date().toISOString()}:x)}))}>End now</button>
        <button className="btn sm danger" onClick={()=>A.mutate(d=>unlockFor(d,e,Date.now()))}>Cancel</button></div></div>})}
    {!live.length&&<div className="muted">No events</div>}</Panel>;
}
