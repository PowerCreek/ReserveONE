// Saved holds on the real engine + desk: the Strategy tab writes a world hold, the Queue's preview and fast seat skip it, Release restores it;
// a hold for a named party lets only that party in; an override seats over a hold after a confirm step and the log keeps it.
import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy} from '../contracts/index.ts'
import type {Entity, HostEngine, State} from '../contracts/index.ts'
import {Engine} from '../engine/index.ts'
import {booking} from '../engine/booking.ts'
import {App} from '../kernel/index.ts'
import {dom, settle} from '../test/dom.ts'
import {ui} from './index.ts'
import {party} from './party.ts'
import {seed} from './rig.ts'
import {uiOf} from './state.ts'
const NOW = Date.UTC(2026, 9, 16, 17, 0)
const tbl = (id: string, label: string, cap: number): Entity => ({id, pos: {floor: 'f1', x: 100, y: 60, w: 70, h: 70}, table: {label, capacity: cap, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}})
const chen = () => party(1, 'W', 4, 'Chen', {queue: {since: NOW - 600000, quotedMin: 5, status: 'WAITING', from: null}, mood: {score: 0}})
const mount = async () => {
  const el = dom().getElementById('app')!
  const s: State = {...seed(), now: NOW}
  s.world.ents = Object.fromEntries([{id: 'f1', floor: {name: 'Main', active: true}}, tbl('t11', 'T11', 6), tbl('t12', 'T12', 4), chen()].map((e): [string, Entity] => [e.id, e]))
  const app = App.create(s).use(a => a.provide('engine', Engine as HostEngine).provide('policy', defaultPolicy).provide('booking', booking)).use(ui)
  app.mount(el)
  uiOf(app).rate = 0
  uiOf(app).size = 4
  const tick = async () => (await settle(), await settle())
  const click = async (sel: string) => (el.querySelector<HTMLElement>(sel)!.click(), await tick())
  const change = async (sel: string, v: string) => ((x = el.querySelector<HTMLSelectElement>(sel)!) => ((x.value = v), x.dispatchEvent(new window.Event('change', {bubbles: true}))))() && (await tick())
  await tick()
  return {el, app, click, change, tick}
}
type M = Awaited<ReturnType<typeof mount>>
const tab = (m: M, id: string) => m.click(`[data-act="tab"][data-id="${id}"]`)
/** Strategy tab: pick T12, set the size (or a party), save the hold. */
const holdT12 = async (m: M, size: number, partyId = '') => {
  await tab(m, 'strategy')
  await m.click('[data-act="strat-pick"][data-tid="t12"]')
  partyId && (await m.change('select[data-on="change:strat-party"]', partyId))
  for (let i = 2; !partyId && i < size; i++) await m.click('[data-act="strat-hsize-more"]')
  await m.click('[data-act="strat-hold"]')
}
const dests = (el: Element) => [...el.querySelectorAll('[data-fast] [data-dest]')].map(p => p.textContent!)
const status = (m: M, id: string) => m.app.store.state.world.ents[id]!.table!.status
test('a saved hold: the preview skips T12, fast seat goes to T11, Release brings T12 back', async () => {
  const m = await mount()
  await tab(m, 'queue')
  assert.match(dests(m.el)[1]!, /Goes to T12/)
  await holdT12(m, 6)
  assert.deepEqual(m.app.store.state.world.ents.t12!.hold && [m.app.store.state.world.ents.t12!.hold.size, m.app.store.state.world.ents.t12!.hold.until - NOW], [6, 30 * 60000])
  assert.match(m.el.querySelector('[data-hold] [data-state]')!.textContent!, /live/)
  assert.ok(m.el.querySelector('[data-lane][data-tid="t12"] [data-lock]'))
  await tab(m, 'queue')
  assert.match(dests(m.el)[1]!, /Goes to T11/)
  assert.match(m.el.querySelector('[data-override="t12"]')!.textContent!, /T12 is held .*6/)
  await m.click('[data-act="quick"]')
  assert.deepEqual([status(m, 't11'), status(m, 't12')], ['occupied', 'available'])
  await tab(m, 'strategy')
  await m.click('[data-act="strat-unhold"]')
  assert.equal(m.app.store.state.world.ents.t12!.hold, undefined)
  await tab(m, 'queue')
  assert.match(dests(m.el)[1]!, /Goes to T12/)
})
test('a hold for a named party: a walk-in of the same size is kept off, the party itself goes to T12; the card shows the lock', async () => {
  const m = await mount()
  await holdT12(m, 0, 'p1')
  assert.deepEqual([m.app.store.state.world.ents.t12!.hold?.party, m.app.store.state.world.ents.t12!.hold?.size], ['p1', 4])
  await tab(m, 'queue')
  const [door, walk] = dests(m.el)
  assert.match(door!, /Goes to T12/)
  assert.match(walk!, /Goes to T11/)
  await tab(m, 'strategy')
  await m.click('[data-lane][data-tid="t12"] [data-act="ent"]') // the timeline label opens the card (Sim tab)
  assert.match(m.el.querySelector('[data-card] [data-held-line]')!.textContent!, /held until 17:30 for W1 Chen x4/)
})
test('override: Seat anyway asks to confirm, then seats over the hold and the log says so', async () => {
  const m = await mount()
  await holdT12(m, 6)
  await tab(m, 'queue')
  await m.click('[data-act="strat-force"][data-tid="t12"]')
  assert.ok(m.el.querySelector('[data-force-confirm]'))
  assert.equal(status(m, 't12'), 'available')
  await m.click('[data-act="strat-force-yes"]')
  assert.equal(status(m, 't12'), 'occupied')
  assert.equal(m.el.querySelector('[data-force-confirm]'), null)
  assert.ok(uiOf(m.app).log.some(l => /over a hold/.test(l.msg)))
})
