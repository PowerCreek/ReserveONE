import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity, Hold, HostEngine} from '../contracts/index.ts'
import {App} from '../kernel/index.ts'
import {dom, settle} from '../test/dom.ts'
import {ui} from './index.ts'
import {fake, seed} from './rig.ts'
const st = (id: string, name: string, over: object = {}): Entity => ({id, staff: {name, active: true, sections: [], lastSeatedAt: null, tally: 3, skip: 0, maxCovers: 40, ...over}})
const tb = (id: string, label: string, section: string | null): Entity => ({id, pos: {floor: 'f1', x: 1, y: 1, w: 70, h: 70}, table: {label, capacity: 4, min: 1, shape: 'rect', status: 'available', waiter: null, section}})
const holds: Hold[] = [
  ...['1', '2', '3', '4', '5', '6'].map((n): Hold => ({table: `t${n}`, area: 'main', staff: 'a', by: 'chunk'})),
  {table: 'p1', area: 'patio', staff: 'a', by: 'tops'}, {table: 'b1', area: 'bar', staff: 'bar', by: 'level'},
]
test('unit cards: a server shows section chunk, tops and covers; a bartender pair is one weighted card for its level', async () => {
  const el = dom().getElementById('app')!
  const s = seed()
  s.world.ents = Object.fromEntries([{id: 'f1', floor: {name: 'Main', active: true}}, {id: 's1', section: {name: 'Window', color: '#0ea5e9'}}, st('a', 'Ana', {tally: 5}), st('bar', 'Bar', {crew: ['Cy', 'Di'], area: 'bar', weight: 2, tally: 8}),
    ...['1', '2', '3', '4', '5', '6'].map(n => tb(`t${n}`, `T${n}`, 's1')), tb('p1', 'P1', null), tb('b1', 'B1', null)].map((e): [string, Entity] => [e.id, e]))
  const app = App.create(s).use(a => a.provide('engine', {...fake(), holds: () => holds} as Partial<HostEngine> as HostEngine)).use(ui)
  app.mount(el)
  await settle()
  const card = (id: string) => el.querySelector(`[data-unit="${id}"]`)!.textContent!
  assert.match(card('a'), /Ana.*covers 5/)
  assert.match(card('a'), /Section T1-T6 \(6\) \(Window\)/)
  assert.match(card('a'), /Tops P1/)
  assert.match(card('bar'), /Bar: Cy \+ Di.*pair x2.*covers 8 \(4\.0 per weight\).*Level B1/)
  assert.equal(el.querySelectorAll('[data-unit]').length, 2)
})
