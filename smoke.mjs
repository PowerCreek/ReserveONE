import {JSDOM} from 'jsdom';import fs from 'fs';
const html=fs.readFileSync(process.env.OUT||'dist/index.html','utf8'),errs=[];
const d=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.addEventListener('error',e=>errs.push(e.message));w.SVGElement.prototype.getScreenCTM=()=>({inverse:()=>({}),a:1});w.DOMPoint=class{constructor(x,y){this.x=x;this.y=y}matrixTransform(){return this}};w.confirm=()=>true}});
const w=d.window,q=s=>[...w.document.querySelectorAll(s)],tick=(n=40)=>new Promise(r=>setTimeout(r,n));
const btn=(t,sc='button')=>q(sc).find(b=>b.textContent.trim().startsWith(t)||b.textContent.includes(t));
const panel=h=>q('.panel').find(p=>p.querySelector('h3')?.textContent.startsWith(h));
const pb=(p,t)=>[...p.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(t));
const set=(el,v)=>{const p=el.tagName==='SELECT'?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,v);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))};
const ok=(n,c)=>console.log(c?'PASS':'FAIL',n);
const doCog=async l=>{q('button').find(b=>b.title==='Widget options').click();await tick();btn(l).click();await tick()};
await tick(300);
ok('section blobs (masks) on canvas',q('mask').length>=3&&!q('filter#goo').length);
ok('no polygon/zone UI',!panel('Zones'));
// dock + custom tile
ok('dock: 6 tiles + custom',q('.dock .tile').length===7&&q('.ctile input').length===1);
set(q('.ctile input')[0],'9');await tick();q('.ctile button')[0].click();await tick();ok('custom 9-top added',q('.card .rail')[0]?.textContent==='9-TOP');
const dk=()=>q('button').find(b=>b.title==='Show / hide drawer');dk().click();await tick();ok('dock collapses',!q('.dockbody').length&&q('.dockbar .script').length===1);dk().click();await tick();ok('dock reopens',q('.dockbody').length===1);
btn('Clear 1').click();await tick();
{const tile=()=>q('.dock .tile').find(b=>b.textContent.startsWith('2-top'));tile().click();await tick();tile().click();await tick();
 ok('N-top cards show predicted server + tally before→after',q('.card .srv').length===2&&q('.card .srv').every(e=>/→ \w+ \d+→\d+/.test(e.textContent)));
 ok('rotation strip: standings with predicted gain adding to 4',q('.tstrip .rchip').length>=4&&q('.tstrip .rchip').filter(e=>e.classList.contains('ok')).length===1&&q('.tstrip sup').reduce((n,e)=>n+ +e.textContent.replace('+',''),0)===4&&/after sequence/.test(q('.tstrip')[0].textContent));
 ok('drawer bar line shows predicted server tally',/· \w+ \d+→\d+/.test(q('.dockbar .script')[0].textContent));
 btn('Clear 2').click();await tick();ok('strip reads "now" with empty sequence',/ now/.test(q('.tstrip')[0].textContent)&&!q('.tstrip sup').length);}
