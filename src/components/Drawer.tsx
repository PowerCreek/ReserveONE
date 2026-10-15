import {useState} from 'react';
import {useApp} from '../state/store';
import {WIDGETS} from './widgets';
import {NtopSummary} from './Predictor';
import {Help} from './Help';
import {openWidget,closeWidget} from '../state/drawer';
/** Bottom drawer of tabbed hot-widgets (sticky to viewport bottom). ＋ adds (first control); ⚙ holds per-widget options. */
export function Drawer(){
  const A=useApp(),{ids,active,open}=A.drawer,[menu,setMenu]=useState(false),[cog,setCog]=useState(false),have=ids.filter(i=>WIDGETS[i]),cur=have.includes(active)?active:have[0],W=cur?WIDGETS[cur]:null;
  const set=(p:Partial<typeof A.drawer>)=>A.setDrawer({...A.drawer,...p});
  const mv=(d:number)=>{const i=ids.indexOf(cur!),j=i+d;if(i<0||j<0||j>=ids.length)return;const n=[...ids];[n[i],n[j]]=[n[j],n[i]];set({ids:n})};
  return <div className={'dock'+(open?'':' closed')}>
    <div className="dockbar"><button className="pbtn" aria-expanded={open} title="Show / hide drawer" onClick={()=>set({open:!open})}>{open?'▾':'▴'}</button>
      <div className="dmenu"><button className="addbtn" title="Add widget" onClick={()=>{setMenu(!menu);setCog(false)}}>＋</button>
        {menu&&<div className="pop">{Object.keys(WIDGETS).filter(i=>!have.includes(i)).map(i=><button key={i} className="btn sm" onClick={()=>{openWidget(A,i);setMenu(false)}}>＋ {WIDGETS[i].title}<small className="muted"> {WIDGETS[i].kind==='panel'?'from sidebar':''}</small></button>)}
          {Object.keys(WIDGETS).every(i=>have.includes(i))&&<span className="muted">All widgets added</span>}</div>}</div>
      <div className="dtabs">{have.map(i=><button key={i} className={'chip'+(i===cur?' on':'')} onClick={()=>set({active:i,open:true})}>{WIDGETS[i].title}</button>)}</div>
      {cur&&<Help id={cur}/>}{cur==='ntop'&&<NtopSummary/>}
      {cur&&W&&<div className="dmenu cogmenu"><button className="pbtn" title="Widget options" onClick={()=>{setCog(!cog);setMenu(false)}}>⚙</button>
        {cog&&<div className="pop right"><button className="btn sm" onClick={()=>{closeWidget(A,cur);setCog(false)}}>{W.kind==='panel'?'↥ Move to sidebar':'✕ Remove from drawer'}</button>
          <button className="btn sm" disabled={ids.indexOf(cur)<=0} onClick={()=>mv(-1)}>◀ Move tab left</button><button className="btn sm" disabled={ids.indexOf(cur)>=ids.length-1} onClick={()=>mv(1)}>▶ Move tab right</button>
          <button className="btn sm" onClick={()=>{set({open:false});setCog(false)}}>▾ Collapse drawer</button></div>}</div>}</div>
    {open&&<div className="dockbody">{W&&cur?W.node():<div className="muted">Drawer is empty. Use ＋ to add widgets.</div>}</div>}</div>;
}
