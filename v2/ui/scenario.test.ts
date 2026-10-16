import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import {load, presets, START} from './index.ts'
import {rig} from './rig.ts'
test('every preset loads a floor, crew, reservations and opening guests, and replaces the previous world', () => {
  const {app} = rig()
  Object.keys(presets).forEach(id => {
    load(app, id)
    const w = app.store.state.world, p = presets[id]
    assert.equal(having(w, 'table', 'pos').length, p.tables.length, id)
    assert.equal(having(w, 'staff', 'body').length, p.servers, id)
    assert.equal(having(w, 'party', 'reservation').length, p.res.length, id)
    assert.equal(having(w, 'party', 'queue').length, p.guests, id)
    assert.equal(having(w, 'link').length, p.links.length, id)
    assert.deepEqual([app.store.state.now, app.store.state.ui.scenario, app.store.state.ui.running], [START, id, false])
  })
})
test('table sections point at declared sections and servers cover them', () => {
  const {app} = rig()
  load(app, 'thin')
  const w = app.store.state.world
  const secs = new Set(having(w, 'section').map(s => s.id))
  assert.ok(having(w, 'table').every(t => secs.has(t.table.section!)))
  assert.deepEqual(having(w, 'staff')[0].staff.sections, ['s1', 's2'])
})
