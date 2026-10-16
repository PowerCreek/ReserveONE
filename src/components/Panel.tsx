import {ReactNode,useState} from 'react';
import {useApp} from '../state/store';
import {openWidget} from '../state/drawer';
import {Help} from './Help';
export const PANEL_IDS=['rotation','inspector','fast','simentries','queue','res','arrivals','ledger','turnover','events','staff','sections','bus','sim','canvas','gantt','audit','reserve'];
/** Snap stops for `sizing` panels — fixed fractions, never a free-drag pixel value ("no weird pixel counts"). Each container's own CSS decides what the fraction means via the `--panel-size` custom property this sets on the panel root (today: Canvas/Gantt's own flex-basis inside `.views`, so the PANEL's box shrinks, not just its inner content). */
const SIZE_STOPS:[number,string,string][]=[[.25,'¼','Quarter'],[1/3,'⅓','One third'],[.5,'½','Half'],[2/3,'⅔','Two thirds'],[.75,'¾','Three quarters'],[1,'1','Full (default)']];
/** Sidebar panel: collapse, pin open (📌), move to drawer (⤓). When docked in the drawer it renders bare (the drawer supplies chrome). `main` = fixed in the main area (no controls). `drawer=false` keeps collapse/pin but hides ⤓ — for main-view containers (Canvas/Gantt/Audit) that aren't registered in the drawer's widget list and would crash it if moved there. `sizing` adds a snap-fraction size picker (⇲) for large containers (Canvas/Gantt) — see SIZE_STOPS. */
export function Panel({id,title,children,main,drawer=true,sizing}:{id:string;title:ReactNode;children:ReactNode;main?:boolean;drawer?:boolean;sizing?:boolean}){
  const A=useApp(),s=A.ui[id]||{},open=!s.c||!!s.p,set=(p:{c?:boolean;p?:boolean;w?:number})=>A.setUi({...A.ui,[id]:{...s,...p}});
  const [szOpen,setSzOpen]=useState(false),sz=s.w??1;
  if(main)return <div className="panel"><div className="phead"><h3>{title}</h3><Help id={id}/></div>{children}</div>;
  if(A.drawer.ids.includes(id))return <>{children}</>;
  // below full size, pin the chosen width (flexGrow:0) so flex-grow doesn't stretch it back to fill the row when it's alone
  return <div className="panel" data-panel={id} style={sizing?({'--panel-size':sz,flexGrow:sz<1?0:undefined} as any):undefined}><div className="phead">
    <button className="pbtn" aria-expanded={open} title={s.p?'Pinned open':'Collapse / expand'} disabled={!!s.p} onClick={()=>set({c:open})}>{open?'▾':'▸'}</button>
    <h3>{title}</h3><Help id={id}/>
    {sizing&&<button className={'pbtn'+(szOpen?' on':'')} aria-expanded={szOpen} title="Panel size" onClick={()=>setSzOpen(!szOpen)}>⇲</button>}
    {drawer&&<button className="pbtn" title="Move to drawer" onClick={()=>openWidget(A,id)}>⤓</button>}
    <button className={'pbtn'+(s.p?' on':'')} aria-pressed={!!s.p} title="Pin open" onClick={()=>set({p:!s.p,c:false})}>📌</button></div>
    {sizing&&szOpen&&<div className="row wrap">{SIZE_STOPS.map(([f,l,t])=><button key={l} className={'chip sm'+(sz===f?' on':'')} title={t} onClick={()=>set({w:f})}>{l}</button>)}</div>}
    {open&&children}</div>;
}
