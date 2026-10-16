import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity, World} from '../contracts/index.ts'
import {assign} from './assign.ts'
import {apply} from './patch.ts'
import {P, staff, table, world} from './testkit.ts'
const at = (h: number) => new Date(2026, 5, 1, h).getTime()
const t = (id: string, label: string, area: string, section: string | null = null): Entity => ({...table(id, 4, 'available', section), area: {id: area}, table: {...table(id, 4, 'available', section).table!, label}})
const sec = (id: string): Entity => ({id, section: {name: id, color: '#fff'}})
const main = Array.from({length: 24}, (_, i) => t(`m${i + 1}`, String(i + 1), 'main'))
const grotto = Array.from({length: 6}, (_, i) => t(`g${i + 1}`, `G${i + 1}`, 'grotto'))
const patio = Array.from({length: 7}, (_, i) => t(`p${i + 1}`, `P${i + 1}`, 'patio'))
const crew = [...'abcd'].map(x => staff(x, 0, 5, {sections: [`s${x}`]}))
const pair = staff('pr', 0, 5, {area: 'bar', weight: 2, crew: ['Kit', 'Lou']})
const base = (carve: Record<string, string> = {}): World => world([...main, ...grotto, ...patio, ...crew.flatMap(s => [s, sec(s.staff!.sections[0])]), pair, {id: 'service', service: {override: null, carve}} as Entity])
const run = (w: World, h = 10, mode?: string) => apply(w, assign(P, w, at(h), mode))
const heldBy = (w: World, area: string) => Object.values(w.ents).filter(e => e.area?.id === area)
test('assign: main = contiguous chunks by table number, one section per server, even sizes; second run changes nothing', () => {
  const w = run(base())
  const secs = main.map((_, i) => w.ents[`m${i + 1}`].table!.section)
  assert.deepEqual(secs.map(s => s!.slice(1)).join(''), 'a'.repeat(6) + 'b'.repeat(6) + 'c'.repeat(6) + 'd'.repeat(6)) // m10 follows m9: numeric order
  assert.deepEqual(assign(P, w, at(10)), [])
})
test('assign: grotto whole = one section held by one server; the lightest-loaded unit takes it; re-running keeps the holder', () => {
  const w = run(base())
  const g = new Set(heldBy(w, 'grotto').map(e => e.table!.section))
  assert.equal(g.size, 1)
  const holders = crew.filter(s => w.ents[s.id].staff!.sections.includes([...g][0]!))
  assert.equal(holders.length, 1)
  assert.equal(w.ents[holders[0].id].staff!.sections.length, 2)
  assert.ok(!(w.ents[[...g][0]!] === undefined))
  assert.deepEqual(assign(P, w, at(10)), [])
})
test('assign: grotto piecemeal (service.carve tops) deals single tables like the patio, balanced over the whole crew', () => {
  const w = run(base({grotto: 'tops'}))
  const tops = [...heldBy(w, 'grotto'), ...heldBy(w, 'patio')].map(e => e.assign!.staff)
  const tally = Object.fromEntries('abcd'.split('').map(x => [x, tops.filter(s => s === x).length]))
  assert.equal(tops.length, 13)
  assert.ok(Math.max(...Object.values(tally)) - Math.min(...Object.values(tally)) <= 1, JSON.stringify(tally)) // chunks are even, so tops stay even
  assert.ok(!tops.includes('pr')) // the bar pair serves its own level only
  assert.deepEqual(assign(P, w, at(10)), [])
})
test('assign: piecemeal evens totals: the server holding the grotto and more main tables gets fewer patio tops', () => {
  const two = world(Object.values(base().ents).filter(e => !['c', 'd', 'sc', 'sd'].includes(e.id)))
  const w = run(two)
  const tops = (id: string) => Object.values(w.ents).filter(e => e.assign?.staff === id).length
  const total = (id: string) => Object.values(w.ents).filter(e => e.table && w.ents[id].staff!.sections.includes(e.table.section!)).length + tops(id)
  assert.deepEqual([tops('a'), tops('b')], [1, 6]) // a: 12 main + 6 grotto, b: 12 main
  assert.ok(Math.abs(total('a') - total('b')) <= 1)
})
test('assign: rotation deals nothing; an explicit mode overrides the clock; unknown mode deals nothing', () => {
  const w = base()
  assert.deepEqual(assign(P, w, at(12)), [])
  assert.deepEqual(assign(P, w, at(10), 'rotation'), [])
  assert.ok(assign(P, w, at(12), 'sectioned').length > 0)
  assert.deepEqual(assign(P, w, at(10), 'brunch'), [])
})
