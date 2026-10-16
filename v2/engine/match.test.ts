import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy} from '../contracts/index.ts'
import type {Policy} from '../contracts/index.ts'
import {intake, match} from './match.ts'
import {apply} from './patch.ts'
import {N, P, mins} from './testkit.ts'
import {busy, guest, room, tbl, want} from './mkit.ts'
const ids = (fs: {spot: string}[]) => fs.map(f => f.spot)
const m = (w: ReturnType<typeof room>, within?: string[]) => match(P, w, N, 'pty1', within)
test('match: a need is a hard filter (missing feature or avoided feature drops the spot), never a score', () => {
  const w = room(guest([want('quiet', 'need'), want('loud', 'need', {avoid: true})]), tbl('a', 2, ['quiet']), tbl('b', 2), tbl('c', 2, ['quiet', 'loud']))
  assert.deepEqual(ids(m(w)), ['a'])
  assert.deepEqual(m(w)[0].met.sort(), ['loud', 'quiet'])
})
test('match: capacity filters, tightest fit wins on equal score, blocked spots are skipped, within narrows', () => {
  const blocked = {...tbl('d', 2), table: {...tbl('d', 2).table!, status: 'blocked_private' as const}}
  const w = room(guest([]), tbl('big', 6), tbl('b', 2), tbl('a', 4), tbl('tiny', 1), blocked)
  assert.deepEqual(ids(m(w)), ['b', 'a', 'big'])
  assert.deepEqual(ids(m(w, ['a', 'tiny'])), ['a'])
})
test('match: score = level x why x accord, avoid takes the sign, missed lists feat/level/why', () => {
  const w = room(guest([want('booth', 'strong', {why: 'bench'}), want('window', 'soft', {accord: 'one'}), want('loud', 'strong', {avoid: true})]), tbl('a', 2, ['booth']), tbl('b', 2, ['window']), tbl('c', 2, ['booth', 'loud']), tbl('d', 2))
  const fs = m(w)
  assert.deepEqual(ids(fs), ['a', 'c', 'b', 'd'])
  assert.deepEqual(fs.map(f => f.score), [15, 5, 1.5, 0])
  assert.deepEqual(fs[2].missed, [{feat: 'booth', level: 'strong', why: 'bench'}])
  assert.deepEqual(fs[1].missed.map(x => x.feat), ['window', 'loud'])
})
test('match: wide spots lose slack points per spare cover', () => {
  const [a, b] = m(room(guest([], 2), tbl('a', 4), tbl('b', 2)))
  assert.deepEqual([a.spot, a.score, b.spot, b.score], ['b', 0, 'a', -P.host.score.slack * 2])
})
test('match: ready and waitMin come from table turnover; a due reservation pushes a free table out', () => {
  const held = {id: 'r', party: {num: 2, label: 'R', prefix: '', kind: 'R' as const, name: 'R', size: 2}, reservation: {at: N + mins(10), durationMin: 90, table: 'h', status: 'BOOKED' as const, phone: '', notes: ''}}
  const w = room(guest([]), busy(tbl('a', 2), 8), tbl('h', 2, [], 'f1'), held, tbl('z', 4))
  const by = Object.fromEntries(m(w).map(f => [f.spot, f]))
  assert.deepEqual([by.a.ready, by.a.waitMin], [false, 13])
  assert.equal(by.z.ready, true)
  assert.equal(by.h.ready, false)
  assert.ok(by.h.waitMin > 90)
})
test('match: only wants the host knows count (volunteered or heard)', () => {
  const quiet = want('quiet', 'strong', {said: false})
  const w = (heard: string[]) => room(guest([quiet], 2, heard), tbl('a', 2), tbl('b', 2, ['quiet']))
  assert.deepEqual(m(w([])).map(f => f.score), [0, 0])
  assert.deepEqual(ids(m(w(['quiet']))), ['b', 'a'])
})
test('match: unknown party gives nothing; a link group is one spot carrying its members features', () => {
  const w = room(guest([want('booth')], 4), tbl('t1', 2, ['booth']), tbl('t2', 2, ['quiet']), {id: 'g', link: {members: ['t1', 't2']}})
  assert.deepEqual(match(P, w, N, 'nobody'), [])
  assert.deepEqual(m(w).map(f => [f.spot, f.met]), [['g', ['booth']]])
})
test('intake: records heard qualifiers as a patch, idempotent, reports what it learned', () => {
  const w = room(guest([want('quiet', 'strong', {said: false}), want('booth', 'soft', {said: false})]))
  const d = intake(P, w, N, 'pty1', ['quiet', 'patio'])
  assert.ok(d.ok && d.msg === 'Heard quiet (strong)' && d.tone === 'ok')
  const w2 = apply(w, d.ok ? d.patches : [])
  assert.deepEqual(w2.ents.pty1.wants, {list: w.ents.pty1.wants!.list, heard: ['quiet', 'patio']})
  const d2 = intake(P, w2, N, 'pty1', ['booth', 'quiet'])
  assert.deepEqual(apply(w2, d2.ok ? d2.patches : []).ents.pty1.wants!.heard, ['quiet', 'patio', 'booth'])
  assert.equal(w.ents.pty1.wants!.heard.length, 0)
})
test('intake: refuses unknown party or feature; a party without wants still records heard', () => {
  const w = room({id: 'pty1', party: {num: 1, label: 'x', prefix: '', kind: 'W', name: 'Z', size: 2}})
  assert.deepEqual(intake(P, w, N, 'nope', ['quiet']), {ok: false, err: 'No party nope'})
  const bad = intake(P, w, N, 'pty1', ['jacuzzi'])
  assert.ok(!bad.ok && /jacuzzi/.test(bad.err))
  const d = intake(P, w, N, 'pty1', ['quiet'])
  assert.ok(d.ok && d.msg === 'Nothing special')
})
test('match: purity, same inputs same output, frozen inputs untouched', () => {
  const deep = <T,>(o: T): T => { Object.values(o as object).forEach(v => typeof v === 'object' && v && deep(v)); return Object.freeze(o) }
  const w = deep(room(guest([want('booth')]), tbl('a', 2, ['booth']), busy(tbl('b', 2), 5)))
  const p: Policy = deep(structuredClone(defaultPolicy))
  assert.deepEqual(match(p, w, N, 'pty1'), match(p, w, N, 'pty1'))
  assert.ok(intake(p, w, N, 'pty1', ['booth']).ok)
})
