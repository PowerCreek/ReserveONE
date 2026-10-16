import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy} from '../contracts/index.ts'
import {holdsOn, modeAt} from './modes.ts'
import {P, world} from './testkit.ts'
const at = (h: number, m = 0) => new Date(2026, 5, 1, h, m).getTime()
const svc = (override: string | null) => world([{id: 'service', service: {override, carve: {}}}])
test('modeAt: the schedule decides the day mode (sectioned 10:00, rotation 12:00, sectioned 16:00; rows switch on the minute)', () => {
  const w = world([])
  assert.deepEqual([10, 12, 16].map(h => modeAt(P, w, at(h))), ['sectioned', 'rotation', 'sectioned'])
  assert.deepEqual([[10, 59], [11, 0], [14, 59], [15, 0]].map(([h, m]) => modeAt(P, w, at(h, m))), ['sectioned', 'rotation', 'rotation', 'sectioned'])
  assert.deepEqual([10, 12].map(h => holdsOn(P, w, at(h))), [true, false])
})
test('modeAt: the service entity overrides the schedule; null follows it; an unknown override is ignored', () => {
  assert.equal(modeAt(P, svc('rotation'), at(10)), 'rotation')
  assert.equal(modeAt(P, svc('sectioned'), at(12)), 'sectioned')
  assert.equal(modeAt(P, svc(null), at(12)), 'rotation')
  assert.equal(modeAt(P, svc('brunch'), at(12)), 'rotation')
})
test('modeAt: policy decides, before the first row yesterday\'s last row runs, an empty schedule takes the first mode', () => {
  const late = {...P, service: {...P.service, schedule: [{from: 9 * 60, mode: 'rotation'}, {from: 20 * 60, mode: 'sectioned'}]}}
  assert.deepEqual([6, 10, 21].map(h => modeAt(late, world([]), at(h))), ['sectioned', 'rotation', 'sectioned'])
  assert.equal(modeAt({...defaultPolicy, service: {...P.service, schedule: []}}, world([]), at(12)), 'sectioned')
})