// party label + seating
ok('fast seating previews auto target (table + server)',(()=>{const b=q('.pvbox')[0];return !!b&&b.textContent.includes('Table')&&b.textContent.includes('Server')})());
ok('queue Seat button names its target',q('.entry button').some(b=>/^Seat → /.test(b.textContent)));
btn('Auto-allocate').click();await tick();ok('receipt: party/table/server/turn + undo',(()=>{const t=q('.rcpt')[0]?.textContent||'';return t.includes('HS-W-9')&&t.includes('Table')&&t.includes('Server')&&t.includes('Turn')&&t.includes('Undo')})());
{const tile=n=>q('.dock .tile').find(b=>b.textContent.startsWith(n+'-top')),qc=()=>+(panel('Queue').querySelector('h3').textContent.match(/\((\d+)\)/)?.[1]??-1);
 tile(2).click();await tick();ok('N-top card says what a tap does (ready -> seat)',/tap → seat/.test(q('.card .act')[0].textContent));
 q('.card')[0].click();await tick();ok('tapping a ready N-top card auto-seats it and clears the card',/Seated/.test(q('.rcpt')[0].textContent)&&q('.card').length===0);
 const n0=qc();set(q('.ctile input')[0],'12');await tick();q('.ctile button')[0].click();await tick();ok('oversize card says it will queue',/tap → queue/.test(q('.card .act')[0].textContent));
 q('.card')[0].click();await tick();ok('tapping a non-ready card queues it with quote + plan',qc()===n0+1&&/Added to queue/.test(q('.rcpt')[0].textContent)&&/Quote/.test(q('.rcpt')[0].textContent)&&q('.card').length===0);
 set(q('.ctile input')[0],'8');await tick();}
{const fp=()=>panel('Fast seating');pb(fp(),'Mark ahead').click();await tick();
 ok('mark-ahead mode: when + length inputs and a conflict-free best-table preview',!!fp().querySelector('input[type=datetime-local]')&&!!fp().querySelector('input[aria-label="Duration minutes"]')&&/Table \w+/.test(fp().querySelector('.pvbox').textContent));
 pb(fp(),'Auto-mark').click();await tick();ok('auto-mark holds a table: receipt names guest, when and table',/Table marked ahead/.test(q('.rcpt')[0].textContent)&&/When/.test(q('.rcpt')[0].textContent)&&/Table/.test(q('.rcpt')[0].textContent));
 pb(fp(),'Seat now').click();await tick();ok('back to seat-now mode',!!pb(fp(),'Auto-allocate')&&!fp().querySelector('input[type=datetime-local]'));}
