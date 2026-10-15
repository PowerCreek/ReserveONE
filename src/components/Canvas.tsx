import {useEffect,useRef,useState,PointerEvent as PE} from 'react';
import {useApp} from '../state/store';
import {SectionBlobs} from './Blobs';
import {snap,expandIds,tryMove,rotateTables,members,touching} from '../geometry';
import {pinchView} from '../pinch';
import {Help} from './Help';
import {tableInfo} from '../tableinfo';
import {fmtClock} from '../party';
type Pos=Record<string,{x:number;y:number}>;
type G={k:'pan'|'marq'|'press'|'drag';sx:number;sy:number;p0:{x:number;y:number};pan0:{x:number;y:number};id?:string;origin?:Pos;ids?:string[];moved?:boolean;last?:Pos;base?:string[];shift?:boolean;wasSel?:boolean};
const CW=1200,CH=720,statusFill:Record<string,string>={available:'#065f46',occupied:'#7f1d1d',lapsed:'#78350f',blocked_private:'#334155'};
const statusStroke:Record<string,string>={available:'#10b981',occupied:'#ef4444',lapsed:'#f59e0b',blocked_private:'#64748b'};
export function Canvas({local,floor,mark,init}:{local?:boolean;floor?:string;mark?:string[];init?:{zoom:number;pan:{x:number;y:number}}}={}){
  const A=useApp(),{data,sel,setSel,floorId:cf,grid,zoom:gz0,setZoom:gsz,pan:gp0,setPan:gsp,flash,setStatus,hl,pv}=A,[lz,setLz]=useState(init?.zoom??1),[lp,setLp]=useState(init?.pan??{x:0,y:0}),floorId=floor??cf,zoom=local?lz:gz0,setZoom=local?setLz:gsz,pan=local?lp:gp0,setPan=local?setLp:gsp;
  const ref=useRef<SVGSVGElement>(null),g=useRef<G|null>(null),space=useRef(false);
  const [tool,setTool]=useState<'select'|'pan'>('select'),[drag,setDrag]=useState<Pos|null>(null),[mq,setMq]=useState<{x:number;y:number;w:number;h:number}|null>(null);
  const tables=data.tables.filter(t=>t.floor_id===floorId),pos=(t:{id:string;x:number;y:number})=>drag?.[t.id]??t;
  const pt=(e:{clientX:number;clientY:number})=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(ref.current!.getScreenCTM()!.inverse());return{x:p.x,y:p.y}};
  const vw=CW/zoom,vh=CH/zoom;
  useEffect(()=>{const s=ref.current;if(!s)return;
    const w=(e:WheelEvent)=>{e.preventDefault();const p=pt(e),nz=Math.min(2.5,Math.max(.4,zoom*(e.deltaY<0?1.1:1/1.1)));
      setZoom(nz);setPan({x:p.x-(p.x-pan.x)*zoom/nz,y:p.y-(p.y-pan.y)*zoom/nz})};
    const md=(e:MouseEvent)=>{if(e.button===1)e.preventDefault()};// stops browser middle-click autoscroll escaping the canvas
    s.addEventListener('wheel',w,{passive:false});s.addEventListener('mousedown',md);s.addEventListener('auxclick',md);
    return()=>{s.removeEventListener('wheel',w);s.removeEventListener('mousedown',md);s.removeEventListener('auxclick',md)}});
  useEffect(()=>{if(!hl)return;const t=data.tables.find(x=>x.id===hl.id);if(!t||t.floor_id!==floorId)return;
    const out=t.x<pan.x||t.y<pan.y||t.x+t.width>pan.x+vw||t.y+t.height>pan.y+vh;
    if(out)setPan({x:Math.max(0,t.x+t.width/2-vw/2),y:Math.max(0,t.y+t.height/2-vh/2)})},[hl?.k]);// eslint-disable-line
  const moveSel=(dx:number,dy:number)=>{const ids=expandIds(sel,data.assocs);if(!ids.length)return;
    const n=tryMove(data.tables,ids,dx,dy);n?A.mutate(d=>({...d,tables:n})):flash('Blocked: overlaps','warn')};
  useEffect(()=>{
    if(!local&&A.locOpen)return;// popup canvas owns the keyboard while open
    const kd=(e:KeyboardEvent)=>{const el=e.target as HTMLElement;if(/INPUT|SELECT|TEXTAREA/.test(el.tagName))return;
      const m=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
      if(e.code==='Space'){space.current=true;e.preventDefault();return}
      if(m&&k==='z'){e.preventDefault();e.shiftKey?A.redo():A.undo()}
      else if(m&&k==='y'){e.preventDefault();A.redo()}
      else if(m&&k==='a'){e.preventDefault();setSel(tables.map(t=>t.id))}
      else if(k==='r'&&!m&&sel.length){const n=rotateTables(data.tables,expandIds(sel,data.assocs),grid);n?A.mutate(d=>({...d,tables:n})):flash('Blocked: overlaps','warn')}
      else if(k==='escape')setSel([]);
      else if((k==='delete'||k==='backspace')&&sel.length){const s=new Set(sel);A.mutate(d=>({...d,tables:d.tables.filter(t=>!s.has(t.id))}));setSel([])}
      else if(k.startsWith('arrow')&&sel.length){e.preventDefault();const st=e.shiftKey?1:grid;moveSel(k==='arrowleft'?-st:k==='arrowright'?st:0,k==='arrowup'?-st:k==='arrowdown'?st:0)}};
    const ku=(e:KeyboardEvent)=>{if(e.code==='Space')space.current=false};
    window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);return()=>{window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku)}});
  const ptrs=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<{d0:number;z0:number;m0:{x:number;y:number}}|null>(null);
  const down=(e:PE,id?:string)=>{
    e.stopPropagation();ref.current!.setPointerCapture(e.pointerId);ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.current.size===2){const [a,b]=[...ptrs.current.values()];g.current=null;setDrag(null);setMq(null);
      pinch.current={d0:Math.hypot(a.x-b.x,a.y-b.y)||1,z0:zoom,m0:pt({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2})};return}
    if(ptrs.current.size>2)return;
    const base={sx:e.clientX,sy:e.clientY,p0:pt(e),pan0:pan};
    if(tool==='pan'||space.current||e.button===1){g.current={...base,k:'pan'};return}
    if(id){
      const was=sel.includes(id);let ns=sel;
      if(e.shiftKey)ns=was?sel.filter(x=>x!==id):[...sel,id];else if(!was)ns=[id];
      setSel(ns);const ids=expandIds(ns,data.assocs);
      g.current={...base,k:'press',id,ids,wasSel:was,shift:e.shiftKey,origin:Object.fromEntries(data.tables.filter(t=>ids.includes(t.id)).map(t=>[t.id,{x:t.x,y:t.y}]))};
    }else g.current={...base,k:'marq',shift:e.shiftKey,base:sel};
  };
  const move=(e:PE)=>{
    if(ptrs.current.has(e.pointerId))ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch.current&&ptrs.current.size>=2){const [a,b]=[...ptrs.current.values()],r=ref.current!.getBoundingClientRect();
      const v=pinchView(pinch.current.z0,pinch.current.d0,Math.hypot(a.x-b.x,a.y-b.y),pinch.current.m0,{x:((a.x+b.x)/2-r.left)/r.width,y:((a.y+b.y)/2-r.top)/r.height},CW,CH);setZoom(v.zoom);setPan(v.pan);return}
    const s=g.current;if(!s)return;
    if(s.k==='pan'){const kk=vw/ref.current!.getBoundingClientRect().width;
      setPan({x:s.pan0.x-(e.clientX-s.sx)*kk,y:s.pan0.y-(e.clientY-s.sy)*kk})}
    else if(s.k==='marq'){const p=pt(e),r={x:Math.min(p.x,s.p0.x),y:Math.min(p.y,s.p0.y),w:Math.abs(p.x-s.p0.x),h:Math.abs(p.y-s.p0.y)};setMq(r);
      const hit=tables.filter(t=>t.x<r.x+r.w&&t.x+t.width>r.x&&t.y<r.y+r.h&&t.y+t.height>r.y).map(t=>t.id);
      setSel(s.shift?[...new Set([...(s.base||[]),...hit])]:hit)}
    else if(s.k==='press'||s.k==='drag'){
      if(s.k==='press'&&Math.hypot(e.clientX-s.sx,e.clientY-s.sy)<4)return;
      s.k='drag';const p=pt(e),o=s.origin![s.id!],ids=s.ids!;
      const dx=snap(o.x+p.x-s.p0.x,grid)-o.x,dy=snap(o.y+p.y-s.p0.y,grid)-o.y;
      for(const [mx,my] of [[dx,dy],[dx,0],[0,dy]]){const n=tryMove(data.tables,ids,mx,my);
        if(n){const np:Pos={};n.filter(t=>ids.includes(t.id)).forEach(t=>np[t.id]={x:t.x,y:t.y});s.last=np;s.moved=mx!==0||my!==0||s.moved;setDrag(np);setStatus(null);return}}
      setStatus({msg:'blocked: overlaps',tone:'warn',k:0});
    }};
  const up=(e?:PE)=>{
    if(e)ptrs.current.delete(e.pointerId);
    if(pinch.current){if(ptrs.current.size<2)pinch.current=null;g.current=null;return}
    const s=g.current;g.current=null;setMq(null);if(!s)return;
    if(s.k==='drag'&&s.last&&Object.entries(s.last).some(([i,p])=>s.origin![i].x!==p.x||s.origin![i].y!==p.y)){
      const L=s.last;A.mutate(d=>({...d,tables:d.tables.map(t=>L[t.id]?{...t,...L[t.id]}:t)}))}
    else if(s.k==='press'&&!s.shift&&s.wasSel&&sel.length>1)setSel([s.id!]);
    else if(s.k==='marq'&&!mq&&!s.shift)setSel([]);
    setDrag(null);setStatus(null)};
  const groups=data.assocs.map(a=>({a,ts:members(a).map(i=>data.tables.find(t=>t.id===i)).filter(t=>t&&t.floor_id===floorId) as typeof tables})).filter(x=>x.ts.length>1);
  return <div className="panel canvas-wrap">
    <div className="toolbar scroll-x"><Help id="canvas"/>
      <button className={'btn'+(tool==='select'?' on':'')} onClick={()=>setTool('select')}>Select</button>
      <button className={'btn'+(tool==='pan'?' on':'')} onClick={()=>setTool('pan')}>Pan</button>
      <button className="btn" onClick={()=>setZoom(Math.min(2.5,zoom*1.2))}>＋</button><button className="btn" onClick={()=>setZoom(Math.max(.4,zoom/1.2))}>－</button>
      <button className="btn" onClick={()=>{setZoom(1);setPan({x:0,y:0})}}>Fit</button>
      <select className="inp" value={A.grid} onChange={e=>A.setGrid(+e.target.value)} style={{width:84}}>{[10,20,40].map(n=><option key={n} value={n}>Grid {n}</option>)}</select>
      
    </div>
    <svg ref={ref} className="cv" viewBox={`${pan.x} ${pan.y} ${vw} ${vh}`} onPointerDown={e=>down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
      <defs><pattern id="gp" width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={`M${grid} 0H0V${grid}`} fill="none" stroke="#1e293b" strokeWidth="1"/></pattern></defs>
      <rect x="0" y="0" width={CW} height={CH} fill="url(#gp)" stroke="#334155"/><SectionBlobs floor={floorId}/>
      {tables.map(t=>{const p=pos(t),s=sel.indexOf(t.id),sec=data.sections.find(x=>x.id===t.section_id),h=hl?.id===t.id||pv.includes(t.id)||!!mark?.includes(t.id);
        return <g key={t.id} data-tid={t.id} onPointerDown={e=>down(e,t.id)} style={{cursor:tool==='pan'?'grab':'move'}}>
          <rect x={p.x} y={p.y} width={t.width} height={t.height} rx={t.shape==='booth'?14:6} fill={statusFill[t.status]} stroke={s>=0?'#38bdf8':statusStroke[t.status]} strokeWidth={s>=0?4:2}/>
          {sec&&<rect x={p.x+2} y={p.y+2} width={t.width-4} height={4} fill={sec.color}/>}
          <text x={p.x+t.width/2} y={p.y+t.height/2-2} textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="700" pointerEvents="none">{t.label}</text>
          <text x={p.x+t.width/2} y={p.y+t.height/2+14} textAnchor="middle" fill="#94a3b8" fontSize="11" pointerEvents="none">{t.capacity}-top</text>
          {s>=0&&sel.length>1&&<text x={p.x+t.width-4} y={p.y+t.height-5} textAnchor="end" fill="#38bdf8" fontSize="11" fontWeight="700" pointerEvents="none">#{s+1}</text>}
          {mark?.includes(t.id)&&<text x={p.x+t.width/2} y={p.y-10} textAnchor="middle" fill="#f59e0b" fontSize="22" pointerEvents="none">▼</text>}{h&&<rect className="pulse" x={p.x-4} y={p.y-4} width={t.width+8} height={t.height+8} rx="8" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" pointerEvents="none"/>}
        </g>})}
      {tables.map(t=>{const i=tableInfo(data,t,A.now);if(!i.owner||(!i.party&&!i.held))return null;const p=pos(t),cx=p.x+t.width/2,y=p.y+t.height+3;
        const nm=(s:string)=>s.length>10?s.slice(0,9)+'…':s,txt=i.party?`${i.party.label} · ${nm(i.party.name)} ${i.party.here<i.party.size?`${i.party.here}/${i.party.size}`:'×'+i.party.size}`:`📅 ${fmtClock(i.held!.at)} ${nm(i.held!.name)} ×${i.held!.size}`;
        const w=Math.min(200,txt.length*6.3+14),col=i.state==='lapsed'?'#f59e0b':i.party?'#ef4444':'#38bdf8';
        return <g key={'tg'+t.id} className="ttag" pointerEvents="none"><line x1={cx} y1={p.y+t.height} x2={cx} y2={y} stroke={col} strokeWidth="2"/>
          <rect x={cx-w/2} y={y} width={w} height={17} rx={8} fill="#0b1120" stroke={col} strokeWidth="1.5"/><text x={cx} y={y+12} textAnchor="middle" fill="#e2e8f0" fontSize="10.5" fontWeight="600">{txt}</text></g>})}
      {groups.map(({a,ts})=>{const P=ts.map(pos),pr=ts[0],pp=P[0];
        return <g key={a.id} pointerEvents="none"><g opacity=".35">{ts.map((t,i)=><rect key={t.id} x={P[i].x} y={P[i].y} width={t.width} height={t.height} fill="#38bdf8"/>)}</g>
          {ts.slice(1).map((t,i)=>touching({...P[i+1],width:t.width,height:t.height},{...pp,width:pr.width,height:pr.height})?null:
            <line key={t.id} x1={pp.x+pr.width/2} y1={pp.y+pr.height/2} x2={P[i+1].x+t.width/2} y2={P[i+1].y+t.height/2} stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="2 6" strokeLinecap="round"/>)}
          <text x={pp.x+2} y={pp.y-6} fill="#7dd3fc" fontSize="12" fontWeight="700">🔗 {ts.reduce((s,t)=>s+t.capacity,0)} Top</text></g>})}
      {mq&&<rect x={mq.x} y={mq.y} width={mq.w} height={mq.h} fill="rgba(56,189,248,.15)" stroke="#38bdf8" strokeDasharray="4"/>}
    </svg><div className="legend muted">{[['#10b981','available'],['#ef4444','occupied'],['#f59e0b','lapsed'],['#64748b','blocked']].map(([c,l])=><span key={l}><i style={{background:c}}/>{l}</span>)}<span>▒ blob = section (tables merge with same-section neighbours)</span></div></div>;
}
