import test from 'node:test'
import assert from 'node:assert/strict'
import {App} from '../kernel/index.ts'
import {Engine} from '../engine/index.ts'
import {defaultPolicy} from '../contracts/index.ts'
import {run} from '../ui/act.ts'
import {history, undo} from '../kernel/index.ts'
test('a hold is one undoable step', () => {
  const t12 = {id: 't12', pos: {floor: 'f1', x: 0, y: 0, w: 80, h: 80}, table: {label: 'T12', capacity: 4, min: 1, shape: 'rect' as const, status: 'available' as const, waiter: null, section: null}}
  const app = App.create({now: 0, ui: {size: 2, pick: '', tone: '', log: []} as never, world: {nextParty: 1, ents: {t12}}}).use(a => a.provide('engine', Engine).provide('policy', defaultPolicy)).use(history)
  const before = JSON.stringify(app.store.state.world)
  assert.ok(run(app, {do: 'hold', tables: ['t12'], size: 4, until: 60000, why: 'x'}).ok)
  assert.equal(app.store.state.world.ents.t12!.hold?.id, 'hd1')
  undo(app)
  assert.equal(JSON.stringify(app.store.state.world), before)
})
