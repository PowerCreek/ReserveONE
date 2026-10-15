import {ReactNode} from 'react';
import {NtopWidget} from './Predictor';
import {BookWidget} from './Book';
import {Inspector} from './Inspector';
import {FastSeating} from './FastSeating';
import {QueueList,ResList} from './Reserve';
import {EventsPanel} from './Events';
import {StaffPanel} from './Staff';
import {Rotation,SectionsPanel,BusList} from './Panels';
import {Ledger} from './Ledger';
import {Turnover} from './Turnover';
import {Simulation} from './Simulation';
import {Arrivals} from './Arrivals';
import {SimEntries} from './SimEntries';
/** Widget registry. kind 'panel' = lives in sidebar or drawer (one place at a time); 'tool' = drawer-only (add/remove from the ＋ menu). */
export const WIDGETS:Record<string,{title:string;kind:'panel'|'tool';node:()=>ReactNode}>={
  ntop:{title:'N-top',kind:'tool',node:()=><NtopWidget/>},book:{title:'Book',kind:'tool',node:()=><BookWidget/>},
  rotation:{title:'Rotation',kind:'panel',node:()=><Rotation/>},inspector:{title:'Inspector',kind:'panel',node:()=><Inspector/>},fast:{title:'Fast seating',kind:'panel',node:()=><FastSeating/>},
  queue:{title:'Queue',kind:'panel',node:()=><QueueList compact/>},res:{title:'Reservations',kind:'panel',node:()=><ResList compact/>},events:{title:'Events',kind:'panel',node:()=><EventsPanel/>},
  staff:{title:'Staff',kind:'panel',node:()=><StaffPanel/>},sections:{title:'Sections',kind:'panel',node:()=><SectionsPanel/>},bus:{title:'Bus',kind:'panel',node:()=><BusList/>},ledger:{title:'Ledger',kind:'panel',node:()=><Ledger/>},turnover:{title:'Turnover',kind:'panel',node:()=><Turnover/>},sim:{title:'Simulation',kind:'panel',node:()=><Simulation/>},arrivals:{title:'Expecting',kind:'panel',node:()=><Arrivals/>},simentries:{title:'Door list',kind:'panel',node:()=><SimEntries/>}};
export const SIDE=['inspector','fast','simentries','queue','res','arrivals','ledger','turnover','events','staff','sections','bus','sim'];
