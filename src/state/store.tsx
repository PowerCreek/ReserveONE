import {createContext,useContext,useEffect,useReducer,useRef,useState,useCallback,ReactNode} from 'react';
import {Data,Snap,AuditEntry,Ref,Receipt} from '../types';
import {load,write,writeSim,clearSim,Prefs,Drawer} from '../storage';
import {setOffset,getOffset} from '../simclock';
import {normalizeAssociations,expandIds} from '../geometry';
import {useAlerts} from './alerts';
import {diffAudit,pushAudit} from './audit';
import {dayKey} from '../party';
type Actor='host'|'system';
interface HS{data:Data;past:Snap[];future:Snap[]}
type Act={t:'mut';fn:(d:Data)=>Data;push:boolean;at:number;actor:Actor}|{t:'undo';at:number}|{t:'redo';at:number}|{t:'log';e:AuditEntry}|{t:'reset';data:Data};
const snap=(d:Data):Snap=>({tables:d.tables,assocs:d.assocs,slots:d.slots,waiters:d.waiters,reservations:d.reservations,queue:d.queue,events:d.events});
const withAudit=(prev:Data,nd:Data,at:number,actor:Actor,note?:string):Data=>{const e=diffAudit(prev,nd,at,actor,note);return e.length?{...nd,audit:pushAudit(nd.audit??[],e)}:nd};
function red(s:HS,a:Act):HS{
  if(a.t==='reset')return{data:a.data,past:[],future:[]};
  if(a.t==='log')return{...s,data:{...s.data,audit:pushAudit(s.data.audit,[a.e])}};
  if(a.t==='mut'){const nd=a.fn(s.data);if(nd===s.data)return s;const d2=withAudit(s.data,nd,a.at,a.actor);
    return a.push?{data:d2,past:[...s.past,snap(s.data)].slice(-50),future:[]}:{...s,data:d2}}
  if(a.t==='undo'){if(!s.past.length)return s;const p=s.past[s.past.length-1];
    return{data:withAudit(s.data,{...s.data,...p},a.at,'host','undo'),past:s.past.slice(0,-1),future:[snap(s.data),...s.future].slice(0,50)}}
  if(!s.future.length)return s;const f=s.future[0];
  return{data:withAudit(s.data,{...s.data,...f},a.at,'host','redo'),past:[...s.past,snap(s.data)].slice(-50),future:s.future.slice(1)};
}
function integrity(d:Data):Data{
  const ids=new Set(d.tables.map(t=>t.id)),as=normalizeAssociations(d.tables,d.assocs);
  const rs=d.reservations.some(r=>r.table_id&&!ids.has(r.table_id))?d.reservations.map(r=>r.table_id&&!ids.has(r.table_id)?{...r,table_id:null}:r):d.reservations;
  const sl=d.slots.every(s=>ids.has(s.table_id))?d.slots:d.slots.filter(s=>ids.has(s.table_id));
  return as===d.assocs&&rs===d.reservations&&sl===d.slots?d:{...d,assocs:as,reservations:rs,slots:sl};
}
export interface Status{msg:string;tone:'ok'|'warn'|'info';k:number}
export type UiMap=Record<string,{c?:boolean;p?:boolean;w?:number}>;
export interface App{
  data:Data;mutate:(fn:(d:Data)=>Data,push?:boolean,actor?:Actor)=>void;undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean;
  sel:string[];setSel:(s:string[])=>void;floorId:string;setFloorId:(f:string)=>void;
  status:Status|null;flash:(m:string,t?:Status['tone'])=>void;setStatus:(s:Status|null)=>void;log:(m:string,note?:string)=>void;
  hl:{id:string;k:number}|null;focusTable:(id:string)=>void;
  grid:number;setGrid:(n:number)=>void;zoom:number;setZoom:(z:number)=>void;pan:{x:number;y:number};setPan:(p:{x:number;y:number})=>void;
  sim:boolean;simOffset:number;enterSim:()=>void;exitSim:(keep:boolean)=>void;advanceClock:(min:number)=>void;
  lref:{ids:string[];k:number}|null;setLref:(r:{ids:string[];k:number}|null)=>void;locOpen:boolean;setLocOpen:(b:boolean)=>void;
  rcpt:Receipt|null;setRcpt:(r:Receipt|null)=>void;receipt:(title:string,refs:Ref[])=>void;pv:string[];setPv:(s:string[])=>void;
  sound:boolean;setSound:(b:boolean)=>void;drawer:Drawer;setDrawer:(d:Drawer)=>void;editRes:string|null;setEditRes:(s:string|null)=>void;day:string;setDay:(d:string)=>void;today:string;
  gint:number;setGint:(n:number)=>void;gan:number;setGan:(n:number)=>void;ui:UiMap;setUi:(u:UiMap)=>void;
  view:string;setView:(v:string)=>void;gz:number;setGz:(n:number)=>void;rf:string;setRf:(s:string)=>void;activeR:string|null;setActiveR:(s:string|null)=>void;
  size:number;setSize:(n:number)=>void;ptype:string;setPtype:(t:string)=>void;
  seq:number[];setSeq:(s:number[])=>void;activeQ:string|null;setActiveQ:(s:string|null)=>void;now:number;
  layoutMode:boolean;setLayoutMode:(b:boolean)=>void;
}
const Ctx=createContext<App>(null as unknown as App);
export const useApp=()=>useContext(Ctx);
export function Provider({children}:{children:ReactNode}){
  const init=useRef(load()).current,p=init.prefs;
  const [hs,dispatch]=useReducer(red,{data:init.data,past:[],future:[]});
  const data=hs.data;
  const [sel,setSel]=useState<string[]>([]),[floorId,setFloor]=useState(p.floorId),[grid,setGrid]=useState(p.grid);
  const [zoom,setZoom]=useState(p.zoom),[pan,setPan]=useState(p.pan),[size,setSize]=useState(p.size),[ptype,setPtype]=useState(p.ptype);
  const [view,setView]=useState(p.view),[gz,setGz]=useState(p.gz),[rf,setRf]=useState(p.rf),[activeR,setActiveR]=useState<string|null>(null);
  const [sound,setSound]=useState(!!p.sound),[gint,setGint]=useState(p.gint),[gan,setGan]=useState(p.gan),[ui,setUi]=useState<UiMap>(p.ui||{});
  const [drawer,setDrawer]=useState<Drawer>(p.drawer),[editRes,setEditRes]=useState<string|null>(null);
  const [layoutMode,setLayoutMode]=useState(!!p.layoutMode);
  const [rcpt,setRcpt]=useState<Receipt|null>(null),[pv,setPv]=useState<string[]>([]);
  const [lref,setLref]=useState<{ids:string[];k:number}|null>(null),[locOpen,setLocOpen]=useState(false);
  const [sim,setSim]=useState<{on:boolean;snap:Data|null}>({on:!!init.sim,snap:init.sim?.snapshot??null}),[simOff,setSimOff]=useState(getOffset());
  const [seq,setSeq]=useState<number[]>([]),[activeQ,setActiveQ]=useState<string|null>(null);
  const [status,setStatus]=useState<Status|null>(null),[hl,setHl]=useState<{id:string;k:number}|null>(null),[now,setNow]=useState(Date.now());
  const [day,setDay]=useState(dayKey(Date.now()));
  const mutate=useCallback((fn:(d:Data)=>Data,push=true,actor:Actor='host')=>dispatch({t:'mut',fn,push,at:Date.now(),actor}),[]);
  const log=useCallback((msg:string,note?:string)=>{const k=Date.now();dispatch({t:'log',e:{id:`${k}-l${Math.random().toString(36).slice(2,6)}`,at:new Date(k).toISOString(),actor:'host',action:'event',entity:'ui',ref:'',label:msg,...(note?{note}:{})}})},[]);
  const flash=useCallback((msg:string,tone:Status['tone']='info')=>{const k=Date.now();setStatus({msg,tone,k});log(msg,tone);setTimeout(()=>setStatus(s=>s&&s.k===k?null:s),3000)},[log]);
  const receipt=useCallback((title:string,refs:Ref[])=>{const k=Date.now();setRcpt({k,title,refs});const tids=refs.filter(r=>r.tid).map(r=>r.tid!);setPv(tids);if(tids.length)setLref({ids:expandIds(tids,data.assocs),k});
    log(`${title}: ${refs.map(r=>`${r.label} ${r.value}`).join(' · ')}`,'receipt');setTimeout(()=>setPv([]),6000);setTimeout(()=>setRcpt(c=>c&&c.k===k?null:c),20000)},[log,data.assocs]);
  const fid=data.floors.some(f=>f.id===floorId)?floorId:data.floors[0]?.id??'';
  const focusTable=useCallback((id:string)=>{const t=data.tables.find(x=>x.id===id);if(!t)return;
    setFloor(t.floor_id);setSel([id]);const k=Date.now();setLref({ids:expandIds([id],data.assocs),k});setHl({id,k});setTimeout(()=>setHl(h=>h&&h.k===k?null:h),6000)},[data.tables,data.assocs]);
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(i)},[]);
  useEffect(()=>{const n=integrity(data);if(n!==data)mutate(()=>n,false,'system')},[data,mutate]);
  useEffect(()=>{const ids=new Set(data.tables.map(t=>t.id));if(sel.some(i=>!ids.has(i)))setSel(sel.filter(i=>ids.has(i)));
    if(activeQ&&!data.queue.some(q=>q.id===activeQ&&q.status==='WAITING'))setActiveQ(null);
    if(activeR&&!data.reservations.some(r=>r.id===activeR&&(r.status==='BOOKED'||r.status==='ARRIVED')))setActiveR(null)},[data,sel,activeQ,activeR]);
  const latest=useRef<[Data,Prefs]>(null as any);
  latest.current=[data,{grid,zoom,pan,floorId:fid,size,ptype,view,gz,rf,sound,gint,gan,ui,drawer,layoutMode}];
  const simRef=useRef(sim);simRef.current=sim;
  /** Real data -> real key; while simulating -> separate sim key (the real key keeps the pre-simulation state). */
  const persist=()=>{const [d,pf]=latest.current;simRef.current.on?writeSim({data:d,snapshot:simRef.current.snap!,offset:getOffset(),prefs:pf}):write(d,pf)};
  const enterSim=()=>{const snap:Data=JSON.parse(JSON.stringify(data));write(data,latest.current[1]);setSim({on:true,snap})};
  const exitSim=(keep:boolean)=>{if(!keep&&sim.snap)dispatch({t:'reset',data:sim.snap});setOffset(0);setSimOff(0);clearSim();setSim({on:false,snap:null});setNow(Date.now());if(keep)write(data,latest.current[1])};
  const advanceClock=(min:number)=>{setOffset(getOffset()+min*60000);setSimOff(getOffset());setNow(Date.now())};
  useEffect(()=>{const t=setTimeout(()=>persist(),250);return()=>clearTimeout(t)},[data,grid,zoom,pan,fid,size,ptype,view,gz,rf,sound,gint,gan,ui,drawer,layoutMode]);
  useEffect(()=>{const f=()=>persist(),v=()=>{if(document.visibilityState==='hidden')f()};
    window.addEventListener('pagehide',f);document.addEventListener('visibilitychange',v);
    return()=>{window.removeEventListener('pagehide',f);document.removeEventListener('visibilitychange',v)}},[]);
  useAlerts(data,now,flash,sound,mutate);
  const v:App={data,mutate,undo:()=>dispatch({t:'undo',at:Date.now()}),redo:()=>dispatch({t:'redo',at:Date.now()}),canUndo:!!hs.past.length,canRedo:!!hs.future.length,
    sel,setSel,floorId:fid,setFloorId:setFloor,status,flash,setStatus,log,hl,focusTable,grid,setGrid,zoom,setZoom,pan,setPan,sound,setSound,day,setDay,today:dayKey(now),
    gint,setGint,gan,setGan,ui,setUi,drawer,setDrawer,editRes,setEditRes,sim:sim.on,simOffset:simOff,enterSim,exitSim,advanceClock,lref,setLref,locOpen,setLocOpen,rcpt,setRcpt,receipt,pv,setPv,view,setView,gz,setGz,rf,setRf,activeR,setActiveR,size,setSize,ptype,setPtype,seq,setSeq,activeQ,setActiveQ,now,layoutMode,setLayoutMode};
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