// collapse / pin
const fp=panel('Fast seating');fp.querySelector('.pbtn').click();await tick();ok('panel collapses',!panel('Fast seating').querySelector('.btn.primary'));
panel('Fast seating').querySelector('.pbtn').click();await tick();
panel('Fast seating').querySelector('.pbtn[title="Pin open"]').click();await tick();ok('pin sets disabled collapse',panel('Fast seating').querySelector('.pbtn').disabled);
btn('⊟').click();await tick();ok('collapse-all keeps pinned open',!!panel('Fast seating').querySelector('.btn.primary')&&!panel('Staff pool').querySelector('input'));btn('⊞').click();await tick();
// gantt
btn('Gantt').click();await tick();
const rowsA=q('.grow').length;ok('gantt active-only rows',rowsA>3&&q('.gbar.slot').length>=3);
q('.glabel').find(e=>e.textContent.startsWith('A3')).click();await tick();ok('gantt click -> inspector shows table',q('h3').some(h=>h.textContent==='Table A3')&&q('.tcard').length>=1);
ok('locator pin appears for the referenced table',q('.locator .locbtn').length===1&&q('.locbtn')[0].textContent.includes('A3'));
q('.locbtn')[0].click();await tick();ok('locator popup = interactive canvas with arrow on target',q('.modal.big .cv').length===1&&q('.modal.big text').filter(x=>x.textContent==='▼').length===1);
q('.modal.big .pbtn[title="Close"]')[0].click();await tick();ok('locator popup closes',!q('.modal.big').length);
q('.glabel').find(e=>e.textContent.startsWith('B1')).click();await tick();btn('Mark Available').click();await tick();
ok('clear receipt: table + closed party + server delta',(()=>{const t=q('.rcpt')[0]?.textContent||'';return t.includes('Table cleared')&&t.includes('HS-W-2')&&t.includes('covers')})());
btn('Active only').click();await tick();ok('all tables toggle adds rows',q('.grow').length>rowsA);
q('.glabel').find(e=>e.textContent.startsWith('C3')).click();await tick();
set(q('select').find(x=>[...x.options].some(o=>o.textContent==='No section')),'sA');await tick();btn('Canvas').click();await tick();
ok('fragmented section: all its bubbles dotted (pattern fill), not solid',q('pattern[id="dt_f1_sA"]').length===1&&q('.cv rect[fill="url(#dt_f1_sA)"]').length===1&&q('.cv rect[fill="#38bdf8"][fill-opacity="0.17"]').length===0);
ok('bubble fill = hull polygons in mask (no line strokes)',q('mask[id="bm_f1_sB"] polygon').length===1&&!q('mask line').length);
ok('unified section B stays solid; blocked section C also dotted',q('.cv rect[fill-opacity="0.17"]').length===1&&q('pattern[id="dt_f1_sC"]').length===1);
btn('Gantt').click();await tick();
btn('⚙').click();await tick();set(q('input[aria-label="Update seconds"]')[0],'7');await tick();ok('gantt interval configurable (free-typed)',q('input[aria-label="Update seconds"]')[0].value==='7');
set(q('input[aria-label="Update seconds"]')[0],'1');set(q('input[aria-label="NOW anchor percent"]')[0],'0');await tick();
ok('gantt: 1 s update and 0% anchor accepted (any %)',q('input[aria-label="Update seconds"]')[0].value==='1'&&q('input[aria-label="NOW anchor percent"]')[0].value==='0');
ok('gantt: full-height NOW line + NOW tag in the header; 5m/10m zoom',q('.gnowline').length===1&&/^NOW /.test(q('.gnowtag')[0]?.textContent||'')&&['5m','10m','15m','30m','1h'].every(l=>q('.toolbar .btn').some(b=>b.textContent===l)));
// reserve + day nav + CRUD
btn('Reserve').click();await tick();ok('reserve stats',q('.stats .panel').length===5);
const rp=()=>panel('Reservations');
ok('no inline add button/form in reservations',!pb(rp(),'＋ Add')&&!q('.entry .form').length);
ok('queue has no own add form (Fast seating is the one way)',!pb(panel('Queue'),'＋ Add')&&!q('.form input[placeholder="Name"]').length);
pb(rp(),'📖').click();await tick();ok('Book wizard opens in drawer',q('.wizard').length===1);
set(q('input[placeholder="Guest name"]')[0],'Zed');await tick();btn('Next ▸').click();await tick();ok('step 2 date+time',!!q('.wizard input[type=date]')[0]&&!!q('.wizard input[type=time]')[0]);
btn('Next ▸').click();await tick();ok('step 3 best fit + chips',!!btn('★ Best fit')&&q('.wizard .chip').length>5);btn('Book reservation').click();await tick();
ok('reservation added today',q('.entry').some(e=>e.textContent.includes('Zed')));
const zed=()=>q('.entry').find(e=>e.textContent.includes('Zed'));ok('edit+delete buttons present',!!pb(zed(),'Edit')&&!!pb(zed(),'Delete'));
pb(zed(),'Edit').click();await tick();ok('edit loads into wizard',q('input[placeholder="Guest name"]')[0].value==='Zed');
set(q('input[placheholder]')[0]||q('input[placeholder="Guest name"]')[0],'Zed2');await tick();btn('Save changes').click();await tick();ok('reservation edited',q('.entry').some(e=>e.textContent.includes('Zed2')));
{pb(panel('Reservations'),'all').click();await tick();
 const z=()=>q('.entry').find(e=>e.textContent.includes('Zed2')&&e.querySelector('.hrow'));
 ok('reservation card shows the partial-arrival row (here 0/2)',!!z()&&/here 0\/2/.test(z().textContent));
 pb(z(),'＋').click();await tick();ok('first guest arrives: state Arrived, here 1/2, 1 to come',/here 1\/2/.test(z().textContent)&&z().querySelector('.statrow .chip.on').textContent==='Arrived'&&/1 to come/.test(z().textContent));
 ok('Expecting panel + header badge show who to watch for',/Zed2/.test(panel('Expecting')?.textContent||'')&&/⏳ 1 to come/.test(q('.hdr')[0].textContent));
 btn('Canvas').click();await tick();w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));await tick();btn('Reserve').click();await tick();// clear any leftover table selection (Seat targets the selection first)
 [...z().querySelectorAll('button:not(.chip)')].find(b=>/^Seat( →| ✕|$)/.test(b.textContent)).click();await tick();
 ok('seating the reservation: state Seated, arrival kept at 1/2 (still expecting 1), receipt says so',z().querySelector('.statrow .chip.on').textContent==='Seated'&&/here 1\/2/.test(z().textContent)&&/seated/.test(panel('Expecting').textContent)&&/1 to come/.test(panel('Expecting').textContent)&&/Still to come/.test(q('.rcpt')[0].textContent));
 pb(panel('Expecting'),'all here').click();await tick();ok('all here clears the expectation',!/Zed2/.test(panel('Expecting').textContent)&&/here 2\/2/.test(z().textContent));}
