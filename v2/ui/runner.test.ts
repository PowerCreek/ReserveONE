import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import type {Decision, Engine} from '../contracts/index.ts'
import {App} from '../kernel/index.ts'
import {scenarios} from '../scenarios/index.ts'
import {dom} from '../test/dom.ts'
import {presets, ui} from './index.ts'
import {choices, load} from './scenario.ts'
import {fake, seed} from './rig.ts'
import {runner} from './runner.ts'
const MIN = 60000
const kit = (engine = true) => {
  dom()
  const asks: [string, string][] = []
  const seat: Engine['seat'] = (_p, w, _n, req) => {
    const t = w.ents[req.tables![0]]
    return {ok: true, msg: 'seated', tone: 'ok', patches: [{op: 'set', id: t.id, parts: {table: {...t.table!, status: 'occupied'}}}]}
  }
  const ask = (_p: unknown, _w: unknown, _n: number, party: string, reason: string): Decision => (asks.push([party, reason]), {ok: true, msg: 'asked', tone: 'ok', patches: []})
  const e = engine ? {...fake(), seat, ask} : {}
  const app = App.create(seed()).use(a => a.provide('engine', e as unknown as Engine)).use(ui)
  return {app, asks, to: (min: number) => (app.store.state.now = app.store.state.ui.run!.t0 + min * MIN), parties: () => having(app.store.state.world, 'party')}
}
test('a starter loads its room, crew and busy tables, then plays the minute-0 steps only', () => {
  const {app, asks, parties} = kit()
  load(app, 'table-change')
  const w = app.store.state.world
  assert.deepEqual(having(w, 'feat').map(t => t.id).sort(), ['d1', 'l1', 'l2', 'q1'])
  assert.deepEqual(having(w, 'feat').find(t => t.id === 'q1')!.feat.tags, ['chairs', 'quiet', 'window'])
  assert.equal(w.ents.l2.table!.status, 'occupied') // seed busy table
  assert.equal(having(w, 'slot').filter(s => s.slot.table === 'l2' && s.slot.status === 'ACTIVE').length, 1)
  assert.equal(w.ents.l1.table!.status, 'occupied') // tanaka placed seated
  assert.equal(having(w, 'staff').length, 1)
  assert.deepEqual(['host', 'door'].map(id => id in w.ents), [true, true])
  assert.equal(parties().length, 3) // busy + garcia + tanaka
  assert.deepEqual(asks, [])
  assert.equal(app.store.state.ui.run!.done, 4)
  assert.equal(app.store.state.ui.scenario, 'table-change')
  assert.equal(app.store.state.ui.rate, 0)
})
test('arrive carries party facts and wants; place arrived leases the table through act (guest at it, held past its scripted ask)', () => {
  const {app} = kit()
  load(app, 'booth-out')
  const w = app.store.state.world
  const run = app.store.state.ui.run!
  const chen = w.ents[run.keys.okafor]
  assert.deepEqual([chen.party!.name, chen.party!.size, chen.party!.here, chen.queue!.status, chen.mood!.score], ['Okafor', 4, 4, 'WAITING', 0])
  assert.deepEqual(chen.wants!.list, [{feat: 'booth', level: 'strong', why: 'bench', accord: 'all'}])
  assert.equal(chen.body!.role, 'guest')
  load(app, 'table-change')
  const g = app.store.state.world.ents[app.store.state.ui.run!.keys.garcia]
  assert.deepEqual([g.lease!.spot, g.lease!.tables, g.offer!.status, app.store.state.world.ents.d1.table!.status], ['d1', ['d1'], 'accepted', 'leased'])
  assert.equal(g.lease!.until, app.store.state.ui.run!.t0 + 4 * MIN) // the scripted draft ask at minute 3 finds the lease still open
  assert.deepEqual([g.body!.x, g.body!.y, g.body!.task], [88, 148, null])
  assert.ok(app.store.state.ui.stand && !app.store.state.ui.log!.some(l => l.kind === 'warn'), app.store.state.ui.log!.map(l => l.msg).join(' | '))
})
test('later steps play once, at their minute, through the engine', () => {
  const {app, asks, to} = kit()
  load(app, 'table-change')
  to(2)
  assert.deepEqual(asks, [])
  to(3)
  to(3.5)
  assert.deepEqual(asks.map(a => a[1]), ['draft'])
  to(12)
  to(40)
  assert.deepEqual(asks.map(a => a[1]), ['draft', 'noise'])
  const {keys} = app.store.state.ui.run!
  assert.deepEqual(asks.map(a => a[0]), [keys.garcia, keys.tanaka])
  assert.equal(app.store.state.ui.run!.done, scenarios['table-change'].steps.length)
})
test('every starter loads and runs to its last step, with the engine or without it', () => {
  ;[true, false].forEach(engine => Object.keys(scenarios).forEach(id => {
    const {app, asks, to} = kit(engine)
    load(app, id)
    to(120)
    const steps = scenarios[id].steps
    assert.equal(app.store.state.ui.run!.done, steps.length, id)
    assert.equal(asks.length, engine ? steps.filter(x => x.do === 'ask').length : 0, id)
    assert.equal(having(app.store.state.world, 'party').filter(p => p.party.size && 'wants' in p).length, steps.filter(x => x.do === 'arrive').length, id)
  }))
})
test('wiring the runner again, or loading a preset, does not replay or keep playing a starter', () => {
  const {app, asks, to, parties} = kit()
  app.use(runner).use(runner)
  load(app, 'table-change')
  to(12)
  assert.equal(asks.length, 2)
  const n = parties().length
  load(app, 'lunch')
  assert.equal(app.store.state.ui.run, undefined)
  app.store.state.now += 30 * MIN
  assert.equal(asks.length, 2)
  assert.ok(parties().length >= presets.lunch.guests && n >= 3)
})
test('the picker lists presets then starters; free play carries no grading fields', () => {
  const c = choices()
  assert.deepEqual(c.map(x => x.kind), [...Object.keys(presets).map(() => 'preset'), ...Object.keys(scenarios).map(() => 'starter')])
  assert.ok(['lunch-rush', 'patio-swing'].every(id => c.some(x => x.id === id)))
  assert.ok(c.every(x => Object.keys(x).join() === 'id,label,blurb,kind'))
})
