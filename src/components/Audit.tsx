import {useMemo,useState} from 'react';
import {useApp} from '../state/store';
import {AuditEntry} from '../types';
import {dayKey,fmtDay} from '../party';
import {fieldLabel,humanValue} from '../auditfmt';
import {Help} from './Help';
const ENTS=['all','table','slot','reservation','queue','waiter','event','section','floor','link','ui'];
const txt=(e:AuditEntry)=>`${e.entity} ${e.action} ${e.label} ${e.note??''} ${(e.changes??[]).map(c=>`${c.f} ${c.from} ${c.to}`).join(' ')}`.toLowerCase();
export function AuditView(){
  const A=useApp(),{data,today}=A,[ent,setEnt]=useState('all'),[q,setQ]=useState(''),[lim,setLim]=useState(100);
  const list=useMemo(()=>[...data.audit].reverse().filter(e=>(ent==='all'||e.entity===ent)&&(!q||txt(e).includes(q.toLowerCase()))),[data.audit,ent,q]);
  const copy=()=>{try{navigator.clipboard.writeText(JSON.stringify(list.slice(0,500).reverse(),null,1)).then(()=>A.flash('Audit copied','ok'),()=>A.flash('Clipboard blocked by browser','warn'))}catch{A.flash('Clipboard unavailable','warn')}};
  return <div className="panel"><h3>Audit log <span className="muted">({data.audit.length} entries, newest first)</span><Help id="audit"/></h3>
    <div className="row wrap">{ENTS.map(k=><button key={k} className={'chip'+(ent===k?' on':'')} onClick={()=>setEnt(k)}>{k}</button>)}</div>
    <div className="row"><input className="inp" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/><button className="btn sm" onClick={copy}>Copy JSON</button>
      <button className="btn sm danger" onClick={()=>{if(confirm('Clear the whole audit log?')){A.mutate(d=>({...d,audit:[]}),false);A.log('Audit log cleared')}}}>Clear</button></div>
    <div className="alist">{list.slice(0,lim).map(e=>{const ms=Date.parse(e.at);return <div key={e.id} className="entry arow" style={{cursor:'default'}}>
      <span className="muted">{dayKey(ms)===today?'':fmtDay(dayKey(ms))+' '}{new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'})}</span>
      <span className={'badge '+(e.actor==='system'?'sky':'')}>{e.actor}</span><span className={'badge '+(e.action==='delete'?'late':e.action==='create'?'ok':'')}>{e.action}</span>
      <span className="badge">{e.entity}</span>{e.note&&<span className="badge warn">{e.note}</span>} <b>{e.label}</b>
      {e.changes?.map((c,i)=><span key={i} className="muted">{fieldLabel(c.f)}: {humanValue(c.f,c.from,data)} → {humanValue(c.f,c.to,data)}</span>)}</div>})}
      {!list.length&&<div className="muted">No entries</div>}{list.length>lim&&<button className="btn sm" onClick={()=>setLim(lim+200)}>Show more ({list.length-lim})</button>}</div></div>;
}
