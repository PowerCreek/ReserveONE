import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import type {Coach, Components, Entity, HostEngine, HostEvent, Patch, State, World} from '../contracts/index.ts'
import {App} from '../kernel/index.ts'
import {dom, settle} from '../test/dom.ts'
import {explain} from './events.ts'
import {ui} from './index.ts'
import {fake, click, seed} from './rig.ts'
import {party} from './party.ts'
import {uiOf} from './state.ts'
const want = {feat: 'banquette', level: 'strong', why: 'bench', accord: 'all'} as const
const chen = () => party(1, 'W', 4, 'Chen', {queue: {since: 0, quotedMin: 5, status: 'WAITING', from: null}, wants: {list: [want, {feat: 'quiet', level: 'soft', why: 'nice', accord: 'one'}], heard: []}, mood: {score: 0}})
const tbl = (id: string, label: string, cap: number): Entity => ({id, pos: {floor: 'f1', x: 100, y: 60, w: 70, h: 70}, table: {label, capacity: cap, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}})
const set = (id: string, parts: Partial<Components>): Patch => ({op: 'set', id, parts})
/** Contract-typed Coach double: records `heard`, offers T2 as a near rung, answers a request with swap/explain. */
const coach: Coach = {
  intake: (_p, w, _n, id, heard) => ({ok: true, tone: 'ok', msg: `Recorded ${heard.length}`, patches: [set(id, {wants: {...w.ents[id].wants!, heard}})]}),
  match: () => [],
  ladder: (_p, _w, _n, id) => id ? [{step: 'near', spot: 't2', gives: ['banquette'], lacks: [{feat: 'booth', level: 'strong', why: 'bench'}], waitMin: 0, say: 'T2 has a banquette, not a booth.'}, {step: 'wait', spot: null, gives: [], lacks: [], waitMin: 9, say: 'A booth opens in 9 min.'}] : [],
  ask: () => ({ok: false, err: 'unused'}),
  options: (_p, _w, _n, id) => id ? [{response: 'swap', label: 'Move them', say: 'Let me move you.', spot: 't2'}, {response: 'explain', label: 'Explain', say: 'Here is what I can do.', spot: null}] : [],
  respond: (_p, w, _n, id, response) => {
    const r = w.ents[id].request!
    const swap = response === 'swap'
    const events: HostEvent[] = [{ev: 'replied', party: id, reason: r.reason, response, move: swap ? 'swap' : 'stay', mood: swap ? 3 : 0}, ...(swap ? [{ev: 'moved', party: id, from: r.table, to: 't2'} as HostEvent] : [])]
    return {patches: [set(id, {request: {...r, status: swap ? 'granted' : 'declined'}})], events, move: swap ? 'swap' : 'stay', mood: swap ? 3 : 0, says: swap ? 'Wonderful.' : 'Thanks for explaining.'}
  },
}
const mount = (ents: Entity[], engine: Partial<HostEngine> = {...fake(), ...coach}) => {
  const el = dom().getElementById('app')!
  const s: State = seed()
  const host: Entity = {id: 'host', body: {role: 'host', x: 0, y: 0, speed: 80, task: null, backlog: [], party: null}}
  s.world.ents = Object.fromEntries([{id: 'f1', floor: {name: 'Main', active: true}}, host, ...ents].map((e): [string, Entity] => [e.id, e]))
  const app = App.create(s).use(a => a.provide('engine', engine as HostEngine)).use(ui)
  app.mount(el)
  return {el, app}
}
const log = (app: ReturnType<typeof mount>['app']) => uiOf(app).log.map(l => l.msg)
const text = (el: Element, sel: string) => el.querySelector(sel)!.textContent!
test('greet: the next party at the door is greeted by the host and narrated', async () => {
  const {el, app} = mount([chen(), tbl('t1', 'T1', 4), tbl('t2', 'T2', 4)])
  await settle()
  assert.match(text(el, '[data-stand]'), /At the door/)
  click(el, '[data-act="stand-greet"]')
  assert.deepEqual(uiOf(app).stand.greeted, ['p1'])
  assert.equal(log(app)[0], 'The host greeted Chen party at the door')
  await settle()
  assert.match(text(el, '[data-stand]'), /Greeted Chen party/)
  assert.equal(el.querySelectorAll('[data-act="stand-greet"]').length, 0)
})
test('intake chips: asking records the want (feature, level, why) and narrates what was heard', async () => {
  const {el, app} = mount([chen()])
  await settle()
  assert.match(text(el, '[data-stand]'), /Nothing recorded yet/)
  click(el, '[data-act="stand-hear"][data-feat="banquette"]')
  assert.deepEqual(app.store.state.world.ents.p1.wants!.heard, ['banquette'])
  await settle()
  assert.match(text(el, '[data-stand]'), /banquette \| strong \| the bench side suits us/)
  assert.equal(el.querySelectorAll('[data-act="stand-hear"][data-feat="banquette"]').length, 0)
  assert.equal(log(app)[0], 'Chen party strongly wants the banquette (the bench side suits us)')
  click(el, '[data-act="stand-hear"][data-feat="booth"]') // asked, no such want
  await settle()
  assert.match(text(el, '[data-stand]'), /asked: no booth/)
})
test('ladder: rungs offer, Accept leads the party, Seat books the table; Decline is narrated', async () => {
  const {el, app} = mount([chen(), tbl('t1', 'T1', 4), tbl('t2', 'T2', 4)])
  await settle()
  assert.equal(el.querySelectorAll('[data-act="stand-offer"]').length, 1) // the wait rung has no spot
  click(el, '[data-act="stand-offer"]')
  assert.equal(app.store.state.world.ents.p1.offer!.status, 'open')
  assert.match(log(app).join('|'), /The host offered Chen party the banquette at T2 \(near\)/)
  await settle()
  assert.equal(el.querySelectorAll('[data-act="stand-offer"]').length, 0) // an open offer shows only its answer, not the same offer again
  click(el, '[data-act="stand-answer"][data-yes="0"]')
  assert.equal(app.store.state.world.ents.p1.offer!.status, 'declined')
  assert.equal(log(app)[0], 'Chen party declined the banquette')
  await settle()
  click(el, '[data-act="stand-offer"]')
  await settle()
  click(el, '[data-act="stand-answer"][data-yes="1"]')
  assert.equal(app.store.state.world.ents.p1.offer!.status, 'accepted')
  assert.equal(log(app)[0], 'The host led Chen party to T2')
  await settle()
  assert.equal(el.querySelectorAll('[data-act="stand-greet"]').length, 0) // led parties leave the door list
  click(el, '[data-act="stand-seatled"]')
  assert.equal(having(app.store.state.world, 'table').filter(t => t.table.status === 'occupied').length, 1)
  await settle()
  assert.equal(el.querySelectorAll('[data-act="stand-offer"]').length, 0) // a seated party is out of the offer flow: no next table is offered for it
  assert.match(text(el, '[data-stand]'), /Pick a party/)
})
test('requests: open request lists the reason and options; a reply applies patches and narrates host events', async () => {
  const sat = {...chen(), request: {reason: 'noise', stage: 'seated', table: 't1', at: 0, status: 'open', spot: null}} as Entity
  const {el, app} = mount([sat, tbl('t1', 'T1', 4), tbl('t2', 'T2', 4)])
  await settle()
  assert.match(text(el, '[data-stand]'), /noise, seated\): "It is too loud for us to talk\."/)
  assert.deepEqual([...el.querySelectorAll('[data-act="stand-reply"]')].map(b => b.textContent), ['Move them', 'Explain'])
  click(el, '[data-act="stand-reply"][data-r="swap"]')
  assert.equal(app.store.state.world.ents.p1.request!.status, 'granted')
  const [says, moved, replied] = log(app)
  assert.equal(says, 'Chen party: "Wonderful."')
  assert.equal(moved, 'Chen party moved from T1 to T2')
  assert.match(replied, /answered the noise request of Chen party with "Move them"/)
  await settle()
  assert.match(text(el, '[data-stand]'), /No open requests/)
})
test('without the host service the stand degrades to notes instead of throwing', async () => {
  const {el, app} = mount([chen()], fake())
  await settle()
  assert.match(text(el, '[data-stand]'), /Engine host service not available/)
  click(el, '[data-act="stand-hear"][data-feat="banquette"]')
  assert.match(log(app)[0], /engine\.intake is not available/)
})
test('every HostEvent has a narrated plain sentence (and the decline-and-leave example)', () => {
  const w: World = {nextParty: 2, ents: {p1: chen(), host: {id: 'host', body: {role: 'host', x: 0, y: 0, speed: 1, task: null, backlog: [], party: null}}, t1: tbl('t1', 'T1', 4), t2: tbl('t2', 'T2', 4)}}
  w.ents.p1.offer = {spot: 't2', step: 'near', gives: ['banquette'], lacks: [], at: 0, status: 'declined'}
  const all: HostEvent[] = [
    {ev: 'greeted', party: 'p1', by: 'host'}, {ev: 'heard', party: 'p1', feat: 'banquette', level: 'strong'}, {ev: 'quoted', party: 'p1', min: 12},
    {ev: 'offered', party: 'p1', spot: 't2', step: 'near'}, {ev: 'answered', party: 'p1', spot: 't2', yes: true}, {ev: 'led', party: 'p1', table: 't2', by: 'host'},
    {ev: 'asked', party: 'p1', reason: 'noise', stage: 'seated'}, {ev: 'replied', party: 'p1', reason: 'noise', response: 'swap', move: 'swap', mood: 3},
    {ev: 'moved', party: 'p1', from: 't1', to: 't2'}, {ev: 'mood', party: 'p1', delta: -2, why: 'noise'},
  ]
  const msgs = all.map(e => explain(e, w).msg)
  assert.deepEqual(msgs, [
    'The host greeted Chen party at the door', 'Chen party strongly wants the banquette (the bench side suits us)', 'Chen party was quoted 12 min',
    'The host offered Chen party the banquette at T2 (near)', 'Chen party accepted the banquette', 'The host led Chen party to T2',
    'Chen party asked for another table (noise, already seated): "It is too loud for us to talk."',
    'The host answered the noise request of Chen party with "Move them": moving them (mood +3)',
    'Chen party moved from T1 to T2', 'Chen party mood fell by 2: noise',
  ])
  w.ents.p1 = {...w.ents.p1, queue: undefined}
  assert.equal(explain({ev: 'answered', party: 'p1', spot: 't2', yes: false}, w).msg, 'Chen party declined the banquette and left the list')
  assert.equal(explain({ev: 'left', party: 'p1'}, w).msg, 'W1 x4 left the list after declining the banquette')
})
// ---- awareness (service modes): who must be told
const dana: Entity = {id: 'dana', body: {role: 'server', x: 0, y: 0, speed: 1, task: null, backlog: [], party: null}, staff: {name: 'Dana', active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40}}
const inArea = (e: Entity, id: string): Entity => ({...e, area: {id}})
const sat = (id: string, party: string, table: string, told?: boolean): Entity =>
  ({id, slot: {table, party, seatedAt: 0, turnAt: 3600000, status: 'ACTIVE', ...(told ? {told: {by: 'host', at: 0}} : {})}})
