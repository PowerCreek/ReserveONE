import test from 'node:test'
import assert from 'node:assert/strict'
import {settle} from '../test/dom.ts'
import {load} from './index.ts'
import {floorSvg} from './floor.ts'
import {click, rig} from './rig.ts'
test('empty world shows scenario picker; clicking a preset draws the floor', async () => {
  const {app, el} = rig()
  await settle()
  assert.match(el.querySelector('[data-floor]')!.textContent!, /No floor yet/)
  click(el, '[data-floor] [data-act="scenario"][data-id="rush"]')
  await settle()
  assert.equal(el.querySelectorAll('[data-floor] rect[class*="stroke-"]').length, 12)
  assert.equal(app.store.state.ui.scenario, 'rush')
})
test('floor draws tables, link groups, units with task lines and pings', () => {
  const {app} = rig()
  load(app, 'rush')
  const w = app.store.state.world
  w.ents.host.body!.task = {do: 'seat', party: 'p1', table: 't1'}
  const svg = floorSvg(w, [{x: 5, y: 5, kind: 'seated', msg: '', ttl: 3}])
  assert.equal(svg.match(/<circle/g)!.length, 1 + 1 + 2 + 10 + 1) // host, busser, servers, guests, ping
  assert.match(svg, /stroke-dasharray="6 4"/) // link T7-T8
  assert.match(svg, /stroke-dasharray="3 4"/) // host task line
  assert.match(svg, /animate-ping/)
  assert.match(svg, /dark:fill-emerald-950/)
})
