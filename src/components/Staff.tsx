import {useState} from 'react';
import {useApp} from '../state/store';
import {Panel} from './Panel';
import {Tally} from './Tally';
import {fmtClock} from '../party';
import {rotation} from '../engines';
import {expandIds} from '../geometry';
import {Waiter} from '../types';
export function StaffPanel(){
  const A=useApp(),{data,now}=A,rank=rotation(data.waiters,data.tables,data.reservations,now);
  const [name,setName]=useState(''),[open,setOpen]=useState<string|null>(null),[blk,setBlk]=useState<string|null>(null),[to,setTo]=useState(''),[as,setAs]=useState('');
  const upd=(id:string,p:Partial<Waiter>,push=true)=>A.mutate(d=>({...d,waiters:d.waiters.map(w=>w.id===id?{...w,...p}:w)}),push);
  const busy=(id:string)=>data.tables.some(t=>t.assigned_waiter_id===id&&t.status!=='available')||data.slots.some(s=>s.status!=='COMPLETED'&&data.tables.find(t=>t.id===s.table_id)?.assigned_waiter_id===id);
  const add=()=>{if(!name.trim())return;A.mutate(d=>({...d,waiters:[...d.waiters,{id:`w_${Date.now()}`,name:name.trim(),active_cover_count:0,last_seated_at:null,section_ids:[],is_active:true,tally_covers:d.waiters.length?Math.min(...d.waiters.map(w=>w.tally_covers??0)):0}]}));setName('')};
  const drop=(id:string,mode:'reassign'|'force'|'plain')=>{
    A.mutate(d=>{const from=d.waiters.find(w=>w.id===id)!;
      const tables=d.tables.map(t=>t.assigned_waiter_id===id?{...t,assigned_waiter_id:mode==='reassign'?to:null}:t);
      const waiters=d.waiters.filter(w=>w.id!==id).map(w=>mode==='reassign'&&w.id===to?{...w,active_cover_count:w.active_cover_count+from.active_cover_count}:w);
      return{...d,tables,waiters}});setBlk(null);setOpen(null)};
  const tryRemove=(id:string)=>{if(!busy(id))return drop(id,'plain');const o=data.waiters.find(w=>w.id!==id);setTo(o?.id??'');setBlk(id)};
  const assign=(wid:string)=>{if(!A.sel.length)return A.flash('Select tables first','warn');
    A.mutate(d=>{const ids=expandIds(A.sel,d.assocs),dec=new Map<string,number>();let inc=0;
      d.slots.forEach(s=>{if(s.status==='COMPLETED'||!ids.includes(s.table_id))return;const old=d.tables.find(t=>t.id===s.table_id)?.assigned_waiter_id;if(old===wid)return;if(old)dec.set(old,(dec.get(old)??0)+s.party_size);inc+=s.party_size});
      return{...d,tables:d.tables.map(t=>ids.includes(t.id)?{...t,assigned_waiter_id:wid}:t),
        waiters:d.waiters.map(w=>w.id===wid?{...w,active_cover_count:w.active_cover_count+inc,tally_covers:(w.tally_covers??0)+inc}:dec.has(w.id)?{...w,active_cover_count:Math.max(0,w.active_cover_count-dec.get(w.id)!),tally_covers:Math.max(0,(w.tally_covers??0)-dec.get(w.id)!)}:w)}});
    A.flash('Server assigned','ok')};
  const secName=(id:string)=>data.sections.find(s=>s.id===id)?.name;
  return <Panel id="staff" title="Staff pool">
    <div className="row"><input className="inp" placeholder="New server name" value={name} onChange={e=>setName(e.target.value)}/><button className="btn" onClick={add}>Add</button></div>
    <div className="row"><button className="btn sm" title="Zero every server's tally (start of a new service)" onClick={()=>{if(confirm('Reset all cover tallies for a new service?'))A.mutate(d=>({...d,waiters:d.waiters.map(w=>({...w,tally_covers:0}))}))}}>↺ New service (reset tallies)</button></div>
    <div className="row"><select className="inp" value={as} onChange={e=>setAs(e.target.value)}><option value="">Assign selected tables to…</option>{data.waiters.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <button className="btn" disabled={!as} onClick={()=>assign(as)}>Assign</button></div>
    <div className="cards">{rank.map(({w},i)=>{
      return <div key={w.id} className="scard">
        <b>{w.name}{i===0&&<span className="badge ok" style={{marginLeft:6}}>next up</span>}</b><span className="muted">rank #{i+1} · open {w.active_cover_count}{w.skip_penalty?' · skipping':''}{w.last_seated_at?` · last ${fmtClock(Date.parse(w.last_seated_at))}`:''}</span>
        <div className="row"><Tally n={w.tally_covers??0}/><b className="nw">{w.tally_covers??0}</b><button className="btn sm" title="Correct tally −1" onClick={()=>upd(w.id,{tally_covers:Math.max(0,(w.tally_covers??0)-1)})}>−</button><button className="btn sm" title="Correct tally +1" onClick={()=>upd(w.id,{tally_covers:(w.tally_covers??0)+1})}>＋</button></div>
        <div className="row wrap">{w.section_ids.map(s=><span key={s} className="badge">{secName(s)}</span>)}{!w.section_ids.length&&<span className="badge warn" title="Only used as a fallback server">no section</span>}</div>
        <div className="row wrap">
          <button className="btn sm" onClick={()=>setOpen(open===w.id?null:w.id)}>Edit</button>
          
          <button className="btn sm" onClick={()=>upd(w.id,{skip_penalty:w.skip_penalty?0:300})}>{w.skip_penalty?'Unskip':'Skip next'}</button>
          <button className="btn sm danger" onClick={()=>tryRemove(w.id)}>Remove</button></div>
        {open===w.id&&<div className="form"><div className="row"><input className="inp" value={w.name} onFocus={()=>A.mutate(d=>({...d}),true)} onChange={e=>upd(w.id,{name:e.target.value},false)} onBlur={e=>e.target.value.trim()||upd(w.id,{name:'Server'},false)}/>
          </div>
          </div>}
        {blk===w.id&&<div className="form"><div className="muted">{w.name} still has covers/tables. Reassign first, or force remove.</div>
          <div className="row"><select className="inp" value={to} onChange={e=>setTo(e.target.value)}>{data.waiters.filter(x=>x.id!==w.id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <button className="btn" disabled={!to} onClick={()=>drop(w.id,'reassign')}>Reassign &amp; remove</button></div>
          <div className="row"><button className="btn danger" onClick={()=>drop(w.id,'force')}>Force remove</button><button className="btn" onClick={()=>setBlk(null)}>Cancel</button></div></div>}
      </div>})}</div></Panel>;
}
