import test from 'node:test'
import assert from 'node:assert/strict'
import {settle} from '../test/dom.ts'
import {GAPS, ISO, isoSvg, legend, tweak} from './iso.ts'
import type {Ctx} from './iso.ts'
import {click, rig} from './rig.ts'
import type {Entity, World} from '../contracts/index.ts'
const t = (id: string, floor: string, x: number, y: number, extra: Partial<Entity> = {}): Entity =>
  ({id, pos: {floor, x, y, w: 40, h: 40}, table: {label: id.toUpperCase(), capacity: 4, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}, ...extra})
const world = (): World => ({nextParty: 1, ents: Object.fromEntries([
  {id: 'g', floor: {name: 'Main', active: true, level: 0}}, {id: 'r', floor: {name: 'Roof', active: true, level: 1}},
  {id: 's1', section: {name: 'Window', color: '#0ea5e9'}}, {id: 'sv', staff: {name: 'Ana', active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 20}},
  t('far', 'g', 100, 100, {area: {id: 'main'}}), t('near', 'g', 400, 400, {area: {id: 'bar'}, table: {label: 'NEAR', capacity: 2, min: 1, shape: 'rect', status: 'occupied', waiter: 'sv', section: 's1'}}),
  t('up', 'r', 100, 100, {area: {id: 'roof'}}),
].map(e => [e.id, e]))})
const ctx = (): Ctx => ({w: world(), holds: [], areas: {main: {label: 'Main floor'}, bar: {label: 'Bar'}, roof: {label: 'Roof'}}})
const order = (svg: string, ...ids: string[]) => ids.map(id => svg.indexOf(`data-tid="${id}"`))
/** Screen y of a block's first top-face point (the 5th polygon in its group). */
const topY = (svg: string, id: string) => Number(svg.slice(svg.indexOf(`data-tid="${id}"`)).match(/<polygon points="([^"]+)"/g)![4]!.match(/,(-?[\d.]+)/)![1])
test('painter order: a nearer table is drawn after a farther one, and a camera half-turn flips them', () => {
  const [far, near] = order(isoSvg(ctx(), ISO), 'far', 'near')
  assert.ok(far! > 0 && near! > far!)
  const [far2, near2] = order(isoSvg(ctx(), tweak(tweak(ISO, 'turn', '1'), 'turn', '1')), 'far', 'near')
  assert.ok(far2! > near2!)
})
test('level 1 is drawn after level 0 and sits above it by the spacing stop', () => {
  const svg = isoSvg(ctx(), ISO)
  assert.ok(svg.indexOf('data-level="1"') > svg.indexOf('data-level="0"'))
  assert.ok(svg.indexOf('data-tid="up"') > svg.indexOf('data-tid="near"'))
  const lift = (o: typeof ISO) => ((s = isoSvg(ctx(), o)) => topY(s, 'far') - topY(s, 'up'))()
  assert.ok(Math.abs(lift(ISO) - GAPS[ISO.gap]!) < 0.2) // same x, y: the roof block is one spacing stop higher on screen
  assert.ok(Math.abs(lift(tweak(ISO, 'gap', '0'))) < 0.2) // flat: stacked in place
  assert.match(svg, /data-slab="g"[^]*>Main<[^]*data-slab="r"[^]*>Roof</) // one labelled slab per floor
})
test('opacity and hide controls change the output; upper levels start see-through', () => {
  const lv = (svg: string, n: number) => svg.match(new RegExp(`data-level="${n}" class="([^"]+)"`))?.[1]
  assert.deepEqual([lv(isoSvg(ctx(), ISO), 0), lv(isoSvg(ctx(), ISO), 1)], ['opacity-100', 'opacity-50'])
  assert.equal(lv(isoSvg(ctx(), tweak(ISO, 'op', '1:75')), 1), 'opacity-75')
  const hid = isoSvg(ctx(), tweak(ISO, 'hide', '1'))
  assert.equal(lv(hid, 1), undefined)
  assert.doesNotMatch(hid, /data-tid="up"/)
  assert.match(isoSvg(ctx(), tweak(tweak(ISO, 'hide', '1'), 'hide', '1')), /data-tid="up"/)
})
test('palette swaps fills and the legend', () => {
  const near = (pal: string) => ((s = isoSvg(ctx(), tweak(ISO, 'pal', pal))) => s.slice(s.indexOf('data-tid="near"'), s.indexOf('</g>', s.indexOf('data-tid="near"'))))()
  assert.match(near('status'), /fill-rose-100/)
  assert.match(near('area'), /fill-amber-200/)
  assert.match(near('section'), /fill="#0ea5e9"/)
  assert.match(near('server'), /fill-sky-600/)
  assert.match(near('server'), /<title>NEAR cap 2 occupied, server Ana<\/title>/)
  const key = legend(ctx(), tweak(ISO, 'pal', 'section'))
  assert.match(key, /Window <span[^>]*>1</)
  assert.match(key, /no section <span[^>]*>2</)
})
test('the floor panel toggles 2D | Iso and the iso controls repaint the same world', async () => {
  const {app, el} = rig()
  app.apply(Object.values(world().ents).map(ent => ({op: 'add' as const, ent})))
  await settle()
  const f = () => el.querySelector('[data-floor]')!
  assert.ok(f().querySelector('[data-floors]') && !f().querySelector('[data-iso]'))
  click(el, '[data-act="floorView"][data-id="iso"]')
  await settle()
  assert.ok(f().querySelector('svg[data-iso]') && !f().querySelector('[data-floors]'))
  assert.equal(f().querySelectorAll('[data-tid]').length, 3)
  click(el, '[data-act="iso"][data-k="hide"][data-v="1"]')
  await settle()
  assert.equal(f().querySelectorAll('[data-tid]').length, 2)
  assert.equal(f().querySelector('[data-k="hide"][data-v="1"]')!.getAttribute('aria-pressed'), 'false')
  click(el, '[data-act="floorView"][data-id="2d"]')
  await settle()
  assert.ok(f().querySelector('[data-floors]'))
})
test('zones outline each slab with their names; insight tables ring their top face; blocks open the table card', () => {
  const c = {...ctx(), w: {...world(), ents: {...world().ents, z1: {id: 'z1', zone: {label: 'Lobby', kind: 'lobby' as const}, pos: {floor: 'g', x: 0, y: 500, w: 80, h: 60}}}}, alerts: {near: {level: 'crit' as const, msg: 'x'}, far: {level: 'warn' as const, msg: 'y'}}}
  const svg = isoSvg(c, ISO)
  assert.match(svg, /data-izone="lobby"><title>Lobby<\/title><polygon[^>]*stroke-dasharray="5 4"[^]*>Lobby<\/text>/)
  assert.ok(svg.indexOf('data-izone') > svg.indexOf('data-slab="g"') && svg.indexOf('data-izone') < svg.indexOf('data-tid=')) // on the slab, under the blocks
  assert.match(svg, /data-tid="near" data-act="tcard"[^]*?data-insight="crit"[^>]*stroke-rose-600/)
  assert.match(svg, /data-tid="far" data-act="tcard"[^]*?data-insight="warn"[^>]*stroke-amber-500/)
  assert.doesNotMatch(isoSvg(ctx(), ISO), /data-insight/)
})
test('seating draws pads under the block (chairs and benches), pointer-less; dividers are a bare line', () => {
  const w = world()
  w.ents.far!.seating = {chairs: {l: 2}, bench: ['b']}
  w.ents.dv = {id: 'dv', zone: {label: 'Screen', kind: 'divider'}, pos: {floor: 'g', x: 300, y: 300, w: 0, h: 48}}
  const svg = isoSvg({...ctx(), w}, ISO)
  const pads = svg.slice(svg.indexOf('data-iseats'), svg.indexOf('</g>', svg.indexOf('data-iseats')))
  assert.equal(pads.match(/<polygon points="[^"]+" class="fill-emerald-300/g)!.length, 3 * 3 + 0 + 0 + 3 * 0 || 9) // 3 pads, each with a top and two shaded sides
  assert.ok(svg.indexOf('data-iseats') < svg.indexOf('data-tid="far"') + 400 && svg.indexOf('data-iseats') > svg.indexOf('data-tid="far"'))
  assert.match(svg, /pointer-events-none/)
  assert.match(svg, /data-izone="divider"><title>Screen<\/title><polyline/)
  assert.doesNotMatch(svg, />Screen<\/text>/)
  assert.doesNotMatch(isoSvg(ctx(), ISO), /data-iseats/)
})
