import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy} from '../contracts/index.ts'
import type {Policy} from '../contracts/index.ts'
import {ladder} from './ladder.ts'
import {N, P} from './testkit.ts'
import {busy, guest, room, tbl, want} from './mkit.ts'
const steps = (w: ReturnType<typeof room>, p: Policy = P) => ladder(p, w, N, 'pty1').map(r => [r.step, r.spot])
const booth = [want('booth')]
test('ladder: a ready spot with every want met is the exact rung and the whole answer', () => {
  const rs = ladder(P, room(guest(booth), tbl('a', 2, ['booth']), tbl('b', 2, ['banquette'])), N, 'pty1')
  assert.deepEqual(rs.map(r => [r.step, r.spot, r.gives, r.lacks]), [['exact', 'a', ['booth'], []]])
  assert.equal(rs[0].say, 'A1 is ready for Chen party.'.replace('A1', 'A'.toUpperCase()))
})
test('ladder: feature runs out -> wait within tolerance, then near (stand-in), then elsewhere', () => {
  const w = room(guest(booth), busy(tbl('b1', 2, ['booth']), 8), tbl('q1', 2, ['banquette']), tbl('p', 2, [], 'f2'))
  const rs = ladder(P, w, N, 'pty1')
  assert.deepEqual(rs.map(r => [r.step, r.spot]), [['wait', 'b1'], ['near', 'q1'], ['elsewhere', 'p']])
  assert.equal(rs[0].waitMin, 13)
  assert.equal(rs[0].say, 'A booth table opens in 13 min: would Chen party like to wait?')
  assert.equal(rs[1].say, 'Q1 has banquette, though not booth: would that suit Chen party?')
  assert.deepEqual([rs[1].gives, rs[1].lacks.map(l => l.feat)], [['banquette'], ['booth']])
})
test('ladder: the wait is dropped past the level tolerance (strong 15, soft 10) and past patience', () => {
  const late = (min: number) => room(guest(booth), busy(tbl('b1', 2, ['booth']), min), tbl('q1', 2, ['banquette']))
  assert.deepEqual(steps(late(8)).map(s => s[0]), ['wait', 'near'])
  assert.deepEqual(steps(late(12)).map(s => s[0]), ['near'])
  const soft = room(guest([want('booth', 'soft')]), busy(tbl('b1', 2, ['booth']), 8), tbl('x', 2))
  assert.deepEqual(steps(soft).map(s => s[0]), ['relax'])
})
test('ladder: relax drops soft wants only, a strong want missing is not relaxed on the same floor', () => {
  const soft = room(guest([want('window', 'soft')]), busy(tbl('w', 2, ['window']), 60), tbl('x', 2))
  const rs = ladder(P, soft, N, 'pty1')
  assert.deepEqual(rs.map(r => [r.step, r.spot, r.lacks.map(l => l.feat)]), [['relax', 'x', ['window']]])
  assert.equal(rs[0].say, 'X is ready now, without window: would that suit Chen party?')
  assert.deepEqual(steps(room(guest([want('window', 'strong')]), busy(tbl('w', 2, ['window']), 60), tbl('x', 2))), [])
})
test('ladder: a need is never relaxed or substituted, even when policy tries to drop it', () => {
  const greedy: Policy = {...defaultPolicy, host: {...defaultPolicy.host, ladder: defaultPolicy.host.ladder.map(d => ({...d, drops: ['soft', 'strong', 'need'] as const} as typeof d))}}
  const feats = {...defaultPolicy.host.feats, accessible: {...defaultPolicy.host.feats.accessible, near: ['quiet']}}
  const p: Policy = {...greedy, host: {...greedy.host, feats}}
  const ws = [
    room(guest([want('accessible', 'need'), want('booth', 'soft')]), busy(tbl('a', 2, ['accessible']), 60), tbl('x', 2, ['booth']), tbl('y', 2, ['quiet']), tbl('z', 2, [], 'f2')),
    room(guest([want('accessible', 'need'), want('booth', 'soft')]), busy(tbl('a', 2, ['accessible']), 8), tbl('x', 2, ['booth']), tbl('y', 2, ['quiet'])),
    room(guest([want('accessible', 'need'), want('booth', 'soft')]), tbl('a', 2, ['accessible']), tbl('x', 2, ['booth', 'quiet'])),
  ]
  const rs = ws.map(w => ladder(p, w, N, 'pty1'))
  assert.deepEqual(rs.map(r => r.map(x => x.spot)), [[], ['a'], ['a']])
  assert.ok(rs.flat().every(r => r.spot === 'a' && r.lacks.every(l => l.level !== 'need')))
})
test('ladder: elsewhere only offers another floor or section than the preferred spot, and each spot is claimed once', () => {
  const w = room(guest(booth), busy(tbl('b1', 2, ['booth'], 'f1', 's1'), 60), tbl('q1', 2, ['banquette'], 'f1', 's1'), tbl('o', 2, [], 'f1', 's2'), tbl('p', 2, [], 'f2', 's1'))
  const rs = ladder(P, w, N, 'pty1')
  assert.deepEqual(rs.map(r => [r.step, r.spot]), [['near', 'q1'], ['elsewhere', 'o']])
  assert.equal(new Set(rs.map(r => r.spot)).size, rs.length)
})
test('ladder: no spot satisfies the needs, or no party, means no rungs (the host explains instead)', () => {
  assert.deepEqual(steps(room(guest([want('booth', 'need')]), tbl('a', 2))), [])
  assert.deepEqual(ladder(P, room(), N, 'pty1'), [])
})
test('ladder: rows come from policy (reorder, drop, rename say) and nothing is hard-wired', () => {
  const w = room(guest(booth), busy(tbl('b1', 2, ['booth']), 60), tbl('q1', 2, ['banquette']), tbl('x', 2))
  const rows = defaultPolicy.host.ladder
  const p: Policy = {...defaultPolicy, host: {...defaultPolicy.host, ladder: [{...rows[2], say: 'Try {spot} ({gives}, not {lacks})'}]}}
  assert.deepEqual(ladder(p, w, N, 'pty1').map(r => r.say), ['Try Q1 (banquette, not booth)'])
  assert.deepEqual(ladder({...p, host: {...p.host, ladder: []}}, w, N, 'pty1'), [])
})
test('ladder: avoid wants read as "no X" and unheard wants are ignored', () => {
  const w = room(guest([want('sunny', 'soft', {avoid: true}), want('quiet', 'strong', {said: false})]), tbl('s', 2, ['sunny']))
  const [r] = ladder(P, w, N, 'pty1')
  assert.deepEqual([r.step, r.say], ['relax', 'S is ready now, without no sun glare: would that suit Chen party?'])
})
test('ladder: purity, frozen inputs, deterministic', () => {
  const deep = <T,>(o: T): T => { Object.values(o as object).forEach(v => typeof v === 'object' && v && deep(v)); return Object.freeze(o) }
  const w = deep(room(guest(booth), busy(tbl('b1', 2, ['booth']), 8), tbl('q1', 2, ['banquette'])))
  const p = deep(structuredClone(defaultPolicy))
  assert.deepEqual(ladder(p, w, N, 'pty1'), ladder(p, w, N, 'pty1'))
})
