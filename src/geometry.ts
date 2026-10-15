import {Assoc,Table,Unit,TStatus} from './types';
export const TILE=40;
type R={x:number;y:number;width:number;height:number};
export const snap=(v:number,g:number)=>Math.round(v/g)*g;
export const baseDims=(cap:number,shape:string)=>{
  if(shape==='booth')return{w:120,h:80};
  if(cap<=2)return{w:40,h:80};
  if(cap<=4)return{w:80,h:80};
  return{w:Math.ceil(cap/2)*TILE,h:80};
};
export const isRotated=(t:Table)=>{const b=baseDims(t.capacity,t.shape);return b.w!==b.h&&t.width===b.h&&t.height===b.w};
export const overlap=(a:R,b:R)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export const touching=(a:R,b:R,tol=2)=>a.x<=b.x+b.width+tol&&b.x<=a.x+a.width+tol&&a.y<=b.y+b.height+tol&&b.y<=a.y+a.height+tol;
export const members=(a:Assoc)=>[a.primary_table_id,...a.associated_table_ids];
export const expandIds=(ids:string[],assocs:Assoc[])=>{
  const s=new Set(ids);for(const a of assocs){const m=members(a);if(m.some(i=>s.has(i)))m.forEach(i=>s.add(i))}return [...s];
};
const key=(a:Assoc)=>a.id+':'+members(a).slice().sort().join(',');
/** Link groups carry no positional rules: only drops deleted tables, dissolves groups left with <2 members, and repairs a missing primary. Never splits a group because tables moved. */
export function normalizeAssociations(tables:Table[],assocs:Assoc[]):Assoc[]{
  const ids=new Set(tables.map(t=>t.id)),out:Assoc[]=[];
  for(const a of assocs){const m=members(a).filter((id,i,arr)=>ids.has(id)&&arr.indexOf(id)===i);if(m.length<2)continue;
    const p=m.includes(a.primary_table_id)?a.primary_table_id:m[0];out.push({...a,primary_table_id:p,associated_table_ids:m.filter(x=>x!==p)})}
  return out.map(key).sort().join('|')===assocs.map(key).sort().join('|')?assocs:out;
}
const prec:TStatus[]=['blocked_private','occupied','lapsed','available'];
export function buildUnits(tables:Table[],assocs:Assoc[]):Unit[]{
  const by=new Map(tables.map(t=>[t.id,t])),used=new Set<string>(),out:Unit[]=[];
  const mk=(id:string,ts:Table[]):Unit=>({id,tableIds:ts.map(t=>t.id),label:ts.map(t=>t.label).join('+'),capacity:ts.reduce((s,t)=>s+t.capacity,0),
    status:prec.find(p=>ts.some(t=>t.status===p))!,floor_id:ts[0].floor_id,sectionId:ts[0].section_id});
  for(const a of assocs){const ts=members(a).map(i=>by.get(i)).filter(Boolean) as Table[];if(ts.length<2)continue;ts.forEach(t=>used.add(t.id));out.push(mk(a.id,ts))}
  for(const t of tables)if(!used.has(t.id))out.push(mk(t.id,[t]));
  return out;
}
/** Move set by (dx,dy); returns null on collision with non-moving tables on same floor. */
export function tryMove(tables:Table[],ids:string[],dx:number,dy:number):Table[]|null{
  const mv=new Set(ids),moved=tables.map(t=>mv.has(t.id)?{...t,x:t.x+dx,y:t.y+dy}:t);
  for(const t of moved)if(mv.has(t.id)&&(t.x<0||t.y<0||moved.some(o=>!mv.has(o.id)&&o.floor_id===t.floor_id&&overlap(t,o))))return null;
  return moved;
}
export function rotateTables(tables:Table[],ids:string[],grid:number):Table[]|null{
  const s=new Set(ids),out=tables.map(t=>{if(!s.has(t.id))return t;const cx=t.x+t.width/2,cy=t.y+t.height/2;
    return{...t,width:t.height,height:t.width,x:Math.max(0,snap(cx-t.height/2,grid)),y:Math.max(0,snap(cy-t.width/2,grid))}});
  for(const t of out)if(s.has(t.id)&&out.some(o=>o.id!==t.id&&o.floor_id===t.floor_id&&overlap(t,o)))return null;
  return out;
}
export function setCapacity(tables:Table[],id:string,cap:number):Table[]|null{
  const t=tables.find(x=>x.id===id);if(!t)return null;
  const max=t.shape==='booth'?6:20;cap=Math.max(1,Math.min(max,cap));
  const rot=isRotated(t),b=baseDims(cap,t.shape),n={...t,capacity:cap,width:rot?b.h:b.w,height:rot?b.w:b.h};
  if(tables.some(o=>o.id!==id&&o.floor_id===t.floor_id&&overlap(n,o)))return null;
  return tables.map(x=>x.id===id?n:x);
}
export function findSpot(tables:Table[],floor:string,w:number,h:number,W=1200,H=720){
  const fl=tables.filter(t=>t.floor_id===floor);
  for(let y=40;y<H;y+=40)for(let x=40;x<W-w;x+=40)if(!fl.some(o=>overlap({x,y,width:w,height:h},o)))return{x,y};
  return{x:40,y:40};
}
/** Any tables can be linked regardless of distance; only constraint is same floor (units/canvas are per floor). */
export function planLink(tables:Table[],assocs:Assoc[],sel:string[]):{ids:string[]}|{err:string}{
  const ids=expandIds(sel,assocs);if(ids.length<2)return{err:'Select 2+ tables to link'};
  if(new Set(ids.map(i=>tables.find(t=>t.id===i)?.floor_id)).size>1)return{err:'Linked tables must be on the same floor'};
  return{ids:sel.filter(i=>ids.includes(i)).concat(ids.filter(i=>!sel.includes(i)))};
}
export const applyLink=(assocs:Assoc[],ids:string[]):Assoc[]=>{
  const s=new Set(ids),rest=assocs.filter(a=>!members(a).some(m=>s.has(m)));
  return [...rest,{id:'a_'+Date.now(),primary_table_id:ids[0],associated_table_ids:ids.slice(1),created_at:new Date().toISOString()}];
};
export const dissolve=(assocs:Assoc[],sel:string[])=>assocs.filter(a=>!members(a).some(m=>sel.includes(m)));
export const removeFromGroup=(assocs:Assoc[],sel:string[])=>assocs.map(a=>{
  const m=members(a).filter(x=>!sel.includes(x));return m.length===members(a).length?a:{...a,primary_table_id:m[0]??a.primary_table_id,associated_table_ids:m.slice(1)}});
