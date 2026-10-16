import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy, having} from '../contracts/index.ts'
import type {App as AppT} from '../contracts/index.ts'
import {build} from '../main.ts'
import {scenarios} from '../scenarios/index.ts'
import {load, step} from '../ui/index.ts'
import {uiOf} from '../ui/state.ts'
import {Engine} from '../engine/index.ts'
import {dom, settle} from './dom.ts'
import {real} from './real.ts'
import {run} from '../ui/act.ts'
const fresh = async () => {
  const el = dom().getElementById('app')!
  const app: AppT = build().mount(el)
  app.apply([{op: 'set', id: 'pty1', parts: {party: {...app.store.state.world.ents.pty1.party!, size: 2}, wants: {list: [{feat: 'booth', level: 'strong', why: 'bench', accord: 'all'}], heard: []}}}])
  uiOf(app).rate = 0 // no walk-ins while the clock runs
  uiOf(app).rev++
  await settle()
  return {el, app}
}
/** A click on the host stand, then wait for the panel to repaint. */
const tap = async (el: Element, sel: string) => (el.querySelector<HTMLElement>(sel)!.click(), settle())
const world = (app: AppT) => app.store.state.world
const slotOf = (app: AppT) => having(world(app), 'slot').find(s => s.slot.party === 'pty1' && s.slot.status === 'ACTIVE')
const tags = (app: AppT, table: string) => world(app).ents[table].feat?.tags ?? []
const log = (app: AppT) => uiOf(app).log.map(l => l.msg)
const raise = (app: AppT, reason: string) => {
  const d = Engine.ask(defaultPolicy, world(app), app.store.state.now, 'pty1', reason)
  d.ok && app.apply(d.patches)
  uiOf(app).rev++
  return d.ok
}
const cta = '[data-offer="top"] [data-act="stand-lease"]'
const LEASE = defaultPolicy.host.clock.leaseMin * 60000
const leaseOf = (app: AppT) => world(app).ents.pty1.lease
test('fresh seed: a booth walk-in is asked about, leased the booth in one click on the stand, and settles into it by the clock', async () => {
  const {el, app} = await fresh()
  const stand = () => el.querySelector('[data-stand]')!.textContent!
  assert.doesNotMatch(stand(), /Greet/)
  await tap(el, '[data-act="stand-hear"][data-feat="booth"]')
  assert.deepEqual(world(app).ents.pty1.wants!.heard, ['booth'])
  const spot = el.querySelector(cta)!.getAttribute('data-spot')!
  assert.ok(tags(app, spot).includes('booth'), 'the top offer is a booth')
  await tap(el, cta)
  assert.deepEqual([leaseOf(app)?.spot, world(app).ents[spot].table!.status, slotOf(app)], [spot, 'leased', undefined])
  assert.equal(el.querySelectorAll(`[data-stand] [role="radio"][data-id="pty1"]`).length, 0, 'a leased party leaves the door list')
  assert.ok(el.querySelector('[data-lease="pty1"]'), 'listed under Leased')
  step(app, LEASE)
  assert.equal(slotOf(app)!.slot.table, spot)
  assert.equal(world(app).ents[spot].table!.status, 'occupied')
  assert.ok(log(app).some(m => /strongly wants the booth/.test(m)) && log(app).some(m => /^You leased .* party$/.test(m)) && log(app).some(m => /party seated at .* by You/.test(m)), log(app).join(' | '))
})
test('fresh seed: Release hands the spot back and the next offer takes the CTA; leasing that one and Seat now seats it', async () => {
  const {el, app} = await fresh()
  const first = el.querySelector(cta)!.getAttribute('data-spot')!
  await tap(el, cta)
  await tap(el, '[data-lease="pty1"] [data-act="stand-release"]')
  assert.deepEqual([leaseOf(app), world(app).ents[first].table!.status, world(app).ents.pty1.offer?.declined], [undefined, 'available', [first]])
  const next = el.querySelector(cta)!.getAttribute('data-spot')!
  assert.notEqual(next, first)
  await tap(el, cta)
  await tap(el, '[data-lease="pty1"] [data-act="stand-confirm"]')
  assert.equal(slotOf(app)!.slot.table, next)
})
test('fresh seed: a leased party raises a concern (arrived stage): the lease holds past its time, a swap moves it, then it settles', async () => {
  const {el, app} = await fresh()
  await tap(el, cta)
  const first = leaseOf(app)!.spot
  assert.ok(raise(app, 'noise'))
  assert.equal(world(app).ents.pty1.request!.stage, 'arrived')
  step(app, 2 * LEASE)
  await settle()
  assert.deepEqual([slotOf(app), leaseOf(app)?.spot], [undefined, first], 'a concern keeps the lease waiting for the host')
  await tap(el, '[data-act="stand-reply"][data-r="swap"]')
  const now = leaseOf(app)!.spot
  assert.notEqual(now, first)
  assert.deepEqual([world(app).ents[first].table!.status, world(app).ents[now].table!.status], ['available', 'leased'])
  step(app, 1000)
  assert.equal(slotOf(app)!.slot.table, now)
})
test('fresh seed: further offers are rows with Lease and No; Lease on a row leases that spot', async () => {
  const {el, app} = await fresh()
  app.apply([{op: 'set', id: 'pty1', parts: {wants: {list: [{feat: 'banquette', level: 'strong', why: 'bench', accord: 'all'}, {feat: 'quiet', level: 'soft', why: 'nice', accord: 'one'}], heard: ['banquette', 'quiet']}}}])
  uiOf(app).rev++
  await settle()
  const rows = [...el.querySelectorAll<HTMLElement>('[data-stand] li[data-offer]')]
  assert.ok(rows.length >= 1, el.querySelector('[data-stand]')!.textContent!)
  assert.equal(rows[0].querySelectorAll('[data-act="stand-lease"], [data-act="stand-decline"]').length, 2)
  const spot = rows[0].getAttribute('data-offer')!
  await tap(rows[0], '[data-act="stand-lease"]')
  assert.equal(world(app).ents.pty1.lease?.spot, spot)
})
test('fresh seed: a table-change request once seated (raised at the seated stage) swaps tables from the stand', async () => {
  const {el, app} = await fresh()
  await tap(el, '[data-act="stand-hear"][data-feat="booth"]')
  await tap(el, cta)
  await tap(el, '[data-lease="pty1"] [data-act="stand-confirm"]')
  const first = slotOf(app)!.slot.table
  assert.ok(raise(app, 'noise'))
  assert.equal(world(app).ents.pty1.request!.stage, 'seated')
  await settle()
  await tap(el, '[data-act="stand-reply"][data-r="swap"]')
  const now = slotOf(app)!.slot.table
  assert.equal(world(app).ents.pty1.request!.status, 'granted')
  assert.notEqual(now, first)
  assert.deepEqual([world(app).ents[first].table!.status, world(app).ents[now].table!.status], ['available', 'occupied'])
  assert.ok(log(app).some(m => /moved from/.test(m)), log(app).join(' | '))
})
// Starters never stick: every one runs 120 sim minutes (10 s steps; arrivals only from the starter's own steps) with the real engine and ui.
Object.keys(scenarios).forEach(id => test(`starter ${id}: 120 sim minutes headless, never stuck`, () => {
  const {app} = real()
  load(app, id)
  const evs = Array.from({length: 720}, () => step(app, 10000)).flat()
  assert.deepEqual(evs.filter(e => e.ev === 'stuck'), [])
  assert.ok(evs.length > 0, 'the starter did something')
}))
test('starter table-change: both parties raise their request (announced as asked) and the sandbox keeps going', () => {
  const {app} = real()
  load(app, 'table-change')
  const evs = Array.from({length: 720}, () => step(app, 10000)).flat() as {ev: string}[]
  assert.equal(evs.filter(e => e.ev === 'asked').length, 2)
  assert.ok(evs.some(e => e.ev === 'left'), 'unanswered requests and patience end in parties leaving')
})
const served = (evs: {ev: string}[]) => evs.filter(e => e.ev === 'served')
const sim = (app: AppT, sec: number) => Array.from({length: sec}, () => step(app, 1000)).flat()
// The ladder picks no particular area, so the seat command names the spot: a main-floor and a patio table (the same Cmd the stand dispatches).
const ledTo = async (spot: string) => {
  const {el, app} = await fresh()
  uiOf(app).rate = 0
  assert.ok(run(app, {do: 'seat', party: 'pty1', spot}).ok)
  await settle()
  return {el, app}
}
test('fresh seed: a party the stand seated on the main floor is served without a Tell (the seating queued the guest for service)', async () => {
  const {app} = await ledTo('rf_5')
  assert.deepEqual(world(app).ents.pty1.body!.backlog, [{do: 'serve', table: 'rf_5'}])
  assert.equal(served(sim(app, 240)).length, 1)
})
test('fresh seed: a party the stand seated on the patio waits unserved until Tell on the stand, then is served', async () => {
  const {el, app} = await ledTo('rf_p1')
  assert.equal(served(sim(app, 240)).length, 0, 'not told yet')
  await tap(el, '[data-act="stand-tell"]')
  assert.equal(having(world(app), 'slot').find(s => s.slot.party === 'pty1')!.slot.told?.by, 'host')
  assert.equal(served(sim(app, 240)).length, 1, 'served after Tell')
})