const seatedP = (n: number, name: string) => party(n, 'W', 2, name, {})
/** Contract-typed Service double: Dana holds everything; tell refuses seen areas and sets `slot.told`. */
const service: Partial<HostEngine> = {
  serverFor: () => ({staff: 'dana', fallback: false, by: 'chunks' as never}),
  tell: (_p, w, now, table) => {
    const s = having(w, 'slot').find(x => x.slot.table === table && x.slot.status === 'ACTIVE')
    return s ? {ok: true, tone: 'ok', msg: 'told', patches: [set(s.id, {slot: {...s.slot, told: {by: 'host', at: now}}})]} : {ok: false, err: 'nobody seated there'}
  },
}
const world3 = () => [dana, seatedP(1, 'Chen'), seatedP(2, 'Ortiz'), inArea(tbl('t4', 'P4', 4), 'grotto'), tbl('t5', 'P5', 4), sat('s1', 'p1', 't4'), sat('s2', 'p2', 't5')]
test('awareness: untold grotto seating is pending with Tell Dana; main floor names the server who sees it and has no action', async () => {
  const {el} = mount(world3(), {...fake(), ...coach, ...service})
  await settle()
  const pane = text(el, '[data-stand]')
  assert.match(pane, /Chen party at P4 \(Grotto\) Not told yet Tell Dana/)
  assert.match(pane, /Ortiz party at P5 \(Main floor\) Dana sees it/)
  assert.deepEqual([...el.querySelectorAll('[data-act="stand-tell"]')].map(b => b.getAttribute('data-table')), ['t4'])
})
test('awareness: Tell calls engine.tell, writes slot.told, swaps the badge and narrates "You told Dana ..."', async () => {
  const {el, app} = mount(world3(), {...fake(), ...coach, ...service})
  await settle()
  click(el, '[data-act="stand-tell"]')
  assert.equal(app.store.state.world.ents.s1.slot!.told!.by, 'host')
  assert.equal(log(app)[0], 'You told Dana the Chen party is at P4')
  await settle()
  assert.match(text(el, '[data-stand]'), /Chen party at P4 \(Grotto\) Told Dana/)
  assert.equal(el.querySelectorAll('[data-act="stand-tell"]').length, 0)
})
test('awareness: an already-told seating shows the told chip; a refusal or a missing engine.tell is a warning, not a throw', async () => {
  const told = mount([dana, seatedP(1, 'Chen'), inArea(tbl('t4', 'P4', 4), 'grotto'), sat('s1', 'p1', 't4', true)], {...fake(), ...coach, ...service})
  await settle()
  assert.match(text(told.el, '[data-stand]'), /Told Dana/)
  const bare = mount(world3(), {...fake(), ...coach})
  await settle()
  assert.match(text(bare.el, '[data-stand]'), /Not told yet Tell server/)
  click(bare.el, '[data-act="stand-tell"]')
  assert.match(log(bare.app)[0], /engine\.tell is not available/)
  assert.equal(bare.app.store.state.world.ents.s1.slot!.told, undefined)
  const refuse = mount(world3(), {...fake(), ...coach, ...service, tell: () => ({ok: false, err: 'no server holds P4'})})
  await settle()
  click(refuse.el, '[data-act="stand-tell"]')
  assert.equal(log(refuse.app)[0], 'no server holds P4')
})
test('told describer names the teller (You for the host, a name otherwise) and the server', () => {
  const w: World = {nextParty: 3, ents: Object.fromEntries(world3().concat([{id: 'host', body: {role: 'host', x: 0, y: 0, speed: 1, task: null, backlog: [], party: null}}]).map((e): [string, Entity] => [e.id, e]))}
  assert.equal(explain({ev: 'told', party: 'p1', table: 't4', server: 'dana', by: 'host'}, w).msg, 'You told Dana the Chen party is at P4')
  assert.equal(explain({ev: 'told', party: 'p1', table: 't4', server: 'dana', by: 'dana'}, w).msg, 'Dana told Dana the Chen party is at P4')
})
test('merge offer: Accept leads the party to the merged tables, Seat books both tables', async () => {
  const seen: string[][] = []
  const rung = {step: 'merge', spot: 'm:t1+t2', gives: [], lacks: [], waitMin: 0, say: 'Push T1 and T2 together: seats 8.'}
  const engine = {...fake(), ...coach, ladder: () => [rung], seat: (_p, _w, _n, req) => (seen.push(req.tables ?? []), {ok: true, msg: 'Seated', tone: 'ok', patches: []})} as Partial<HostEngine>
  const {el, app} = mount([chen(), tbl('t1', 'T1', 4), tbl('t2', 'T2', 4)], engine)
  await settle()
  click(el, '[data-act="stand-offer"]')
  assert.equal(app.store.state.world.ents.p1.offer!.spot, 'm:t1+t2')
  assert.match(log(app).join('|'), /The host offered Chen party T1\+T2 at T1\+T2 \(merge\)/)
  await settle()
  click(el, '[data-act="stand-answer"][data-yes="1"]')
  assert.equal(app.store.state.world.ents.p1.offer!.status, 'accepted')
  assert.equal(log(app)[0], 'The host led Chen party to T1+T2')
  await settle()
  assert.match(text(el, '[data-stand]'), /led to T1\+T2, not seated/)
  click(el, '[data-act="stand-seatled"]')
  assert.deepEqual(seen, [['t1', 't2']])
})
