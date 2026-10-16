import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import type {Entity} from '../contracts/index.ts'
import {Engine} from './index.ts'
import {merges} from './merge.ts'
import {apply} from './patch.ts'
import {freeUp} from './free.ts'
import {plan} from './fit.ts'
import {N, P, demo} from './testkit.ts'
import {busy, guest, room, tbl, want} from './mkit.ts'
/** A table with neighbours: `adj` is symmetric venue data, so each side names the other. */
const next = (e: Entity, ...ids: string[]): Entity => ({...e, adj: {with: ids}})
const pair = (a: string, b: string, cap: number, ...tags: string[]) => [next(tbl(a, cap, tags), b), next(tbl(b, cap, tags), a)]
const spotsOf = (w: ReturnType<typeof room>) => merges(w).map(s => [s.id, s.spot.capacity, s.spot.label])
test('merges: only adjacent pairs where both tables are free and ungrouped, once each, same floor', () => {
  const w = room(next(tbl('t1', 4), 't2', 't3'), next(tbl('t2', 4), 't1'), next(tbl('t3', 2, [], 'f2'), 't1'), tbl('t4', 4), next(tbl('t5', 4), 't6'), ...busy(next(tbl('t6', 4), 't5'), 30))
  assert.deepEqual(spotsOf(w), [['m:t1+t2', 8, 'T1+T2']])
  const grouped = room(...pair('a', 'b', 2), {id: 'k', link: {members: ['a', 'b']}})
  assert.deepEqual(merges(grouped), [])
})
test('fit: a party of 8 is one merge of two adjacent 4-tops, claimed so the next party cannot reuse its tables', () => {
  const w = room(...pair('t1', 't2', 4), tbl('t3', 4), ...pair('t4', 't5', 4))
  const [a, b] = Engine.fit(P, w, N, [8, 8])
  assert.deepEqual([a.spot, a.tables, a.ready, a.label], ['m:t1+t2', ['t1', 't2'], true, 'T1+T2'])
  assert.deepEqual([b.spot, b.ready], ['m:t4+t5', true])
  assert.equal(Engine.fit(P, w, N, [8, 8, 8])[2].ready, false)
})
test('fit and ladder: a party of 6 prefers the booth to a merge; with the booth busy the merge is offered after the wait', () => {
  const free = room(guest([], 6), tbl('booth', 6, ['booth']), ...pair('a', 'b', 4))
  assert.equal(Engine.fit(P, free, N, [6])[0].spot, 'booth')
  assert.deepEqual(Engine.ladder(P, free, N, 'pty1').map(r => [r.step, r.spot]), [['exact', 'booth']])
  assert.deepEqual(Engine.match(P, free, N, 'pty1').map(f => f.spot), ['booth'])
  const out = room(guest([], 6), ...busy(tbl('booth', 6, ['booth']), 8), ...pair('a', 'b', 4))
  assert.deepEqual(Engine.ladder(P, out, N, 'pty1').map(r => [r.step, r.spot]), [['wait', 'booth'], ['merge', 'm:a+b']])
  assert.equal(Engine.fit(P, out, N, [6])[0].spot, 'm:a+b')
})
test('ladder: merge rung says which tables to push together and the seats; the smallest fitting pair wins', () => {
  const w = room(guest([], 4), ...pair('t5', 't6', 2), ...pair('t7', 't8', 3))
  const [r, ...rest] = Engine.ladder(P, w, N, 'pty1')
  assert.deepEqual([r.step, r.spot, r.say, rest.length], ['merge', 'm:t5+t6', 'Push T5 and T6 together: seats 4.', 0])
  assert.deepEqual(r.lacks, [])
})
test('ladder: the merge row is data (say template, and dropping the row drops the rung)', () => {
  const w = room(guest([], 4), ...pair('t5', 't6', 2))
  const row = P.host.ladder.find(d => d.kind === 'merge')!
  const p = {...P, host: {...P.host, ladder: [{...row, say: 'Join {spot} ({cap})'}]}}
  assert.deepEqual(Engine.ladder(p, w, N, 'pty1').map(r => r.say), ['Join T5+T6 (4)'])
  assert.deepEqual(Engine.ladder({...p, host: {...p.host, ladder: []}}, w, N, 'pty1'), [])
})
test('a 2-top never merges when a 2-top is free, and a need still filters merges', () => {
  const w = room(guest([], 2), tbl('two', 2), ...pair('a', 'b', 2))
  assert.deepEqual(Engine.fit(P, w, N, [2])[0].tables, ['two'])
  assert.deepEqual(Engine.ladder(P, w, N, 'pty1').map(r => r.step), ['exact'])
  assert.ok(!Engine.match(P, w, N, 'pty1').some(f => f.spot.startsWith('m:')))
  const quiet = room(guest([want('quiet', 'need')], 4), ...pair('a', 'b', 2), ...pair('c', 'd', 2, 'quiet'))
  assert.deepEqual(Engine.ladder(P, quiet, N, 'pty1').map(r => [r.step, r.spot]), [['merge', 'm:c+d']])
})
test('seat: a merge writes a merged link so the pair is one occupied spot; clearing dissolves it', () => {
  const w = room(...pair('t1', 't2', 4), tbl('t3', 4))
  const d = Engine.seat(P, w, N, {size: 8, kind: 'W', prefix: 'HS'})
  assert.ok(d.ok)
  const seated = apply(w, d.ok ? d.patches : [])
  const k = having(seated, 'link')
  assert.deepEqual(k.map(l => [l.link.members, l.link.merged]), [[['t1', 't2'], true]])
  assert.deepEqual(Engine.spots(seated).map(s => [s.id, s.spot.capacity, s.spot.status]), [[k[0].id, 8, 'occupied'], ['t3', 4, 'available']])
  assert.deepEqual(merges(seated), [])
  const cleared = apply(seated, freeUp(seated, ['t2'], N))
  assert.deepEqual(having(cleared, 'link'), [])
  assert.deepEqual(['t1', 't2'].map(i => cleared.ents[i].table!.status), ['available', 'available'])
  assert.deepEqual(merges(cleared).map(s => s.id), ['m:t1+t2'])
})
test('seat: a standing link group (not merged) survives a clear; a manual seat on a merge id pair links too', () => {
  const w = demo()
  assert.ok(having(apply(w, freeUp(w, ['t1'], N)), 'link').some(l => l.id === 'a1'))
  const m = room(...pair('t1', 't2', 4))
  const d = Engine.seat(P, m, N, {size: 6, kind: 'W', tables: ['t1', 't2']})
  assert.ok(d.ok && d.patches.some(p => p.op === 'add' && !!p.ent.link?.merged))
})
test('fit: without `adj` data nothing merges (existing worlds are unchanged), and the sim host seats singles only (opt merge: false)', () => {
  const w = room(...pair('t1', 't2', 4))
  const bare = room(...[w.ents.t1, w.ents.t2].map(e => ({...e, adj: undefined})))
  assert.deepEqual([Engine.fit(P, w, N, [8])[0].ready, Engine.fit(P, bare, N, [8])[0].ready], [true, false])
  assert.equal(plan(P, w, N, [8], {merge: false})[0].ready, false)
})
