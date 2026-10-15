import {Table} from './types';
type P={x:number;y:number};type R={x:number;y:number;w:number;h:number};
export const SLACK=8;
const ctr=(t:Table):P=>({x:t.x+t.width/2,y:t.y+t.height/2});
/** Liang–Barsky segment/rect intersection. */
function hits(a:P,b:P,r:R){let t0=0,t1=1;const dx=b.x-a.x,dy=b.y-a.y,p=[-dx,dx,-dy,dy],q=[a.x-r.x,r.x+r.w-a.x,a.y-r.y,r.y+r.h-a.y];
  for(let i=0;i<4;i++){if(p[i]===0){if(q[i]<0)return false}else{const t=q[i]/p[i];if(p[i]<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}}return true}
const cross=(o:P,a:P,b:P)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
const corners=(t:Table):P[]=>[{x:t.x,y:t.y},{x:t.x+t.width,y:t.y},{x:t.x+t.width,y:t.y+t.height},{x:t.x,y:t.y+t.height}];
/** Convex hull (monotone chain). */
export function hull(pts:P[]):P[]{const p=[...pts].sort((a,b)=>a.x-b.x||a.y-b.y);if(p.length<3)return p;const lo:P[]=[],up:P[]=[];
  for(const q of p){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
  for(const q of [...p].reverse()){while(up.length>=2&&cross(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
  return lo.slice(0,-1).concat(up.slice(0,-1))}
export interface Graph{edges:[string,string][];comps:string[][];wires:[string,string][];polys:P[][]}
/** Line-of-sight graph over one section's tables: an edge exists when the centre-to-centre segment is not blocked by any non-member table (any distance).
 *  Connected components = bubbles. Remaining components are chained with 'wires' (nearest table pair, Prim) so the section still reads as one group. */
export function sectionGraph(mine:Table[],others:Table[]):Graph{
  const rects:R[]=others.map(t=>({x:t.x-SLACK,y:t.y-SLACK,w:t.width+2*SLACK,h:t.height+2*SLACK})),edges:[string,string][]=[],par=new Map(mine.map(t=>[t.id,t.id]));
  const find=(i:string):string=>{while(par.get(i)!==i)i=par.get(i)!;return i};
  for(let i=0;i<mine.length;i++)for(let j=i+1;j<mine.length;j++){const a=ctr(mine[i]),b=ctr(mine[j]);
    if(!rects.some(r=>hits(a,b,r))){edges.push([mine[i].id,mine[j].id]);par.set(find(mine[i].id),find(mine[j].id))}}
  const g=new Map<string,string[]>();mine.forEach(t=>{const k=find(t.id);g.set(k,[...(g.get(k)??[]),t.id])});
  const comps=[...g.values()],by=new Map(mine.map(t=>[t.id,t])),wires:[string,string][]=[];
  if(comps.length>1){const inn=[comps[0]],out=comps.slice(1);
    while(out.length){let best:{d:number;a:string;b:string;k:number}|null=null;
      for(const c of inn)for(const a of c)for(let k=0;k<out.length;k++)for(const b of out[k]){const pa=ctr(by.get(a)!),pb=ctr(by.get(b)!),d=Math.hypot(pa.x-pb.x,pa.y-pb.y);if(!best||d<best.d)best={d,a,b,k}}
      wires.push([best!.a,best!.b]);inn.push(out.splice(best!.k,1)[0])}}
  // Fill: a component whose members all see each other = ONE hull around all of them; otherwise a hull per visible pair (+ triple, small comps) so gaps between tables are filled, not just traced.
  const idx=new Map(mine.map((t,i)=>[t.id,i])),ok=mine.map(()=>mine.map(()=>false));
  edges.forEach(([a,b])=>{ok[idx.get(a)!][idx.get(b)!]=true;ok[idx.get(b)!][idx.get(a)!]=true});
  const polys:P[][]=[];
  for(const comp of comps){if(comp.length<2)continue;const ts=comp.map(id=>by.get(id)!),ix=comp.map(id=>idx.get(id)!);
    if(ix.every((a,i)=>ix.every((b,j)=>i===j||ok[a][b]))){polys.push(hull(ts.flatMap(corners)));continue}
    for(let i=0;i<ix.length;i++)for(let j=i+1;j<ix.length;j++){if(!ok[ix[i]][ix[j]])continue;polys.push(hull([...corners(ts[i]),...corners(ts[j])]));
      if(ix.length<=16)for(let l=j+1;l<ix.length;l++)if(ok[ix[i]][ix[l]]&&ok[ix[j]][ix[l]])polys.push(hull([...corners(ts[i]),...corners(ts[j]),...corners(ts[l])]))}}
  return{edges,comps,wires,polys};
}
