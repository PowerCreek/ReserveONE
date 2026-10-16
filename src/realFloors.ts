import {Floor,Table} from './types';
import {mk} from './seed';
/** The venue's real floors/tables (from the gist floor-plan photos), added alongside the demo seed so existing seed-based tests/scenarios are untouched.
 * Sections are deliberately NOT assigned here (section_id stays null) — section data is being overhauled separately; every table below is unsectioned on purpose.
 * Positions are a left-to-right, top-to-bottom flow in the photo's reading order (not a pixel-traced copy of the photo) — tables can be dragged to taste afterward. */
type Item={id:string;label:string;cap:number;shape?:'rect'|'booth'};
/** Flows items into rows within the fixed 1200x720 canvas, wrapping when a row would overflow. Every table is 80 tall (the app's fixed table height), so row pitch is constant. */
function flow(items:Item[],fl:string):Table[]{
  const GAP=16,MARGIN=40,MAXX=1200-MARGIN,ROWH=80+GAP;
  let x=MARGIN,y=MARGIN;
  return items.map(it=>{
    const t=mk(it.id,it.label,it.cap,0,0,null,fl,it.shape??'rect');
    if(x+t.width>MAXX){x=MARGIN;y+=ROWH}
    const placed={...t,x,y};
    x+=t.width+GAP;
    return placed;
  });
}
const booth=(id:string,label:string,cap:number):Item=>({id,label,cap,shape:'booth'});
const rect=(id:string,label:string,cap:number):Item=>({id,label,cap,shape:'rect'});
// ---- Main Dining Room (gist image 1): G1-G6 booths, 1-4 booths, 5-8/13-16 two-top clusters, 9-12/17-23 four-tops, 24 a larger corner booth
const mainItems:Item[]=[
  booth('rf_g1','G1',2),booth('rf_g2','G2',2),booth('rf_g3','G3',2),booth('rf_g4','G4',2),booth('rf_g5','G5',2),booth('rf_g6','G6',2),
  booth('rf_1','1',2),booth('rf_2','2',4),booth('rf_3','3',4),booth('rf_4','4',4),
  rect('rf_5','5',2),rect('rf_6','6',2),rect('rf_7','7',2),rect('rf_8','8',2),
  rect('rf_9','9',4),rect('rf_10','10',4),rect('rf_11','11',4),rect('rf_12','12',4),
  rect('rf_13','13',2),rect('rf_14','14',2),rect('rf_15','15',2),rect('rf_16','16',2),
  rect('rf_17','17',4),rect('rf_18','18',4),rect('rf_19','19',4),rect('rf_20','20',4),rect('rf_21','21',4),rect('rf_22','22',4),rect('rf_23','23',4),
  booth('rf_24','24',6)];
// ---- Bar (gist image 2): B1-B12 booth banquette (U-shape wraparound), B14/B16 four-tops, B15 two-top, B20/B22 two-top booths, B21 four-top
const barItems:Item[]=[
  booth('rf_b1','B1',4),booth('rf_b2','B2',4),booth('rf_b3','B3',4),booth('rf_b4','B4',4),booth('rf_b5','B5',4),booth('rf_b6','B6',4),
  booth('rf_b7','B7',4),booth('rf_b8','B8',4),booth('rf_b9','B9',4),booth('rf_b10','B10',4),booth('rf_b11','B11',4),booth('rf_b12','B12',4),
  rect('rf_b14','B14',4),rect('rf_b15','B15',2),rect('rf_b16','B16',4),
  booth('rf_b20','B20',2),rect('rf_b21','B21',4),booth('rf_b22','B22',2)];
// ---- Patio (gist image 3, outdoor): the "7 table layout" — P1-P7, all four-tops
const patioItems:Item[]=[rect('rf_p1','P1',4),rect('rf_p2','P2',4),rect('rf_p3','P3',4),rect('rf_p4','P4',4),rect('rf_p5','P5',4),rect('rf_p6','P6',4),rect('rf_p7','P7',4)];
// ---- Upstairs (new): the Patio's 7-table pattern (U1-U7, four-tops) + a 6-top, a 4-top hightop, a 2-top hightop, + a 10-seat bar
const upstairsItems:Item[]=[rect('rf_u1','U1',4),rect('rf_u2','U2',4),rect('rf_u3','U3',4),rect('rf_u4','U4',4),rect('rf_u5','U5',4),rect('rf_u6','U6',4),rect('rf_u7','U7',4),
  rect('rf_u8','U8',6),rect('rf_u9','U9',4),rect('rf_u10','U10',2),rect('rf_u_bar','Bar',10)];
export function realFloors():{floors:Floor[];tables:Table[]}{
  const floors:Floor[]=[
    {id:'rf1',name:'Main Dining Room',description:'',is_active:true},
    {id:'rf2',name:'Bar',description:'',is_active:true},
    {id:'rf3',name:'Patio',description:'',is_active:true},
    {id:'rf4',name:'Upstairs',description:'',is_active:true}];
  const tables=[...flow(mainItems,'rf1'),...flow(barItems,'rf2'),...flow(patioItems,'rf3'),...flow(upstairsItems,'rf4')];
  return{floors,tables};
}
