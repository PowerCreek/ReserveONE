import {useApp} from '../state/store';
import {sectionStats} from '../sections';
import {sectionGraph} from '../blobs';
const CW=1200,CH=720,PAD=14;
/** Section bubbles: same-section tables with clear line of sight are united by thick round strokes (masked); blocked/diagonal groups are joined by dotted wires. Other-section tables are always cut out. */
export function SectionBlobs({floor}:{floor?:string}){
  const {data,floorId:cf,now,grid}=useApp(),floorId=floor??cf,tb=data.tables.filter(t=>t.floor_id===floorId),by=new Map(tb.map(t=>[t.id,t]));
  const fs=Math.max(9,12*Math.sqrt(grid/40));
  const c=(id:string)=>({x:by.get(id)!.x+by.get(id)!.width/2,y:by.get(id)!.y+by.get(id)!.height/2});
  const items=data.sections.map(s=>{const mine=tb.filter(t=>t.section_id===s.id);return{s,mine,g:mine.length?sectionGraph(mine,tb.filter(t=>t.section_id!==s.id)):null}}).filter(x=>x.g);
  return <g pointerEvents="none"><defs><pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="12" fill="rgba(245,158,11,.5)"/></pattern>
    {items.filter(x=>x.g!.comps.length>1).map(({s})=><pattern key={s.id} id={'dt_'+floorId+'_'+s.id} width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill={s.color} fillOpacity=".06"/><circle cx="4.5" cy="4.5" r="2" fill={s.color} fillOpacity=".75"/></pattern>)}
    {items.map(({s,mine,g})=><mask key={s.id} id={'bm_'+floorId+'_'+s.id} maskUnits="userSpaceOnUse" x="0" y="0" width={CW} height={CH}>
      <rect width={CW} height={CH} fill="#000"/>
      {mine.map(t=><rect key={t.id} x={t.x} y={t.y} width={t.width} height={t.height} fill="#fff" stroke="#fff" strokeWidth={2*PAD} strokeLinejoin="round"/>)}
      {g!.polys.map((p,i)=><polygon key={i} points={p.map(q=>`${q.x},${q.y}`).join(' ')} fill="#fff" stroke="#fff" strokeWidth={2*PAD} strokeLinejoin="round"/>)}
      {tb.filter(t=>t.section_id!==s.id).map(t=><rect key={t.id} x={t.x-3} y={t.y-3} width={t.width+6} height={t.height+6} rx="8" fill="#000"/>)}</mask>)}</defs>
    {items.map(({s,mine,g})=>{const st=sectionStats(s,data,now);
      return <g key={s.id}><rect width={CW} height={CH} fill={g!.comps.length>1?`url(#dt_${floorId}_${s.id})`:s.color} fillOpacity={g!.comps.length>1?1:.17} mask={`url(#bm_${floorId}_${s.id})`}/>
        {st.under&&<rect width={CW} height={CH} fill="url(#hatch)" mask={`url(#bm_${floorId}_${s.id})`}/>}
        <g className="wires">{g!.wires.map(([a,b])=><g key={a+b}><line x1={c(a).x} y1={c(a).y} x2={c(b).x} y2={c(b).y} stroke={s.color} strokeWidth="2.5" strokeDasharray="1 6" strokeLinecap="round"/>
          <circle cx={c(a).x} cy={c(a).y} r="3.5" fill={s.color}/><circle cx={c(b).x} cy={c(b).y} r="3.5" fill={s.color}/></g>)}</g>
        <text x={Math.min(...mine.map(t=>t.x))} y={Math.min(...mine.map(t=>t.y))-PAD-4} fill={st.under?'#fcd34d':s.color} fontSize={fs} fontWeight="700">{s.name}{st.under?' · UNDERFLOW':''}</text></g>})}</g>;
}
