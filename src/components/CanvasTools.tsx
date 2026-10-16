import {useEffect,useState,RefObject} from 'react';
import {useApp} from '../state/store';
import {expandIds,rotateTables,planLink,applyLink,dissolve,removeFromGroup,groupTouch} from '../geometry';
import {Help} from './Help';
type T={id:string;x:number;y:number;width:number;height:number};
/** Canvas-anchored tool palette: rotation/transform live here only (spatial, acts on the selection in place). Grouping is also offered here as a convenience — its one implementation (`groupTouch`) is shared with the sidebar Inspector.
 * Takes the ref object (not `.current`) because the svg node doesn't exist yet on Canvas's first render — reading `.current` inside the effect (after commit) is what makes it available. */
export function CanvasTools({svgRef,tables,sel,pan,zoom}:{svgRef:RefObject<SVGSVGElement|null>;tables:T[];sel:string[];pan:{x:number;y:number};zoom:number}){
  const A=useApp(),{data,flash}=A,[at,setAt]=useState<{x:number;y:number}|null>(null);
  useEffect(()=>{
    const recalc=()=>{
      const svg=svgRef.current,ts=tables.filter(t=>sel.includes(t.id));
      if(!svg||!ts.length)return setAt(null);
      const ctm=svg.getScreenCTM();if(!ctm)return setAt(null);
      const minX=Math.min(...ts.map(t=>t.x)),maxX=Math.max(...ts.map(t=>t.x+t.width)),minY=Math.min(...ts.map(t=>t.y));
      const p=new DOMPoint((minX+maxX)/2,minY).matrixTransform(ctm);
      setAt({x:p.x,y:p.y});
    };
    recalc();
    // the palette is position:fixed, projected from SVG space — a scroll on any ancestor (or a resize) moves the SVG on screen without changing sel/pan/zoom, so it must recompute (not just dismiss, unlike Help/HoverCard) to stay co-located with the selection.
    document.addEventListener('scroll',recalc,true);window.addEventListener('resize',recalc);
    return()=>{document.removeEventListener('scroll',recalc,true);window.removeEventListener('resize',recalc)};
  },[svgRef,sel,tables,pan,zoom]);
  if(!at||!sel.length)return null;
  const ids=expandIds(sel,data.assocs),gt=groupTouch(data.assocs,sel),canLink=sel.length>=2;
  const rot=()=>{const n=rotateTables(data.tables,ids,A.grid);n?A.mutate(d=>({...d,tables:n})):flash('Blocked: overlaps','warn')};
  const link=()=>{const p=planLink(data.tables,data.assocs,sel);'err' in p?flash(p.err,'warn'):A.mutate(d=>({...d,assocs:applyLink(d.assocs,p.ids)}))};
  return <div className="ctools" style={{left:at.x,top:at.y}}>
    <Help id="canvastools"/>
    <button className="btn sm" title="Rotate the selection 90°" onClick={rot}>⟳ Rotate</button>
    <button className="btn sm" disabled={!canLink} title={canLink?'Link the selection into one group':'Select 2+ tables to link'} onClick={link}>🔗 Group</button>
    {gt.touched&&!gt.full&&<button className="btn sm" title="Remove just the selected tables from their group" onClick={()=>A.mutate(d=>({...d,assocs:removeFromGroup(d.assocs,sel)}))}>Remove from Group</button>}
    {gt.touched&&<button className="btn sm" title="Disband the whole group" onClick={()=>A.mutate(d=>({...d,assocs:dissolve(d.assocs,sel)}))}>Dissolve Group</button>}
  </div>;
}
