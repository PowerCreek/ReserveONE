import {useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {genDoorWalkins,genArrivals,genReservations,fillSeated,settleOverdue,genStarter} from '../sim';
import {fmtClock} from '../party';
import {Panel} from './Panel';
/** Role-play sandbox. Entering snapshots the real state, auto-fills the Door list, and saves everything separately (discarded on exit). Generators are parameter-driven + seeded. */
export function Simulation(){
  const A=useApp(),{sim,simOffset,now}=A,[seed,setSeed]=useState(()=>Date.now()%100000),[auto,setAuto]=useState(true);
  const [w,setW]=useState({count:6,min:1,max:6,spread:40,partial:30}),[ar,setAr]=useState({win:90,partial:40,noshow:10}),[r,setR]=useState({count:6,min:2,max:6,from:30,to:180,dur:90,assign:true}),[f,setF]=useState({pct:60,min:1,max:6});
  const nx=()=>{const s=seed;setSeed(seed+1);return s};
  const num=(label:string,v:number,on:(n:number)=>void,lo:number,hi:number)=><label className="nw"><span className="muted">{label} </span><NumInput style={{maxWidth:64}} min={lo} max={hi} value={v} label={label} onChange={on}/></label>;
  const adv=(min:number)=>{A.advanceClock(min);if(auto){const t=Date.now();A.mutate(d=>settleOverdue(d,t))}A.flash(`Clock +${min} min${auto?' · overdue tables cleared':''}`,'info')};
  if(!sim)return <Panel id="sim" title="Simulation"><div className="muted prose">Role-play with the system: snapshot the current restaurant, then work a Door list of walk-ins and reservation arrivals (some arriving in waves) through the normal flow, fill the dining room, and move the clock. Nothing is saved to your real data; exiting restores the snapshot.</div>
    <button className="btn primary" onClick={()=>{A.enterSim();A.mutate(d=>genStarter(d,Date.now(),seed),false)}}>🧪 Enter simulation</button></Panel>;
  return <Panel id="sim" title={<>Simulation <span className="badge warn">ON</span></>}>
    <div className="row wrap"><span className="rchip warn">Clock {simOffset?`+${Math.round(simOffset/60000)} min`:'live'} · {fmtClock(now)}</span><span className="muted nw">seed</span>
      <NumInput style={{maxWidth:84}} min={0} max={99999999} value={seed} label="Seed" onChange={setSeed}/><button className="btn sm" title="Random seed" onClick={()=>setSeed(Math.floor(Math.random()*1e5))}>🎲</button></div>
    <div className="qbox"><b className="nw">Door entries · walk-ins</b><div className="row wrap">{num('count',w.count,n=>setW({...w,count:n}),1,40)}{num('min size',w.min,n=>setW({...w,min:n}),1,20)}{num('max size',w.max,n=>setW({...w,max:n}),1,20)}{num('spread min',w.spread,n=>setW({...w,spread:n}),0,240)}{num('partial %',w.partial,n=>setW({...w,partial:n}),0,100)}</div>
      <button className="btn" onClick={()=>{A.mutate(d=>genDoorWalkins(d,Date.now(),{count:w.count,minSize:w.min,maxSize:w.max,spread:w.spread,partialPct:w.partial,seed:nx()}),false);A.flash(`Added ${w.count} walk-ins to the Door list`,'ok')}}>Generate door entries</button></div>
    <div className="qbox"><b className="nw">Door entries · reservation arrivals</b><div className="row wrap">{num('window min',ar.win,n=>setAr({...ar,win:n}),5,600)}{num('arrive in waves %',ar.partial,n=>setAr({...ar,partial:n}),0,100)}{num('no-show %',ar.noshow,n=>setAr({...ar,noshow:n}),0,100)}</div>
      <button className="btn" onClick={()=>{A.mutate(d=>genArrivals(d,Date.now(),{windowMin:ar.win,partialPct:ar.partial,noShowPct:ar.noshow,seed:nx()}),false);A.flash('Reservation arrivals added to the Door list','ok')}}>Generate arrivals</button></div>
    <div className="qbox"><b className="nw">Reservations</b><div className="row wrap">{num('count',r.count,n=>setR({...r,count:n}),1,40)}{num('min size',r.min,n=>setR({...r,min:n}),1,20)}{num('max size',r.max,n=>setR({...r,max:n}),1,20)}{num('from +min',r.from,n=>setR({...r,from:n}),0,600)}{num('to +min',r.to,n=>setR({...r,to:n}),0,900)}{num('length',r.dur,n=>setR({...r,dur:n}),30,240)}</div>
      <label className="nw"><input type="checkbox" checked={r.assign} onChange={e=>setR({...r,assign:e.target.checked})}/> assign best-fit tables</label>
      <button className="btn" onClick={()=>{A.mutate(d=>genReservations(d,Date.now(),{count:r.count,minSize:r.min,maxSize:r.max,fromMin:r.from,toMin:Math.max(r.from,r.to),duration:r.dur,assign:r.assign,seed:nx()}));A.flash(`Added ${r.count} reservations`,'ok')}}>Add reservations</button></div>
    <div className="qbox"><b className="nw">Dining room</b><div className="row wrap">{num('fill %',f.pct,n=>setF({...f,pct:n}),5,100)}{num('min size',f.min,n=>setF({...f,min:n}),1,20)}{num('max size',f.max,n=>setF({...f,max:n}),1,20)}</div>
      <button className="btn" onClick={()=>{A.mutate(d=>fillSeated(d,Date.now(),{pct:f.pct,minSize:f.min,maxSize:f.max,seed:nx()}));A.flash(`Seated parties up to ${f.pct}% of tables (smart allocator)`,'ok')}}>Fill dining room</button></div>
    <div className="qbox"><b className="nw">Clock</b><div className="row wrap">{[5,15,30,60].map(m=><button key={m} className="btn sm" onClick={()=>adv(m)}>+{m} min</button>)}</div>
      <label className="nw"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> staff clear overdue tables as time passes</label></div>
    <div className="row wrap"><button className="btn primary" onClick={()=>A.exitSim(false)}>Exit &amp; discard</button>
      <button className="btn" disabled={simOffset!==0} title={simOffset?'Not available after moving the clock':'Adopt the simulated state as real data'} onClick={()=>A.exitSim(true)}>Exit &amp; keep</button></div></Panel>;
}
