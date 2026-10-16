import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy, having} from './contracts/index.ts'
import {Engine} from './engine/index.ts'
import type {Entity} from './contracts/index.ts'
import {venue} from './venue.ts'
import {staffed} from './crew.ts'
const ents = staffed(venue([800, 520]))
const w = {nextParty: 1, ents: Object.fromEntries(ents.map(e => [e.id, e]))}
const tables = having(w, 'table', 'area')
const inArea = (a: string) => tables.filter(t => t.area.id === a)
const assign = (t: Entity) => t.assign?.staff
const labels = (ts: Entity[]) => ts.map(t => t.table!.label)

test('every table carries an area tag with the expected counts', () => {
  assert.equal(tables.length, having(w, 'table').length)
  assert.deepEqual(['main', 'grotto', 'patio', 'bar', 'upstairs'].map(a => inArea(a).length), [24, 6, 7, 18, 11])
  assert.deepEqual(labels(inArea('grotto')).sort(), ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'])
})
test('main is four contiguous section chunks by table number, held by the four floor servers', () => {
  const main = inArea('main').sort((a, b) => Number(a.table.label) - Number(b.table.label))
  assert.deepEqual(main.map(t => t.table.section), Array.from({length: 24}, (_, i) => `sec_m${Math.floor(i / 6) + 1}`))
  const servers = having(w, 'staff').filter(s => !s.staff.area)
  assert.deepEqual(servers.map(s => [s.staff.weight, s.staff.sections]), [1, 2, 3, 4].map(i => [undefined, [`sec_m${i}`]]))
})
test('grotto is one whole section; patio tops are dealt across the servers', () => {
  assert.equal(new Set(inArea('grotto').map(t => t.table.section)).size, 1)
  assert.ok(inArea('grotto').every(t => t.table.section === 'sec_grotto' && !assign(t)))
  const tops = inArea('patio').map(t => assign(t))
  assert.deepEqual(tops, ['sv1', 'sv2', 'sv3', 'sv4', 'sv1', 'sv2', 'sv3'])
  assert.ok(inArea('patio').every(t => t.table.section === null))
})
test('bar and upstairs each have a bartender pair of weight 2', () => {
  const pairs = having(w, 'staff').filter(s => s.staff.area)
  assert.deepEqual(pairs.map(p => [p.staff.area, p.staff.weight, p.staff.crew?.length]), [['bar', 2, 2], ['upstairs', 2, 2]])
  assert.ok(inArea('bar').concat(inArea('upstairs')).every(t => t.table.section === null && !assign(t)))
})
test('singleton service entity, host, busser and door are present', () => {
  assert.deepEqual(w.ents.service!.service, {override: null, carve: {main: 'chunk', grotto: 'whole', patio: 'tops', bar: 'level', upstairs: 'level'}})
  assert.deepEqual(['host', 'busser'].map(r => having(w, 'body').filter(e => e.body.role === r).length), [1, 1])
  assert.deepEqual(w.ents.door!.pos, {floor: 'rf1', x: 24, y: 260, w: 0, h: 0})
  assert.equal(ents.filter(e => e.id === 'service').length, 1)
})
const main = (ids: string[]) => ids.map(n => w.ents[`rf_${n}`]!.table!)
const nums = (ids: number[]) => ids.map(String)
test('main floor capacities: booths 1-4 and 24 seat 6, the listed 2-tops seat 2, every other table is a 4-top', () => {
  const booths = ['1', '2', '3', '4', '24'], twos = ['5', '6', '7', '8', '13', '14', '15', '16', '19', '21']
  const fours = nums(Array.from({length: 24}, (_, i) => i + 1)).filter(n => ![...booths, ...twos].includes(n))
  assert.deepEqual(main(booths).map(t => [t.capacity, t.shape]), booths.map(() => [6, 'booth']))
  assert.deepEqual(main(twos).map(t => [t.capacity, t.shape]), twos.map(() => [2, 'rect']))
  assert.deepEqual(main(fours).map(t => [t.capacity, t.shape]), fours.map(() => [4, 'rect']))
  assert.deepEqual(fours, ['9', '10', '11', '12', '17', '18', '20', '22', '23'])
  assert.equal(having(w, 'table').length, 66)
})
test('main floor is laid out physically: no overlaps, and adjacency (adj) is symmetric, same area, within the policy gap', () => {
  const ts = having(w, 'table', 'pos', 'area').filter(t => t.pos.floor === 'rf1')
  const hit = (a: typeof ts[0], b: typeof ts[0]) => a.pos.x < b.pos.x + b.pos.w && b.pos.x < a.pos.x + a.pos.w && a.pos.y < b.pos.y + b.pos.h && b.pos.y < a.pos.y + a.pos.h
  assert.deepEqual(ts.flatMap((a, i) => ts.slice(i + 1).filter(b => hit(a, b)).map(b => [a.id, b.id])), [])
  const adj = (id: string) => w.ents[id]!.adj?.with ?? []
  assert.ok(ts.every(t => adj(t.id).every(o => adj(o).includes(t.id) && w.ents[o]!.area!.id === t.area.id)))
  assert.deepEqual([adj('rf_5'), adj('rf_6')], [['rf_6'], ['rf_5', 'rf_7']])
  assert.deepEqual([adj('rf_4').includes('rf_5'), adj('rf_9').includes('rf_13'), adj('rf_24')], [false, false, []])
})
test('adjacency covers only the main area (the only physical layout): grotto, bar, patio, upstairs carry none', () => {
  assert.deepEqual(having(w, 'table', 'area').filter(t => t.area.id !== 'main' && w.ents[t.id]!.adj).map(t => t.id), [])
  assert.ok(inArea('main').filter(t => w.ents[t.id]!.adj).length >= 20)
})
test('real venue: a party of 12 is two adjacent booths; 2, 4 and 6 stay on a single table', () => {
  const ask = (size: number) => Engine.fit(defaultPolicy, w, 0, [size])[0]
  assert.deepEqual([ask(12).ready, ask(12).tables.length, ask(12).tables.every(t => w.ents[t]!.table!.capacity === 6)], [true, 2, true])
  assert.deepEqual([2, 4, 6].map(n => ask(n).tables.length), [1, 1, 1])
})
