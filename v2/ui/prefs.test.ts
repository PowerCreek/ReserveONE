// Server preferences in the UI: one chip and one editor (ui/prefs.ts) on the real desk; presets and the custom form dispatch `pref` / `unpref`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy} from '../contracts/index.ts'
import type {Cmd, Entity, HostEngine, Pref, PrefRow, State} from '../contracts/index.ts'
import {Engine} from '../engine/index.ts'
import {App} from '../kernel/index.ts'
import {N, party, staff, table} from '../engine/testkit.ts'
import {dom, settle} from '../test/dom.ts'
import {ui} from './index.ts'
import {chips, said} from './prefs.ts'
import {click, seed} from './rig.ts'
import {go} from './shell.ts'
import {uiOf} from './state.ts'
const rot: Entity = {id: 'service', service: {override: 'rotation', carve: {}}}
const grotto = (id: string): Entity => ({...table(id, 4), area: {id: 'grotto'}})
const host: Entity = {id: 'host', body: {role: 'host', x: 0, y: 0, speed: 80, task: null, backlog: [], party: null}}
const pf = (id: string, over: Partial<Pref> = {}): Pref => ({id, kind: 'avoid', on: {area: ['grotto']}, give: 'firm', note: 'No grotto', at: 0, ...over})
const mount = (ents: Entity[]) => {
  const el = dom().getElementById('app')!
  const s: State = {...seed(), now: N}
  s.world.ents = Object.fromEntries([{id: 'f1', floor: {name: 'Main', active: true}}, host, rot, ...ents].map((e): [string, Entity] => [e.id, e]))
  const sent: Cmd[] = []
  const act: HostEngine['act'] = (p, w, now, cmd) => (cmd.do === 'seat' || sent.push(cmd), Engine.act!(p, w, now, cmd))
  const app = App.create(s).use(a => a.provide('engine', {...Engine, act} as HostEngine).provide('policy', defaultPolicy)).use(ui)
  app.mount(el)
  uiOf(app).rate = 0
  return {el, app, sent}
}
const prefsOf = (app: ReturnType<typeof mount>['app'], id: string) => app.store.state.world.ents[id].staff!.prefs ?? []
const crew = () => [staff('ann', 0, 5), staff('ben', 4, 5), table('m1', 4), grotto('g1')]
test('one chip: kind, plain words from policy labels, give, and the state badge with its why', () => {
  const c = {p: defaultPolicy, w: {nextParty: 1, ents: {}}}
  const rows: PrefRow[] = [
    {pref: pf('g'), state: 'set', why: 'not tested yet', at: null}, {pref: pf('b', {kind: 'prefer', on: {shape: ['booth']}}), state: 'enforced', why: 'steered it here ahead of Ben', at: N},
    {pref: pf('s', {on: {size: [1, 2], cap: [3, 99]}, give: 'yield'}), state: 'overridden', why: 'nobody else can take it', at: N}, {pref: pf('m', {on: {area: ['grotto', 'patio']}}), state: 'met', why: 'due anyway', at: N},
  ]
  const el = dom().getElementById('app')!
  el.innerHTML = chips(c, 'ann', rows, true)
  const chip = [...el.querySelectorAll('[data-pref]')]
  assert.deepEqual(chip.map(x => x.querySelector('[data-pstate]')!.getAttribute('data-pstate')), ['set', 'enforced', 'overridden', 'met'])
  assert.deepEqual(chip.map(x => x.querySelector('[data-pstate]')!.getAttribute('title')), rows.map(r => r.why))
  assert.match(chip[0].textContent!, /Avoids Grotto\s*firm\s*○\s*set/)
  assert.match(chip[1].textContent!, /Prefers booths\s*●\s*enforced/) // a prefer has no give
  assert.match(chip[2].textContent!, /Avoids 3\+-seat tables for parties of 1–2\s*yields/)
  assert.equal(said(defaultPolicy, rows[3].pref), 'Avoids Grotto or Patio')
  assert.equal(el.querySelectorAll('[data-act="unpref"]').length, 4)
  assert.ok(el.querySelector('[data-act="unpref"]')!.getAttribute('aria-label')!.startsWith('Remove ann: Avoids Grotto'))
})
test('Staff tab editor: a preset is one click (pressed once set; a second click removes it), the give badge flips firm / yields', async () => {
  const {el, app, sent} = mount(crew())
  go(app, 'staff')
  await settle()
  const preset = '[data-unit="ann"] [data-act="pref-preset"][data-preset="no-grotto"]'
  assert.equal(el.querySelector(preset)!.getAttribute('aria-pressed'), 'false')
  click(el, preset)
  await settle()
  assert.deepEqual(sent.at(-1), {do: 'pref', staff: 'ann', pref: {id: 'no-grotto', kind: 'avoid', give: 'firm', on: {area: ['grotto']}, note: 'No grotto', at: N}})
  assert.equal(el.querySelector(preset)!.getAttribute('aria-pressed'), 'true')
  assert.match(el.querySelector('[data-unit="ann"] [data-pref="no-grotto"]')!.textContent!, /Avoids Grotto\s*firm\s*○\s*set/)
  assert.match(el.querySelector('[data-staff]')!.textContent!, /Avoids Grotto/) // the rotation list shows the same chip
  click(el, '[data-unit="ann"] [data-act="pref-give"]')
  await settle()
  assert.deepEqual([prefsOf(app, 'ann').map(x => x.give), (sent.at(-1) as Extract<Cmd, {do: 'pref'}>).pref.give], [['yield'], 'yield'])
  click(el, preset)
  await settle()
  assert.deepEqual([sent.at(-1), prefsOf(app, 'ann')], [{do: 'unpref', staff: 'ann', id: 'no-grotto'}, []])
  click(el, '[data-act="pref-preset"][data-preset="main-only"][data-who="ben"]')
  assert.deepEqual(prefsOf(app, 'ben')[0].on, {area: ['grotto', 'patio', 'bar', 'roof']})
  await settle()
  click(el, '[data-unit="ben"] [data-act="unpref"]')
  assert.deepEqual(sent.at(-1), {do: 'unpref', staff: 'ben', id: 'main-only'})
})
test('Staff tab custom form: kind, give, areas, shape, ranges and note become one pref command', async () => {
  const {el, app, sent} = mount(crew())
  go(app, 'staff')
  await settle()
  click(el, '[data-unit="ben"] [data-act="pref-open"]')
  await settle()
  const f = el.querySelector('[data-pform="ben"]')!
  assert.match(f.textContent!, /Custom preference for b/)
  f.querySelector<HTMLSelectElement>('[name="kind"]')!.value = 'avoid'
  f.querySelector<HTMLSelectElement>('[name="give"]')!.value = 'yield'
  ;['patio', 'roof'].forEach(a => (f.querySelector<HTMLInputElement>(`[name="area"][value="${a}"]`)!.checked = true))
  f.querySelector<HTMLInputElement>('[name="shape"][value="booth"]')!.checked = true
  f.querySelector<HTMLInputElement>('[name="cap-lo"]')!.value = '6'
  f.querySelector<HTMLInputElement>('[name="note"]')!.value = 'knee'
  click(el, '[data-act="pref-add"]')
  const cmd = sent.at(-1) as Extract<Cmd, {do: 'pref'}>
  assert.deepEqual([cmd.do, cmd.staff, cmd.pref.kind, cmd.pref.give, cmd.pref.on, cmd.pref.note], ['pref', 'ben', 'avoid', 'yield', {area: ['patio', 'roof'], shape: ['booth'], cap: [6, 99]}, 'knee'])
  assert.equal(prefsOf(app, 'ben').length, 1)
  await settle()
  assert.equal(el.querySelector('[data-pform]'), null) // closed once added
  click(el, '[data-unit="ann"] [data-act="pref-open"]')
  await settle()
  click(el, '[data-act="pref-add"]') // nothing picked: the engine refuses, the log says why
  assert.equal(prefsOf(app, 'ann').length, 0)
  assert.ok(uiOf(app).log.some(l => /needs at least one of area/.test(l.msg)))
})
test('stand offers show what server preferences did: "ann skipped: avoids grotto (firm)", with the why as title', async () => {
  const {el} = mount([staff('ann', 0, 5, {name: 'Ann', prefs: [pf('no-grotto')]}), staff('ben', 4, 5, {name: 'Ben'}), grotto('g1'),
    party(1, 'W', 2, 'Patel', {queue: {since: N - 60000, quotedMin: 5, status: 'WAITING', from: null}, mood: {score: 0}})])
  await settle()
  const top = el.querySelector('[data-offer="top"]')!
  assert.match(top.textContent!, /server\s*Ben/)
  const m = top.querySelector('[data-marks] [data-pref="no-grotto"]')!
  assert.match(m.textContent!, /Ann skipped:\s*avoids grotto\s*\(firm\)\s*●\s*enforced/)
  assert.match(m.querySelector('[data-pstate]')!.getAttribute('title')!, /held: Ben takes it/)
})
