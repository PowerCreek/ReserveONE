import {PType,Reservation} from './types';
export const MIN=60000;
export const sanitizePrefix=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
export const partyLabel=(prefix:string,type:PType,id:number)=>[prefix,type,id].filter(x=>x!=='').join('-');
export const fmtClock=(ms:number)=>new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
export const fmtWait=(m:number)=>m<=0?'Now':m<60?`${Math.round(m)}m`:`${Math.floor(m/60)}h${Math.round(m%60)?Math.round(m%60)+'m':''}`;
export const isLate=(r:Reservation,now:number)=>r.status==='BOOKED'&&now-Date.parse(r.time)>15*MIN;
export const loc=(ms:number)=>new Date(ms-new Date(ms).getTimezoneOffset()*60000).toISOString().slice(0,16);
export const PREP_MIN=30;
type Ev={table_ids:string[];start:string;end:string;reclaimed:boolean};
/** Holds from reservations + private events (event hold starts PREP_MIN early). */
export function holdsFrom(rs:Reservation[],now:number,evs:Ev[]=[]){
  const r=rs.filter(r=>r.table_id&&(r.status==='ARRIVED'||(r.status==='BOOKED'&&now-Date.parse(r.time)<=15*MIN)))
    .map(r=>({table_id:r.table_id!,start:Date.parse(r.time),end:Date.parse(r.time)+r.duration_min*MIN}));
  const e=evs.filter(x=>!x.reclaimed).flatMap(x=>x.table_ids.map(id=>({table_id:id,start:Date.parse(x.start)-PREP_MIN*MIN,end:Date.parse(x.end)})));
  return [...r,...e];
}
export const dayKey=(ms:number)=>{const d=new Date(ms);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const dayStartMs=(k:string)=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).getTime()};
export const shiftDay=(k:string,n:number)=>dayKey(dayStartMs(k)+n*86400000+12*3600000);
export const fmtDay=(k:string)=>new Date(dayStartMs(k)).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
