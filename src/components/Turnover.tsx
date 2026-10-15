import {useMemo,useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {turnoverEvents,bucketTurnover,nextWindow,walkinQuote,queueOrder} from '../turnover';
import {fmtClock} from '../party';
import {Panel} from './Panel';
const IVS=Array.from({length:23},(_,i)=>10+i*5);
const s=(n:number)=>n>0?`+${n}`:n<0?`−${-n}`:'0';
/** Covers/tables in vs out per interval (observed + projected) and a two-part walk-in script: ① wait, ② turnover. */
export function Turnover(){
  const A=useApp(),{data,now}=A,[iv,setIv]=useState(15),[size,setSize]=useState(2);
  const ev=useMemo(()=>turnoverEvents(data,now),[data,now]),rows=useMemo(()=>bucketTurnover(ev,iv,now),[ev,iv,now]),nw=nextWindow(ev,now,iv);
  const q=useMemo(()=>walkinQuote(data,now,size),[data,now,size]),first=useMemo(()=>walkinQuote(data,now,1),[data,now]),qq=queueOrder(data.queue);
  const sayWait=q.none?`We don't have a single table that seats ${size}, so we'd need to combine tables and it may take longer.`:q.ready?`For a party of ${size}, we can seat you right away.`:`For a party of ${size} it's about ${q.lo}–${q.hi} minutes.`;
  const sayTurn=(nw.outT?`Over the next ${iv} minutes we expect about ${nw.outT} table${nw.outT>1?'s':''} (${nw.outC} guests) to turn over`:`No tables are expected to turn over in the next ${iv} minutes; the next one frees up ${first.ready?'right now':'around '+first.clock}`)+(nw.inT?`, with ${nw.inT} reservation${nw.inT>1?'s':''} (${nw.inC} guests) arriving in that time.`:'.');
  return <Panel id="turnover" title="Turnover & walk-in quotes">
    <div className="row wrap">{[10,15,30,45].map(k=><button key={k} className={'chip'+(iv===k?' on':'')} onClick={()=>setIv(k)}>{k}m</button>)}
      <select className="inp" style={{maxWidth:90}} value={iv} aria-label="Interval minutes" onChange={e=>setIv(+e.target.value)}>{IVS.map(k=><option key={k} value={k}>{k} min</option>)}</select></div>
    <div className="ttab"><span className="th">Interval</span><span className="th">IN cov / tbl</span><span className="th">OUT cov / tbl</span><span className="th">Net</span>
      {rows.map(r=>{const c=(x:string)=>x+(r.now?' now':'')+(r.proj?' proj':'');return <span key={r.start} style={{display:'contents'}}>
        <span className={c('tt')}>{fmtClock(r.start)}–{fmtClock(r.end)}</span><span className={c('tin')}>{r.proj?'~':''}{s(r.inC)} / {r.inT}</span><span className={c('tout')}>{r.proj?'~':''}{r.outC?`−${r.outC}`:'0'} / {r.outT}</span><span className={c('tnet')}>{s(r.net)}</span></span>})}</div>
    <div className="muted">Solid = observed · ~ italic = projected from turn times &amp; reservations</div>
    <div className="qbox"><b className="nw">① Wait · what to tell a walk-in</b>
      <div className="row wrap">{[1,2,3,4,5,6].map(n=><button key={n} className={'chip'+(size===n?' on':'')} onClick={()=>setSize(n)}>{n}</button>)}
        <NumInput min={1} max={40} style={{maxWidth:64}} value={size} label="Party size" onChange={setSize}/></div>
      <div className="row wrap"><span className={'rchip'+(q.ready?'':' warn')}>{size}-top · {q.none?'no table':q.ready?'ready now':`${q.lo}–${q.hi} min`}</span><span className="muted nw">{q.ahead} ahead</span>
        {!q.none&&q.tableId&&<button className="badge linkb" title="Show on canvas" onClick={()=>A.focusTable(q.tableId!)}>{q.label} · {q.ready?'now':q.clock}</button>}</div>
      <div className="say prose">“{sayWait}”</div></div>
    <div className="qbox"><b className="nw">② Turnover · what to expect</b>
      <div className="row wrap"><span className="rchip">next {iv}m out: {nw.outT} tbl / {nw.outC} cov</span><span className="rchip">res in: {nw.inT} / {nw.inC} cov</span><span className="rchip">queue: {qq.length} / {qq.reduce((n,x)=>n+x.party_size,0)} cov</span></div>
      <div className="say prose">“{sayTurn}”</div></div></Panel>;
}
