import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import {real} from '../test/real.ts'
import {settle} from '../test/dom.ts'
import {ask} from './ask.ts'
import {gate, runs} from './memo.ts'
import {load, step, uiOf} from './index.ts'
const live = async () => {
  const {el, app} = real()
  load(app, 'rush')
  uiOf(app).rate = 0
  step(app, 1000)
  await settle()
  return {el, app}
}
test('a derived read is computed once per world revision however many panels ask', async () => {
  const {app} = await live()
  const n = () => runs(app).stand ?? 0
  const n0 = n()
  ;[1, 2, 3, 4].forEach(() => ask(app, 'stand'))
  ask(app, 'stand')
  assert.ok(n() - n0 <= 1, 'five asks cost at most one compute')
  const n1 = n()
  ask(app, 'stand')
  assert.equal(n(), n1, 'a repeat ask is a hit')
  const t = having(app.store.state.world, 'table')[0]!
  app.apply([{op: 'set', id: t.id, parts: {table: {...t.table, status: t.table.status === 'occupied' ? 'available' : 'occupied'}}}])
  ask(app, 'stand')
  assert.equal(n(), n1 + 1, 'a patch to the world invalidates')
  const n2 = n()
  const body = having(app.store.state.world, 'body')[0]!
  app.apply([{op: 'set', id: body.id, parts: {body: {...body.body, x: body.body.x + 5, y: body.body.y + 5}}}])
  ask(app, 'stand')
  assert.equal(n(), n2, 'a unit merely walking invalidates nothing')
  app.store.state.now += 61000
  ask(app, 'stand')
  assert.equal(n(), n2 + 1, 'the next minute recomputes')
})
test('board, eta, fit and alerts share the same revision key', async () => {
  const {app} = await live()
  const names = ['board', 'eta', 'fit', 'alerts'] as const
  const calls = () => names.map(k => runs(app)[k] ?? 0)
  const read = () => (ask(app, 'board', {ivMin: 15, pastMin: 30, aheadMin: 180}), ask(app, 'eta', 2), ask(app, 'fit', [2]), ask(app, 'alerts'))
  read()
  const c0 = calls()
  read()
  read()
  assert.deepEqual(calls(), c0)
})
test('a camera, hover or drag write repaints no panel', async () => {
  const {el, app} = await live()
  const hits: string[] = []
  const mo = new (el.ownerDocument.defaultView!.MutationObserver)(rs => rs.forEach(r => (r.target as Element).closest?.('[data-floor]') || hits.push(r.type + ':' + (r.target as Element).nodeName)))
  mo.observe(el, {subtree: true, childList: true, attributes: true, characterData: true})
  const [r0, rev0] = [JSON.stringify(runs(app)), uiOf(app).rev]
  const u = app.store.state.ui as unknown as Record<string, unknown>
  ;[1, 2, 3].forEach(i => Object.assign(u, {cam: {x: i, y: i, z: 1 + i / 10}, iso: {rot: i * 5}, hover: `t${i}`, drag: {x: i}}))
  await settle()
  assert.deepEqual(hits, [])
  assert.equal(JSON.stringify(runs(app)), r0)
  assert.equal(uiOf(app).rev, rev0)
  mo.disconnect()
})
test('controls repaint on their own keys only; gate skips an unchanged key', async () => {
  const {el, app} = await live()
  step(app, 1000)
  await settle()
  const bar = el.querySelector('[data-controls]')!
  const html = bar.innerHTML
  uiOf(app).speed = 120
  await settle()
  assert.notEqual(bar.innerHTML, html, 'a speed write repaints the bar')
  let k = 'a'
  let drawn = 0
  const g = gate(() => k, () => `${++drawn}`)
  g(); g()
  assert.equal(drawn, 1)
  k = 'b'
  assert.equal(g(), '2')
})
