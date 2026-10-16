import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import {settle} from '../test/dom.ts'
import {load} from './index.ts'
import {click, rig} from './rig.ts'
const text = (el: Element, sel: string) => el.querySelector(sel)!.textContent!
test('tabs show one pane at a time through data-show', async () => {
  const {el, app} = rig()
  await settle()
  const shown = () => [...el.querySelectorAll<HTMLElement>('section[data-show]')].filter(s => !s.hidden).map(s => s.getAttribute('data-show'))
  assert.deepEqual(shown(), ['ui.on.sim'])
  click(el, '[data-act="tab"][data-id="staff"]')
  await settle()
  assert.deepEqual(shown(), ['ui.on.staff'])
  assert.equal(app.store.state.ui.tab, 'staff')
})
test('controls: play/pause, speed, spawn and scenario buttons write ui state and the log', async () => {
  const {el, app} = rig()
  load(app, 'lunch')
  await settle()
  click(el, '[data-act="speed"][data-v="30"]')
  click(el, '[data-act="spawn"][data-n="5"]')
  click(el, '[data-act="play"]')
  assert.deepEqual([app.store.state.ui.speed, app.store.state.ui.running], [30, true])
  assert.equal(having(app.store.state.world, 'party', 'queue').length, 4 + 5)
  click(el, '[data-act="play"]')
  assert.equal(app.store.state.ui.running, false)
  await settle()
  assert.match(text(el, '[data-clock]'), /^17:00:00 UTC \| queue 9 \| busy 0\/12/)
})
test('fast seating: stepper refits, Seat now occupies the table, Undo restores it', async () => {
  const {el, app} = rig()
  load(app, 'lunch')
  await settle()
  click(el, '[data-act="more"]') // size 3 -> tightest free table with 4
  await settle()
  assert.equal(text(el, '[data-text="ui.pick"]'), 'T3')
  click(el, '[data-act="quick"]')
  assert.equal(app.store.state.world.ents.t3.table!.status, 'occupied')
  click(el, '[data-act="undo"]')
  assert.equal(app.store.state.world.ents.t3.table!.status, 'available')
  await settle()
  assert.equal(el.querySelectorAll('[data-fits] button').length, 8)
})
test('queue lists waiting parties and Seat uses the party as its own request; Add to queue enrolls with an eta quote', async () => {
  const {el, app} = rig()
  load(app, 'lunch')
  click(el, '[data-act="join"]')
  await settle()
  const rows = el.querySelectorAll('[data-queue] li')
  assert.equal(rows.length, 4 + 1)
  assert.match(rows[rows.length - 1].textContent!, /quote 12m/)
  click(el, '[data-queue] [data-act="seat"]')
  assert.equal(having(app.store.state.world, 'table').filter(t => t.table.status === 'occupied').length, 1)
})
test('reservations: the form books, rows advance Arrived -> Seat, No-show closes', async () => {
  const {el, app} = rig()
  load(app, 'lunch')
  el.querySelector<HTMLInputElement>('[name=name]')!.value = 'Lee'
  el.querySelector<HTMLInputElement>('[name=size]')!.value = '4'
  click(el, '[data-act="book"]')
  await settle()
  const rs = () => having(app.store.state.world, 'party', 'reservation')
  assert.equal(rs().length, 2)
  click(el, '[data-book] [data-to="arrive"]')
  assert.equal(rs().filter(r => r.reservation.status === 'ARRIVED').length, 1)
  await settle()
  assert.equal(el.querySelectorAll('[data-book] [data-act="seat"]').length, 1)
  click(el, '[data-book] [data-to="noshow"]')
  assert.ok(rs().some(r => r.reservation.status === 'NO_SHOW'))
})
test('staff: rotation rows, duty toggle; alerts: engine alerts and tab badge', async () => {
  const {el, app} = rig()
  load(app, 'lunch')
  await settle()
  assert.equal(el.querySelectorAll('[data-staff] li').length, 2)
  click(el, '[data-staff] [data-to="duty"]')
  assert.equal(app.store.state.world.ents.sv1.staff!.active, false)
  await settle()
  assert.match(text(el, '[data-staff] li'), /Ana \(off\)/)
  assert.match(text(el, '[data-alerts]'), /Party late/)
  assert.match(text(el, '[data-act="tab"][data-id="alerts"]'), /Alerts 1/)
})
