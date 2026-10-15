import {build} from 'esbuild';
await build({entryPoints:['tests/entry.ts'],bundle:true,format:'esm',platform:'node',outfile:'tests/.u.mjs',logLevel:'silent'});
const m=await import('./.u.mjs');let bad=0;const t=(n,c)=>{if(!c)bad++;console.log(c?'PASS':'FAIL',n)};
const MIN=60000,iso=ms=>new Date(ms).toISOString(),N=Date.now();
t('label HS-W-7',m.partyLabel('HS','W',7)==='HS-W-7');t('label empty prefix W-7',m.partyLabel('','W',7)==='W-7');
t('relabel HSW-7',m.relabel({party_label:'HSW-7'}).party_label==='HS-W-7');t('relabel idempotent',m.relabel({party_label:'HS-W-7'}).party_label==='HS-W-7');t('relabel WWW-3',m.relabel({party_label:'WWW-3'}).party_label==='WW-W-3');
t('dayKey/shiftDay roundtrip',m.shiftDay(m.shiftDay('2026-03-08',1),-1)==='2026-03-08'&&m.shiftDay('2026-12-31',1)==='2027-01-01');
const ev=(s,e)=>({id:'e1',name:'X',table_ids:['t13'],start:iso(s),end:iso(e),locked_ids:[],reclaimed:false}),e=ev(N+100*MIN,N+220*MIN);
t('state PENDING',m.eventState(e,N)==='RESERVED_PENDING');t('state PREP',m.eventState(e,N+71*MIN)==='BLOCKED_PREP');t('state ACTIVE',m.eventState(e,N+101*MIN)==='ACTIVE_EVENT');t('state EXPIRING',m.eventState(e,N+210*MIN)==='EXPIRING_WARNING');t('state EXPIRED',m.eventState(e,N+221*MIN)==='EXPIRED_RECLAIMED');
const d0=m.createSeed(N),d1={...d0,events:[ev(N+10*MIN,N+100*MIN)]},r1=m.reconcile(d1,N),tb=x=>x.tables.find(q=>q.id==='t13');
t('prep locks',tb(r1).status==='blocked_private');t('idempotent',m.reconcile(r1,N)===r1);t('expiry reclaims',tb(m.reconcile(r1,N+101*MIN)).status==='available');
t('auto-lapse',m.reconcile(d0,N+30*MIN).slots.find(s=>s.id==='s1').status==='LAPSED');
t('event hold -30m',m.holdsFrom([],N,[ev(N+100*MIN,N+220*MIN)])[0].start===N+70*MIN);
const sec=id=>d0.sections.find(s=>s.id===id);
t('section D (empty patio) underflow',m.sectionStats(sec('sD'),d0,N).under);t('section B not underflow',!m.sectionStats(sec('sB'),d0,N).under);t('section stats count',m.sectionStats(sec('sA'),d0,N).n===5);
const us=m.buildUnits(d0.tables,d0.assocs).filter(u=>u.floor_id==='f1'),lk=m.lookahead(us,d0.slots,[],N,[],[2,12]);
t('custom 12-top => NO_TABLE',lk[12].code==='NO_TABLE');t('2-top lookahead present',!!lk[2]);
// audit
const d2={...d0,reservations:[...d0.reservations,{...d0.reservations[0],id:'rX',name:'New'}]},a1=m.diffAudit(d0,d2,N);
t('audit create reservation',a1.length===1&&a1[0].action==='create'&&a1[0].entity==='reservation'&&a1[0].label==='New');
const d3={...d2,tables:d2.tables.map(x=>x.id==='t1'?{...x,label:'A1x'}:x)},a2=m.diffAudit(d2,d3,N+1000),d4={...d3,tables:d3.tables.map(x=>x.id==='t1'?{...x,label:'A1xy'}:x)},a3=m.diffAudit(d3,d4,N+2000);
const co=m.pushAudit(m.pushAudit([],a2),a3);t('audit coalesce typing keeps first from',co.length===1&&co[0].changes[0].from==='A1'&&co[0].changes[0].to==='A1xy');
t('audit delete',m.diffAudit(d3,{...d3,queue:[]},N)[0].action==='delete');t('audit unchanged => none',m.diffAudit(d0,d0,N).length===0);
// LOS bubbles
const TB=(id,x,y,w=80,h=80,sec='a')=>({id,label:id,capacity:4,min_capacity:1,x,y,width:w,height:h,shape:'rect',status:'available',assigned_waiter_id:null,section_id:sec,floor_id:'f'});
let g=m.sectionGraph([TB('a',0,0),TB('b',600,0)],[]);t('LOS merges at any distance',g.edges.length===1&&g.comps.length===1&&g.wires.length===0);
g=m.sectionGraph([TB('a',0,0),TB('b',400,0)],[TB('x',200,0,80,80,'b')]);t('blocker splits bubble, one wire',g.comps.length===2&&g.wires.length===1);
g=m.sectionGraph([TB('a',0,0),TB('b',300,300)],[TB('x',150,150,80,80,'b')]);t('diagonal blocked => wired',g.comps.length===2&&g.wires.length===1);
g=m.sectionGraph([TB('a',0,0),TB('b',300,300)],[TB('x',250,0,80,80,'b')]);t('diagonal clear => merged',g.comps.length===1&&g.wires.length===0);
g=m.sectionGraph([TB('a',0,0),TB('m',200,0),TB('c',400,0)],[]);t('same-section tables never block each other',g.edges.length===3);
g=m.sectionGraph([TB('a',0,0),TB('b',300,0),TB('c',600,0)],[TB('x',150,0,80,80,'b')]);t('partial: [a] + [b,c] + 1 wire',g.comps.length===2&&g.wires.length===1);
g=m.sectionGraph([TB('a',0,0),TB('b',300,0),TB('c',600,0)],[TB('x',150,0,80,80,'b'),TB('y',450,0,80,80,'b')]);t('3 isolated => 2 wires',g.comps.length===3&&g.wires.length===2);
// booking conflicts
const db={...d0,events:[ev(N+300*MIN,N+420*MIN)]};
t('conflict: overlapping reservation',m.tableConflict(d0,'t8',N+60*MIN,60)!==null);t('no conflict: well after',m.tableConflict(d0,'t8',N+5*3600e3,60)===null);
t('conflict: seated party (t3 turns +25m)',m.tableConflict(d0,'t3',N+10*MIN,60)!==null);t('free after seated party clears',m.tableConflict(d0,'t3',N+60*MIN,60)===null);
t('conflict: private event incl. 30m prep',m.tableConflict(db,'t13',N+280*MIN,60)!==null);t('own reservation excluded when editing',m.tableConflict(d0,'t8',N+30*MIN,90,'r1')===null);
const cs=[{t:{id:'a',capacity:6,label:'A'},c:null},{t:{id:'b',capacity:4,label:'B'},c:'x'},{t:{id:'c',capacity:4,label:'C'},c:null}];t('bestFit = tightest conflict-free',m.bestFit(cs)==='c');
t('dayLoad within ±1h',m.dayLoad(d0,N+30*MIN).parties>=1);
// seat references (preview/receipt)
const rr=m.seatParty(d0,{size:2,prefix:'HS',type:'W'},[],'f1',N,'auto'),sr=m.seatRefs(d0,rr.d,rr.tone==='warn');
t('seatRefs: party/table/server/turn',sr.refs.some(x=>x.label==='Party'&&x.value.startsWith('HS-W-9'))&&sr.refs.some(x=>x.label==='Table'&&x.tid)&&sr.refs.some(x=>x.label==='Server'&&x.value!=='none')&&sr.refs.some(x=>x.label==='Turn')&&sr.names.length>=1);
const rl=m.seatParty(d0,{size:4,prefix:'HS',type:'W'},['t1'],'f1',N,'selected'),sl=m.seatRefs(d0,rl.d);t('linked group lists every table',sl.names.length===2&&sl.refs.filter(x=>x.label==='Table').length===2);
const fb=m.seatRefs(d0,rr.d,true).refs.find(x=>x.label==='Server');t('fallback flagged on server',fb.warn&&fb.value.includes('fallback'));
t('preview is pure (input data untouched)',d0.slots.length===4&&d0.nextPartyId===9);
// linking has no positional rules
const far=[TB('p',0,0),TB('q',900,600)],pl=m.planLink(far,[],['p','q']);
t('link far-apart tables allowed',!('err' in pl)&&pl.ids.length===2);const as=m.applyLink([],pl.ids);
t('far group survives normalize',m.normalizeAssociations(far,as)===as);
t('moving members apart never splits group',m.normalizeAssociations(far.map(x=>x.id==='q'?{...x,x:5,y:700}:x),as)===as);
t('deleting a member dissolves a pair',m.normalizeAssociations([far[0]],as).length===0);
t('3-group minus one keeps remaining pair',m.normalizeAssociations([...far],m.applyLink([],['p','q','r']))[0].associated_table_ids.length===1);
t('cross-floor link rejected (only rule)',m.planLink([far[0],{...far[1],floor_id:'g'}],[],['p','q']).err==='Linked tables must be on the same floor');
t('single table rejected',m.planLink(far,[],['p']).err==='Select 2+ tables to link');
// bubble fill (hulls)
const inP=(p,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c};
g=m.sectionGraph([TB('a',0,0),TB('b',300,0)],[]);t('pair bubble fills the whole gap band',g.polys.length===1&&inP({x:190,y:5},g.polys[0])&&inP({x:190,y:75},g.polys[0])&&!inP({x:190,y:95},g.polys[0]));
g=m.sectionGraph([TB('a',0,0),TB('b',200,0),TB('c',0,200),TB('d',200,200)],[]);t('clique of 4 => one hull enclosing the middle',g.polys.length===1&&inP({x:140,y:140},g.polys[0]));
g=m.sectionGraph([TB('a',0,0),TB('b',300,0),TB('c',600,0)],[TB('x',150,0,80,80,'b')]);t('blocked pair gets no fill (only b-c hull)',g.polys.length===1);
g=m.sectionGraph([TB('a',0,0),TB('b',300,0)],[TB('x',150,0,80,80,'b')]);t('fully blocked pair => no hull',g.polys.length===0);
// tally-mark fair rotation
const W=(id,tally,idle,open=0,x={})=>({id,name:id,active_cover_count:open,last_seated_at:new Date(N-idle*MIN).toISOString(),section_ids:[],is_active:true,max_covers:18,tally_covers:tally,...x});
const rk=(ws,res=[])=>m.rotation(ws,[],res,N).map(x=>x.w.id).join();
t('lowest cover tally goes next',rk([W('a',10,5),W('b',4,5),W('c',7,5)])==='b,c,a');
t('tie on tally => longest since last seated',rk([W('a',5,10),W('b',5,60),W('c',5,30)])==='b,c,a');
t('tally outranks idle time',rk([W('a',5,1),W('b',6,500)])==='a,b');
t('open (current) covers do not matter, only past tally',rk([W('a',3,10,0),W('b',3,5,12)])==='a,b');
t('incoming reservations ignored',rk([W('a',3,10),W('b',3,5)],d0.reservations)===rk([W('a',3,10),W('b',3,5)]));
t('no cap: many open covers never demote a low-tally server',rk([W('a',1,5,40),W('b',9,5,0)])==='a,b');
t('skip next demotes',rk([W('a',1,5,0,{skip_penalty:300}),W('b',9,5)])==='b,a');
t('inactive ranked last',rk([W('a',0,5,0,{is_active:false}),W('b',9,5)])==='b,a');
t('seating adds party size to the assigned server\'s tally (A5/Maya 12+2)',(()=>{const s=rr.d.tables.find(x=>x.status==='occupied'&&d0.tables.find(y=>y.id===x.id).status!=='occupied'),b=d0.waiters.find(w=>w.id===s.assigned_waiter_id).tally_covers,a=rr.d.waiters.find(w=>w.id===s.assigned_waiter_id).tally_covers;return s.label==='A5'&&a===b+2})());
const big=m.seatParty(d0,{size:6,prefix:'HS',type:'W'},['t8'],'f1',N,'selected'),dev=big.d.waiters.find(w=>w.id==='w2');
t('6-top weighs 6 covers on the lowest-tally section server (Dev 6+6)',dev.tally_covers===12);
t('after a big party the server rotates behind equal-tally peers',(()=>{const o=m.rotation(big.d.waiters,[],[],N).map(x=>x.w.id);return o.indexOf('w1')<o.indexOf('w2')})());
// ledger / ended_at
const cl=m.markAvailable(d0,['t3']),s1=cl.slots.find(s=>s.id==='s1'),w1=cl.waiters.find(w=>w.id==='w1');
t('clear stamps ended_at, keeps tally, drops open covers',!!s1.ended_at&&w1.tally_covers===12&&w1.active_cover_count===0);
const evs=m.ledgerEvents(cl,m.dayKey(Date.parse(s1.seated_at))),evo=m.ledgerEvents(cl,m.dayKey(N));
t('ledger: seat event +4 and clear event -4 for A3',evs.some(e=>e.kind==='in'&&e.label==='A3'&&e.covers===4)&&evo.some(e=>e.kind==='out'&&e.label==='A3'&&e.covers===4));
const lnk=m.seatParty(d0,{size:4,prefix:'HS',type:'W'},['t1'],'f1',N,'selected');
t('ledger labels a linked group A1+A2',m.ledgerEvents(lnk.d,m.dayKey(N)).some(e=>e.label==='A1+A2'&&e.covers===4&&e.kind==='in'));
const base=Math.floor(N/(5*MIN))*5*MIN,es=[{at:base+MIN,kind:'in',label:'X',covers:4,tid:'x'},{at:base+4*MIN,kind:'out',label:'Y',covers:3,tid:'y'},{at:base+7*MIN,kind:'in',label:'Z',covers:2,tid:'z'}];
const b5=m.bucketEvents(es,5);t('bucket 5m: 2 rows, newest first, net covers',b5.length===2&&b5[0].es[0].label==='Z'&&b5[0].net===2&&b5[1].net===1);t('bucket 1m splits into 3',m.bucketEvents(es,1).length===3);
const ts=m.tableStates(d0,'f1',N),by=l=>ts.find(x=>x.unit.label===l);
t('table states: seated(+covers)/lapsed/reserved/open',by('A3').state==='seated'&&by('A3').covers===4&&by('B2').state==='lapsed'&&by('B3').state==='reserved'&&by('A1+A2').state==='open'&&by('C3').state==='open');
// pinch
const pv=m.pinchView(1,100,200,{x:600,y:360},{x:.5,y:.5},1200,720);t('pinch out doubles zoom around midpoint',pv.zoom===2&&pv.pan.x===300&&pv.pan.y===180);
t('pinch zoom clamped .4–2.5',m.pinchView(1,100,1000,{x:0,y:0},{x:0,y:0},1200,720).zoom===2.5&&m.pinchView(1,100,1,{x:0,y:0},{x:0,y:0},1200,720).zoom===.4);
t('two-finger drag pans at constant zoom',(()=>{const p=m.pinchView(1,100,100,{x:600,y:360},{x:.3,y:.5},1200,720);return p.zoom===1&&p.pan.x===240})());
// bus priority incorporates tally rotation
const lapsedAt=(d,ids)=>({...d,tables:d.tables.map(x=>ids.includes(x.id)?{...x,status:'lapsed'}:x)}),db2=lapsedAt(d0,['t7','t13']);
const order=(d)=>m.busPriority(d.tables,d.queue,d.slots,N,m.rotation(d.waiters,d.tables,d.reservations,N)).map(x=>x.t.id).join();
t('bus: table whose server is next up (Dev, section B) first',order(db2)==='t7,t13');
const dl={...db2,waiters:db2.waiters.map(w=>w.id==='w3'?{...w,tally_covers:0}:w)};t('bus: flips when another server (Sam, section C) becomes next up',order(dl)==='t13,t7');
t('bus: entries carry server + rank position',m.busPriority(db2.tables,db2.queue,db2.slots,N,m.rotation(db2.waiters,db2.tables,db2.reservations,N)).every(x=>x.w&&x.pos>=0));
// turnover / walk-in quotes
const tev=m.turnoverEvents(d0,N);
t('turnover events: 4 observed ins, 4 projected outs',tev.filter(x=>x.kind==='in'&&!x.proj).length===4&&tev.filter(x=>x.kind==='out'&&x.proj).length===4);
t('overdue turn (lapsed 3-top) projects to now',tev.some(x=>x.kind==='out'&&x.proj&&x.at===N&&x.covers===3));
const nwv=m.nextWindow(tev,N,15);t('next 15m: 2 tables / 7 covers out (overdue + 10m turn); 1 late res / 2 covers in',nwv.outT===2&&nwv.outC===7&&nwv.inT===1&&nwv.inC===2);
for(const iv of [10,15,30,45]){const rw=m.bucketTurnover(tev,iv,N,3,5);t(`buckets ${iv}m: 9 rows, 1 current, aligned to midnight`,rw.length===9&&rw.filter(r=>r.now).length===1&&(rw[0].start-m.dayStartMs(m.dayKey(N)))%(iv*MIN)===0&&rw.every(r=>r.end-r.start===iv*MIN))}
t('current bucket carries the overdue out',m.bucketTurnover(tev,15,N).find(r=>r.now).outC>=3);
t('rangeOf: 0/17/20/5',(()=>{const a=m.rangeOf(0),b=m.rangeOf(17),c=m.rangeOf(20),e=m.rangeOf(5);return a.hi===0&&b.lo===15&&b.hi===25&&c.lo===20&&c.hi===30&&e.lo===5&&e.hi===15})());
const qa=m.walkinQuote(d0,N,2);t('quote: one party ahead (Chen), tables free => ready',qa.ahead===1&&qa.ready&&!qa.none);
t('quote: oversize party => none',m.walkinQuote(d0,N,40).none===true);
const full={...d0,tables:d0.tables.map(x=>({...x,status:'occupied'}))},qf=m.walkinQuote(full,N,2);t('quote: all occupied => waits, 10-min window',!qf.ready&&qf.wait>0&&qf.hi===qf.lo+10);
t('queueOrder: priority first then oldest',m.queueOrder([{id:'1',type:'W',queued_at:new Date(N-9*MIN).toISOString(),status:'WAITING'},{id:'2',type:'P',queued_at:new Date(N-1*MIN).toISOString(),status:'WAITING'},{id:'3',type:'W',queued_at:new Date(N-20*MIN).toISOString(),status:'WAITING'}]).map(x=>x.id).join()==='2,3,1');
// rotation-aware planning (1:1 sections)
const f1u=m.buildUnits(d0.tables,d0.assocs).filter(u=>u.floor_id==='f1'),hold0=m.holdsFrom(d0.reservations,N,d0.events),pn=m.planSequence(d0,[2,2],f1u,N,hold0);
t('1:1 seed: each section has exactly one server',d0.sections.every(s=>d0.waiters.filter(w=>w.section_ids.includes(s.id)).length===1));
t('plan: among equally-tight 2-tops the next-up server\'s table wins (A5/Maya over C3/Sam)',pn.items[0].label==='A5'&&pn.preds[0].server.id==='w1'&&pn.preds[0].from===12&&pn.preds[0].to===14);
t('plan: sequential - 2nd party sees the 1st\'s covers and goes to the other station (C3/Sam 14->16)',pn.items[1].label==='C3'&&pn.preds[1].server.id==='w3'&&pn.preds[1].from===14&&pn.preds[1].to===16);
t('plan: tightness still beats rotation (next-up Dev only has 6/8-tops free)',pn.items[0].label!=='B3'&&pn.items[0].label!=='B4');
t('plan: first pick = what seatParty really seats and assigns',(()=>{const s=rr.d.tables.find(x=>x.status==='occupied'&&d0.tables.find(y=>y.id===x.id).status!=='occupied');return s.label===pn.items[0].label&&s.assigned_waiter_id===pn.preds[0].server.id})());
t('plan: standings deltas add up to the covers planned (4)',pn.standings.reduce((s,x)=>s+x.delta,0)===4&&pn.standings.length===4);
t('plan: waits unchanged vs plain evaluation (rotation only breaks ties)',JSON.stringify(pn.items.map(i=>i.wait))===JSON.stringify(m.evaluateSequence(f1u,d0.slots,[2,2],N,hold0).map(i=>i.wait)));
t('plan: empty sequence = current order, zero deltas',(()=>{const e=m.planSequence(d0,[],f1u,N,hold0);return e.items.length===0&&e.standings.every(x=>x.delta===0)&&e.standings[0].w.id==='w2'})());
t('plan: no-table item => null pred',m.planSequence(d0,[40],f1u,N,hold0).preds[0]===null);
t('plan: skip-next on Maya hands the tie to Sam',(()=>{const ds={...d0,waiters:d0.waiters.map(w=>w.id==='w1'?{...w,skip_penalty:300}:w)};return m.planSequence(ds,[2],f1u,N,hold0).preds[0].server.id==='w3'})());
t('plan: unsectioned table loses ties (fallback last)',(()=>{const ds={...d0,tables:d0.tables.map(x=>x.id==='t5'?{...x,section_id:null}:x)};return m.planSequence(ds,[2],m.buildUnits(ds.tables,ds.assocs).filter(u=>u.floor_id==='f1'),N,hold0).items[0].label==='C3'})());
t('plan: no servers at all still plans tables',(()=>{const ds={...d0,waiters:[]},p=m.planSequence(ds,[2],f1u,N,hold0);return p.items[0].ready&&p.preds[0].server===null})());
t('plan: input data untouched',d0.waiters[1].tally_covers===6&&d0.waiters.length===4);
// simulation generators
const sR1=m.rng(42),sR2=m.rng(42),sR3=m.rng(43),sA1=[sR1(),sR1(),sR1()],sA2=[sR2(),sR2(),sR2()];
t('rng deterministic per seed, differs across seeds',JSON.stringify(sA1)===JSON.stringify(sA2)&&sA1[0]!==sR3()&&sA1.every(x=>x>=0&&x<1));
t('pickSize stays in range; falls back when no weighted size fits',(()=>{const r=m.rng(7);for(let i=0;i<200;i++){const s=m.pickSize(r,2,4);if(s<2||s>4)return false}return m.pickSize(m.rng(1),7,7)===7})());
const sGr=m.genReservations(d0,N,{count:6,minSize:2,maxSize:6,fromMin:30,toMin:180,duration:90,assign:true,seed:5}),sNewR=sGr.reservations.slice(d0.reservations.length);
t('genReservations: 6 BOOKED inside the window, 5-min aligned',sNewR.length===6&&sNewR.every(x=>x.status==='BOOKED'&&Date.parse(x.time)>=N+25*MIN&&Date.parse(x.time)<=N+185*MIN&&Date.parse(x.time)%(5*MIN)===0));
t('genReservations: assigned tables fit the party and are conflict-free',sNewR.every(x=>!x.table_id||(sGr.tables.find(y=>y.id===x.table_id).capacity>=x.party_size&&m.tableConflict(sGr,x.table_id,Date.parse(x.time),x.duration_min,x.id)===null)));
const sFl=m.fillSeated(d0,N,{pct:90,minSize:1,maxSize:6,seed:3}),sUs=m.buildUnits(sFl.tables,sFl.assocs).filter(u=>u.status!=='blocked_private');
t('fillSeated: reaches the target occupancy (or the room is full)',sUs.filter(u=>u.status==='occupied'||u.status==='lapsed').length/sUs.length>=.9||sUs.every(u=>u.status!=='available'));
t('fillSeated: new slots started in the past, turn in the future, labels unique',(()=>{const ns=sFl.slots.slice(d0.slots.length);return ns.length>0&&new Set(sFl.slots.map(s=>s.party_label)).size===sFl.slots.length&&ns.every(s=>Date.parse(s.seated_at)<=N&&Date.parse(s.expected_turn_at)>N)})());
t('fillSeated: open covers == active slot covers, tallies grew',(()=>{const open=sFl.waiters.reduce((s,w)=>s+w.active_cover_count,0),act=sFl.slots.filter(s=>s.status!=='COMPLETED').reduce((s,x)=>s+x.party_size,0);return open===act&&sFl.waiters.reduce((s,w)=>s+(w.tally_covers??0),0)>d0.waiters.reduce((s,w)=>s+(w.tally_covers??0),0)})());
const sSt=m.settleOverdue(d0,N+30*MIN);
t('settleOverdue: clears A3 (past turn+5m), leaves C1 (turn +40m)',sSt.tables.find(x=>x.id==='t3').status==='available'&&sSt.tables.find(x=>x.id==='t10').status==='occupied');
t('settleOverdue: ended_at = turn + 5m (not "now")',Date.parse(sSt.slots.find(s=>s.id==='s1').ended_at)===Date.parse(d0.slots.find(s=>s.id==='s1').expected_turn_at)+5*MIN);
t('settleOverdue far ahead clears everyone and zeroes open covers',(()=>{const x=m.settleOverdue(d0,N+300*MIN);return x.slots.every(s=>s.status==='COMPLETED')&&x.waiters.every(w=>w.active_cover_count===0)})());
// audit humanizer
const sHv=(f,v)=>m.humanValue(f,v,d0);
t('audit: server id -> name, null -> none',sHv('assigned_waiter_id','w2')==='Dev'&&sHv('assigned_waiter_id','null')==='none');
t('audit: section/table/floor ids resolve',sHv('section_id','sB')==='B'&&sHv('table_id','t3')==='A3'&&sHv('floor_id','f2')==='Patio');
t('audit: ISO -> clock, id arrays -> names, booleans',(()=>{const iso=new Date(N).toISOString(),c=sHv('seated_at',iso);return /\d/.test(c)&&!/T\d\d:/.test(c)&&sHv('section_ids','["sA","sB"]')==='A, B'&&sHv('is_active','true')==='yes'})());
t('audit: unknown ids fall back to raw; field labels prettified',sHv('assigned_waiter_id','w99')==='w99'&&m.fieldLabel('assigned_waiter_id')==='server'&&m.fieldLabel('some_new_field')==='some new field');
{ // reservation states: any -> any
const SS=['BOOKED','ARRIVED','SEATED','NO_SHOW','QUEUED'],mkA=d=>{const A={data:d,rc:[],mutate(fn){A.data=fn(A.data)},receipt(t,r){A.rc.push([t,r])}};return A};
let all=true;for(const f of SS)for(const to of SS){if(f===to)continue;const A=mkA({...d0,reservations:d0.reservations.map(x=>x.id==='r1'?{...x,status:f}:x)});m.setResStatus(A,'r1',to);if(A.data.reservations.find(x=>x.id==='r1').status!==to||A.rc.length!==1)all=false}
t('reservation: all 20 state transitions are allowed (incl. back to BOOKED)',all);
const A0=mkA(d0);m.setResStatus(A0,'r1','BOOKED');t('reservation: same-state click is a no-op',A0.rc.length===0&&A0.data===d0);
const dq={...d0,reservations:d0.reservations.map(x=>x.id==='r2'?{...x,status:'QUEUED'}:x),queue:[...d0.queue,{id:'qx',party_id:6,prefix:'HS',type:'P',name:'Lindqvist',party_size:2,queued_at:new Date(N).toISOString(),quoted_wait_min:10,notes:'',origin_reservation_id:'r2',status:'WAITING'}]};
const Aq=mkA(dq);m.setResStatus(Aq,'r2','BOOKED');t('leaving QUEUED withdraws the waiting priority entry (and says so)',!Aq.data.queue.some(q=>q.id==='qx')&&Aq.data.reservations.find(x=>x.id==='r2').status==='BOOKED'&&Aq.rc[0][1].some(x=>x.label==='Queue'));
const As=mkA(d0);m.setResStatus(As,'r1','SEATED');t('SEATED is status-only and the receipt says so',As.data.tables===d0.tables&&As.data.slots===d0.slots&&As.rc[0][1].some(x=>x.label==='Note'&&x.warn));
const rs2=m.seatParty(dq,m.queueReq(dq.queue[1]),[],'f1',N,'auto');t('seating a promoted entry from the queue marks its reservation SEATED',rs2.d.reservations.find(x=>x.id==='r2').status==='SEATED'&&rs2.d.queue.find(q=>q.id==='qx').status==='SEATED');}
{ // free-typing numeric fields
t('typed: empty/partial text commits nothing',m.typed('',1,40)===null&&m.typed('  ',1,40)===null&&m.typed('-',1,40)===null&&m.typed('abc',1,40)===null);
t('typed: in-range numbers commit; out-of-range wait for blur; decimals round',m.typed('12',1,40)===12&&m.typed('0',1,40)===null&&m.typed('41',1,40)===null&&m.typed(' 7 ',1,40)===7&&m.typed('12.6',1,40)===13);
t('settle: empty/invalid -> previous; out of range -> clamped; decimals rounded',m.settle('',9,1,40)===9&&m.settle('abc',9,1,40)===9&&m.settle('0',9,1,40)===1&&m.settle('999',9,1,40)===40&&m.settle('7.4',9,1,40)===7);
t('min 10: "1" is allowed as the start of "15" (not committed, clamps only on blur)',m.typed('1',10,120)===null&&m.typed('15',10,120)===15&&m.settle('1',30,10,120)===10);}
{ // arrivals: partial-arrival metric, seating = arrived/seated
const R1=d0.reservations.find(x=>x.id==='r1'),mk=d=>{const A={data:d,rc:[],mutate(fn){A.data=fn(A.data)},receipt(t,r){A.rc.push([t,r])}};return A},get=(A,id)=>A.data.reservations.find(x=>x.id===id);
t('hereRes defaults: BOOKED 0; ARRIVED/SEATED/QUEUED everyone; recorded count wins; clamps',m.hereRes(R1)===0&&m.hereRes({...R1,status:'ARRIVED'})===6&&m.hereRes({...R1,status:'SEATED'})===6&&m.hereRes({...R1,status:'ARRIVED',arrived_count:3})===3&&m.hereRes({...R1,arrived_count:99})===6);
let A=mk(d0);m.setArrived(A,{kind:'res',id:'r1'},2);
t('first partial arrival: BOOKED -> ARRIVED, 2/6, arrival stamped, receipt says 4 to come',get(A,'r1').status==='ARRIVED'&&get(A,'r1').arrived_count===2&&!!get(A,'r1').arrived_at&&A.rc[0][0]==='Arrivals'&&A.rc[0][1].some(x=>x.label==='Still to come'&&x.value==='4'));
m.setArrived(A,{kind:'res',id:'r1'},0);t('back to 0 here -> BOOKED, arrival time cleared',get(A,'r1').status==='BOOKED'&&get(A,'r1').arrived_count===0&&!get(A,'r1').arrived_at);
m.setArrived(A,{kind:'res',id:'r1'},99);t('arrived count clamps to party size',get(A,'r1').arrived_count===6);
A=mk({...d0,reservations:d0.reservations.map(x=>x.id==='r1'?{...x,status:'NO_SHOW'}:x)});m.setArrived(A,{kind:'res',id:'r1'},1);t('a no-show who turns up becomes ARRIVED',get(A,'r1').status==='ARRIVED');
A=mk(d0);m.setResStatus(A,'r1','ARRIVED');t('state chip ARRIVED = everyone here',get(A,'r1').arrived_count===6&&!!get(A,'r1').arrived_at);m.setResStatus(A,'r1','BOOKED');t('state chip BOOKED = nobody here',get(A,'r1').arrived_count===0&&!get(A,'r1').arrived_at);
A=mk(d0);m.addArrived(A,{kind:'res',id:'r1'},1);m.addArrived(A,{kind:'res',id:'r1'},1);t('addArrived is incremental (+1,+1 = 2/6)',get(A,'r1').arrived_count===2);
const s1=m.seatParty(d0,m.resReq(R1),['t8'],'f1',N,'selected'),r1s=s1.d.reservations.find(x=>x.id==='r1');
t('seating a BOOKED reservation -> SEATED + everyone arrived + arrival time (not left at booked)',r1s.status==='SEATED'&&r1s.arrived_count===6&&!!r1s.arrived_at);
const dp={...d0,reservations:d0.reservations.map(x=>x.id==='r1'?{...x,status:'ARRIVED',arrived_count:3,arrived_at:new Date(N).toISOString()}:x)},s2=m.seatParty(dp,m.resReq(dp.reservations.find(x=>x.id==='r1')),['t8'],'f1',N,'selected');
t('seating a PARTIAL party keeps the recorded 3/6 so the host still watches for 3',s2.d.reservations.find(x=>x.id==='r1').arrived_count===3);
const ex=m.expectingMore(s2.d).find(x=>x.id==='r1');t('expectingMore: seated partial party listed with table + missing count',!!ex&&ex.missing===3&&/seated B3/.test(ex.where)&&ex.tid==='t8');
t('expectingMore: dropped once the table is cleared',!m.expectingMore(m.markAvailable(s2.d,['t8'])).some(x=>x.id==='r1'));
t('expectingMore: BOOKED / NO_SHOW / complete parties are not listed',m.expectingMore(d0).length===0&&m.expectingMore({...dp,reservations:dp.reservations.map(x=>({...x,status:'NO_SHOW'}))}).length===0);
t('expectingMore: partial walk-in in the queue',m.expectingMore({...d0,queue:d0.queue.map(x=>({...x,arrived_count:1}))}).some(x=>x.kind==='queue'&&x.missing===1&&x.where==='in queue'));
A=mk(dp);m.promote(A,dp.reservations.find(x=>x.id==='r1'));const pq=A.data.queue.find(x=>x.origin_reservation_id==='r1');
t('promote keeps the partial count on both records and lists the party once',pq.arrived_count===3&&get(A,'r1').arrived_count===3&&m.expectingMore(A.data).filter(x=>x.name==='Okafor').length===1);
m.setArrived(A,{kind:'queue',id:pq.id},5);t('arriving via the promoted queue entry updates the reservation and mirrors back',get(A,'r1').arrived_count===5&&A.data.queue.find(x=>x.id===pq.id).arrived_count===5);
A=mk(d0);m.addToQueue(A,{name:'Cho',size:5,here:2,id:'q_test'});const nq=A.data.queue.find(x=>x.id==='q_test');
t('addToQueue: partial walk-in (2 of 5), custom id, party id advances, receipt shows Here',nq.arrived_count===2&&nq.party_size===5&&A.data.nextPartyId===d0.nextPartyId+1&&A.rc[0][1].some(x=>x.label==='Here'&&x.value==='2/5'));
A=mk(d0);m.addToQueue(A,{size:2,quiet:true});t('addToQueue quiet = no receipt',A.rc.length===0&&A.data.queue.length===d0.queue.length+1);}
{ // mark a table ahead (hours / days)
const far=N+26*3600e3,hd=m.planAhead(d0,{size:4,whenMs:far,dur:90,sel:null});
t('planAhead auto: tightest conflict-free 4-top for tomorrow evening, skipping A3 (held by Tanaka then)',hd.ok&&hd.cap===4&&hd.primary!=='t3');
t('planAhead auto: avoids a table already marked for that window',(()=>{const dd=m.applyAhead(d0,hd,{size:4,whenMs:far,dur:90}),h2=m.planAhead(dd,{size:4,whenMs:far,dur:90,sel:null});return h2.ok&&h2.primary!==hd.primary})());
t('planAhead selected: validates capacity + conflicts, allows a free table',m.planAhead(d0,{size:6,whenMs:far,dur:90,sel:['t6']}).ok===false&&m.planAhead(d0,{size:4,whenMs:far,dur:90,sel:['t3']}).ok===false&&m.planAhead(d0,{size:4,whenMs:far,dur:90,sel:['t4']}).ok===true);
t('planAhead selected: a linked group is held as a unit (A1 -> A1+A2, cap 4)',(()=>{const p=m.planAhead(d0,{size:4,whenMs:far,dur:90,sel:['t1']});return p.ok&&p.tableIds.length===2&&p.cap===4&&p.label==='A1+A2'})());
t('planAhead: editing a reservation ignores its own hold (re-mark A3 for Tanaka)',m.planAhead(d0,{size:4,whenMs:far,dur:90,sel:['t3'],exceptRes:'r3'}).ok===true);
t('planAhead: a private event blocks that table in its window',m.planAhead({...d0,events:[{id:'e9',name:'Buyout',table_ids:['t4'],start:new Date(far).toISOString(),end:new Date(far+120*MIN).toISOString(),locked_ids:[],reclaimed:false}]},{size:4,whenMs:far,dur:90,sel:['t4']}).ok===false);
t('planAhead: nothing fits -> clear message',(()=>{const p=m.planAhead(d0,{size:40,whenMs:far,dur:90,sel:null});return p.ok===false&&/no table/.test(p.err)})());
const ap=m.planAhead(d0,{size:4,whenMs:far,dur:90,sel:['t4']}),a1=m.applyAhead(d0,ap,{size:4,name:'Vega',whenMs:far,dur:90}),nr=a1.reservations[a1.reservations.length-1];
t('applyAhead (new party): held BOOKED reservation with the table, ids advance, input untouched',a1.reservations.length===d0.reservations.length+1&&nr.table_id==='t4'&&nr.status==='BOOKED'&&nr.name==='Vega'&&nr.arrived_count===0&&a1.nextPartyId===d0.nextPartyId+1&&d0.reservations.length===3);
const a2=m.applyAhead(d0,ap,{size:4,whenMs:far+30*MIN,dur:60,resId:'r3'}),r3=a2.reservations.find(x=>x.id==='r3');
t('applyAhead (existing reservation): moves table/time/length only',r3.table_id==='t4'&&Date.parse(r3.time)===far+30*MIN&&r3.duration_min===60&&r3.name==='Tanaka'&&a2.reservations.length===d0.reservations.length);
const A=(d=>{const X={data:d,rc:[],mutate(fn){X.data=fn(X.data)},receipt(t,r){X.rc.push([t,r])}};return X})(d0);m.markAhead(A,ap,{size:4,name:'Vega',whenMs:far,dur:90});
t('markAhead: receipt shows guest, when (with day), table; reservation created',A.rc[0][0]==='Table marked ahead'&&A.rc[0][1].some(x=>x.label==='When'&&/-|–/.test(x.value))&&A.rc[0][1].some(x=>x.label==='Table'&&x.tid==='t4')&&A.data.reservations.length===4);}
{ // simulation door list (staged, not dumped into the queue)
const g=m.genDoorWalkins(d0,N,{count:8,minSize:1,maxSize:6,spread:40,partialPct:100,seed:11}),g2=m.genDoorWalkins(d0,N,{count:8,minSize:1,maxSize:6,spread:40,partialPct:100,seed:11}),wk=g.sim.filter(e=>e.kind==='walkin'),jn=g.sim.filter(e=>e.kind==='arrive');
t('door walk-ins: 8 staged entries inside the spread; the queue is untouched',wk.length===8&&g.queue.length===d0.queue.length&&wk.every(e=>Date.parse(e.at)>=N&&Date.parse(e.at)<=N+40*MIN));
t('door walk-ins: parties of 2+ arrive in waves; the follow-up joins the queued party by id, later',wk.filter(e=>e.size>=2).every(e=>e.here<e.size&&jn.some(j=>j.ref.id==='q_'+e.id&&j.size===e.size-e.here&&Date.parse(j.at)>Date.parse(e.at))));
t('door entries: sorted by time, deterministic per seed, input untouched',g.sim.every((e,i,a)=>i===0||Date.parse(a[i-1].at)<=Date.parse(e.at))&&JSON.stringify(g)===JSON.stringify(g2)&&d0.sim===undefined);
const ga=m.genArrivals(d0,N,{windowMin:90,partialPct:100,noShowPct:0,seed:3}),ea=ga.sim.filter(e=>e.ref.id==='r1');
t('door arrivals: reservations due in the window arrive in waves summing to the party (Okafor 6)',ea.length===2&&ea.reduce((n,e)=>n+e.size,0)===6&&ga.sim.every(e=>e.kind==='arrive'&&e.ref.type==='res'));
t('door arrivals: 100% no-show stages nothing; re-generating never duplicates',(m.genArrivals(d0,N,{windowMin:90,partialPct:0,noShowPct:100,seed:3}).sim??[]).length===0&&m.genArrivals(ga,N,{windowMin:90,partialPct:100,noShowPct:0,seed:3}).sim.length===ga.sim.length);
t('starter populates walk-ins AND reservation arrivals',(()=>{const s=m.genStarter(d0,N,5);return s.sim.some(e=>e.kind==='walkin')&&s.sim.some(e=>e.kind==='arrive'&&e.ref.type==='res')})());}
// ---- selection / table info / door / unseat
{const occ=d0.tables.find(x=>x.status==='occupied'),osl=d0.slots.find(s=>s.status!=='COMPLETED'&&s.table_id===occ.id),av=d0.tables.find(x=>x.status==='available'&&x.capacity>=2&&!d0.reservations.some(r=>r.table_id===x.id));
 const sk=(d,ids,n=2,p)=>m.selectionState(d,ids,n,p).kind,with_=(d,id,st)=>({...d,tables:d.tables.map(x=>x.id===id?{...x,status:st}:x)});
 t('selection: none / free / occupied / small',sk(d0,[])==='none'&&sk(d0,[av.id])==='free'&&sk(d0,[occ.id])==='occupied'&&sk(d0,[av.id],av.capacity+3)==='small');
 t('selection: occupied message names the seated party',m.selectionState(d0,[occ.id],2).msg.includes(osl.party_label));
 t('selection: the party already seated there is "joining", not an error',sk(d0,[occ.id],2,osl.party_id)==='joining');
 t('selection: past-turn and blocked are distinct',sk(with_(d0,occ.id,'lapsed'),[occ.id])==='lapsed'&&sk(with_(d0,av.id,'blocked_private'),[av.id])==='blocked');
 const sp=(d,id)=>m.seatParty(d,{size:2,prefix:'HS',type:'W'},[id],'f1',N,'selected');
 t('seat errors are specific (no "occupied or blocked")',/occupied by another party/.test(sp(d0,occ.id).err)&&/past its turn/.test(sp(with_(d0,occ.id,'lapsed'),occ.id).err)&&/blocked/.test(sp(with_(d0,av.id,'blocked_private'),av.id).err)&&!('err' in sp(d0,av.id)));
 const ti=m.tableInfo(d0,occ,N),h1={...d0,reservations:[...d0.reservations,{id:'rh',party_id:99,prefix:'HS',type:'R',name:'Held',party_size:2,time:iso(N+30*MIN),duration_min:60,phone:'',notes:'',table_id:av.id,status:'BOOKED'}]},th=m.tableInfo(h1,av,N);
 t('tableInfo: seated party with label/size/seat+turn times',ti.state==='seated'&&ti.party.label===osl.party_label&&ti.party.size===osl.party_size&&ti.party.seatedAt===Date.parse(osl.seated_at)&&ti.party.turnAt===Date.parse(osl.expected_turn_at)&&ti.owner===(osl.table_id===occ.id));
 t('tableInfo: open vs held (reservation holds it, owner shows the tag)',m.tableInfo(d0,av,N).state==='open'&&th.state==='held'&&th.held.name==='Held'&&th.held.at===N+30*MIN&&th.owner);
 t('tableInfo: partial arrival reports here/size',(()=>{const r=m.tableInfo({...h1,reservations:h1.reservations.map(x=>x.id==='rh'?{...x,arrived_count:1}:x)},av,N);return r.held.here===1&&r.held.size===2})());
 // door
 const e1=m.enqueue(d0,{size:3,name:' Zed '},N);
 t('enqueue: trims name, bumps party id, positions after the waiting',e1.entry.name==='Zed'&&e1.d.nextPartyId===d0.nextPartyId+1&&e1.pos===d0.queue.filter(x=>x.status==='WAITING').length+1&&e1.d.queue.length===d0.queue.length+1);
 const dq={...d0,queue:[]},so=m.seatOrQueue(dq,{size:2,name:'Zed'},N);
 t('door ⚡: complete party + empty queue + ready table => seated with a SEATED record',so.seated&&so.d.slots.length===dq.slots.length+1&&so.d.queue.length===1&&so.d.queue[0].status==='SEATED'&&so.d.queue[0].name==='Zed');
 t('door ⚡: queue not empty => queued fairly behind',(()=>{const r=m.seatOrQueue({...d0,queue:[{...e1.entry}]},{size:2},N);return !r.seated&&/not empty/.test(r.msg)})());
 t('door ⚡: partial party waits for the rest',(()=>{const r=m.seatOrQueue(dq,{size:4,here:2},N);return !r.seated&&/rest/.test(r.msg)&&r.d.queue[0].arrived_count===2})());
 t('door ⚡ all: only guests already at the door; list shrinks',(()=>{const es=[{id:'a',at:iso(N-1000),kind:'walkin',name:'A',size:2,here:2},{id:'b',at:iso(N+60*MIN),kind:'walkin',name:'B',size:2,here:2}],r=m.processDoor({...dq,sim:es},N);return r.seated+r.queued===1&&r.d.sim.length===1&&r.d.sim[0].id==='b'})());
 // unseat
 const wA=d0.waiters.find(x=>x.id===occ.assigned_waiter_id),u1=m.unseatToQueue(d0,osl.id,N);
 t('unseat: slot removed, table free, covers returned, party WAITING',!!u1&&!u1.d.slots.some(s=>s.id===osl.id)&&u1.d.tables.find(x=>x.id===occ.id).status==='available'&&u1.d.waiters.find(x=>x.id===wA.id).active_cover_count===Math.max(0,wA.active_cover_count-osl.party_size)&&u1.d.queue.some(q=>q.party_id===osl.party_id&&q.status==='WAITING'));
 const s1=m.seatParty(d0,{size:2,prefix:'HS',type:'W'},[av.id],'f1',N,'selected'),sl1=s1.d.slots[s1.d.slots.length-1],u2=m.unseatToQueue(s1.d,sl1.id,N),wB=d0.waiters.find(x=>x.id===s1.d.tables.find(y=>y.id===av.id).assigned_waiter_id);
 t('seat → unseat round-trip restores server covers + tally and frees the table',(()=>{const w1=u2.d.waiters.find(x=>x.id===s1.d.tables.find(y=>y.id===av.id).assigned_waiter_id);return w1.active_cover_count===wB.active_cover_count&&(w1.tally_covers??0)===(wB.tally_covers??0)&&u2.d.tables.find(x=>x.id===av.id).status==='available'&&u2.d.queue.some(q=>q.party_id===sl1.party_id&&q.status==='WAITING')})());
 const rq={id:'rq',party_id:98,prefix:'HS',type:'R',name:'Quin',party_size:2,time:iso(N),duration_min:60,phone:'',notes:'',table_id:null,status:'BOOKED'},dr={...d0,reservations:[...d0.reservations,rq]},sr=m.seatParty(dr,m.resReq(rq),[],'f1',N,'auto');
 t('unseat a reservation: back to QUEUED with a priority entry',!('err' in sr)&&(()=>{const u=m.unseatToQueue(sr.d,sr.d.slots[sr.d.slots.length-1].id,N);return u.d.reservations.find(x=>x.id==='rq').status==='QUEUED'&&u.d.queue.some(q=>q.origin_reservation_id==='rq'&&q.status==='WAITING'&&q.type==='P')})());
 // unqueue -> door
 const ub=m.unqueueToDoor(e1.d,e1.entry.id,N);
 t('unqueue (walk-in): leaves the queue, returns as a door entry with the guests who are here',!ub.queue.some(q=>q.id===e1.entry.id)&&ub.sim.some(x=>x.kind==='walkin'&&x.name==='Zed'&&x.size===3&&x.here===3));
 t('unqueue (reservation): booked again + door arrival for the reservation',(()=>{const pr={...dr,reservations:dr.reservations.map(x=>x.id==='rq'?{...x,status:'QUEUED',arrived_count:2}:x),queue:[{...e1.entry,id:'qx',origin_reservation_id:'rq',party_size:2,arrived_count:2}]},r=m.unqueueToDoor(pr,'qx',N);return r.reservations.find(x=>x.id==='rq').status==='BOOKED'&&r.reservations.find(x=>x.id==='rq').arrived_count===0&&r.sim.some(x=>x.kind==='arrive'&&x.ref.id==='rq')&&!r.queue.length})());
}
console.log(bad?`${bad} FAILED`:'all unit tests pass');process.exit(bad?1:0);
