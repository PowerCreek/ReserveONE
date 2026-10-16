import {useMemo,useState} from 'react';
import {useApp} from '../state/store';
import {NumInput} from './NumInput';
import {ledgerEvents,bucketEvents,tableStates} from '../ledger';
import {expandIds} from '../geometry';
import {fmtClock} from '../party';
import {Panel} from './Panel';
const GROUPS:[string,string][]=[['open','Open · unreserved'],['reserved','Reserved'],['seated','Seated'],['lapsed','Lapsed'],['blocked','Blocked']];
/** Vertical ledger: current state of every table + seat/clear events grouped in N-minute intervals (A3⁺⁴/B1⁻³ out). Clicking any reference cross-highlights every other reference to the same table/party in this panel, so associations don't need to be spotted by eye. */
export function Ledger(){
  const A=useApp(),{data,now,today}=A,[n,setN]=useState(15),[pick,setPick]=useState<string|null>(null);
  const rows=useMemo(()=>bucketEvents(ledgerEvents(data,today),n),[data,today,n]),st=useMemo(()=>tableStates(data,now),[data,now]);
  const pickedIds=pick?expandIds([pick],data.assocs):[],go=(tid:string)=>{setPick(tid);A.focusTable(tid)};
  return <Panel id="ledger" title="Ledger">
    <div className="row wrap">{[5,10,15,30,60].map(k=><button key={k} className={'chip'+(n===k?' on':'')} onClick={()=>setN(k)}>{k}m</button>)}
      <NumInput min={1} max={240} style={{maxWidth:70}} value={n} label="Interval minutes" onChange={setN}/></div>
    {GROUPS.map(([k,l])=>{const xs=st.filter(x=>x.state===k);return <div key={k} className="lrow"><span className="muted nw">{l} ({xs.length})</span>
      <div className="lchips">{xs.map(x=><button key={x.unit.id} className={'lchip '+k+(pickedIds.some(id=>x.unit.tableIds.includes(id))?' pick':'')} onClick={()=>go(x.unit.tableIds[0])}>{x.unit.label}{x.covers?<sup>{x.covers}</sup>:null}{k==='reserved'&&x.res?<sup>{fmtClock(Date.parse(x.res.time))}</sup>:null}</button>)}{!xs.length&&<span className="muted">—</span>}</div></div>})}
    <h3 style={{marginTop:10}}>Activity today</h3>
    {rows.slice(0,40).map(r=><div key={r.start} className="lrow"><span className="muted nw">{fmtClock(r.start)}–{fmtClock(r.end)} <b>{r.net>=0?'+':'−'}{Math.abs(r.net)}</b></span>
      <div className="lchips">{r.es.map((e,i)=><button key={i} className={'lchip '+e.kind+(pickedIds.includes(e.tid)?' pick':'')} onClick={()=>go(e.tid)}>{e.label}<sup>{e.kind==='in'?'+':'−'}{e.covers}</sup></button>)}</div></div>)}
    {!rows.length&&<div className="muted">No seatings yet today</div>}</Panel>;
}
