import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy, having} from '../contracts/index.ts'
import {presets, step} from '../ui/index.ts'
import {count, real, run} from './real.ts'
// presets are the sim host's own sandbox: it seats for them
defaultPolicy.sim.autoSeat = true
const stuck = (evs: {ev: string}[]) => evs.filter(e => e.ev === 'stuck')
// Turns last 45-90 sim minutes, so cleared/left only appear after the first two minutes: phase 1 is the literal 120 s, phase 2 coasts on (no new arrivals; the ui repaint of a 300-party queue dominates jsdom time).
Object.keys(presets).forEach(id => test(`preset ${id}: 120 sim seconds seat and serve, then a full turn clears and leaves, never stuck`, () => {
  const {app} = real()
  const first = run(app, id, 120)
  const n = count(first)
  assert.deepEqual(stuck(first), [], 'stuck in the first 120 s')
  assert.ok(n.arrived > 0 && n.seated > 0 && n.served > 0, JSON.stringify(n))
  app.store.state.ui.rate = 0
  const rest = Array.from({length: 240}, () => step(app, 30000)).flat()
  const m = count(rest)
  assert.deepEqual(stuck(rest), [], 'stuck while turning tables')
  assert.ok(m.cleared > 0 && m.left > 0, JSON.stringify(m))
}))
test('the door entity agrees with the policy door and with where guests spawn', () => {
  const {app} = real()
  run(app, 'lunch', 1)
  const w = app.store.state.world
  const [dx, dy] = defaultPolicy.sim.door
  assert.deepEqual([w.ents.door.pos!.x, w.ents.door.pos!.y], [dx, dy])
  assert.ok(having(w, 'body').filter(b => b.body.role === 'guest').every(g => Math.abs(g.body.x - dx) <= defaultPolicy.sim.walkPxPerSec && g.body.y === dy))
})
