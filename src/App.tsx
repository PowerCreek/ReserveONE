import {Fragment} from 'react';
import {Provider,useApp} from './state/store';
import {Canvas} from './components/Canvas';
import {Gantt} from './components/Gantt';
import {ReserveView} from './components/Reserve';
import {AuditView} from './components/Audit';
import {Drawer} from './components/Drawer';
import {ReceiptBar} from './components/Receipt';
import {FixedTop} from './components/FixedTop';
import {HoverCard} from './components/HoverCard';
import {WIDGETS,SIDE} from './components/widgets';
import {openWidget,closeWidget} from './state/drawer';
import {isLate} from './party';
import {Header,StatusSlot,FloorNav} from './components/Panels';
function Body(){
  const A=useApp(),v=A.view,late=A.data.reservations.filter(r=>isLate(r,A.now)).length,docked=(id:string)=>A.drawer.ids.includes(id);
  const tabs:[string,string][]=[['canvas','Canvas'],['gantt','Gantt'],['split','Split'],['reserve','Reserve'+(late?` (${late})`:'')],['audit','Audit']];
  /** Docked panels leave a stub where they were, so there is always a visible way back. */
  const stub=(id:string)=><div key={id} className="stub"><b className="nw">{WIDGETS[id].title}</b><span className="muted nw">in drawer</span>
    <button className="btn sm" onClick={()=>openWidget(A,id)}>Open</button><button className="btn sm" onClick={()=>closeWidget(A,id)}>↥ Restore</button></div>;
  return <div className="app"><Header/><FloorNav/>{docked('rotation')?stub('rotation'):WIDGETS.rotation.node()}
    <div className="main"><div className="left"><div className="row seg"><div className="scroll-x row" style={{margin:0}}>{tabs.map(([k,l])=><button key={k} className={'btn'+(v===k?' on':'')} onClick={()=>A.setView(k)}>{l}</button>)}</div><StatusSlot/></div><ReceiptBar/>
      {(v==='canvas'||v==='split')&&<Canvas/>}{(v==='gantt'||v==='split')&&<Gantt/>}{v==='reserve'&&<ReserveView/>}{v==='audit'&&<AuditView/>}</div>
      <div className="side">{SIDE.filter(id=>!(v==='reserve'&&(id==='queue'||id==='res'))).map(id=>docked(id)?stub(id):<Fragment key={id}>{WIDGETS[id].node()}</Fragment>)}</div></div>
    <Drawer/><FixedTop/><HoverCard/></div>;
}
export default function App(){return <Provider><Body/></Provider>}
