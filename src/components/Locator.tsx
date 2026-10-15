import {useApp} from '../state/store';
import {Canvas} from './Canvas';
/** Fixed top-right pin whenever something references tables (receipts, 📍 chips, Gantt/queue/reservation table badges). Opens an interactive canvas focused on the target (whole link group outlined + arrow). */
export function LocatorWidget(){
  const A=useApp(),{data,lref,locOpen,setLocOpen}=A,ts=lref?data.tables.filter(t=>lref.ids.includes(t.id)):[];
  if(!ts.length)return null;
  const f=ts[0].floor_id,same=ts.filter(t=>t.floor_id===f),ids=same.map(t=>t.id),label=same.map(t=>t.label).join('+');
  const x0=Math.min(...same.map(t=>t.x)),x1=Math.max(...same.map(t=>t.x+t.width)),y0=Math.min(...same.map(t=>t.y)),y1=Math.max(...same.map(t=>t.y+t.height));
  const zoom=Math.min(2.2,Math.max(.6,Math.min(1200/(x1-x0+300),720/(y1-y0+300))));
  const init={zoom,pan:{x:(x0+x1)/2-600/zoom,y:(y0+y1)/2-360/zoom}},go=()=>{A.setFloorId(f);A.setSel(ids);if(A.view!=='canvas'&&A.view!=='split')A.setView('canvas');setLocOpen(false)};
  return <><div className="locator"><button className="locbtn" title="Show on canvas" onClick={()=>setLocOpen(true)}>📍 {label}</button><button className="pbtn" title="Dismiss" onClick={()=>{A.setLref(null);setLocOpen(false)}}>✕</button></div>
    {locOpen&&<div className="modal big" onClick={()=>setLocOpen(false)}><div className="panel" onClick={e=>e.stopPropagation()}>
      <div className="phead"><h3>📍 {label} · {data.floors.find(x=>x.id===f)?.name}</h3><button className="btn sm" onClick={go}>Go to canvas</button><button className="pbtn" title="Close" onClick={()=>setLocOpen(false)}>✕</button></div>
      <Canvas local floor={f} mark={ids} init={init} key={ids.join(',')}/></div></div>}</>;
}
