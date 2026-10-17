import test from 'node:test'
import assert from 'node:assert/strict'
import {dom} from '../test/dom.ts'
import {gesture} from './gesture.ts'
import type {Vec} from './inputs.ts'
const svgRoot = () => {
  const doc = dom()
  const root = doc.createElement('div')
  root.innerHTML = '<svg data-v viewBox="0 0 100 100"></svg>'
  doc.body.append(root)
  return {root, svg: root.querySelector('svg')!, win: doc.defaultView!}
}
const clock = () => {
  let t = 1000
  const q: (() => void)[] = []
  return {env: {now: () => t, raf: (f: () => void) => q.push(f)}, frame: (ms = 16) => ((t += ms), q.splice(0).forEach(f => f())), pending: () => q.length}
}
const rig = (over: Partial<Parameters<typeof gesture>[0]> = {}) => {
  const {root, svg, win} = svgRoot(), c = clock(), calls: {d: Vec; settled: boolean}[] = []
  gesture({root, sel: 'svg[data-v]', fling: [], mode: () => 'pan', push: {pan: (dx, dy) => ({px: dx, py: dy})}, wheel: () => true, apply: (d, _g, settled) => calls.push({d, settled}), env: c.env, ...over})
  const ptr = (type: string, x: number, y: number, id = 1, o: object = {}) => ((e = new win.MouseEvent(type, {bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...o})) => (Object.defineProperty(e, 'pointerId', {value: id}), svg.dispatchEvent(e), e))()
  const wheel = (dy: number, o: object = {}) => ((e = new win.WheelEvent('wheel', {bubbles: true, cancelable: true, deltaY: dy, ...o})) => (svg.dispatchEvent(e), e))()
  const run = () => { let n = 0; while (c.pending() && n++ < 400) c.frame() }
  return {svg, c, calls, ptr, wheel, run}
}
test('100 wheel events inside one frame cause one apply, and the wheel is not left to the page', () => {
  const r = rig()
  const evs = Array.from({length: 100}, () => r.wheel(-100, {ctrlKey: true}))
  assert.ok(evs.every(e => e.defaultPrevented))
  assert.equal(r.calls.length, 0) // nothing applied by the events themselves
  assert.equal(r.c.pending(), 1)
  r.c.frame()
  assert.equal(r.calls.length, 1) // one apply for the whole burst
  assert.ok(r.calls[0]!.d.lz! > 0 && r.calls[0]!.settled === false) // eased: the first frame only covers part of the target
  r.run()
  assert.equal(r.calls.at(-1)!.settled, true)
  assert.equal(r.c.pending(), 0) // settled: no frames scheduled while idle
  const total = r.calls.reduce((a, c) => a + (c.d.lz ?? 0), 0)
  assert.ok(Math.abs(total - 1.4) < 1e-6) // capped pending zoom, delivered in full
})
test('a drag stays a click under 4 px, pans past it with the deltas applied once per frame, and ignores sub-pixel jitter', () => {
  const r = rig()
  r.ptr('pointerdown', 10, 10); r.ptr('pointermove', 12, 11)
  assert.equal(r.c.pending(), 0)
  r.ptr('pointermove', 30, 10) // crosses the threshold: the whole 20 px from the press
  r.ptr('pointermove', 30.2, 10.2) // jitter: dropped
  r.ptr('pointermove', 40, 10)
  r.ptr('pointerup', 40, 10)
  assert.equal(r.calls.length, 0)
  r.run()
  const px = r.calls.reduce((a, c) => a + (c.d.px ?? 0), 0)
  assert.ok(Math.abs(px - 30) < 1e-6)
  assert.equal(r.calls.filter(c => c.settled).length, 1)
  const click = new r.svg.ownerDocument.defaultView!.MouseEvent('click', {bubbles: true, cancelable: true})
  r.svg.dispatchEvent(click)
  assert.ok(click.defaultPrevented) // the click that ends a drag is swallowed
})
test('two pointers pinch: zoom from the distance ratio and pan from the midpoint, about the midpoint', () => {
  const r = rig()
  r.ptr('pointerdown', 0, 0, 1); r.ptr('pointerdown', 100, 0, 2)
  r.ptr('pointermove', 0, 0, 1); r.ptr('pointermove', 200, 0, 2)
  r.run()
  assert.ok(Math.abs(r.calls.reduce((a, c) => a + (c.d.lz ?? 0), 0) - Math.log(2)) < 1e-6)
  assert.ok(Math.abs(r.calls.reduce((a, c) => a + (c.d.px ?? 0), 0) - 50) < 1e-6)
})
test('a new press during a glide ends it at once with a settled apply', () => {
  const r = rig({fling: ['pan']})
  r.ptr('pointerdown', 0, 0); r.ptr('pointermove', 40, 0, 1, {timeStamp: 1}); r.c.frame(); r.c.frame()
  const n = r.calls.length
  r.ptr('pointerdown', 5, 5)
  assert.equal(r.calls.length, n + 1)
  assert.equal(r.calls.at(-1)!.settled, true)
})
