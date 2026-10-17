// Host stand on the real desk (engine.stand + engine.act): one click leases, `No` drops a spot; a lease settles by the clock or Seat now, Release hands it back; requests and tells go through the same seam.
import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy, having} from '../contracts/index.ts'
import type {Entity, HostEngine, HostEvent, State, World} from '../contracts/index.ts'
import {Engine} from '../engine/index.ts'
import {booking} from '../engine/booking.ts'
import {App} from '../kernel/index.ts'
import {dom, settle} from '../test/dom.ts'
import {run} from './act.ts'
import {explain} from './events.ts'
import {step, ui} from './index.ts'
import {click, seed} from './rig.ts'
import {party} from './party.ts'
import {uiOf} from './state.ts'
const NOW = Date.UTC(2026, 9, 16, 17, 0)
const want = {feat: 'banquette', level: 'strong', why: 'bench', accord: 'all'} as const
const queued = (since: number) => ({queue: {since, quotedMin: 5, status: 'WAITING' as const, from: null}, mood: {score: 0}})
const chen = () => party(1, 'W', 4, 'Chen', {...queued(NOW - 10 * 60000), wants: {list: [want, {feat: 'quiet', level: 'soft', why: 'nice', accord: 'one'}], heard: []}})
const ortiz = () => party(2, 'W', 2, 'Ortiz', queued(NOW - 5 * 60000))
const tbl = (id: string, label: string, cap: number, tags: string[] = [], over: Partial<Entity> = {}): Entity =>
  ({id, pos: {floor: 'f1', x: 100, y: 60, w: 70, h: 70}, feat: {tags}, table: {label, capacity: cap, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}, ...over})
