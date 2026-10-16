import {Data, Table, Slot} from '../src/types';
import {MIN} from '../src/party';
import {mk} from '../src/seed';
import {realFloors} from '../src/realFloors';
/** Test-only fixture: the old demo scenario (2 demo floors, pre-seated tables, reservations, queue, 4 placeholder waiters) PLUS the real venue floors —
 * this is exactly what `createSeed()` used to return before it became a clean slate for real deployment. The test suite depends on this exact rich,
 * known starting state (ids/labels/capacities/pre-seeded slots/reservations/queue) and should keep using it via `testData()`, never the production `createSeed()`. */
export function testData(now=Date.now()):Data{
  const iso=(m:number)=>new Date(now+m*MIN).toISOString();
  const tables:Table[]=[mk('t1','A1',2,40,40,'sA'),mk('t2','A2',2,80,40,'sA'),mk('t3','A3',4,200,40,'sA'),mk('t4','A4',4,320,40,'sA'),mk('t5','A5',2,440,40,'sA'),
    mk('t6','B1',4,40,200,'sB'),mk('t7','B2',4,160,200,'sB'),mk('t8','B3',6,280,200,'sB'),mk('t9','B4',8,440,200,'sB'),
    mk('t10','C1',4,40,360,'sC','f1','booth'),mk('t11','C2',4,200,360,'sC','f1','booth'),mk('t12','C3',2,360,360,'sC'),mk('t13','C4',2,440,360,'sC'),
    mk('p1','P1',2,40,40,'sD','f2'),mk('p2','P2',4,160,40,'sD','f2'),mk('p3','P3',4,320,40,'sD','f2'),mk('p4','P4',6,40,200,'sD','f2')];
  const occ=(tid:string,wid:string,label:string,pid:number,size:number,ago:number,left:number,st:'ACTIVE'|'LAPSED'='ACTIVE'):Slot=>{
    const t=tables.find(x=>x.id===tid)!;t.status=st==='LAPSED'?'lapsed':'occupied';t.assigned_waiter_id=wid;
    return{id:'s'+pid,table_id:tid,party_id:pid,party_label:label,party_size:size,seated_at:iso(-ago),expected_turn_at:iso(left),status:st};
  };
  const slots=[occ('t3','w1','HS-W-1',1,4,35,25),occ('t6','w3','HS-W-2',2,4,50,10),occ('t7','w3','HS-W-3',3,3,70,-10,'LAPSED'),occ('t10','w4','HS-W-4',4,3,20,40)];
  const rf=realFloors();
  return{floors:[{id:'f1',name:'Main',description:'Dining room',is_active:true},{id:'f2',name:'Patio',description:'Outdoor',is_active:true},...rf.floors],
    sections:[{id:'sA',name:'A',color:'#38bdf8'},{id:'sB',name:'B',color:'#a78bfa'},{id:'sC',name:'C',color:'#f472b6'},{id:'sD',name:'Patio',color:'#34d399'}],
    tables:[...tables,...rf.tables],assocs:[{id:'a1',primary_table_id:'t1',associated_table_ids:['t2'],created_at:iso(0)}],slots,
    waiters:[{id:'w1',name:'Maya',active_cover_count:4,tally_covers:12,last_seated_at:iso(-35),section_ids:['sA'],is_active:true},
      {id:'w2',name:'Dev',active_cover_count:0,tally_covers:6,last_seated_at:iso(-60),section_ids:['sB'],is_active:true},
      {id:'w3',name:'Sam',active_cover_count:7,tally_covers:14,last_seated_at:iso(-20),section_ids:['sC'],is_active:true},
      {id:'w4',name:'Lee',active_cover_count:3,tally_covers:9,last_seated_at:iso(-12),section_ids:['sD'],is_active:true}],
    reservations:[{id:'r1',party_id:5,prefix:'HS',type:'R',name:'Okafor',party_size:6,time:iso(30),duration_min:90,phone:'',notes:'',table_id:'t8',status:'BOOKED'},
      {id:'r2',party_id:6,prefix:'HS',type:'R',name:'Lindqvist',party_size:2,time:iso(-20),duration_min:60,phone:'',notes:'',table_id:null,status:'BOOKED'},
      {id:'r3',party_id:8,prefix:'HS',type:'R',name:'Tanaka',party_size:4,time:iso(26*60),duration_min:90,phone:'',notes:'Anniversary',table_id:'t3',status:'BOOKED'}],
    queue:[{id:'q1',party_id:7,prefix:'HS',type:'W',name:'Chen',party_size:2,queued_at:iso(-8),quoted_wait_min:15,notes:'',origin_reservation_id:null,status:'WAITING'}],
    nextPartyId:9,prefix:'HS',events:[],audit:[]};
}
