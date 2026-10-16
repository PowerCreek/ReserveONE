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
const fresh = async () => {
  const el = dom().getElementById('app')!
  const app: AppT = build().mount(el)
  app.apply([{op: 'set', id: 'pty1', parts: {party: {...app.store.state.world.ents.pty1.party!, size: 2}, wants: {list: [{feat: 'booth', level: 'strong', why: 'bench', accord: 'all'}], heard: []}}}])
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
const lead = async (el: Element) => {
  await tap(el, '[data-act="stand-hear"][data-feat="booth"]')
  await tap(el, '[data-act="stand-offer"]')
  await tap(el, '[data-act="stand-answer"][data-yes="1"]')
}
test('fresh seed: a booth walk-in goes intake -> ladder offer -> accept -> seat, all through the stand', async () => {
  const {el, app} = await fresh()
  assert.match(el.querySelector('[data-stand]')!.textContent!, /Greet/)
  await tap(el, '[data-act="stand-hear"][data-feat="booth"]')
  assert.deepEqual(world(app).ents.pty1.wants!.heard, ['booth'])
  await tap(el, '[data-act="stand-offer"]')
  const offer = world(app).ents.pty1.offer!
  assert.deepEqual([offer.status, offer.step], ['open', 'exact'])
  assert.ok(tags(app, offer.spot).includes('booth'), 'the offer is a booth')
  await tap(el, '[data-act="stand-answer"][data-yes="1"]')
  assert.equal(world(app).ents.pty1.offer!.status, 'accepted')
  assert.equal(slotOf(app), undefined, 'led is not seated')
  await tap(el, '[data-act="stand-seatled"]')
  assert.equal(slotOf(app)!.slot.table, offer.spot)
  assert.equal(world(app).ents[offer.spot].table!.status, 'occupied')
  assert.ok(log(app).some(m => /heard|wants/.test(m)) && log(app).some(m => /accepted/.test(m)) && log(app).some(m => /led .* to/.test(m)), log(app).join(' | '))
})
test('fresh seed: a table-change request after the party arrived (then once seated) swaps tables', async () => {
  const {el, app} = await fresh()
  await lead(el)
  const first = world(app).ents.pty1.offer!.spot
  assert.ok(raise(app, 'noise'))
  await settle()
  await tap(el, '[data-act="stand-reply"][data-r="swap"]')
  const to = world(app).ents.pty1.offer!.spot
  assert.deepEqual([world(app).ents.pty1.request!.status, to !== first, tags(app, to).includes('quiet')], ['granted', true, true])
  await tap(el, '[data-act="stand-seatled"]')
  assert.equal(slotOf(app)!.slot.table, to)
  assert.ok(raise(app, 'draft'))
  await settle()
  await tap(el, '[data-act="stand-reply"][data-r="swap"]')
  const now = slotOf(app)!.slot.table
  assert.notEqual(now, to)
  assert.deepEqual([world(app).ents[to].table!.status, world(app).ents[now].table!.status], ['available', 'occupied'])
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
// The stand seats a led party at `spot`; the ladder picks no particular area, so the offer is placed by hand on a main-floor and a patio table.
const ledTo = async (spot: string) => {
  const {el, app} = await fresh()
  uiOf(app).rate = 0
  app.apply([{op: 'set', id: 'pty1', parts: {offer: {spot, step: 'exact', gives: [], lacks: [], at: app.store.state.now, status: 'accepted'}}}])
  uiOf(app).rev++
  await settle()
  await tap(el, '[data-act="stand-seatled"]')
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
