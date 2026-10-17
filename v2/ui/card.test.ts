import test from 'node:test'
import assert from 'node:assert/strict'
import {settle} from '../test/dom.ts'
import {click, rig} from './rig.ts'
import {party} from './party.ts'
import {openCard} from './card.ts'
import type {App, Entity} from '../contracts/index.ts'
const MIN = 60000
const tbl = (id: string, x: number, area = 'patio'): Entity => ({id, area: {id: area}, pos: {floor: 'f1', x, y: 64, w: 48, h: 48}, table: {label: id.toUpperCase(), capacity: 4, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}})
const crew = (id: string, name: string): Entity => ({id, staff: {name, active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 30}})
const setup = async () => {
  const r = rig()
  r.app.apply([
    {id: 'f1', floor: {name: 'Main', active: true}}, {id: 'door', pos: {floor: 'f1', x: 32, y: 300, w: 0, h: 0}}, tbl('t1', 64), tbl('t2', 160), crew('sv1', 'Ana'), crew('sv2', 'Ben'),
    party(1, 'W', 2, 'Chen', {queue: {since: 0, quotedMin: 5, status: 'WAITING', from: null}}),
  ].map(ent => ({op: 'add' as const, ent})))
  await settle()
  return r
}
/** SVG elements have no .click() in jsdom: dispatch one. */
const tap = (el: Element, sel: string) => el.querySelector(sel)!.dispatchEvent(new el.ownerDocument.defaultView!.MouseEvent('click', {bubbles: true}))
const card = (el: Element) => el.querySelector('[data-floor] [data-card]')
const acts = (el: Element) => [...el.querySelectorAll('[data-card] [data-card-acts] button')].map(b => b.textContent)
const press = async (el: Element, name: string) => (click(el, `[data-card] [data-act="card-${name}"]`), await settle())
const slot = (app: App) => Object.values(app.store.state.world.ents).find(e => e.slot?.table === 't1' && e.slot.status !== 'COMPLETED')?.slot
const t1 = (app: App) => app.store.state.world.ents.t1!.table!

