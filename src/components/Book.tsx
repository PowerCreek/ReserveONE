import {useEffect,useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {tableConflict,bestFit,dayLoad} from '../booking';
import {dayKey,shiftDay,fmtDay,fmtClock,partyLabel,MIN} from '../party';
import {Reservation} from '../types';
const hhmm=(ms:number)=>{const d=new Date(ms);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
type F={name:string;size:number;date:string;time:string;dur:number;phone:string;notes:string;table:string;status:Reservation['status']};
/** The single place reservations are created or edited (3-step wizard: Guest → When → Table). Lists live in the Reservations panel / Reserve view. */
export function BookWidget(){
  const A=useApp(),{data,day,today,editRes,setEditRes}=A,ed=data.reservations.find(r=>r.id===editRes);
  const blank=():F=>({name:'',size:2,date:day,time:day===today?hhmm(Math.ceil((Date.now()+3600e3)/(15*MIN))*15*MIN):'19:00',dur:90,phone:'',notes:'',table:'',status:'BOOKED'});
  const [f,setF]=useState<F>(blank),[step,setStep]=useState(1);
  useEffect(()=>{if(ed){setF({name:ed.name,size:ed.party_size,date:dayKey(Date.parse(ed.time)),time:hhmm(Date.parse(ed.time)),dur:ed.duration_min,phone:ed.phone,notes:ed.notes,table:ed.table_id??'',status:ed.status});setStep(1)}},[editRes]);// eslint-disable-line
  const set=<K extends keyof F>(k:K,v:F[K])=>setF(p=>({...p,[k]:v}));
  const ms=new Date(`${f.date}T${f.time}`).getTime(),valid=!isNaN(ms);
  const cands=data.tables.filter(t=>t.capacity>=f.size).sort((a,b)=>a.capacity-b.capacity||a.label.localeCompare(b.label)).map(t=>({t,c:valid?tableConflict(data,t.id,ms,f.dur,ed?.id):null}));
  const sel=cands.find(x=>x.t.id===f.table),load=valid?dayLoad(data,ms,ed?.id):{parties:0,covers:0};
  const nudge=(m:number)=>{const n=ms+m*MIN;setF(p=>({...p,date:dayKey(n),time:hhmm(n)}))};
  const reset=()=>{setF(blank());setStep(1);setEditRes(null)};
  const save=()=>{if(!valid)return A.flash('Pick a date and time','warn');
    const t=data.tables.find(x=>x.id===f.table);if(t&&t.capacity<f.size)return A.flash(`${t.label} seats ${t.capacity} < ${f.size}`,'warn');
    const base={name:f.name.trim()||'Guest',party_size:f.size,time:new Date(ms).toISOString(),duration_min:f.dur,phone:f.phone,notes:f.notes,table_id:f.table||null};
    if(ed)A.mutate(d=>({...d,reservations:d.reservations.map(r=>r.id===ed.id?{...r,...base,status:f.status}:r)}));
    else A.mutate(d=>({...d,nextPartyId:d.nextPartyId+1,reservations:[...d.reservations,{...base,id:'r'+Date.now(),party_id:d.nextPartyId,prefix:d.prefix,type:'R',status:'BOOKED'}]}));
    A.flash(`${ed?'Saved':'Booked'} ${base.name} · ${fmtDay(dayKey(ms))} ${fmtClock(ms)}`,'ok');reset()};
  return <div className="wizard"><div className="row wrap">{[[1,'Guest'],[2,'When'],[3,'Table']].map(([n,l])=><button key={n} className={'chip'+(step===n?' on':'')} onClick={()=>setStep(n as number)}>{n} {l}</button>)}
    <span className="badge sky">{ed?'Editing':'New'} {partyLabel(ed?.prefix??data.prefix,'R',ed?.party_id??data.nextPartyId)}</span></div>
    {step===1&&<div className="form"><div className="row"><input className="inp" placeholder="Guest name" value={f.name} onChange={e=>set('name',e.target.value)}/>
      <button className="btn" onClick={()=>set('size',Math.max(1,f.size-1))}>−</button><NumInput style={{maxWidth:64}} min={1} max={40} value={f.size} label="Party size" onChange={n=>set('size',n)}/><button className="btn" onClick={()=>set('size',f.size+1)}>＋</button></div>
      <div className="row"><input className="inp" placeholder="Phone" value={f.phone} onChange={e=>set('phone',e.target.value)}/><input className="inp" placeholder="Notes" value={f.notes} onChange={e=>set('notes',e.target.value)}/></div></div>}
    {step===2&&<div className="form"><div className="row wrap"><button className={'chip'+(f.date===today?' on':'')} onClick={()=>set('date',today)}>Today</button><button className={'chip'+(f.date===shiftDay(today,1)?' on':'')} onClick={()=>set('date',shiftDay(today,1))}>Tomorrow</button>
      <input className="inp" type="date" style={{maxWidth:160}} value={f.date} onChange={e=>e.target.value&&set('date',e.target.value)}/></div>
      <div className="row wrap"><button className="btn sm" onClick={()=>nudge(-15)}>−15m</button><input className="inp" type="time" style={{maxWidth:130}} value={f.time} onChange={e=>e.target.value&&set('time',e.target.value)}/><button className="btn sm" onClick={()=>nudge(15)}>+15m</button>
        <span className="muted nw">for</span><NumInput style={{maxWidth:80}} min={15} max={720} value={f.dur} label="Duration minutes" onChange={n=>set('dur',n)}/><span className="muted nw">min</span></div>
      <div className="muted nw">{valid?`${fmtDay(f.date)} ${fmtClock(ms)} · already booked within ±1h: ${load.parties} parties / ${load.covers} covers`:'Pick a valid date and time'}</div></div>}
    {step===3&&<div className="form"><div className="row wrap"><button className="btn sm" onClick={()=>set('table',bestFit(cands)??'')}>★ Best fit</button><button className={'chip'+(!f.table?' on':'')} onClick={()=>set('table','')}>Assign later</button>
      {cands.map(({t,c})=><button key={t.id} className={'chip'+(f.table===t.id?' on':'')+(c?' warnchip':'')} title={c??'free'} onClick={()=>set('table',t.id)}>{t.label} ({t.capacity})</button>)}</div>
      {sel?.c&&<div className="muted nw">⚠ {sel.t.label} conflicts: {sel.c}</div>}{!cands.length&&<div className="muted">No table seats {f.size}; book without a table.</div>}
      
      <div className="muted nw">{f.name.trim()||'Guest'} · {f.size}-top · {valid?`${fmtDay(f.date)} ${fmtClock(ms)}`:'—'} · {f.dur}m · {sel?sel.t.label:'no table'}</div></div>}
    <div className="row wrap">{step>1&&<button className="btn" onClick={()=>setStep(step-1)}>◂ Back</button>}{step<3&&<button className="btn" onClick={()=>setStep(step+1)}>Next ▸</button>}
      <button className="btn primary" onClick={save}>{ed?'Save changes':'Book reservation'}</button><button className="btn" onClick={reset}>{ed?'Cancel edit':'Clear'}</button></div></div>;
}
