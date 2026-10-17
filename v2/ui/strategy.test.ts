import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity, HostEngine} from '../contracts/index.ts'
import type {StratCtl, StratView} from '../contracts/strategy.ts'
import {App} from '../kernel/index.ts'
import {dom, settle} from '../test/dom.ts'
import {ui} from './index.ts'
import {fake, seed} from './rig.ts'
import {uiOf} from './state.ts'
const tb = (id: string, label: string, section: string | null): Entity => ({id, pos: {floor: 'f1', x: 1, y: 1, w: 70, h: 70}, area: {id: 'main'}, table: {label, capacity: 4, min: 1, shape: 'rect', status: 'available', waiter: null, section}} as Entity)
const lane = (table: string, label: string, freeIn: number, run: string[], extra = {}) => ({table, label, freeIn, seated: freeIn ? 2 : 0, next: null, run, section: 's1', ...extra})
const move = (size: number, tables: string[], cost: number, turn: number) => ({size, tables, label: tables.join('+'), merge: tables.length > 1, cost, turn, why: [`fits ${size}`]})
/** The fake strategist: records every ctl it is handed, answers from the levers so the test can see them arrive. */
const strategist = (calls: StratCtl[]) => (_p: unknown, _w: unknown, _n: number, ctl: StratCtl): StratView => (calls.push(ctl), {
  lanes: [lane('t1', 'T1', 0, []), lane('t2', 'T2', 40, ['t3'], {next: {party: 'p1', label: 'R-1', size: 4, at: 60}}), lane('t3', 'T3', 45, ['t2']), lane('t4', 'T4', 0, [], {section: null})],
  moves: {2: move(2, ['t1'], 0, 70), 3: move(3, ['t4'], 1, 80), 4: move(4, ['t4'], 0, 75), 5: move(5, ['t2', 't3'], 2, 45)},
  sizes: ({none: [], '2top': [2], '3-4top': [3, 4], '5-6top': [5, 6], large: [6, 7, 8]} as Record<string, number[]>)[ctl.guess]!,
  joint: ctl.behind.length ? [move(ctl.at ?? 2, ['t1'], 0, 70), move(ctl.behind[0]!, ['t4'], 0, 75)] : null,
  pairs: [{tables: ['t2', 't3'], labels: ['T2', 'T3'], size: 6, at: 45, why: 'free within 5m of each other'}],
  risks: [{kind: 'lockout', text: 'Nothing fits 8 for 90m', size: 8}, {kind: 'squeeze', text: 'R-1 needs T2', party: 'p1'}],
  share: [{staff: 'a', name: 'Ana', now: 6, planned: 4}, {staff: 'b', name: 'Bo', now: 2, planned: 0}],
  live: ctl.holds.filter(h => !h.gate).map(h => h.id), waiting: ctl.holds.filter(h => h.gate).map(h => h.id),
})
const mount = async () => {
  const el = dom().getElementById('app')!
  const s = seed()
  const st = (id: string, name: string): Entity => ({id, staff: {name, active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40}})
  s.world.ents = Object.fromEntries([{id: 'f1', floor: {name: 'Main', active: true}}, {id: 's1', section: {name: 'Window', color: '#0ea5e9'}}, tb('t1', 'T1', 's1'), tb('t2', 'T2', 's1'), tb('t3', 'T3', 's1'), tb('t4', 'T4', null), st('a', 'Ana'), st('b', 'Bo')].map((e): [string, Entity] => [e.id, e]))
  const calls: StratCtl[] = []
  const app = App.create(s).use(a => a.provide('engine', {...fake(), strategy: strategist(calls)} as Partial<HostEngine> as HostEngine)).use(ui)
  app.mount(el)
  await settle()
  const go = async (sel: string) => (el.querySelector<HTMLElement>(sel)!.click(), await settle(), await settle())
  return {el, app, calls, go}
}
const texts = (el: Element, sel: string) => [...el.querySelectorAll(sel)].map(n => n.textContent!.trim())
test('strategy tab: hidden it never asks the planner; shown it draws the timeline grouped, with bars, pairs and a legend', async () => {
  const {el, calls, go} = await mount()
  assert.equal(calls.length, 0)
  await go('[data-act="tab"][data-id="strategy"]')
  assert.ok(calls.length >= 1)
  assert.deepEqual(texts(el, '[data-group] > h3'), ['Window', 'Main floor'])
  assert.deepEqual([...el.querySelectorAll('[data-lane]')].map(n => n.getAttribute('data-tid')), ['t1', 't2', 't3', 't4'])
  assert.match(el.querySelector('[data-lane][data-tid="t2"] [data-bar="seated"]')!.getAttribute('aria-label')!, /T2: 2 seated, free in 40m/)
  assert.match(el.querySelector('[data-lane][data-tid="t2"] [data-bar="planned"]')!.getAttribute('aria-label')!, /R-1 x4/)
  assert.equal(el.querySelectorAll('[data-bar="pair"]').length, 2)
  assert.equal(el.querySelectorAll('[data-legend]').length, 5)
  assert.ok([...el.querySelectorAll('[data-bar]')].every(b => b.getAttribute('tabindex') === '0'))
})
test('assumptions: the guess, the door party and the parties behind reach the planner; suggestions rank by cost; Use sets the stepper and opens Queue', async () => {
  const {el, app, calls, go} = await mount()
  await go('[data-act="tab"][data-id="strategy"]')
  await go('[data-act="strat-guess"][data-g="3-4top"]')
  assert.equal(calls.at(-1)!.guess, '3-4top')
  assert.equal(el.querySelector('[data-g="3-4top"]')!.getAttribute('aria-checked'), 'true')
  assert.deepEqual(texts(el, '[data-move][data-kind="size"] > div > b:nth-child(2)'), ['Party of 4', 'Party of 3']) // cost 0 before cost 1
  await go('[data-act="strat-at-more"]')
  await go('[data-act="strat-at-more"]')
  await go('[data-act="strat-behind"][data-n="5"]')
  assert.deepEqual([calls.at(-1)!.at, calls.at(-1)!.behind], [2, [5]])
  assert.equal(el.querySelectorAll('[data-kind="joint"]').length, 2)
  await go('[data-act="strat-unbehind"][data-i="0"]')
  assert.equal(el.querySelectorAll('[data-kind="joint"]').length, 0) // back to an earlier ctl: the memo seam answers it without a new call
  await go('[data-move="4"] [data-act="strat-use"]')
  assert.deepEqual([uiOf(app).size, uiOf(app).tab], [4, 'queue'])
})
test('levers: a hold with a gate is saved to the world through the desk, drawn on its tables, then released', async () => {
  const {el, app, calls, go} = await mount()
  await go('[data-act="tab"][data-id="strategy"]')
  assert.ok(el.querySelector<HTMLButtonElement>('[data-act="strat-hold"]')!.disabled)
  await go('[data-act="strat-pick"][data-tid="t1"]')
  await go('[data-act="strat-hsize-more"]')
  await go('[data-act="strat-gate"][data-g="free"]')
  const sel = el.querySelector<HTMLSelectElement>('select[data-on="change:strat-gtab"]')!
  sel.value = 't2'
  sel.dispatchEvent(new window.Event('change', {bubbles: true}))
  const why = el.querySelector<HTMLInputElement>('input[data-on="input:strat-why"]')!
  why.value = 'R-1 at 8'
  why.dispatchEvent(new window.Event('input', {bubbles: true}))
  await go('[data-act="strat-hold"]')
  const h = app.store.state.world.ents.t1!.hold!
  assert.deepEqual([h.size, h.gate, h.why], [3, {kind: 'free', table: 't2'}, 'R-1 at 8'])
  assert.match(el.querySelector(`[data-hold="${h.id}"]`)!.textContent!, /T1.*for a 3.*when T2 frees \(opens in 40m\).*R-1 at 8.*Release/)
  assert.ok(el.querySelector('[data-lane][data-tid="t1"] [data-bar="gate"]') && el.querySelector('[data-lane][data-tid="t1"] [data-bar="hold"]'))
  assert.deepEqual(calls.at(-1)!.holds, []) // saved holds are world state; ctl.holds carries drafts only
  await go(`[data-act="strat-unhold"][data-id="${h.id}"]`)
  assert.deepEqual([app.store.state.world.ents.t1!.hold, el.querySelectorAll('[data-hold]').length, el.querySelectorAll('[data-bar="hold"]').length], [undefined, 0, 0])
})
test('risks and share render; a table label opens its card on the Sim tab', async () => {
  const {el, app, go} = await mount()
  await go('[data-act="tab"][data-id="strategy"]')
  assert.deepEqual([...el.querySelectorAll('[data-risk]')].map(r => r.getAttribute('data-risk')), ['lockout', 'squeeze'])
  assert.match(el.querySelector('[data-risk="lockout"]')!.textContent!, /Act now: Lockout Nothing fits 8/)
  assert.equal(el.querySelector('[data-spread]')!.textContent, '8')
  assert.deepEqual([...el.querySelectorAll('[data-share]')].map(r => r.getAttribute('data-share')), ['b', 'a'])
  await go('[data-lane][data-tid="t3"] [data-act="ent"]')
  assert.deepEqual([uiOf(app).tab, uiOf(app).card?.table], ['sim', 't3'])
})
test('without a strategist the tab degrades to a note', async () => {
  const el = dom().getElementById('app')!
  const app = App.create(seed()).use(a => a.provide('engine', fake() as HostEngine)).use(ui)
  app.mount(el)
  await settle()
  el.querySelector<HTMLElement>('[data-act="tab"][data-id="strategy"]')!.click()
  await settle()
  await settle()
  assert.match(el.querySelector('[data-stline]')!.textContent!, /Needs engine\.strategy/)
})
