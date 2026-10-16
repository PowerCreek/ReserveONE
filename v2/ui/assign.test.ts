import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import type {Entity, Hold, HostEngine, Id, Patch, Service, World} from '../contracts/index.ts'
import {App} from '../kernel/index.ts'
import {dom, settle} from '../test/dom.ts'
import {ui} from './index.ts'
import {click, fake, seed} from './rig.ts'
const NOON = new Date(2026, 0, 5, 12, 0).getTime()
const MORNING = new Date(2026, 0, 5, 9, 0).getTime()
const tbl = (id: string, label: string, over: Partial<Entity> = {}, section: Id | null = null): Entity =>
  ({id, pos: {floor: 'f1', x: 100, y: 60, w: 70, h: 70}, table: {label, capacity: 4, min: 1, shape: 'rect', status: 'available', waiter: null, section}, ...over})
const server = (id: string, name: string, over: Partial<Entity['staff'] & object> = {}): Entity =>
  ({id, staff: {name, active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40, ...over}})
const room = (): Entity[] => [
  {id: 'f1', floor: {name: 'Main', active: true}}, {id: 's1', section: {name: 'Window', color: '#0ea5e9'}},
  server('sv1', 'Ana', {sections: ['s1'], tally: 6}), server('sv2', 'Ben'), server('sv3', 'Bar', {crew: ['Cy', 'Di'], area: 'bar', weight: 2, tally: 8}),
  ...['1', '2', '3'].map(n => tbl(`t${n}`, `T${n}`, {}, 's1')),
  ...['1', '2', '3', '4'].map(n => tbl(`p${n}`, `P${n}`, {area: {id: 'patio'}})),
  ...['1', '2'].map(n => tbl(`g${n}`, `G${n}`, {area: {id: 'grotto'}})), tbl('b1', 'B1', {area: {id: 'bar'}}),
]
const area = (w: World, id: Id) => w.ents[id].area?.id ?? 'main'
/** Contract-typed double of the wave-3 service: just enough rules to exercise the panel. */
const svc: Partial<Service> = {
  modeAt: (p, w, now) => w.ents.service?.service?.override ?? p.service.schedule.filter(s => s.from <= new Date(now).getHours() * 60).at(-1)!.mode,
  holds: (p, w, now): Hold[] => having(w, 'table').map(t => {
    const sectioned = svc.modeAt!(p, w, now) === 'sectioned'
    const [a, e] = [area(w, t.id), w.ents[t.id]]
    const pair = having(w, 'staff').find(s => s.staff.area === a && s.staff.crew)
    const sec = having(w, 'staff').find(s => s.staff.sections.includes(t.table.section ?? ''))
    const pick: [Id | null, Hold['by']] = !sectioned ? [t.table.waiter, 'rotation'] : e.assign ? [e.assign.staff, 'tops'] : pair ? [pair.id, 'level'] : [sec?.id ?? null, 'chunk']
    return {table: t.id, area: a, staff: pick[0], by: pick[1]}
  }),
  assign: (_p, w): Patch[] => {
    const ss = having(w, 'staff').filter(s => !s.staff.crew)
    const dealt = ss.map(s => ({id: s.id, n: having(w, 'table', 'assign').filter(t => t.assign.staff === s.id).length}))
    return having(w, 'table', 'area').filter(t => t.area.id === 'patio' && !w.ents[t.id].assign).map((t, i): Patch => ({op: 'set', id: t.id, parts: {assign: {staff: dealt.sort((a, b) => a.n - b.n)[i % dealt.length].id}}}))
  },
}
const mount = (now = NOON) => {
  const el = dom().getElementById('app')!
  const s = seed()
  s.now = now
  s.world.ents = Object.fromEntries(room().map((e): [string, Entity] => [e.id, e]))
  const app = App.create(s).use(a => a.provide('engine', {...fake(), ...svc} as HostEngine)).use(ui)
  app.mount(el)
  return {el, app}
}
const text = (el: Element, sel: string) => el.querySelector(sel)!.textContent!
test('mode readout follows the schedule; Sectioned/Rotation override via service.override; Follow clears it; undo restores', async () => {
  const {el, app} = mount()
  await settle()
  assert.equal(text(el, '[data-mode-now]'), 'Rotation')
  assert.match(text(el, '[data-assign]'), /by schedule.*00:00 Sectioned.*11:00 Rotation.*15:00 Sectioned/)
  assert.match(text(el, '[data-mode]'), /Rotation schedule/)
  click(el, '[data-act="svcmode"][data-to="sectioned"]')
  assert.equal(app.store.state.world.ents.service.service!.override, 'sectioned')
  await settle()
  assert.equal(text(el, '[data-mode-now]'), 'Sectioned')
  assert.match(text(el, '[data-assign]'), /manual override/)
  click(el, '[data-act="svcmode"][data-to="auto"]')
  assert.equal(app.store.state.world.ents.service.service!.override, null)
  click(el, '[data-act="undo"]')
  click(el, '[data-act="undo"]')
  assert.equal(app.store.state.world.ents.service, undefined)
})
test('grotto carve toggles whole area vs piecemeal tops; tops UI shows only for tops carves', async () => {
  const {el, app} = mount(MORNING)
  await settle()
  const tops = () => [...el.querySelectorAll('[data-tops]')].map(e => e.getAttribute('data-tops'))
  assert.deepEqual(tops(), ['patio']) // grotto defaults to whole
  assert.equal(el.querySelectorAll('[data-area="grotto"] [data-act="svccarve"]').length, 2)
  assert.equal(el.querySelectorAll('[data-area="patio"] [data-act="svccarve"]').length, 0) // patio has one carve: no choice
  click(el, '[data-act="svccarve"][data-area="grotto"][data-to="tops"]')
  assert.deepEqual(app.store.state.world.ents.service.service!.carve, {grotto: 'tops'})
  await settle()
  assert.deepEqual(tops(), ['grotto', 'patio'])
  click(el, '[data-act="svccarve"][data-area="grotto"][data-to="whole"]')
  await settle()
  assert.deepEqual(tops(), ['patio'])
})
test('piecemeal tops: assign a table to a server, balance updates, Deal fills the rest, undo reverts', async () => {
  const {el, app} = mount(MORNING)
  await settle()
  const bal = () => text(el, '[data-tops="patio"] [data-balance]')
  assert.match(bal(), /Ana 0 \| Ben 0 \| spread 0/)
  click(el, '[data-top="p1"] [data-who="sv2"]')
  click(el, '[data-top="p2"] [data-who="sv2"]')
  click(el, '[data-top="p3"] [data-who="sv2"]')
  assert.equal(app.store.state.world.ents.p1.assign!.staff, 'sv2')
  await settle()
  assert.match(bal(), /Ana 0 \| Ben 3 \| spread 3/)
  assert.match(el.querySelector('[data-tops="patio"] [data-balance]')!.className, /amber/)
  assert.match(text(el, '[data-act="svcdeal"]'), /Deal \(1 change\)/)
  click(el, '[data-act="svcdeal"]')
  assert.equal(app.store.state.world.ents.p4.assign!.staff, 'sv1')
  await settle()
  assert.match(bal(), /Ana 1 \| Ben 3/)
  assert.match(text(el, '[data-act="svcdeal"]'), /balanced/)
  click(el, '[data-act="undo"]')
  assert.equal(app.store.state.world.ents.p4.assign, undefined)
})
test('rotation: tops note says holds are off; pairs are one weighted card per level', async () => {
  const {el} = mount(NOON)
  await settle()
  assert.match(text(el, '[data-assign]'), /Tops are ignored/)
  const pair = el.querySelectorAll('[data-units] [data-unit="sv3"]')
  assert.equal(pair.length, 1)
  assert.match(pair[0].textContent!, /Bar: Cy \+ Di.*pair x2.*covers 8 \(4\.0 per weight\)/)
  assert.equal(el.querySelectorAll('[data-units] [data-unit]').length, 3) // two servers + one pair, never one slot per bartender
})
test('degrades without the service: the readout never recomputes the clock (first mode) and Deal warns', async () => {
  const el = dom().getElementById('app')!
  const s = seed()
  s.now = NOON
  s.world.ents = Object.fromEntries(room().map((e): [string, Entity] => [e.id, e]))
  const app = App.create(s).use(a => a.provide('engine', fake() as HostEngine)).use(ui)
  app.mount(el)
  await settle()
  assert.equal(text(el, '[data-mode-now]'), 'Sectioned')
  click(el, '[data-act="svcdeal"]')
  assert.match(app.store.state.ui.log![0].msg, /No assign service/)
})