const ana: Entity = {id: 'ana', staff: {name: 'Ana', active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40}}
const room = () => [chen(), ortiz(), ana, tbl('t1', 'T1', 4), tbl('t2', 'T2', 4, ['banquette']), tbl('t3', 'T3', 6)]
const LEASE = defaultPolicy.host.clock.leaseMin * 60000
const host: Entity = {id: 'host', body: {role: 'host', x: 0, y: 0, speed: 80, task: null, backlog: [], party: null}}
const mount = (ents: Entity[], engine: Partial<HostEngine> = Engine) => {
  const el = dom().getElementById('app')!
  const s: State = {...seed(), now: NOW}
  s.world.ents = Object.fromEntries([{id: 'f1', floor: {name: 'Main', active: true}}, host, ...ents].map((e): [string, Entity] => [e.id, e]))
  const app = App.create(s).use(a => a.provide('engine', engine as HostEngine).provide('policy', defaultPolicy).provide('booking', booking)).use(ui)
  app.mount(el)
  uiOf(app).rate = 0 // no walk-ins while the clock runs
  return {el, app}
}
const log = (app: ReturnType<typeof mount>['app']) => uiOf(app).log.map(l => l.msg)
const text = (el: Element, sel: string) => el.querySelector(sel)?.textContent ?? ''
const cta = '[data-offer="top"] [data-act="stand-lease"]'
const tables = (app: ReturnType<typeof mount>['app'], ...ids: string[]) => ids.map(id => app.store.state.world.ents[id].table!.status)
const door = (el: Element) => [...el.querySelectorAll('[data-stand] [role="radio"]')].map(b => [b.getAttribute('data-id'), b.getAttribute('aria-checked')])
const slotOf = (app: ReturnType<typeof mount>['app'], id: string) => having(app.store.state.world, 'slot').find(s => s.slot.party === id && s.slot.status === 'ACTIVE')
test('door: party cards are the radiogroup; picking one focuses it, with no greet or accept step', async () => {
  const {el} = mount(room())
  await settle()
  assert.deepEqual(door(el), [['p1', 'true'], ['p2', 'false']])
  assert.equal(el.querySelectorAll('[data-act="stand-greet"], [data-act="stand-answer"], [data-act="stand-offer"]').length, 0)
  assert.equal(text(el, cta), 'Lease T1 to Chen party')
  click(el, '[data-act="stand-focus"][data-id="p2"]')
  await settle()
  assert.deepEqual(door(el), [['p1', 'false'], ['p2', 'true']])
  assert.match(text(el, cta), /^Lease T\d to Ortiz party$/)
})
test('one click leases the top offer: the table is leased, the door drops the party, Leased counts down; the clock settles it into a seat', async () => {
  const {el, app} = mount(room())
  await settle()
  click(el, cta)
  assert.deepEqual([tables(app, 't1'), app.store.state.world.ents.p1.lease?.spot, app.store.state.world.ents.p1.offer?.status, slotOf(app, 'p1')], [['leased'], 't1', 'accepted', undefined])
  assert.equal(log(app)[0], 'You leased T1 to Chen party')
  await settle()
  assert.deepEqual(door(el), [['p2', 'true']]) // a leased party never shows at the door; focus moves on
  assert.match(text(el, '[data-lease="p1"]'), /^Chen party at T1 settles in 2:00\s*Seat nowRelease$/)
  step(app, LEASE)
  assert.equal(slotOf(app, 'p1')?.slot.table, 't1')
  assert.deepEqual(tables(app, 't1'), ['occupied'])
  assert.ok(log(app).includes('Chen party seated at T1 by You, server Ana'), log(app).join(' | '))
  await settle()
  assert.equal(el.querySelectorAll('[data-lease]').length, 0)
  assert.match(text(el, '[data-stand]'), /Chen party at T1 \(Main floor\)/)
})
test('Seat now confirms a lease at once; Release frees the table, drops that spot and the next offer takes the CTA', async () => {
  const {el, app} = mount(room())
  await settle()
  click(el, cta)
  await settle()
  click(el, '[data-lease="p1"] [data-act="stand-release"]')
  assert.deepEqual([tables(app, 't1'), app.store.state.world.ents.p1.lease, app.store.state.world.ents.p1.offer?.declined], [['available'], undefined, ['t1']])
  assert.equal(log(app)[0], 'You released T1: Chen party is back at the door')
  await settle()
  assert.equal(text(el, cta), 'Lease T2 to Chen party')
  click(el, cta)
  await settle()
  click(el, '[data-lease="p1"] [data-act="stand-confirm"]')
  assert.deepEqual([slotOf(app, 'p1')?.slot.table, tables(app, 't2')], ['t2', ['occupied']])
  assert.equal(log(app)[0], 'Chen party seated at T2 by You, server Ana')
})
test('No drops that spot and the next offer takes the CTA; asking records a want and re-ranks the offers', async () => {
  const {el, app} = mount(room())
  await settle()
  click(el, '[data-offer="top"] [data-act="stand-decline"]')
  assert.deepEqual(app.store.state.world.ents.p1.offer?.declined, ['t1'])
  assert.equal(log(app)[0], 'Chen party declined T1')
  await settle()
  assert.equal(text(el, cta), 'Lease T2 to Chen party')
  click(el, '[data-act="stand-hear"][data-feat="banquette"]')
  assert.deepEqual(app.store.state.world.ents.p1.wants!.heard, ['banquette'])
  assert.equal(log(app)[0], 'Chen party strongly wants the banquette (the bench side suits us)')
  await settle()
  assert.match(text(el, '[data-stand]'), /banquette \| strong \| the bench side suits us/)
  assert.match(text(el, '[data-offer="top"]'), /\+banquette/)
  assert.equal(el.querySelectorAll('[data-act="stand-hear"][data-feat="banquette"]').length, 0)
  click(el, '[data-act="stand-hear"][data-feat="booth"]') // asked, no such want
  await settle()
  assert.match(text(el, '[data-stand]'), /asked: no booth/)
})
const raise = (app: ReturnType<typeof mount>['app'], reason: string) => {
  const d = Engine.ask(defaultPolicy, app.store.state.world, app.store.state.now, 'p1', reason)
  assert.ok(d.ok, d.ok ? '' : d.err)
  app.apply(d.ok ? d.patches : [])
}
test('a concern on a leased party (arrived stage) holds the lease past its time; a swap moves the lease and it settles there', async () => {
  const {el, app} = mount([chen(), tbl('t1', 'T1', 4, ['loud']), tbl('t2', 'T2', 4, ['quiet'])])
  await settle()
  click(el, cta)
  raise(app, 'noise')
  await settle()
  assert.match(text(el, '[data-lease="p1"]'), /concern: noise "It is too loud for us to talk\." waits for you/)
  assert.match(text(el, '[data-stand]'), /noise, arrived\)/)
  step(app, 3 * LEASE)
  assert.deepEqual([slotOf(app, 'p1'), tables(app, 't1')], [undefined, ['leased']]) // the lease waits for the host
  await settle()
  click(el, '[data-act="stand-reply"][data-r="swap"]')
  assert.deepEqual([app.store.state.world.ents.p1.lease?.spot, ...tables(app, 't1', 't2')], ['t2', 'available', 'leased'])
  step(app, 1000)
  assert.equal(slotOf(app, 'p1')?.slot.table, 't2')
})
test('requests arise once seated: the stand lists the options from the view and a reply moves the party', async () => {
  const {el, app} = mount([chen(), tbl('t1', 'T1', 4, ['loud']), tbl('t2', 'T2', 4, ['quiet'])])
  await settle()
  click(el, cta)
  await settle()
  click(el, '[data-lease="p1"] [data-act="stand-confirm"]')
  const d = Engine.ask(defaultPolicy, app.store.state.world, app.store.state.now, 'p1', 'noise')
  assert.ok(d.ok, d.ok ? '' : d.err)
  app.apply(d.ok ? d.patches : [])
  await settle()
  assert.match(text(el, '[data-stand]'), /noise, seated\): "It is too loud for us to talk\."/)
  const swap = el.querySelector<HTMLElement>('[data-act="stand-reply"][data-r="swap"]')
  assert.ok(swap, text(el, '[data-stand]'))
  swap.click()
  assert.equal(app.store.state.world.ents.p1.request!.status, 'granted')
  assert.equal(slotOf(app, 'p1')?.slot.table, 't2')
  assert.ok(log(app).some(m => m === 'Chen party moved from T1 to T2'), log(app).join(' | '))
  await settle()
  assert.match(text(el, '[data-stand]'), /No open requests/)
})
// ---- awareness (service modes): who must be told
const dana: Entity = {id: 'dana', body: {role: 'server', x: 0, y: 0, speed: 1, task: null, backlog: [], party: null}, staff: {name: 'Dana', active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40}}
const sat = (id: string, who: string, table: string): Entity => ({id, slot: {table, party: who, seatedAt: NOW, turnAt: NOW + 3600000, status: 'ACTIVE'}})
const busy = (t: Entity): Entity => ({...t, table: {...t.table!, status: 'occupied', waiter: 'dana'}})
const world3 = () => [dana, party(1, 'W', 2, 'Chen', {}), party(2, 'W', 2, 'Ortiz', {}), busy(tbl('t4', 'P4', 4, [], {area: {id: 'grotto'}})), busy(tbl('t5', 'P5', 4)), sat('s1', 'p1', 't4'), sat('s2', 'p2', 't5')]
test('awareness: untold grotto seating is pending with Tell Dana; Tell writes slot.told and narrates; main floor needs no tell', async () => {
  const {el, app} = mount(world3())
  await settle()
  assert.match(text(el, '[data-stand]'), /Chen party at P4 \(Grotto\) Not told yet Tell Dana/)
  assert.match(text(el, '[data-stand]'), /Ortiz party at P5 \(Main floor\) Dana sees it/)
  assert.deepEqual([...el.querySelectorAll('[data-act="stand-tell"]')].map(b => b.getAttribute('data-table')), ['t4'])
  click(el, '[data-act="stand-tell"]')
  assert.equal(app.store.state.world.ents.s1.slot!.told!.by, 'host')
  assert.equal(log(app)[0], 'You told Dana the Chen party is at P4')
  await settle()
  assert.match(text(el, '[data-stand]'), /Chen party at P4 \(Grotto\) Told Dana/)
  assert.equal(el.querySelectorAll('[data-act="stand-tell"]').length, 0)
})
test('without the desk the stand degrades: a note in the pane, a warning from run, never a throw', async () => {
  const {el, app} = mount([chen()], {})
  await settle()
  assert.match(text(el, '[data-stand]'), /Engine host service not available/)
  assert.deepEqual(run(app, {do: 'tell', table: 't1'}), {ok: false, err: 'engine.act is not available'})
  assert.equal(log(app)[0], 'engine.act is not available')
})
test('every HostEvent has a narrated plain sentence (and the decline-and-leave example)', () => {
  const w: World = {nextParty: 2, ents: {p1: chen(), host, t1: tbl('t1', 'T1', 4), t2: tbl('t2', 'T2', 4), t4: tbl('t4', 'P4', 4), dana}}
  w.ents.p1.offer = {spot: 't2', step: 'near', gives: ['banquette'], lacks: [], at: 0, status: 'declined'}
  const all: HostEvent[] = [
    {ev: 'greeted', party: 'p1', by: 'host'}, {ev: 'heard', party: 'p1', feat: 'banquette', level: 'strong'}, {ev: 'quoted', party: 'p1', min: 12},
    {ev: 'offered', party: 'p1', spot: 't2', step: 'near'}, {ev: 'answered', party: 'p1', spot: 't2', yes: true}, {ev: 'leased', party: 'p1', spot: 't2', by: 'host'}, {ev: 'released', party: 'p1', spot: 't2', by: 'host'},
    {ev: 'asked', party: 'p1', reason: 'noise', stage: 'seated'}, {ev: 'replied', party: 'p1', reason: 'noise', response: 'swap', move: 'swap', mood: 3},
    {ev: 'moved', party: 'p1', from: 't1', to: 't2'}, {ev: 'mood', party: 'p1', delta: -2, why: 'noise'},
  ]
  assert.deepEqual(all.map(e => explain(e, w, defaultPolicy).msg), [
    'The host greeted Chen party at the door', 'Chen party strongly wants the banquette (the bench side suits us)', 'Chen party was quoted 12 min',
    'The host offered Chen party the banquette at T2 (near)', 'Chen party accepted the banquette', 'You leased T2 to Chen party', 'You released T2: Chen party is back at the door',
    'Chen party asked for another table (noise, already seated): "It is too loud for us to talk."',
    'The host answered the noise request of Chen party with "Move them": moving them (mood +3)',
    'Chen party moved from T1 to T2', 'Chen party mood fell by 2: noise',
  ])
  assert.equal(explain({ev: 'told', party: 'p1', table: 't4', server: 'dana', by: 'dana'}, w, defaultPolicy).msg, 'Dana told Dana the Chen party is at P4')
  w.ents.p1 = {...w.ents.p1, queue: undefined}
  assert.equal(explain({ev: 'answered', party: 'p1', spot: 't2', yes: false}, w, defaultPolicy).msg, 'Chen party declined the banquette and left the list')
  assert.equal(explain({ev: 'left', party: 'p1'}, w, defaultPolicy).msg, 'W1 x4 left the list after declining the banquette')
})
test('door follows the priority order (policy.book): an arrived reservation outranks walk-ins and is the default focus; cards show the rank', async () => {
  const res = party(3, 'R', 2, 'Booked', {reservation: {at: NOW - 60000, durationMin: 60, table: null, status: 'ARRIVED', phone: '', notes: ''}})
  const {el} = mount([...room(), res])
  await settle()
  assert.deepEqual(door(el).map(([id]) => id), ['p3', 'p1', 'p2'])
  assert.equal(door(el)[0][1], 'true')
  assert.match(text(el, '[data-act="stand-focus"][data-id="p3"]'), /#1 Reservation/)
  assert.match(text(el, cta), /to Booked party$/)
})
