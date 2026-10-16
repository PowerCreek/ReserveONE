import test from 'node:test'
import assert from 'node:assert/strict'
import {dom, settle} from '../test/dom.ts'
import {App, commit, history, keyOf, persist, undo} from './index.ts'
import type {Entity, State} from '../contracts/index.ts'
const tb = (id: string, status: 'available' | 'occupied' = 'available'): Entity =>
  ({id, table: {label: id.toUpperCase(), capacity: 2, min: 1, shape: 'rect', status, waiter: null, section: null}})
const seed = (): State => ({now: 0, ui: {} as State['ui'], world: {nextParty: 1, ents: {t1: tb('t1'), t2: tb('t2'), p1: {id: 'p1'}}}})
const html = `<div data-show="ui.on" id="sh"><i id="at" data-attr="ui.dis" data-as="disabled"></i>
<ul id="l" data-each="world.ents" data-has="table"><template><li class="row"><b data-text="$.table.label"></b><u data-class="$.table.status"></u><button data-on="click:pick"></button></li></template></ul>
<input id="in" data-on="input:name"><button id="u" data-act="undo"></button></div>`
const boot = () => {
  const el = dom().getElementById('app')!
  const app = App.create(seed()).use(history).use(a => a.view(e => (e.innerHTML = html)).act('pick', (x, ev) => ((x.store.state.ui as any).got = keyOf(ev)))
    .act('name', (x, ev) => ((x.store.state.ui as any).name = (ev.target as HTMLInputElement).value))).mount(el)
  return {el, app}
}
test('binders: show, attr, each (keyed, filtered), on -> named acts', async () => {
  const {el, app} = boot()
  const ui = app.store.state.ui as any
  ui.on = false; ui.dis = true
  await settle()
  assert.equal((el.querySelector('#sh') as HTMLElement).hidden, true)
  assert.equal(el.querySelector('#at')!.getAttribute('disabled'), '')
  const rows = () => [...el.querySelectorAll('#l > li')]
  assert.deepEqual(rows().map(r => r.querySelector('b')!.textContent), ['T1', 'T2'])
  const first = rows()[0]
  app.apply([{op: 'add', ent: tb('t3')}, {op: 'set', id: 't2', parts: {table: {...tb('t2').table!, status: 'occupied', label: 'Z'}}}])
  ui.on = true; ui.dis = false
  await settle()
  assert.equal(rows()[0], first) // keyed: untouched row keeps its node
  assert.deepEqual(rows().map(r => r.querySelector('b')!.textContent), ['T1', 'Z', 'T3'])
  assert.equal(rows()[1].querySelector('u')!.className, 'occupied')
  assert.equal(el.querySelector('#at')!.hasAttribute('disabled'), false)
  rows()[2].querySelector('button')!.click()
  assert.equal(ui.got, 't3')
  const inp = el.querySelector<HTMLInputElement>('#in')!
  inp.value = 'abc'
  inp.dispatchEvent(new (globalThis as any).window.Event('input', {bubbles: true}))
  assert.equal(ui.name, 'abc')
  app.apply([{op: 'del', id: 't1'}])
  await settle()
  assert.deepEqual(rows().map(r => r.getAttribute('data-key')), ['t2', 't3'])
})
test('history: commit records, undo/redo restore world from data in the store', async () => {
  const {el, app} = boot()
  commit(app, [{op: 'del', id: 't1'}])
  assert.equal(app.store.state.world.ents.t1, undefined)
  assert.equal(app.store.state.ui.history!.past.length, 1)
  await settle()
  el.querySelector<HTMLElement>('#u')!.click()
  assert.equal((app.store.state.world.ents as any).t1.id, 't1')
  assert.equal(undo(app), false)
  assert.equal(app.store.state.ui.history!.future.length, 1)
  assert.doesNotThrow(() => JSON.stringify(app.store.state))
})
test('persist: hydrates then saves coalesced; provide merges services', async () => {
  dom()
  const mem = new Map<string, string>([['k', JSON.stringify({nextParty: 7, ents: {z: {id: 'z'}}})]])
  const kv = {getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v)}
  const app = App.create(seed()).use(persist('k', kv)).provide('engine', {spots: () => []})
  assert.equal(app.store.state.world.nextParty, 7)
  app.apply([{op: 'add', ent: {id: 'y'}}]).apply([{op: 'del', id: 'z'}])
  await settle()
  assert.deepEqual(Object.keys(JSON.parse(mem.get('k')!).ents), ['y'])
  assert.deepEqual(app.services.engine.spots(app.store.state.world), [])
  assert.deepEqual(app.services.rules.run([], {id: 'q'}), {ok: true, msgs: [], applied: []})
})
