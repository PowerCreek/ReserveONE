import test from 'node:test'
import assert from 'node:assert/strict'
import {settle} from '../test/dom.ts'
import {load} from './index.ts'
import {floorSvg} from './floor.ts'
import {click, rig} from './rig.ts'
import type {Entity} from '../contracts/index.ts'
import {floorOf} from './geo.ts'
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

const at = (id: string, floor: string, tags: string[] = []): Entity => ({id, pos: {floor, x: 100, y: 60, w: 70, h: 70}, feat: {tags}, table: {label: id.toUpperCase(), capacity: 4, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}})
test('floor tabs filter tables, links, units and pings by floor; chips mark features', async () => {
  const {app, el} = rig()
  const body = (party: string | null, task: Entity['body'] extends infer B ? B extends {task: infer T} ? T : never : never) => ({role: 'guest' as const, x: 5, y: 5, speed: 1, task, backlog: [], party})
  app.apply([
    {op: 'add', ent: {id: 'f1', floor: {name: 'Main', active: true}}}, {op: 'add', ent: {id: 'f2', floor: {name: 'Patio', active: true}}},
    {op: 'add', ent: {id: 'door', pos: {floor: 'f1', x: 24, y: 260, w: 0, h: 0}}},
    {op: 'add', ent: at('a1', 'f1', ['booth', 'quiet'])}, {op: 'add', ent: at('b1', 'f2', ['patio', 'sunny', 'banquette', 'bar', 'hightop', 'roomy'])}, {op: 'add', ent: at('b2', 'f2')},
    {op: 'add', ent: {id: 'k', link: {members: ['b1', 'b2']}}},
    {op: 'add', ent: {id: 'g1', body: body('p9', {do: 'move', x: 1, y: 1})}}, {op: 'add', ent: {id: 'g2', body: body('p8', {do: 'seat', party: 'p8', table: 'b1'})}},
  ])
  await settle()
  const f = () => el.querySelector('[data-floor]')!
  assert.equal(f().querySelectorAll('[data-floors] button').length, 2)
  assert.match(f().textContent!, /Main 1\/1.*Patio 2\/2/)
  assert.equal(f().querySelectorAll('svg rect[class*="stroke-"]:not([rx="4"]):not([rx="5"])').length, 1) // A1 only
  assert.deepEqual([...f().querySelectorAll('[data-feat]')].map(c => c.getAttribute('data-feat')), ['booth']) // seating chips only; quiet stays in the tooltip
  assert.equal(f().querySelectorAll('svg circle').length, 1) // g1 at the door's floor; g2 is headed to b1 (Patio)
  assert.match(f().textContent!, /DOOR/)
  click(el, '[data-floors] [data-id="f2"]')
  await settle()
  assert.equal(f().querySelectorAll('svg rect[class*="stroke-"]:not([rx="4"]):not([rx="5"])').length, 2)
  assert.equal(f().querySelectorAll('svg line[stroke-dasharray="6 4"]').length, 1) // link b1-b2
  assert.deepEqual([...f().querySelectorAll('[data-feat]')].map(c => c.getAttribute('data-feat')), ['banquette', 'bar', 'hightop', '+'])
  assert.equal(f().querySelectorAll('svg circle').length, 1) // g2
  assert.doesNotMatch(f().textContent!, /DOOR/)
  assert.deepEqual(['g1', 'g2', 'b1'].map(id => floorOf(app.store.state.world, id)), ['f1', 'f2', 'f2'])
})
test('floor paints the holder on each table, and fades section tints when the mode has no holds', () => {
  const {app} = rig()
  load(app, 'rush')
  const w = app.store.state.world
  const hs = [{table: 't1', area: 'main', staff: 'sv1', by: 'chunk' as const}, {table: 't2', area: 'main', staff: null, by: 'rotation' as const}]
  const on = floorSvg(w, [], undefined, {holds: hs, live: true})
  assert.equal(on.match(/data-hold=/g)!.length, 1) // only t1 has a holder
  assert.match(on, /<title>Ana \(chunk\)/)
  assert.match(on, /fill-opacity="\.14"/)
  const off = floorSvg(w, [], undefined, {holds: [], live: false})
  assert.doesNotMatch(off, /data-hold/)
  assert.match(off, /fill-opacity="\.05"/)
})
