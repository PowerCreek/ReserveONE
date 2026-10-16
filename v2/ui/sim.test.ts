import test from 'node:test'
import assert from 'node:assert/strict'
import {settle} from '../test/dom.ts'
import {load, step} from './index.ts'
import {uiOf} from './state.ts'
import {rig} from './rig.ts'
test('every sim event becomes a log line, a floor ping and a described message (before patches remove entities)', async () => {
  const {app, el} = rig([{patches: [{op: 'del', id: 'g1'}], events: [
    {ev: 'seated', party: 'p201', table: 't1', by: 'sv1'}, {ev: 'left', party: 'p201'}, {ev: 'stuck', unit: 'sv1', task: {do: 'serve', table: 't1'}, why: 'blocked'}]}])
  load(app, 'lunch')
  const before = uiOf(app).log.length
  const out = step(app, 1000)
  const [stuck, left, seated] = uiOf(app).log
  assert.equal(out.length, 3)
  assert.equal(uiOf(app).log.length, before + 3)
  assert.match(seated.msg, /seated at T1 by Ana/)
  assert.match(left.msg, /^W201 x2 left/)
  assert.match(stuck.msg, /stuck on serve: blocked/)
  assert.deepEqual(uiOf(app).fx.map(f => f.kind), ['seated', 'left', 'stuck'])
  await settle()
  assert.equal(el.querySelectorAll('[data-key]').length, uiOf(app).log.length)
  assert.match(el.querySelector('svg')!.innerHTML, /animate-ping/)
})
test('step advances sim time, fades pings and spawns by arrival rate', () => {
  const {app} = rig()
  load(app, 'lunch')
  const t0 = app.store.state.now
  Object.assign(app.store.state.ui, {rate: 6, fx: [{x: 0, y: 0, kind: 'left', msg: '', ttl: 1}]})
  const guests = Object.keys(app.store.state.world.ents).length
  step(app, 10000) // 6/min * 10s = 1 guest
  assert.equal(app.store.state.now, t0 + 10000)
  assert.equal(uiOf(app).fx.length, 0)
  assert.equal(Object.keys(app.store.state.world.ents).length, guests + 2)
})
test('clock runs while ui.running and stops on pause', async () => {
  const {app} = rig()
  load(app, 'lunch')
  const t0 = app.store.state.now
  app.store.state.ui.running = true
  await new Promise(r => setTimeout(r, 260))
  app.store.state.ui.running = false
  const t1 = app.store.state.now
  assert.ok(t1 > t0)
  await new Promise(r => setTimeout(r, 200))
  assert.equal(app.store.state.now, t1)
})
