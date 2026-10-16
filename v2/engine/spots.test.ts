import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine} from './index.ts'
import {demo, table, world} from './testkit.ts'
test('spots: a link group is one spot (label joined, capacity summed); its members are not listed again', () => {
  const ss = Engine.spots(demo())
  const g = ss.find(s => s.id === 'a1')!
  assert.deepEqual([g.spot.label, g.spot.capacity, g.spot.tables], ['A1+A2', 4, ['t1', 't2']])
  assert.equal(ss.length, 16)
  assert.ok(!ss.some(s => s.id === 't1' || s.id === 't2'))
})
test('spots: status precedence blocked > occupied > lapsed > available, floor and section come from the first member', () => {
  const w = world([table('a', 2, 'lapsed', 'sA', null, 'f9'), table('b', 2, 'occupied'), table('c', 2, 'blocked_private'), {id: 'g1', link: {members: ['a', 'b']}}, {id: 'g2', link: {members: ['a', 'c']}}])
  const [g1] = Engine.spots(w)
  assert.deepEqual([g1.spot.status, g1.spot.floor, g1.spot.section], ['occupied', 'f9', 'sA'])
  assert.equal(Engine.spots(world([table('a', 2, 'lapsed'), table('c', 2, 'blocked_private'), {id: 'g', link: {members: ['a', 'c']}}]))[0].spot.status, 'blocked_private')
})
test('spots: a link with a missing member degrades to the remaining table', () => {
  const w = world([table('a', 2), {id: 'g', link: {members: ['a', 'gone']}}])
  assert.deepEqual(Engine.spots(w).map(s => s.id), ['a'])
})
test('spots: feats is the sorted union of member feat.tags (empty when untagged)', () => {
  const tag = (id: string, tags?: string[]) => ({...table(id, 2), ...(tags ? {feat: {tags}} : {})})
  const w = world([tag('a', ['quiet', 'booth']), tag('b', ['booth', 'window']), tag('c'), {id: 'g', link: {members: ['a', 'b']}}])
  const by = Object.fromEntries(Engine.spots(w).map(s => [s.id, s.spot.feats]))
  assert.deepEqual(by, {g: ['booth', 'quiet', 'window'], c: []})
})
