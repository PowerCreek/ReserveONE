import {ReactNode} from 'react';
import {useApp} from '../state/store';
import {openWidget} from '../state/drawer';
import {Help} from './Help';
export const PANEL_IDS=['rotation','inspector','fast','simentries','queue','res','arrivals','ledger','turnover','events','staff','sections','bus','sim'];
/** Sidebar panel: collapse, pin open (📌), move to drawer (⤓). When docked in the drawer it renders bare (the drawer supplies chrome). `main` = fixed in the main area (no controls). */
export function Panel({id,title,children,main}:{id:string;title:ReactNode;children:ReactNode;main?:boolean}){
  const A=useApp(),s=A.ui[id]||{},open=!s.c||!!s.p,set=(p:{c?:boolean;p?:boolean})=>A.setUi({...A.ui,[id]:{...s,...p}});
  if(main)return <div className="panel"><div className="phead"><h3>{title}</h3><Help id={id}/></div>{children}</div>;
  if(A.drawer.ids.includes(id))return <>{children}</>;
  return <div className="panel"><div className="phead">
    <button className="pbtn" aria-expanded={open} title={s.p?'Pinned open':'Collapse / expand'} disabled={!!s.p} onClick={()=>set({c:open})}>{open?'▾':'▸'}</button>
    <h3>{title}</h3><Help id={id}/><button className="pbtn" title="Move to drawer" onClick={()=>openWidget(A,id)}>⤓</button>
    <button className={'pbtn'+(s.p?' on':'')} aria-pressed={!!s.p} title="Pin open" onClick={()=>set({p:!s.p,c:false})}>📌</button></div>{open&&children}</div>;
}