pb(q('.entry').find(e=>e.textContent.includes('Zed2')),'Delete').click();await tick();ok('reservation deleted',!q('.entry').some(e=>e.textContent.includes('Zed2')));
const nav=q('.daynav button');nav[1].click();await tick();ok('tomorrow shows Tanaka, not today-only items',q('.entry').some(e=>e.textContent.includes('Tanaka'))&&!q('.entry').some(e=>e.textContent.includes('Lindqvist')));
[...q('.entry').find(e=>e.textContent.includes('Tanaka')).querySelectorAll('button:not(.chip)')].find(b=>/^Seat( →| ✕|$)/.test(b.textContent)).click();await tick();ok('seat guard for other day',q('.status')[0].textContent.includes('not today'));
q('.daynav button')[2].click();await tick();ok('Today restores',q('.entry').some(e=>e.textContent.includes('Lindqvist')));
const late=q('.entry.late')[0];ok('late entry',!!late);pb(late,'⏫').click();await tick();ok('promoted label HS-P-6',q('.entry').some(e=>/HS-P-6/.test(e.textContent)));ok('priority receipt',(q('.rcpt')[0]?.textContent||'').includes('priority queue'));
{pb(panel('Reservations'),'all').click();await tick();
 const lin=()=>q('.entry').find(e=>e.textContent.includes('Lindqvist')&&e.querySelector('.statrow')),chip=l=>[...lin().querySelectorAll('.statrow .chip')].find(c=>c.textContent===l),qn=()=>+(panel('Queue').querySelector('h3').textContent.match(/\((\d+)\)/)?.[1]??-1);
 ok('every reservation card offers all 5 states; old one-off buttons are gone',!!lin()&&['Booked','Arrived','Seated','No-show','Queued'].every(l=>!!chip(l))&&![...lin().querySelectorAll('button:not(.chip)')].some(b=>/^(Reopen|No-show|Arrived)/.test(b.textContent)));
 ok('current state highlighted (Queued after priority)',chip('Queued').classList.contains('on'));
 const q1=qn();chip('Booked').click();await tick();ok('QUEUED → BOOKED allowed; withdraws the priority queue entry',chip('Booked').classList.contains('on')&&qn()===q1-1&&/withdrawn/.test(q('.rcpt')[0].textContent));
 for(const l of ['Arrived','No-show','Seated','Booked']){chip(l).click();await tick();}
 ok('can cycle through every state and land back on Booked',chip('Booked').classList.contains('on')&&!chip('Seated').classList.contains('on'));}
