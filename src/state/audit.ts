import {Data,AuditEntry} from '../types';
const COLL:[keyof Data,string,(x:any)=>string][]=[['tables','table',x=>x.label],['slots','slot',x=>x.party_label],['reservations','reservation',x=>x.name],['queue','queue',x=>x.name],
  ['waiters','waiter',x=>x.name],['events','event',x=>x.name],['sections','section',x=>x.name],['floors','floor',x=>x.name],['assocs','link',()=>'link group']];
const str=(v:unknown)=>{const t=typeof v==='string'?v:JSON.stringify(v);return t===undefined?'—':t.length>28?t.slice(0,27)+'…':t};
/** Generic data-mutation audit: diffs every id-keyed collection between two states. */
export function diffAudit(a:Data,b:Data,at:number,actor:'host'|'system'='host',note?:string):AuditEntry[]{
  const out:AuditEntry[]=[],iso=new Date(at).toISOString();let n=0;
  const mk=(action:AuditEntry['action'],entity:string,ref:string,label:string,changes?:AuditEntry['changes']):AuditEntry=>({id:`${at}-${n++}`,at:iso,actor,action,entity,ref,label,...(changes?{changes}:{}),...(note?{note}:{})});
  for(const [k,ent,lab] of COLL){
    const A=a[k] as unknown as any[]|undefined,B=b[k] as unknown as any[]|undefined;if(A===B||!B)continue;
    const am=new Map((A??[]).map(x=>[x.id,x])),bm=new Map(B.map(x=>[x.id,x]));
    for(const x of B){const o=am.get(x.id);
      if(!o)out.push(mk('create',ent,x.id,lab(x)));
      else if(o!==x){const ch:NonNullable<AuditEntry['changes']>=[];for(const f of Object.keys(x))if(JSON.stringify(o[f])!==JSON.stringify(x[f]))ch.push({f,from:str(o[f]),to:str(x[f])});
        if(ch.length)out.push(mk('update',ent,x.id,lab(x),ch.slice(0,6)))}}
    for(const o of A??[])if(!bm.has(o.id))out.push(mk('delete',ent,o.id,lab(o)));
  }
  return out;
}
/** Appends entries; coalesces rapid successive updates to the same record (e.g. typing a label) keeping the original 'from'. Capped at 1500. */
export function pushAudit(list:AuditEntry[],add:AuditEntry[]):AuditEntry[]{
  let out=list;
  for(const e of add){const l=out[out.length-1];
    if(l&&e.action==='update'&&l.action==='update'&&l.entity===e.entity&&l.ref===e.ref&&l.actor===e.actor&&!e.note&&!l.note&&Date.parse(e.at)-Date.parse(l.at)<4000){
      const m=new Map((l.changes??[]).map(c=>[c.f,c]));for(const c of e.changes??[]){const p=m.get(c.f);m.set(c.f,p?{...p,to:c.to}:c)}
      const ch=[...m.values()].filter(c=>c.from!==c.to).slice(0,6);
      out=ch.length?[...out.slice(0,-1),{...l,at:e.at,label:e.label,changes:ch}]:out.slice(0,-1);
    }else out=[...out,e]}
  return out.length>1500?out.slice(-1500):out;
}
