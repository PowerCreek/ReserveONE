import {useMemo} from 'react';
import {useApp} from '../state/store';
import {openWidget} from '../state/drawer';
import {buildUnits} from '../geometry';
import {planSequence} from '../predict';
import {holdsFrom,isLate,partyLabel,fmtClock,fmtWait,MIN,dayKey,dayStartMs,shiftDay,fmtDay} from '../party';
import {seatRes,seatQueue,promote,setResStatus,assignRes,resReq,queueReq,unqueue} from '../state/entries';
import {Help} from './Help';
import {SeatBtn} from './Receipt';
import {HereRow} from './Arrivals';
import {hereRes,hereQ} from '../arrivals';
import {queueOrder} from '../turnover';
import {Reservation} from '../types';
import {Panel} from './Panel';
const live=(r:Reservation)=>r.status==='BOOKED'||r.status==='ARRIVED';
const ST_ALL:[Reservation['status'],string][]=[['BOOKED','Booked'],['ARRIVED','Arrived'],['SEATED','Seated'],['NO_SHOW','No-show'],['QUEUED','Queued']];
export function DayNav(){
  const A=useApp();
  return <div className="row wrap daynav"><button className="btn sm" onClick={()=>A.setDay(shiftDay(A.day,-1))}>◀</button>
    <input className="inp" type="date" style={{maxWidth:150}} value={A.day} onChange={e=>e.target.value&&A.setDay(e.target.value)}/>
    <button className="btn sm" onClick={()=>A.setDay(shiftDay(A.day,1))}>▶</button>
    <button className={'btn sm'+(A.day===A.today?' on':'')} onClick={()=>A.setDay(A.today)}>Today</button><span className="muted">{fmtDay(A.day)}</span></div>;
}
export function ResList({compact}:{compact?:boolean}){
  const A=useApp(),{data,now,rf,day,today}=A,d0=compact?today:day;
  const all=data.reservations.filter(r=>dayKey(Date.parse(r.time))===d0).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  const list=all.filter(r=>compact?live(r):rf==='all'?true:rf==='late'?isLate(r,now):rf==='done'?!live(r):live(r)).slice(0,compact?4:300);
  const pick=(r:Reservation)=>{if(A.activeR===r.id){A.setActiveR(null);return}
    if(dayKey(Date.parse(r.time))!==today)return A.flash(`Booked for ${fmtDay(dayKey(Date.parse(r.time)))}, not today`,'warn');
    A.setActiveR(r.id);A.setActiveQ(null);if(r.table_id)A.focusTable(r.table_id)};
  const stop=(f:()=>void)=>(e:React.MouseEvent)=>{e.stopPropagation();f()};
  const book=(id:string|null)=>{A.setEditRes(id);openWidget(A,'book')};
  return <Panel id="res" main={!compact} title={<>Reservations <span className="muted">({all.length}{!compact&&day!==today?` · ${fmtDay(day)}`:''})</span></>}>
    <div className="row wrap">{!compact&&['active','late','done','all'].map(k=><button key={k} className={'chip'+(rf===k?' on':'')} onClick={()=>A.setRf(k)}>{k}</button>)}
      <button className="btn sm primary" onClick={()=>book(null)}>📖 Book</button></div>
    {list.map(r=><div key={r.id} className={'entry'+(A.activeR===r.id?' sel':'')+(isLate(r,now)?' late':'')} onClick={()=>pick(r)}>
      <b>{partyLabel(r.prefix,r.type,r.party_id)}</b><span>{r.name}</span><span>{r.party_size}-top</span><span>{fmtClock(Date.parse(r.time))}</span><span className="muted">{r.duration_min}m</span>
      {r.table_id&&<button className="badge linkb" data-tid={r.table_id} title="Show on canvas" onClick={stop(()=>A.focusTable(r.table_id!))}>{data.tables.find(t=>t.id===r.table_id)?.label}</button>}<span className="badge">{isLate(r,now)?'LATE':r.status}</span>
      {r.notes&&!compact&&<div className="muted prose">{r.notes}{r.phone&&` · ${r.phone}`}</div>}
      {(!compact||(hereRes(r)>0&&hereRes(r)<r.party_size))&&<HereRow kind="res" id={r.id} here={hereRes(r)} size={r.party_size}/>}
      <div className="row wrap statrow">{ST_ALL.map(([s,l])=><button key={s} className={'chip sm'+(r.status===s?' on':'')} aria-pressed={r.status===s}
        title={s==='SEATED'?'Status only (use Seat to actually seat)':s==='QUEUED'?'Moves to the priority queue':`Set ${l}`}
        onClick={stop(()=>{if(r.status===s)return;if(s==='QUEUED')promote(A,r);else setResStatus(A,r.id,s)})}>{l}</button>)}</div>
      <div className="row wrap">{live(r)&&<>
        
        <SeatBtn req={resReq(r)} resTable={r.table_id} off={dayKey(Date.parse(r.time))!==today?`Booked for ${fmtDay(dayKey(Date.parse(r.time)))}`:undefined} onSeat={()=>seatRes(A,r)}/>
        {isLate(r,now)&&<button className="btn sm" onClick={stop(()=>promote(A,r))}>⏫ Priority</button>}
        {!compact&&<><button className="btn sm" onClick={stop(()=>assignRes(A,r))}>{A.sel.length?'Assign':r.table_id?'Unassign':'Assign'}</button>
          </>}</>}
        
        <button className="btn sm" onClick={stop(()=>book(r.id))}>Edit</button>
        {!compact&&<button className="btn sm danger" onClick={stop(()=>A.mutate(d=>({...d,reservations:d.reservations.filter(x=>x.id!==r.id)})))}>Delete</button>}</div></div>)}
    {!list.length&&<div className="muted">None</div>}</Panel>;
}
export function QueueList({compact}:{compact?:boolean}){
  const A=useApp(),{data,now}=A;
  const w=useMemo(()=>queueOrder(data.queue),[data.queue]);
  const eta=useMemo(()=>planSequence(data,w.map(q=>q.party_size),buildUnits(data.tables,data.assocs),now,holdsFrom(data.reservations,now,data.events)).items,[data,w,now]);
  return <Panel id="queue" main={!compact} title={`Queue (${w.length})`}>
    {w.slice(0,compact?4:200).map((q,i)=><div key={q.id} className={'entry'+(A.activeQ===q.id?' sel':'')} onClick={()=>{A.setActiveQ(A.activeQ===q.id?null:q.id);A.setActiveR(null)}}>
      <b>{partyLabel(q.prefix,q.type,q.party_id)}</b><span>{q.name}</span><span>{q.party_size}-top</span><span className="muted">waiting {fmtWait((now-Date.parse(q.queued_at))/MIN)}</span>
      <span className={'badge '+(eta[i]?.ready?'ok':'warn')}>ETA {eta[i]?.code==='NO_TABLE'?'—':fmtWait(eta[i]?.wait??0)}</span>{eta[i]?.tableId&&<button className="badge linkb" data-tid={eta[i].tableId} title="Show on canvas" onClick={e=>{e.stopPropagation();A.focusTable(eta[i].tableId!)}}>{eta[i].label}</button>}
      {(!compact||hereQ(q)<q.party_size)&&<HereRow kind="queue" id={q.id} here={hereQ(q)} size={q.party_size}/>}
      <div className="row"><SeatBtn req={queueReq(q)} onSeat={()=>seatQueue(A,q)}/>
        <button className="btn sm" onClick={e=>{e.stopPropagation();A.mutate(d=>({...d,queue:d.queue.filter(x=>x.id!==q.id)}))}}>Remove</button>
        {A.sim&&<button className="btn sm" title="Simulation: send this party back to the door list" onClick={e=>{e.stopPropagation();unqueue(A,q.id)}}>↩ Door</button>}</div></div>)}
    {!w.length&&<div className="muted">Queue empty. Add walk-ins in Fast seating.</div>}</Panel>;
}
export function ReserveView(){
  const {data,now,day,today}=useApp(),isToday=day===today;
  const act=data.reservations.filter(r=>live(r)&&dayKey(Date.parse(r.time))===day),q=data.queue.filter(x=>x.status==='WAITING');
  const sorted=[...act].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)),next=isToday?sorted.find(r=>Date.parse(r.time)>=now-15*MIN):sorted[0];
  const s0=isToday?Math.floor(now/(30*MIN))*30*MIN:dayStartMs(day)+11*3600e3,cells=Array.from({length:16},(_,i)=>{const a=s0+i*30*MIN;return{a,c:act.filter(r=>{const t=Date.parse(r.time);return t>=a&&t<a+30*MIN}).reduce((s,r)=>s+r.party_size,0)}});
  const st:[string,string][]=[['Booked covers',''+act.reduce((s,r)=>s+r.party_size,0)],['Next arrival',next?fmtClock(Date.parse(next.time)):'—'],['Late',''+act.filter(r=>isLate(r,now)).length],
    ['Queue (now)',`${q.length} / ${q.reduce((s,x)=>s+x.party_size,0)} covers`],['Longest wait',q.length?fmtWait(Math.max(...q.map(x=>(now-Date.parse(x.queued_at))/MIN))):'—']];
  return <div className="rv"><div className="panel"><DayNav/></div><div className="stats">{st.map(([k,v])=><div key={k} className="panel"><div className="muted">{k}</div><b>{v}</b></div>)}</div>
    <div className="panel"><h3>Load (30 min){!isToday&&` · from ${fmtClock(s0)}`}<Help id="reserve"/></h3><div className="scroll-x row">{cells.map(c=><div key={c.a} className={'lcell'+(c.c>=8?' hot':c.c>0?' on':'')}><small>{fmtClock(c.a)}</small><b>{c.c}</b></div>)}</div></div>
    <div className="rgrid"><ResList/><QueueList/></div></div>;
}
