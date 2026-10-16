import {useApp} from '../state/store';
import {expandIds,setCapacity,planLink,applyLink,dissolve,removeFromGroup,groupTouch} from '../geometry';
import {clearTables,unseat} from '../state/entries';
import {Panel} from './Panel';
import {fmtClock,fmtDay,dayKey} from '../party';
import {TStatus} from '../types';
export function Inspector(){
  const A=useApp(),{data,sel,flash}=A,ts=data.tables.filter(t=>sel.includes(t.id));
  if(!ts.length)return <Panel id="inspector" title="Inspector"><div className="muted">Select a table (canvas, Gantt or Inspector) or marquee-select several.</div></Panel>;
  const one=ts.length===1?ts[0]:null,ids=expandIds(sel,data.assocs),gt=groupTouch(data.assocs,sel),canLink=sel.length>=2;
  const upd=(f:(t:typeof ts[0])=>Partial<typeof ts[0]>,push=true)=>A.mutate(d=>({...d,tables:d.tables.map(t=>sel.includes(t.id)?{...t,...f(t)}:t)}),push);
  const setStatus=(s:TStatus)=>{
    if(s!=='available'){upd(()=>({status:s}));return A.receipt(`Marked ${s.replace('_',' ')}`,ts.map(t=>({label:'Table',value:t.label,tid:t.id})))}
    clearTables(A,sel)};
  const cap=(c:number)=>{const n=setCapacity(data.tables,one!.id,c);n?A.mutate(d=>({...d,tables:n})):flash('Blocked: overlaps','warn')};
  const link=()=>{const p=planLink(data.tables,data.assocs,sel);'err' in p?flash(p.err,'warn'):A.mutate(d=>({...d,assocs:applyLink(d.assocs,p.ids)}))};
  const del=()=>{A.mutate(d=>({...d,tables:d.tables.filter(t=>!sel.includes(t.id))}));A.setSel([])};
  const extend=()=>A.mutate(d=>{const n=Date.now(),I=new Set(expandIds(sel,d.assocs));let hit=false;
    const slots=d.slots.map(s=>{if(!I.has(s.table_id)||s.status==='COMPLETED')return s;hit=true;const t=Date.parse(s.expected_turn_at)+15*60000;return{...s,expected_turn_at:new Date(t).toISOString(),status:t>n?'ACTIVE' as const:s.status}});
    if(!hit)return d;return{...d,slots,tables:d.tables.map(t=>I.has(t.id)&&t.status==='lapsed'&&slots.some(s=>s.table_id===t.id&&s.status==='ACTIVE')?{...t,status:'occupied'}:t)}});
  const ext=()=>{const sl=data.slots.filter(x=>ids.includes(x.table_id)&&x.status!=='COMPLETED');
    if(sl.length)A.receipt('Turn extended +15m',sl.flatMap(x=>[{label:'Party',value:`${x.party_label} · ${x.party_size}`},{label:'Table',value:data.tables.find(t=>t.id===x.table_id)?.label??'',tid:x.table_id},{label:'New turn',value:fmtClock(Date.parse(x.expected_turn_at)+15*60000)}]));
    extend()};
  const edit=A.layoutMode;
  return <Panel id="inspector" title={one?`Table ${one.label}`:`${ts.length} tables`}>
    {one&&<div className="row"><input className="inp" value={one.label} disabled={!edit} title={edit?undefined:'Enable Layout Mode (header) to rename'} onFocus={()=>A.mutate(d=>({...d}),true)} onChange={e=>upd(()=>({label:e.target.value}),false)} onBlur={e=>e.target.value.trim()||upd(t=>({label:t.id}),false)}/>
      <button className="btn" disabled={!edit} title={edit?undefined:'Enable Layout Mode (header) to change capacity'} onClick={()=>cap(one.capacity-1)}>−</button><span className="cap">{one.capacity}</span><button className="btn" disabled={!edit} title={edit?undefined:'Enable Layout Mode (header) to change capacity'} onClick={()=>cap(one.capacity+1)}>＋</button></div>}
    {one&&!edit&&<div className="muted">Name and seats are locked in Service Mode — switch to Layout Mode (header) to edit them.</div>}
    <div className="row"><select className="inp" value={ts.every(t=>t.section_id===ts[0].section_id)?ts[0].section_id??'':'__mixed'} onChange={e=>upd(()=>({section_id:e.target.value||null}))}>
      <option value="">No section</option>{ts.some(t=>t.section_id!==ts[0].section_id)&&<option value="__mixed" disabled>Mixed</option>}{data.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    <div className="igroup">{(['available','occupied','lapsed','blocked_private'] as TStatus[]).map(s=>
      <button key={s} className={'btn'+(ts.every(t=>t.status===s)?' on':'')} onClick={()=>setStatus(s)}>{s==='available'?'Mark Available':s==='blocked_private'?'Block':s==='lapsed'?'Mark Lapsed':'Occupied'}</button>)}</div>
    <div className="igroup">
      <button className="btn" disabled={!canLink} title={canLink?undefined:'Select 2+ tables to link'} onClick={link}>🔗 Add/Merge Group</button>
      {gt.touched&&!gt.full&&<button className="btn" onClick={()=>A.mutate(d=>({...d,assocs:removeFromGroup(d.assocs,sel)}))}>Remove from Group</button>}
      {gt.touched&&<button className="btn" onClick={()=>A.mutate(d=>({...d,assocs:dissolve(d.assocs,sel)}))}>Dissolve Group</button>}
    </div>
    <div className="row wrap"><button className="btn" onClick={ext}>+15m turn</button><button className="btn danger" disabled={!edit} title={edit?undefined:'Enable Layout Mode (header) to delete a table'} onClick={del}>🗑 Delete</button></div>{one&&<TableCard id={one.id}/>}</Panel>;
}

/** Table summary + what is scheduled on it (slots, reservations, events). Shared by Inspector and Gantt. */
export function TableCard({id}:{id:string}){
  const A=useApp(),{data,today}=A,t=data.tables.find(x=>x.id===id);if(!t)return null;
  const w=data.waiters.find(x=>x.id===t.assigned_waiter_id),sec=data.sections.find(x=>x.id===t.section_id);
  const sl=data.slots.filter(s=>s.table_id===id&&s.status!=='COMPLETED'),ev=data.events.filter(e=>!e.reclaimed&&e.table_ids.includes(id));
  const rs=data.reservations.filter(r=>r.table_id===id&&(r.status==='BOOKED'||r.status==='ARRIVED')).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)).slice(0,4);
  const fd=(ms:number)=>(dayKey(ms)===today?'':fmtDay(dayKey(ms))+' ')+fmtClock(ms);
  return <div className="tcard"><div className="muted">{t.capacity}-top · {t.status} · {sec?`section ${sec.name}`:'no section'} · server {w?.name??'—'}</div>
    {sl.map(s=><div key={s.id}>🍽 {s.party_label} ({s.party_size}) {fd(Date.parse(s.seated_at))} → {fd(Date.parse(s.expected_turn_at))}</div>)}
    {sl.length>0&&<div className="row wrap" style={{overflow:'visible'}}><button className="btn sm primary" onClick={()=>clearTables(A,[id])}>🧹 Clear (party left)</button><button className="btn sm" onClick={()=>unseat(A,sl[0].id)}>↩ Unseat → queue</button></div>}
    {rs.map(r=><div key={r.id}>📅 {r.name} ({r.party_size}) {fd(Date.parse(r.time))} · {r.duration_min}m</div>)}
    {ev.map(e=><div key={e.id}>🔒 {e.name} {fd(Date.parse(e.start))} → {fd(Date.parse(e.end))}</div>)}
    {!sl.length&&!rs.length&&!ev.length&&<div className="muted">Nothing scheduled</div>}</div>;
}