// audit
btn('Audit').click();await tick();ok('audit logs create+delete+update',q('.arow').some(r=>r.textContent.includes('Zed')&&r.textContent.includes('create'))&&q('.arow').some(r=>r.textContent.includes('delete'))&&q('.arow').length>5);
ok('audit shows server names / none, not ids / null',q('.arow').some(r=>/server: \w+ → none/.test(r.textContent))&&!q('.arow').some(r=>/assigned_waiter_id|→ null/.test(r.textContent)));
ok('audit rows scroll horizontally in place',w.getComputedStyle(q('.arow')[0]).overflowX==='auto');
// staff
ok('rotation cards show tally marks',q('.rcard .tally').length===q('.rcard').length&&q('.rcard').length>=4);
ok('no End of rotation; New service reset present',!btn('End of rotation')&&!!btn('New service'));
const lee=()=>q('.scard').find(e=>e.textContent.startsWith('Lee')),t0=+lee().querySelector('b.nw').textContent;pb(lee(),'＋').click();await tick();ok('tally correction +1',+lee().querySelector('b.nw').textContent===t0+1);
pb(lee(),'Edit').click();await tick();ok('staff edit: no table/cover cap field',!q('input[title="max covers"]').length&&q('.scard .form input').length===1);pb(lee(),'Edit').click();await tick();
{const rn=q('.rcard').map(c=>c.children[0].textContent.replace(/^#\d+ /,'')),sn=q('.scard').map(c=>c.children[0].textContent);ok('staff cards follow the tally order shown up top',rn.length>=4&&rn.every((n,i)=>sn[i].startsWith(n))&&sn[0].includes('next up'));}
ok('top cards: tally in a spaced row with count (same as staff)',q('.rcard .row .tally').length===q('.rcard').length&&q('.rcard .row b.nw').length===q('.rcard').length);
ok('bus entries name the next server + rank',/\w+ #\d/.test(panel('Bus priority')?.textContent||''));
ok('ledger: state groups + interval chips',!!panel('Ledger')&&panel('Ledger').querySelectorAll('.lrow').length>=6&&!!pb(panel('Ledger'),'5m'));
pb(panel('Ledger'),'5m').click();await tick();ok('ledger interval selectable',pb(panel('Ledger'),'5m').classList.contains('on'));
{const inp=()=>panel('Ledger').querySelector('input[aria-label="Interval minutes"]'),fire=(el,t)=>el.dispatchEvent(new w.FocusEvent(t,{bubbles:true}));
 fire(inp(),'focusin');set(inp(),'');await tick();ok('number field can be fully cleared while typing (no snap-back to 1)',inp().value===''&&pb(panel('Ledger'),'5m').classList.contains('on'));
 set(inp(),'4');await tick();set(inp(),'45');await tick();ok('free typing: partial then full value commits',inp().value==='45'&&!pb(panel('Ledger'),'5m').classList.contains('on'));
 set(inp(),'');await tick();fire(inp(),'focusout');await tick();ok('blur with empty text restores the last valid value',inp().value==='45');
 fire(inp(),'focusin');set(inp(),'9999');await tick();fire(inp(),'focusout');await tick();ok('blur clamps an out-of-range value to the max (240)',inp().value==='240');}
ok('ledger lists seat (+) and clear (−) events',q('.lchip.in').length>=1&&q('.lchip.out').length>=1);
const tp=()=>panel('Turnover');
ok('turnover panel: 9 interval rows',!!tp()&&tp().querySelectorAll('.ttab .tin').length===9);
pb(tp(),'30m').click();await tick();ok('interval chip 30m active, rows realign',pb(tp(),'30m').classList.contains('on')&&tp().querySelectorAll('.ttab .tin').length===9);
set(tp().querySelector('select'),'25');await tick();ok('select allows any multiple of 5 >= 10',tp().querySelector('select').value==='25'&&tp().querySelectorAll('.ttab .tin').length===9);
ok('current row highlighted; projected rows italic',tp().querySelectorAll('.ttab .tt.now').length===1&&tp().querySelectorAll('.ttab .tt.proj').length>=1);
ok('bifurcated: wait quote + turnover quote',tp().querySelectorAll('.qbox').length===2&&/party of 2/.test(tp().querySelectorAll('.say')[0].textContent)&&/turn over|frees up/.test(tp().querySelectorAll('.say')[1].textContent));
pb(tp(),'6').click();await tick();ok('wait quote follows party size',/party of 6/.test(tp().querySelectorAll('.say')[0].textContent));
ok('no clocked in/out UI',!q('button').some(b=>/Clocked/.test(b.textContent)));
set(q('input[placeholder="New server name"]')[0],'Nova');await tick();pb(panel('Staff pool'),'Add').click();await tick();ok('server added',q('.rcard').some(c=>c.textContent.includes('Nova')));ok('server without a section is flagged',!!q('.scard').find(e=>e.textContent.startsWith('Nova'))?.textContent.includes('no section'));
pb(q('.scard').find(e=>e.textContent.startsWith('Maya')&&e.textContent.includes('open')),'Remove').click();await tick();ok('remove blocked offers reassign',!!btn('Force remove'));btn('Force remove').click();await tick();ok('force removed',!q('.rcard').some(c=>c.textContent.includes('Maya')));
// sections + events
const sp=()=>panel('Sections');const n0=sp().querySelectorAll('.entry').length;set(q('input[placeholder="New section"]')[0],'Bar');await tick();pb(sp(),'Add').click();await tick();ok('section added',sp().querySelectorAll('.entry').length===n0+1);
{const bar=()=>[...sp().querySelectorAll('.entry')].pop(),sel=l=>bar().querySelector(`select[aria-label="${l}"]`);
 ok('sections: every section has a server select (1:1 default)',sp().querySelectorAll('select[aria-label="Server for section"]').length===n0+1);
 ok('new section starts unstaffed (no-server badge)',bar().textContent.includes('no server'));
 set(sel('Server for section'),'w2');await tick();ok('choosing a server is 1:1',!bar().textContent.includes('no server')&&sel('Server for section').value==='w2');
 set(sel('Share section with'),'w4');await tick();ok('open-ended: share with a second server',bar().textContent.includes('shared ×2'));
 set(sel('Server for section'),'w3');await tick();ok('picking a primary again collapses back to 1:1',!bar().textContent.includes('shared')&&sel('Server for section').value==='w3');}
pb([...sp().querySelectorAll('.entry')].pop(),'Delete').click();await tick();ok('section deleted',sp().querySelectorAll('.entry').length===n0);
pb(panel('Private events'),'＋ Event').click();await tick();set(q('select').find(x=>[...x.options].some(o=>o.value==='floor')),'floor');await tick();btn('Add event').click();await tick();
ok('event added pending',q('.entry').some(e=>e.textContent.includes('Private event')&&e.textContent.includes('RESERVED PENDING')));
btn('Split').click();await tick();ok('split: canvas+gantt',q('.cv').length===1&&q('.gscroll').length===1);
ok('undo/redo only in header',!q('.toolbar button').some(b=>/Undo|Redo/.test(b.textContent))&&q('button').some(b=>b.textContent==='↶'));
// drawer widgets: one place at a time
q('button').find(b=>b.title==='Add widget').click();await tick();q('.pop button').find(b=>b.textContent.includes('Bus')).click();await tick();
ok('Bus moved into drawer (gone from sidebar)',q('.dtabs .chip').some(c=>c.textContent==='Bus')&&!panel('Bus priority')&&q('.dockbody').some?.call(q('.dockbody'),b=>b.textContent.includes('dirty')));
await doCog('↥ Move to sidebar');ok('Bus back in sidebar',!!panel('Bus priority')&&!q('.dtabs .chip').some(c=>c.textContent==='Bus'));
panel('Staff pool').querySelector('.pbtn[title="Move to drawer"]').click();await tick();ok('panel ⤓ docks Staff in drawer',q('.dtabs .chip').some(c=>c.textContent==='Staff')&&!panel('Staff pool'));ok('docked panel leaves a restore stub in the sidebar',q('.stub').some(x=>x.textContent.includes('Staff')&&x.textContent.includes('Restore')));await doCog('↥ Move to sidebar');
q('.dtabs .chip').find(c=>c.textContent==='N-top').click();await tick();await doCog('✕ Remove from drawer');ok('tool widget removable, re-addable',!q('.dtabs .chip').some(c=>c.textContent==='N-top'));
q('button').find(b=>b.title==='Add widget').click();await tick();q('.pop button').find(b=>b.textContent.includes('N-top')).click();await tick();ok('N-top re-added',q('.dtabs .chip').some(c=>c.textContent==='N-top')&&q('.tile').length>=7);
// no-wrap rule
ok('operational data is nowrap (badge, entry items)',w.getComputedStyle(q('.badge')[0]).whiteSpace==='nowrap'&&w.getComputedStyle(q('.entry b')[0]).whiteSpace==='nowrap'&&w.getComputedStyle(q('.entry')[0]).overflowWrap!=='anywhere');
q('.dtabs .chip').find(c=>c.textContent==='Book').click();await tick();ok('N-top summary hidden on other tabs',!q('.dockbar .script').length);
q('.dtabs .chip').find(c=>c.textContent==='N-top').click();await tick();ok('N-top summary shown on its own tab',q('.dockbar .script').length===1);
const bar=q('.dockbar')[0];ok('drawer: ＋ is first tab control (before tabs), accent-styled',bar.children[1].classList.contains('dmenu')&&bar.children[2].classList.contains('dtabs')&&!!bar.querySelector('.addbtn')&&!bar.querySelector('.dmenu .btn.sm'));
ok('staff = row of cards, not data rows',q('.cards .scard').length>=3&&!q('.cards .entry').length&&q('.scard').length===q('.rcard').length);
{const qn=()=>+(panel('Queue').querySelector('h3').textContent.match(/\((\d+)\)/)?.[1]??-1),seated=()=>+(q('.badge.ok')[0].textContent.match(/(\d+) seated/)?.[1]??-1),sm=()=>q('.panel').find(p=>p.querySelector('h3')?.textContent.startsWith('Simulation')),se=()=>panel('Door list');
 ok('simulation panel offers entry; generators + door list hidden outside sim',!!sm()&&!!pb(sm(),'🧪')&&!pb(sm(),'Generate door entries')&&!se());
 const q0=qn(),s0=seated();pb(sm(),'🧪').click();await tick(400);
 ok('banner + separate sim storage once in simulation',q('.simbar').length===1&&!!w.localStorage.getItem('host-seating-planner:sim:v1'));
 ok('entering auto-populates the Door list (walk-ins + reservation arrivals)',!!se()&&se().querySelectorAll('.entry').length>=3);
 ok('nothing was dumped into the queue',qn()===q0);
 const walk=()=>[...se().querySelectorAll('.entry')].find(e=>pb(e,'→ Queue'));
 pb(walk(),'→ Queue').click();await tick();ok('→ Queue uses the normal flow: queue +1, receipt, entry leaves the door list',qn()===q0+1&&/Added to queue/.test(q('.rcpt')[0].textContent));
 set(sm().querySelector('input[aria-label="no-show %"]'),'0');await tick();pb(sm(),'Generate arrivals').click();await tick();
 const okf=[...se().querySelectorAll('.entry')].find(e=>/Okafor/.test(e.textContent)&&pb(e,'Arrive'));ok('reservation arrivals are on the door list (Okafor)',!!okf);
 pb(okf,'Arrive').click();await tick();ok('Arrive uses the normal flow (Arrivals receipt, reservation marked arrived/partial)',/Arrivals/.test(q('.rcpt')[0].textContent));
 pb(sm(),'Generate door entries').click();await tick();ok('generator adds more entries (still not the queue)',qn()===q0+1);
 pb(sm(),'Fill dining room').click();await tick();ok('dining room filled (more seated)',seated()>s0);
 const s1=seated();pb(sm(),'+60 min').click();await tick();ok('clock advance shows offset and clears overdue tables',/\+60 min/.test(q('.simbar')[0].textContent)&&seated()<s1);
 {const dl=()=>se().querySelectorAll('.entry').length,wk=[...se().querySelectorAll('.entry')].find(e=>pb(e,'→ Queue')),d0n=dl(),qa=qn();
  [...wk.querySelectorAll('button')].find(b=>b.textContent.includes('⚡')).click();await tick();
  ok('door ⚡ per guest: seats or queues through one path, entry leaves the list, receipt says which',dl()===d0n-1&&/(Seated|Queued) from the door/.test(q('.rcpt')[0].textContent));
  ok('door ⚡ process-everyone button exists',[...se().querySelectorAll('button')].some(b=>b.textContent.includes('Process everyone')));
  const back=[...panel('Queue').querySelectorAll('button')].find(b=>b.textContent.startsWith('↩ Door')),qb=qn(),db=dl();back.click();await tick();
  ok('↩ Door (sim): queue −1, door list +1, receipt',qn()===qb-1&&dl()===db+1&&/Back to the door/.test(q('.rcpt')[0].textContent));
  q('button').find(b=>b.getAttribute('aria-label')==='Collapse simulation status').click();await tick();
  ok('sim status collapses to the 🧪 icon only (bar gone)',!q('.simbar').length&&q('.simdot').length===1);
  ok('sim icon + locator share one fixed parent',q('.simdot')[0].parentElement===q('.fixtop')[0]&&(!q('.locator').length||q('.locator')[0].parentElement===q('.fixtop')[0]));
  q('.simdot')[0].click();await tick();ok('icon expands the bar again',q('.simbar').length===1&&!q('.simdot').length);}
 pb(sm(),'Exit & discard').click();await tick();ok('exit discards: banner gone, queue + seated restored, door list gone, sim storage cleared',!q('.simbar').length&&qn()===q0&&seated()===s0&&!se()&&!w.localStorage.getItem('host-seating-planner:sim:v1'));}
// ---- selection awareness, unseat, clear, help, tags, hover
{btn('Gantt').click();await tick();
 const sp=()=>panel('Fast seating'),sc=()=>q('.selcard')[0],seatB=()=>[...sp().querySelectorAll('button')].find(b=>/^Seat at /.test(b.textContent)),qn=()=>+(panel('Queue').querySelector('h3').textContent.match(/\((\d+)\)/)?.[1]??-1),sb=(t)=>[...sc().querySelectorAll('button')].find(b=>b.textContent.includes(t));
 const pickOcc=async(skip)=>{const r=q('.grow').filter(x=>x.querySelector('.gbar.slot')).find(x=>!skip.includes(x.querySelector('.glabel').textContent.split(' ')[0]));const l=r.querySelector('.glabel');l.click();await tick();return l.textContent.split(' ')[0]};
 const hb=q('.panel .helpb').find(b=>b.getAttribute('aria-label')==='About Fast seating');hb.click();await tick();
 ok('ⓘ help: popover states the purpose',!!q('.helppop')[0]&&/Seat a party now/i.test(q('.helppop')[0].textContent));hb.click();await tick();ok('ⓘ help: toggles closed',!q('.helppop').length);
 ok('ⓘ help on many containers (panels, gantt, drawer)',q('.helpb').length>=8);
 ok('title rows never clip: h3 is flex with visible overflow',(()=>{const s=w.getComputedStyle(q('.phead h3')[0]);return s.display==='flex'&&s.overflow!=='hidden'})());
 const t1=await pickOcc([]);
 ok('selection card names the occupied table and disables "Seat at"',!!sc()&&sc().classList.contains('occupied')&&sc().textContent.includes(t1)&&/occupied/.test(sc().textContent)&&seatB().disabled&&seatB().textContent.endsWith('✕'));
 ok('occupied selection offers Unseat and Clear',!!sb('Unseat')&&!!sb('Clear'));
 const n0=qn();sb('Unseat').click();await tick();
 ok('unseat → queue: party back in line, receipt, selection card now free',qn()===n0+1&&/Unseated/.test(q('.rcpt')[0].textContent)&&sc().classList.contains('free'));
 ok('free selection: the button names the table and is enabled',!seatB().disabled&&/^Seat at \S+ \(\d+-top\)$/.test(seatB().textContent));
 seatB().click();await tick();
 ok('seat at selected succeeds, then the selection clears (no stale "occupied or blocked")',/Seated/.test(q('.rcpt')[0].textContent)&&!sc()&&!/occupied or blocked/.test(q('.status')[0]?.textContent||''));
 {const chip=q('.rcpt .rchip[data-tid]')[0];chip.dispatchEvent(new w.Event('pointerover',{bubbles:true}));await tick();
  ok('hover card on a reference chip: table, party, here, times',!!q('.hcard')[0]&&/Here \d+\/\d+/.test(q('.hcard')[0].textContent)&&/seated/.test(q('.hcard')[0].textContent)&&/turn/.test(q('.hcard')[0].textContent));
  w.document.body.dispatchEvent(new w.Event('pointerover',{bubbles:true}));await tick();ok('hover card hides when leaving',!q('.hcard').length);}
 const t2=await pickOcc([t1]);btn('Mark Lapsed').click();await tick();
 ok('past-turn selection: card says so, offers Clear & seat here',sc().classList.contains('lapsed')&&!!sb('Clear & seat here')&&seatB().disabled);
 sb('Clear & seat here').click();await tick();ok('Clear & seat here: one step, receipt, selection cleared',/Cleared & seated/.test(q('.rcpt')[0].textContent)&&!sc());
 const t3=await pickOcc([t1,t2]);btn('Mark Lapsed').click();await tick();
 const bp=()=>panel('Bus priority'),cb=()=>[...bp().querySelectorAll('button')].find(b=>b.textContent.includes('Clear table'));
 ok('bus list: every row has 🧹 Clear table',!!bp()&&!!cb());cb().click();await tick();
 ok('bus 🧹 clears the table directly (no Inspector needed)',/Table cleared/.test(q('.rcpt')[0].textContent));
 btn('Canvas').click();await tick();
 ok('canvas tags: party label · name · size under seated tables',q('.cv .ttag').length>=1&&[...q('.cv .ttag')].some(g=>/\S+-\S+-\d+ · .+ (×\d+|\d+\/\d+)/.test(g.textContent)));
 q('.cv g[data-tid]')[0].dispatchEvent(new w.Event('pointerover',{bubbles:true}));await tick();ok('hover card on a canvas table',!!q('.hcard')[0]&&/server/.test(q('.hcard')[0].textContent));
 w.document.body.dispatchEvent(new w.Event('pointerover',{bubbles:true}));await tick();}
console.log('errors:',errs.length?errs:'none');process.exit(0);
