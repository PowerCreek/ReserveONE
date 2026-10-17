import test from 'node:test'
import assert from 'node:assert/strict'
import {driver, pinchOf, sampler, tracker, wheelPx, wheelZoom} from './inputs.ts'
import type {Vec} from './inputs.ts'
const fake = () => {
  let t = 1000
  const q: (() => void)[] = []
  return {env: {now: () => t, raf: (f: () => void) => q.push(f)}, frame: (ms = 16) => ((t += ms), q.splice(0).forEach(f => f())), pending: () => q.length}
}
test('sampler accumulates pushes and delivers exactly their sum, easing toward it', () => {
  const s = sampler(70, 0.01)
  s.push({x: 10}); s.push({x: 6, y: -4})
  assert.deepEqual(s.left(), {x: 16, y: -4})
  const total: Vec = {}
  let n = 0, r = s.step(16)
  while (!r.settled && n++ < 200) { Object.entries(r.delta).forEach(([k, v]) => (total[k] = (total[k] ?? 0) + v)); r = s.step(16) }
  Object.entries(r.delta).forEach(([k, v]) => (total[k] = (total[k] ?? 0) + v))
  assert.ok(Math.abs(total.x! - 16) < 1e-9 && Math.abs(total.y! + 4) < 1e-9)
  assert.ok(n > 5 && n < 100) // glides, then settles
  assert.equal(s.busy(), false)
})
test('smoothing is frame-rate independent: one 32 ms step equals two 16 ms steps', () => {
  const [a, b] = [sampler(70), sampler(70)]
  a.push({x: 100}); b.push({x: 100})
  const one = a.step(32).delta.x!
  const two = b.step(16).delta.x! + b.step(16).delta.x!
  assert.ok(Math.abs(one - two) < 1e-9)
})
test('halt drops the pending target; cap bounds how far it runs ahead', () => {
  const s = sampler(70, 0.01, {z: 1})
  s.push({z: 5}); assert.equal(s.left().z, 1)
  s.halt(); assert.equal(s.busy(), false)
})
test('driver drains once per frame, stops scheduling when settled, and wakes on the next push', () => {
  const f = fake(), s = sampler(40, 0.01), calls: [Vec, boolean][] = []
  const d = driver(s, (v, done) => calls.push([v, done]), f.env)
  for (let i = 0; i < 100; i++) { s.push({x: 1}); d.kick() }
  assert.equal(f.pending(), 1) // 100 inputs, one frame requested
  assert.equal(calls.length, 0)
  let guard = 0
  while (f.pending() && guard++ < 300) f.frame()
  assert.equal(f.pending(), 0) // settled: no more frames
  assert.equal(calls.at(-1)![1], true)
  assert.equal(calls.filter(c => c[1]).length, 1)
  assert.ok(Math.abs(calls.reduce((a, c) => a + (c[0].x ?? 0), 0) - 100) < 1e-6)
  assert.ok(calls.length === guard) // exactly one apply per frame
  s.push({x: 1}); d.kick(); assert.equal(f.pending(), 1)
})
test('wheel: lines and pages normalise; zoom is proportional and clamped; pinch reads scale and pan', () => {
  assert.equal(wheelPx(3, 1), 48); assert.equal(wheelPx(1, 2), 800); assert.equal(wheelPx(7, 0), 7)
  assert.ok(wheelZoom(-100) > 0 && wheelZoom(100) < 0)
  assert.ok(Math.abs(wheelZoom(-20) * 2 - wheelZoom(-40)) < 1e-12)
  assert.ok(wheelZoom(-10, true) > wheelZoom(-10))
  assert.equal(wheelZoom(-1e6), 0.35)
  const p = pinchOf([0, 0, 100, 0], [10, 10, 210, 10])
  assert.ok(Math.abs(p.lz - Math.log(2)) < 1e-12 && p.dx === 60 && p.dy === 10)
})
test('tracker: a real throw flings a little, a single jump or a stop does not', () => {
  const t = tracker()
  t.add(0, 0, 0); t.add(16, 8, 0); t.add(32, 8, 0)
  const [fx] = t.fling(40)
  assert.ok(fx > 20 && fx < 100)
  const j = tracker(); j.add(5, 50, 0)
  assert.deepEqual(j.fling(5), [0, 0])
  assert.deepEqual(t.fling(400), [0, 0]) // stale
})
