import {useRef,useState,useEffect} from 'react';
/** One-line purpose of every container. ⓘ next to a title shows it; keep entries to what the thing is FOR and when to use it. */
export const HELP:Record<string,{title:string;text:string}>={
  rotation:{title:'Rotation',text:'Servers in the order they get the next party (fewest covers first; tally marks show covers served). The top card is who will be assigned next.'},
  inspector:{title:'Inspector',text:'Details and edits for the selected table(s): name, seats, section, status, links. Also what is on the table now and what is booked on it, with Clear / Unseat for a seated party. Rotate lives on the canvas tool palette next to the selection. Renaming, capacity and add/delete table are locked during service — switch to Layout Mode (header) for those.'},
  canvastools:{title:'Canvas tools',text:'Floats above the selected table(s). Rotate turns them 90°; the group buttons mirror the Inspector (handy without leaving the canvas).'},
  fast:{title:'Fast seating',text:'Seat a party now (auto-pick or the selected table), add it to the queue, or hold a table ahead. The card below the buttons says exactly which table is selected and whether it can be used. Flagging a walk-in Priority or VIP needs a short reason — Priority is for active service recovery (a mistake, an over-quoted wait, an accessibility need), VIP is a recognized guest at your discretion; both jump the queue ahead of ordinary walk-ins, Priority first.'},
  simentries:{title:'Door list',text:'Simulation only: guests at or heading to the door. Send them through the normal flow one at a time, or ⚡ seat / queue everyone who is at the door.'},
  queue:{title:'Queue',text:'Walk-ins and late reservations waiting for a table, in seating order (Priority, then VIP, then everyone else by how long they have waited), each with an ETA and the table it would get. A PRIORITY/VIP badge and its reason show on the entry so it is never a mystery why someone moved up.'},
  res:{title:'Reservations',text:'Bookings for the chosen day. Set any state, mark guests arrived, assign or hold a table, seat, or edit.'},
  arrivals:{title:'Expecting',text:'Parties where only some guests are here. Shows who is still to come and where the party is waiting or seated.'},
  ledger:{title:'Ledger',text:'Covers and tables coming in and going out per time interval, plus the current state of every table. Use it to see where the next rush or lull is.'},
  turnover:{title:'Turnover',text:'Expected table and cover turnover in the next minutes and a quote for a new walk-in of any size.'},
  events:{title:'Events',text:'Private events and buyouts: tables lock for prep before the start, warn before the end and are released automatically afterwards.'},
  staff:{title:'Staff',text:'Servers on shift: sections, status and cover tallies. Add, edit, clock in or out.'},
  sections:{title:'Sections',text:'Groups of tables served by a station. Colour blobs on the canvas show them; the minimums drive the under-flow warnings.'},
  bus:{title:'Bus priority',text:'Tables waiting to be cleared, most urgent first (waiting parties, how long dirty, next server). Use 🧹 Clear table when it is reset.'},
  sim:{title:'Simulation',text:'A role-play sandbox: snapshots the real restaurant, fills a door list, and lets you move the clock. Exiting restores the snapshot (or keeps it if you choose).'},
  ntop:{title:'N-top',text:'Tap a party size to build a sequence and see which table, server and wait each party would get. Tap a card to seat or queue it.'},
  book:{title:'Book',text:'Create or edit a reservation: date, time, length, size and an optional table hold.'},
  canvas:{title:'Floor canvas',text:'The floor plan. Tap tables to select, drag to move, pinch or wheel to zoom. Tags under a table show the seated party or the reservation holding it. ⇲ picks how much space it takes (¼ to full) in fixed steps, never a free drag.'},
  gantt:{title:'Gantt',text:'Timeline of seatings, reservations and events per table. The red NOW line follows the clock; ⚙ sets how often it slides and where it is anchored; ⇲ picks how tall the timeline is (¼ to full), in fixed steps.'},
  reserve:{title:'Reserve overview',text:'The day at a glance: booked covers, next arrival, lateness, queue length, and 30-minute load.'},
  audit:{title:'Audit log',text:'Every change made by the host or the system, newest first, with before / after values.'},
  locator:{title:'Locator',text:'Pins the tables the last action touched; tap to see them on a mini floor plan.'},
  simbar:{title:'Simulation status',text:'Shows that simulation is on and the simulated clock. Collapse it to the 🧪 icon; nothing here touches real data.'}};
/** ⓘ popover. Fixed-positioned from the button so it never clips inside scrolling panels. */
export function Help({id,className}:{id:string;className?:string}){
  const h=HELP[id],[at,setAt]=useState<{x:number;y:number;up:boolean}|null>(null),b=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!at)return;const c=(e:Event)=>{if(!b.current?.contains(e.target as Node))setAt(null)};const k=(e:KeyboardEvent)=>e.key==='Escape'&&setAt(null);
    // fixed-positioned popovers don't follow their button when a panel scrolls underneath them — close rather than let them drift off their anchor (mirrors HoverCard's scroll dismissal).
    document.addEventListener('pointerdown',c);document.addEventListener('keydown',k);document.addEventListener('scroll',c,true);
    return()=>{document.removeEventListener('pointerdown',c);document.removeEventListener('keydown',k);document.removeEventListener('scroll',c,true)}},[at]);
  if(!h)return null;
  const open=()=>{if(at)return setAt(null);const r=b.current!.getBoundingClientRect(),w=Math.min(300,window.innerWidth-16);{const up=r.bottom>window.innerHeight-200;setAt({x:Math.max(8,Math.min(r.left,window.innerWidth-w-8)),y:up?window.innerHeight-r.top+6:r.bottom+6,up})}};
  return <span className={'helpw '+(className??'')}><button ref={b} className="pbtn helpb" aria-label={`About ${h.title}`} aria-expanded={!!at} title={h.title} onClick={open}>ⓘ</button>
    {at&&<div className="helppop" role="tooltip" style={at.up?{left:at.x,bottom:at.y}:{left:at.x,top:at.y}}><b>{h.title}</b><div>{h.text}</div></div>}</span>;
}
