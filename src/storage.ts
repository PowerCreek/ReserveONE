import {Data} from './types';
import {createSeed} from './seed';
import {setOffset} from './simclock';
const KEY='host-seating-planner:v1';
/** Migrates old labels (HSW-7) to prefix-type-id (HS-W-7). Idempotent. */
export const relabel=(s:any)=>/-[WPRV]-\d+$/.test(s.party_label)?s:{...s,party_label:String(s.party_label).replace(/^(.*)([WPRV])-(\d+)$/,'$1-$2-$3').replace(/^-/,'')};
export interface Drawer{ids:string[];active:string;open:boolean}
export interface Prefs{grid:number;zoom:number;pan:{x:number;y:number};floorId:string;size:number;ptype:string;view:string;gz:number;rf:string;sound:boolean;gint:number;gan:number;ui:Record<string,{c?:boolean;p?:boolean}>;drawer:Drawer}
export const defaultPrefs=(d:Data):Prefs=>({grid:40,zoom:1,pan:{x:0,y:0},floorId:d.floors[0].id,size:2,ptype:'W',view:'canvas',gz:30,rf:'active',sound:false,gint:5,gan:20,ui:{},drawer:{ids:['ntop','book'],active:'ntop',open:true}});
export function load():{data:Data;prefs:Prefs;sim?:SimState}{
  const sim=readSim();if(sim){setOffset(sim.offset);return{data:sim.data,prefs:{...defaultPrefs(sim.data),...sim.prefs},sim}}
  try{const j=JSON.parse(localStorage.getItem(KEY)||'null');
    if(j&&j.v===1&&j.data&&['floors','sections','tables','assocs','slots','waiters','reservations','queue'].every(k=>Array.isArray(j.data[k]))){
      j.data.waiters=j.data.waiters.map((w:any)=>{const r={tally_covers:w.active_cover_count,...w};delete r.max_covers;return r});
      j.data.events=j.data.events??[];delete j.data.zones;j.data.audit=j.data.audit??[];j.data.slots=j.data.slots.map(relabel);
      return{data:j.data,prefs:{...defaultPrefs(j.data),...j.prefs}};}
  }catch{}
  const data=createSeed();return{data,prefs:defaultPrefs(data)};
}
export const write=(data:Data,prefs:Prefs)=>{try{localStorage.setItem(KEY,JSON.stringify({v:1,data,prefs}))}catch{}};
export const reset=()=>{try{localStorage.removeItem(KEY)}catch{}};

const SKEY='host-seating-planner:sim:v1';
export interface SimState{snapshot:Data;data:Data;offset:number;prefs:Prefs}
export function readSim():SimState|null{try{const j=JSON.parse(localStorage.getItem(SKEY)||'null');if(j&&j.v===1&&j.data&&j.snapshot)return j}catch{}return null}
export const writeSim=(s:SimState)=>{try{localStorage.setItem(SKEY,JSON.stringify({v:1,...s}))}catch{}};
export const clearSim=()=>{try{localStorage.removeItem(SKEY)}catch{}};
