import {useEffect,useState} from 'react';
import {useApp} from '../state/store';
import {tableInfo} from '../tableinfo';
import {fmtClock} from '../party';
/** Hover (mouse / pen) over anything tagged data-tid — canvas tables, 📍 chips, queue / reservation / Gantt table badges — to see that table's party and times. */
export function HoverCard(){
  const A=useApp(),[h,setH]=useState<{id:string;x:number;y:number}|null>(null);
  useEffect(()=>{
    const over=(e:PointerEvent)=>{if(e.pointerType==='touch')return;const el=(e.target as Element|null)?.closest?.('[data-tid]') as HTMLElement|SVGElement|null;
      if(!el)return setH(null);const r=el.getBoundingClientRect();setH({id:el.getAttribute('data-tid')!,x:Math.max(8,Math.min(r.left,window.innerWidth-268)),y:r.bottom+6>window.innerHeight-170?Math.max(8,r.top-176):r.bottom+6})};
    const off=()=>setH(null);document.addEventListener('pointerover',over);document.addEventListener('pointerdown',off);document.addEventListener('scroll',off,true);
    return()=>{document.removeEventListener('pointerover',over);document.removeEventListener('pointerdown',off);document.removeEventListener('scroll',off,true)}},[]);
  const t=h&&A.data.tables.find(x=>x.id===h.id);if(!h||!t)return null;
  const i=tableInfo(A.data,t,A.now),p=i.party,hd=i.held,c=(ms?:number)=>ms?fmtClock(ms):'—';
  return <div className="hcard" style={{left:h.x,top:h.y}} role="status"><b>{i.label} · {i.cap}-top</b> <span className={'badge '+(i.state==='open'?'ok':i.state==='held'?'sky':'warn')}>{i.state}</span>
    <div className="muted">{i.section?`section ${i.section}`:'no section'} · server {i.server??'—'}</div>
    {p&&<><div><b>{p.label}</b> {p.name} <span className="muted">({p.kind==='res'?'reservation':p.kind==='queue'?'queued walk-in':'walk-in'})</span></div>
      <div>Here {p.here}/{p.size}{p.here<p.size&&<span className="badge warn"> {p.size-p.here} to come</span>}</div>
      <div className="muted">{p.resTime?`booked ${c(p.resTime)} · `:''}arrived {c(p.arrivedAt)} · seated {c(p.seatedAt)} · turn {c(p.turnAt)}</div></>}
    {hd&&<><div>📅 <b>{hd.label}</b> {hd.name} ×{hd.size}</div><div>Here {hd.here}/{hd.size} · {c(hd.at)} · {hd.dur}m</div></>}
    {i.state==='open'&&<div className="muted">Free, nothing scheduled</div>}{i.state==='blocked'&&<div className="muted">Blocked (private event)</div>}</div>;
}
