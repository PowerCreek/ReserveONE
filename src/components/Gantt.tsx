import {useEffect,useMemo,useRef,useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {DayNav} from './Reserve';
import {TableCard} from './Inspector';
import {isLate,fmtClock,MIN,PREP_MIN,dayStartMs} from '../party';
import {Help} from './Help';
const LW=112,HR=3600e3;
export function Gantt(){
  const A=useApp(),{data,gz,day,gint,gan,sel,today}=A,isToday=day===today;
  const start=dayStartMs(day),end=start+30*HR,ppm=60/gz,x=(ms:number)=>(ms-start)/MIN*ppm,TW=x(end),W=LW+TW;
  const [now,setNow]=useState(Date.now()),[follow,setFollow]=useState(true),[all,setAll]=useState(false),[cfg,setCfg]=useState(false),sc=useRef<HTMLDivElement>(null),prog=useRef(false);
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),Math.max(1,gint)*1000);return()=>clearInterval(i)},[gint]);
  const go=(v:number)=>{const el=sc.current;if(!el)return;prog.current=true;el.scrollLeft=v;setTimeout(()=>{prog.current=false},80)};
  useEffect(()=>{const el=sc.current;if(!el||!isToday||!follow)return;const want=x(now)-gan/100*(el.clientWidth-LW);if(Math.abs(el.scrollLeft-want)>0.01)go(want)},[now,follow,gz,gan,isToday,day]);// eslint-disable-line
  useEffect(()=>{if(!isToday)go(x(start+10*HR))},[day,gz]);// eslint-disable-line
  const ov=(a:number,b:number)=>a<end&&b>start;
  const live=data.slots.filter(s=>s.status!=='COMPLETED'&&ov(Date.parse(s.seated_at),Date.parse(s.expected_turn_at)));
  const resIn=data.reservations.filter(r=>(r.status==='BOOKED'||r.status==='ARRIVED')&&ov(Date.parse(r.time),Date.parse(r.time)+r.duration_min*MIN));
  const evIn=data.events.filter(e=>!e.reclaimed&&ov(Date.parse(e.start)-PREP_MIN*MIN,Date.parse(e.end)));
  const active=(id:string)=>live.some(s=>s.table_id===id)||resIn.some(r=>r.table_id===id)||evIn.some(e=>e.table_ids.includes(id));
  const head=useMemo(()=>{const b=gz*MIN,n=Math.round((end-start)/b);
    return Array.from({length:n},(_,i)=>{const a=start+i*b,c=live.filter(s=>{const t=Date.parse(s.expected_turn_at);return t>=a&&t<a+b}).length;
      return <div key={i} className={'gh'+(c>=3?' deluge':c===0?' drought':'')+(a+b<now?' past':'')} style={{left:i*60}}><small>{fmtClock(a)}</small><b>{c}</b></div>});
  },[gz,data.slots,start,Math.floor(now/60000)]);// eslint-disable-line
  const track=(kids:React.ReactNode)=><div className="gtrack" style={{width:TW}}>{isToday&&<div className="gpast" style={{width:Math.max(0,x(now))}}/>}{kids}</div>;
  const resBars=(rs:typeof resIn,tid?:string)=>rs.map(r=><div key={r.id} className={'gbar res'+(isLate(r,now)?' late':'')} style={{left:x(Date.parse(r.time)),width:r.duration_min*ppm}} title={`${r.name} ${r.party_size}`} onClick={()=>tid&&A.focusTable(tid)}>{r.name} · {r.party_size}</div>);
  const evBars=(id:string)=>evIn.filter(e=>e.table_ids.includes(id)).map(e=>{const a=Date.parse(e.start)-PREP_MIN*MIN;return <div key={e.id} className="gbar evt" style={{left:x(a),width:x(Date.parse(e.end))-x(a)}}>🔒 {e.name}</div>});
  const rows=data.floors.flatMap(f=>{const ts=data.tables.filter(t=>t.floor_id===f.id&&(all||active(t.id)));if(!ts.length)return [];
    return [<div key={'f'+f.id} className="grow gfloor" style={{width:W}}><div className="glabel">{f.name}</div><div style={{width:TW}}/></div>,
      ...ts.map(t=><div key={t.id} className={'grow'+(sel.includes(t.id)?' sel':'')} style={{width:W}}>
        <div className="glabel" data-tid={t.id} onClick={()=>A.focusTable(t.id)}>{t.label} <small>({t.capacity})</small></div>
        {track(<>{live.filter(s=>s.table_id===t.id).map(s=>{const a=Date.parse(s.seated_at),b=Date.parse(s.expected_turn_at);
          return <div key={s.id} className={'gbar slot'+(b<now?' past':'')} style={{left:x(a),width:Math.max(6,x(b)-x(a))}} onClick={()=>A.focusTable(t.id)}>{s.party_label} · {s.party_size}</div>})}
          {resBars(resIn.filter(r=>r.table_id===t.id),t.id)}{evBars(t.id)}</>)}</div>)]});
  const unas=resIn.filter(r=>!r.table_id),one=sel.length===1?sel[0]:null,oneT=one?data.tables.find(t=>t.id===one):null;
  return <div className="panel"><div className="toolbar scroll-x"><DayNav/></div>
    <div className="toolbar scroll-x"><Help id="gantt"/>
      {[5,10,15,30,60].map(z=><button key={z} className={'btn'+(gz===z?' on':'')} onClick={()=>A.setGz(z)}>{z===60?'1h':z+'m'}</button>)}
      <button className="btn" onClick={()=>{setFollow(false);go((sc.current?.scrollLeft??0)-60*ppm*60)}}>◀ 1h</button>
      <button className="btn" onClick={()=>{setFollow(false);go((sc.current?.scrollLeft??0)+60*ppm*60)}}>1h ▶</button>
      {isToday&&<button className={'btn'+(follow?' on':'')} onClick={()=>setFollow(true)}>{follow?'● Live':'Back to NOW'}</button>}
      <button className={'btn'+(all?' on':'')} onClick={()=>setAll(!all)}>{all?'All tables':'Active only'}</button>
      <button className={'btn'+(cfg?' on':'')} onClick={()=>setCfg(!cfg)} title="Update / slide settings">⚙</button></div>
    {cfg&&<div className="form"><div className="row wrap"><span className="muted">Update &amp; slide every</span><NumInput style={{maxWidth:80}} min={1} max={600} value={gint} label="Update seconds" onChange={A.setGint}/><span className="muted">sec</span>
      <span className="muted">NOW anchored at</span><NumInput style={{maxWidth:80}} min={0} max={100} value={gan} label="NOW anchor percent" onChange={A.setGan}/><span className="muted">% of view</span></div></div>}
    {oneT&&<div className="entry" style={{cursor:'default'}}><b>{oneT.label}</b><TableCard id={oneT.id}/></div>}
    <div className="gscroll" ref={sc} onScroll={()=>{if(!prog.current)setFollow(false)}}><div className="ginner" style={{width:W}}>{isToday&&<div className="gnowline" style={{left:LW+x(now)}}/>}
      <div className="ghead" style={{width:W}}><div className="glabel gcorner">Table</div><div className="ghcells" style={{width:TW}}>{head}{isToday&&<div className="gnowtag" style={{left:x(now)}} title="Current time">NOW {fmtClock(now)}</div>}</div></div>
      {rows}{(all||unas.length>0)&&<div className="grow gfloor" style={{width:W}}><div className="glabel">Unassigned</div>{track(resBars(unas))}</div>}
      {!rows.length&&!unas.length&&<div className="muted" style={{padding:12,position:'sticky',left:0}}>Nothing scheduled for this day. Toggle “Active only” to see all tables.</div>}</div></div></div>;
}