test('clicking a table opens its card; actions follow the table state and each dispatches its Cmd', async () => {
  const {app, el} = await setup()
  tap(el, '[data-floor] [data-act="tcard"][data-tid="t1"]')
  await settle()
  assert.equal(card(el)?.getAttribute('data-status'), 'available')
  assert.match(card(el)!.textContent!, /T1.*4 seats.*available/)
  assert.deepEqual(acts(el), ['Lease to Chen (W1) x2']) // the stand's focus party fits
  assert.equal(el.ownerDocument.activeElement?.textContent, 'Lease to Chen (W1) x2') // focus moved into the card
  await press(el, 'lease')
  assert.equal(t1(app).status, 'leased')
  assert.deepEqual(acts(el), ['Seat now', 'Release'])
  assert.match(card(el)!.querySelector('[data-card-party]')!.textContent!, /Chen \(W1\) x2/)
  await press(el, 'release') // release frees
  assert.equal(t1(app).status, 'available')
  assert.equal(app.store.state.world.ents.p1!.lease, undefined)
  await press(el, 'lease')
  await press(el, 'seat') // seat now confirms the lease
  assert.equal(t1(app).status, 'occupied')
  assert.equal(slot(app)?.status, 'ACTIVE')
  assert.match(card(el)!.textContent!, /seated .*turn/)
  assert.deepEqual(acts(el).slice(0, 3), ['Extend +15', 'Force clear', `Tell ${app.store.state.world.ents[t1(app).waiter!]!.staff!.name}`]) // patio is not seen: the server must be told
  const turn = slot(app)!.turnAt
  await press(el, 'extend') // extend moves turnAt
  assert.equal(slot(app)!.turnAt, turn + 15 * MIN)
  await press(el, 'tell')
  assert.ok(slot(app)!.told)
  assert.ok(!acts(el).some(a => a?.startsWith('Tell')))
  const was = t1(app).waiter
  const sel = el.querySelector<HTMLSelectElement>('[data-card] select[data-on="change:card-reassign"]')!
  const to = [...sel.options].map(o => o.value).find(v => v && v !== was)!
  sel.value = to
  sel.dispatchEvent(new el.ownerDocument.defaultView!.Event('change', {bubbles: true})) // reassign moves the waiter
  await settle()
  assert.equal(t1(app).waiter, to)
  await press(el, 'clear') // force clear frees
  assert.equal(t1(app).status, 'available')
  assert.equal(slot(app), undefined)
  assert.equal(card(el)?.getAttribute('data-status'), 'available')
})
test('Escape and an outside click close the card; openCard opens it from anywhere', async () => {
  const {app, el} = await setup()
  openCard(app, 't2')
  await settle()
  assert.equal(card(el)?.getAttribute('data-card'), 't2')
  assert.match(card(el)!.className, /right-3 top-3/) // no click anchor: the panel's corner
  assert.match(el.querySelector('[data-floor] svg')!.innerHTML, /data-picked/) // the table shows as picked
  el.ownerDocument.dispatchEvent(new el.ownerDocument.defaultView!.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))
  await settle()
  assert.equal(card(el), null)
  tap(el, '[data-floor] [data-act="tcard"][data-tid="t2"]')
  await settle()
  assert.ok(card(el))
  click(el, '[data-floor] [data-act="floorView"][data-id="2d"]') // outside the card, off any table
  await settle()
  assert.equal(card(el), null)
  click(el, '[data-floor] [data-act="floorView"][data-id="iso"]')
  await settle()
  tap(el, '[data-floor] svg[data-iso] [data-act="tcard"][data-tid="t1"]') // iso blocks open the same card
  await settle()
  assert.equal(card(el)?.getAttribute('data-card'), 't1')
  click(el, '[data-card] [data-act="card-close"]')
  await settle()
  assert.equal(card(el), null)
})
test('a blocked table offers nothing; a party too large for the table gets no lease button', async () => {
  const {app, el} = await setup()
  app.apply([{op: 'add', ent: party(2, 'W', 6, 'Big', {queue: {since: -MIN, quotedMin: 5, status: 'WAITING', from: null}})}])
  Object.assign(app.store.state.ui, {stand: {party: 'p2'}})
  openCard(app, 't1')
  await settle()
  assert.deepEqual(acts(el), [])
  assert.match(card(el)!.textContent!, /does not fit/)
  app.apply([{op: 'set', id: 't2', parts: {table: {...app.store.state.world.ents.t2!.table!, status: 'blocked_private'}}}])
  openCard(app, 't2')
  await settle()
  assert.match(card(el)!.textContent!, /Blocked/)
})
test('every entity on the card is a link: table, party, server, joined tables; the floor party chip opens the party', async () => {
  const {app, el} = await setup()
  openCard(app, 't1')
  await settle()
  await press(el, 'lease')
  await press(el, 'seat')
  const refs = () => [...card(el)!.querySelectorAll('[data-act="ent"]')].map(b => b.getAttribute('data-eid'))
  const waiter = t1(app).waiter!
  assert.deepEqual(refs(), ['t1', 'p1', waiter])
  assert.match(card(el)!.querySelector('[data-card-party]')!.textContent!, /Chen \(W1\) x2/)
  click(el, '[data-act="card-close"]')
  await settle()
  const chip = el.querySelector('[data-floor] [data-tid="t1"] [data-party-chip]')!
  assert.match(chip.textContent!, /👥2/)
  tap(el, '[data-floor] [data-tid="t1"] [data-party-chip]') // the chip opens the party: the card of the table it sits at
  await settle()
  assert.equal(card(el)?.getAttribute('data-card'), 't1')
  click(el, `[data-card] [data-act="ent"][data-eid="${waiter}"]`) // the server opens on the Staff tab with its form
  await settle()
  assert.equal(app.store.state.ui.tab, 'staff')
  assert.equal(app.store.state.ui.prefs?.open, waiter)
  app.apply([{op: 'add', ent: {id: 'k', link: {members: ['t2', 't1']}}}, {op: 'add', ent: party(3, 'W', 2, 'Dee', {queue: {since: 0, quotedMin: 5, status: 'WAITING', from: null}})}])
  openCard(app, 't2')
  await settle()
  assert.match(card(el)!.querySelector('[data-card-joined]')!.textContent!, /joined with T1/)
  click(el, '[data-card-joined] [data-act="ent"][data-eid="t1"]') // a joined table opens its own card where this one is
  await settle()
  assert.equal(card(el)?.getAttribute('data-card'), 't1')
  const {follow} = await import('./card.ts')
  follow(app, 'p3', new el.ownerDocument.defaultView!.Event('click')) // a party at the door: the stand with it in focus
  await settle()
  assert.equal(app.store.state.ui.stand?.party, 'p3')
  assert.equal(app.store.state.ui.tab, 'sim')
  assert.equal(card(el), null)
})
