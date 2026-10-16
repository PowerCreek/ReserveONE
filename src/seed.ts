import {Data,Table} from './types';
import {realFloors} from './realFloors';
export const mk=(id:string,label:string,cap:number,x:number,y:number,sec:string|null,fl='f1',shape:'rect'|'booth'='rect',w=0,h=0):Table=>{
  const d=shape==='booth'?[120,80]:cap<=2?[40,80]:cap<=4?[80,80]:[Math.ceil(cap/2)*40,80];
  return{id,label,capacity:cap,min_capacity:1,x,y,width:w||d[0],height:h||d[1],shape,status:'available',assigned_waiter_id:null,section_id:sec,floor_id:fl};
};
/** Clean slate for real deployment: just the venue's 4 real floors/tables (realFloors.ts) — no demo sections/staff/seated parties/reservations/queue.
 * Sections are unassigned on purpose (being overhauled separately). The old demo scenario this used to ship lives on as `tests/fixture.ts`'s `testData()`, for the test suite only. */
export function createSeed():Data{
  const rf=realFloors();
  return{floors:rf.floors,sections:[],tables:rf.tables,assocs:[],slots:[],waiters:[],reservations:[],queue:[],nextPartyId:1,prefix:'HS',events:[],audit:[]};
}
