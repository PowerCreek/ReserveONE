import {useState} from 'react';
import {useApp} from '../state/store';
import {rotation,busPriority,LAPSED_CLEAR} from '../engines';
import {unlock} from '../audio';
import {clearTables} from '../state/entries';
import {Tally} from './Tally';
import {expectingMore} from '../arrivals';
import {NumInput} from './NumInput';
import {Panel,PANEL_IDS} from './Panel';
import {sectionStats} from '../sections';
import {Section} from '../types';
import {reset} from '../storage';
import {isLate,fmtClock} from '../party';
import {findSpot,baseDims} from '../geometry';
export function Header(){
  const A=useApp(),{data,now}=A;
  const miss=expectingMore(data).reduce((n,x)=>n+x.missing,0),seated=data.tables.filter(t=>t.status==='occupied').length,bus=data.tables.filter(t=>t.status==='lapsed').length;
  return <div className="hdr"><h1>Host Seating Planner</h1><div className="row wrap">
    <span className="badge sky">{new Date(now).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span><span className="badge">{data.tables.length} tables</span>{miss>0&&<span className="badge warn" title="Guests still expected from partially arrived parties">⏳ {miss} to come</span>}<span className="badge ok">{seated} seated</span><span className="badge warn">{bus} to bus</span>
    <span className="badge">{data.queue.filter(q=>q.status==='WAITING').length} queued</span><span className="badge late">{data.reservations.filter(r=>isLate(r,now)).length} late</span>
    <button className="btn sm" title="Collapse unpinned panels" onClick={()=>A.setUi(Object.fromEntries(PANEL_IDS.map(i=>[i,{...(A.ui[i]||{}),c:!A.ui[i]?.p}])))}>⊟</button><button className="btn sm" title="Expand all panels" onClick={()=>A.setUi(Object.fromEntries(PANEL_IDS.map(i=>[i,{...(A.ui[i]||{}),c:false}])))}>⊞</button><button className="btn sm" title="Alert chime" onClick={()=>{if(!A.sound)unlock();A.setSound(!A.sound)}}>{A.sound?'🔔':'🔕'}</button><button className="btn sm" disabled={!A.canUndo} onClick={A.undo}>↶</button><button className="btn sm" disabled={!A.canRedo} onClick={A.redo}>↷</button>
    <button className="btn sm" onClick={()=>{if(confirm('Reset all data to the seed?')){reset();location.reload()}}}>↺ Reset data</button></div></div>;
}
export function StatusSlot(){
  const {status}=useApp();
  return <div className={'status '+(status?.tone??'')}>{status?.msg??'R rotate · Ctrl+Z undo · Space pan · Del delete · dbl-tap card removes'}</div>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  return <div className="modal" onClick={onClose}><div className="panel" onClick={e=>e.stopPropagation()}><h3>{title}</h3>{children}<button className="btn" onClick={onClose}>Cancel</button></div></div>;
}
export function FloorNav(){
  const A=useApp(),{data}=A,[m,setM]=useState<''|'floor'|'table'>(''),[name,setName]=useState(''),[cap,setCap]=useState(4),[shape,setShape]=useState<'rect'|'booth'>('rect'),[x,setX]=useState(''),[y,setY]=useState('');
  const addFloor=()=>{if(!name.trim())return;const id='f'+Date.now();A.mutate(d=>({...d,floors:[...d.floors,{id,name:name.trim(),description:'',is_active:true}]}),false);A.setFloorId(id);setName('');setM('')};
  const addTable=()=>{const c=shape==='booth'?Math.min(cap,6):cap,b=baseDims(c,shape),p=x!==''&&y!==''?{x:+x,y:+y}:findSpot(data.tables,A.floorId,b.w,b.h);
    const id='t'+Date.now();A.mutate(d=>({...d,tables:[...d.tables,{id,label:name.trim()||`T${d.tables.length+1}`,capacity:c,min_capacity:1,x:p.x,y:p.y,width:b.w,height:b.h,shape,status:'available',assigned_waiter_id:null,section_id:null,floor_id:A.floorId}]}));
    A.setSel([id]);setName('');setX('');setY('');setM('')};
  return <><div className="scroll-x row">{data.floors.map(f=><button key={f.id} className={'btn'+(f.id===A.floorId?' on':'')} onClick={()=>A.setFloorId(f.id)}>{f.name} ({data.tables.filter(t=>t.floor_id===f.id).length})</button>)}
    <button className="btn" onClick={()=>setM('floor')}>＋ Level</button><button className="btn" onClick={()=>setM('table')}>＋ Add Table</button></div>
    {m==='floor'&&<Modal title="New level" onClose={()=>setM('')}><input className="inp" placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/><button className="btn primary" onClick={addFloor}>Add</button></Modal>}
    {m==='table'&&<Modal title="Add table" onClose={()=>setM('')}><input className="inp" placeholder="Label" value={name} onChange={e=>setName(e.target.value)}/>
      <div className="row"><NumInput min={1} max={20} value={cap} label="Table capacity" onChange={setCap}/><select className="inp" value={shape} onChange={e=>setShape(e.target.value as 'rect'|'booth')}><option value="rect">Rect</option><option value="booth">Booth</option></select></div>
      <div className="row"><input className="inp" placeholder="x (auto)" value={x} onChange={e=>setX(e.target.value)}/><input className="inp" placeholder="y (auto)" value={y} onChange={e=>setY(e.target.value)}/></div>
      <button className="btn primary" onClick={addTable}>Add</button></Modal>}</>;
}
export function Rotation(){
  const {data,now}=useApp(),rank=rotation(data.waiters,data.tables,data.reservations,now);
  return <Panel id="rotation" title="Server rotation"><div className="scroll-x row">{rank.map(({w},i)=><div key={w.id} className={'rcard'+(w.is_active?'':' off')}><b>#{i+1} {w.name}</b><div className="row"><Tally n={w.tally_covers??0}/><b className="nw">{w.tally_covers??0}</b></div><div className="muted">open {w.active_cover_count}{w.skip_penalty?' · skipping':''}{w.last_seated_at?` · last ${fmtClock(Date.parse(w.last_seated_at))}`:''}</div>
    <div className="row">{w.section_ids.map(id=><span key={id} className="badge">{data.sections.find(x=>x.id===id)?.name}</span>)}</div></div>)}</div></Panel>;
}
export function SectionsPanel(){
  const A=useApp(),{data,now}=A,[n,setN]=useState(''),[nsv,setNsv]=useState(''),[open,setOpen]=useState<string|null>(null);
  const upd=(id:string,p:Partial<Section>)=>A.mutate(d=>({...d,sections:d.sections.map(s=>s.id===id?{...s,...p}:s)}),false);
  const covers=(w:{section_ids:string[]},sid:string)=>w.section_ids.includes(sid);
  /** 1:1 by default: exactly this server covers the section (any others are removed). */
  const setServer=(sid:string,wid:string)=>A.mutate(d=>({...d,waiters:d.waiters.map(w=>({...w,section_ids:w.id===wid?[...new Set([...w.section_ids,sid])]:w.section_ids.filter(i=>i!==sid)}))}));
  /** Open-ended: add/remove an extra server without touching the others. */
  const share=(sid:string,wid:string,on:boolean)=>A.mutate(d=>({...d,waiters:d.waiters.map(w=>w.id!==wid?w:{...w,section_ids:on?[...new Set([...w.section_ids,sid])]:w.section_ids.filter(i=>i!==sid)})}));
  const del=(id:string)=>A.mutate(d=>({...d,sections:d.sections.filter(s=>s.id!==id),tables:d.tables.map(t=>t.section_id===id?{...t,section_id:null}:t),waiters:d.waiters.map(w=>({...w,section_ids:w.section_ids.filter(i=>i!==id)}))}));
  const add=()=>{if(!n.trim())return;const id='s'+Date.now();
    A.mutate(d=>({...d,sections:[...d.sections,{id,name:n.trim(),color:['#fbbf24','#fb7185','#2dd4bf','#818cf8'][d.sections.length%4]}],waiters:d.waiters.map(w=>w.id===nsv?{...w,section_ids:[...w.section_ids,id]}:w)}));setN('');setNsv('')};
  return <Panel id="sections" title="Sections (server stations)"><div className="muted prose">One server per section is the norm; share a section only when needed. Assign tables in the Inspector. Bubbles join tables with a clear line of sight; dotted wires link the rest.</div>
    {data.sections.map(s=>{const st=sectionStats(s,data,now),sv=data.waiters.filter(w=>covers(w,s.id));return <div key={s.id} className="entry" style={{cursor:'default'}}>
      <span className="dot" style={{background:s.color}}/><b>{s.name}</b><span className="muted">{st.n} tables · occ {Math.round(st.occ*100)}% · turns {st.turns}/{st.need}</span>
      {st.under&&<span className="badge warn">UNDERFLOW</span>}{!sv.length&&<span className="badge warn">no server</span>}{sv.length>1&&<span className="badge sky">shared ×{sv.length}</span>}
      <div className="row"><span className="muted nw">Server</span><select className="inp" aria-label="Server for section" value={sv.length===1?sv[0].id:sv.length?'__multi':''} onChange={e=>setServer(s.id,e.target.value)}>
        <option value="">— none —</option>{sv.length>1&&<option value="__multi" disabled>{sv.map(w=>w.name).join(' + ')}</option>}{data.waiters.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <div className="row wrap">{sv.length>1&&sv.map(w=><button key={w.id} className="chip on" title="Stop sharing" onClick={()=>share(s.id,w.id,false)}>{w.name} ✕</button>)}
        <select className="inp" style={{maxWidth:150}} aria-label="Share section with" value="" onChange={e=>e.target.value&&share(s.id,e.target.value,true)}><option value="">＋ share with…</option>{data.waiters.filter(w=>!covers(w,s.id)).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <div className="row wrap"><button className="btn sm" onClick={()=>A.setSel(data.tables.filter(t=>t.section_id===s.id&&t.floor_id===A.floorId).map(t=>t.id))}>Select</button>
        <button className="btn sm" onClick={()=>{if(open!==s.id)A.mutate(d=>({...d}),true);setOpen(open===s.id?null:s.id)}}>Edit</button>
        <button className="btn sm danger" onClick={()=>del(s.id)}>Delete</button></div>
      {open===s.id&&<div className="form"><div className="row"><input className="inp" value={s.name} onChange={e=>upd(s.id,{name:e.target.value})}/><input type="color" value={s.color} onChange={e=>upd(s.id,{color:e.target.value})}/></div>
        <div className="row"><span className="muted">underflow if occ &lt;</span><NumInput min={0} max={100} value={Math.round((s.min_occupancy??.2)*100)} label="Min occupancy percent" onChange={n=>upd(s.id,{min_occupancy:n/100})}/><span className="muted">% and turns &lt;</span>
          <NumInput min={0} max={99} value={s.min_turns??0} title="0 = auto" label="Min turns" onChange={n=>upd(s.id,{min_turns:n})}/></div></div>}</div>})}
    <div className="row"><input className="inp" placeholder="New section" value={n} onChange={e=>setN(e.target.value)}/>
      <select className="inp" style={{maxWidth:120}} aria-label="Server for new section" value={nsv} onChange={e=>setNsv(e.target.value)}><option value="">server…</option>{data.waiters.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <button className="btn" onClick={add}>Add</button></div></Panel>;
}
export function BusList(){
  const A=useApp(),{data,now}=A,l=busPriority(data.tables,data.queue,data.slots,now,rotation(data.waiters,data.tables,data.reservations,now));
  return <Panel id="bus" title="Bus priority">{l.map(({t,p,waited,w,pos})=><div key={t.id} className="entry" style={{cursor:'default'}}><button className="badge linkb" data-tid={t.id} title="Show on canvas" onClick={()=>A.focusTable(t.id)}>{t.label}</button><span>priority {p}</span><span className="muted">dirty {Math.round(waited)}m</span><span className="badge" title="Server who would get the next party here">{w?`${w.name} #${pos+1}`:'no server'}</span>{waited>=LAPSED_CLEAR&&<span className="badge warn">CLEAR NOW</span>}<button className={'btn sm'+(waited>=LAPSED_CLEAR?' primary':'')} title="Party left and the table is reset: mark it available" onClick={()=>clearTables(A,[t.id])}>🧹 Clear table</button></div>)}{!l.length&&<div className="muted">Nothing to bus</div>}</Panel>;
}
