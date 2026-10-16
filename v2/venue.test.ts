import {test} from 'node:test'
import assert from 'node:assert/strict'
import {having} from './contracts/index.ts'
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
