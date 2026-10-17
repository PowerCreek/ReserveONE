import test from 'node:test'
import assert from 'node:assert/strict'
import {settle} from '../test/dom.ts'
import {GAPS, ISO, isoSvg, legend, tweak} from './iso.ts'
import {Z, before, outer, table} from './furniture.ts'
import {along, axes, axisOf, fitOf, zoomTo} from './isocam.ts'
import {seen} from './geo.ts'
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
/** One table's group (up to the next table or the level's end). */
const grp = (svg: string, id: string) => svg.split(/(?=<g data-act="tcard" data-tid=")/).filter(x => x.startsWith(`<g data-act="tcard" data-tid="${id}"`)).join('')
const lvl = (svg: string, n: number) => svg.match(new RegExp(`data-level="${n}" opacity="([^"]+)" transform="translate\\(([-\\d.]+) ([-\\d.]+)\\)"`))
const vb = (svg: string) => svg.match(/viewBox="([^"]+)"/)![1]
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0
test('painter order: a nearer table is drawn after a farther one, and a half turn flips them', () => {
  const [far, near] = order(isoSvg(ctx(), ISO), 'far', 'near')
  assert.ok(far! > 0 && near! > far!)
  const [far2, near2] = order(isoSvg(ctx(), tweak(ISO, 'rot', '180')), 'far', 'near')
  assert.ok(far2! > near2!)
  assert.equal(tweak(ISO, 'rot', '-90').rot, 270)
})
test('level 1 is drawn after level 0 and its group is lifted by the spacing stop (one translate, geometry unchanged)', () => {
  const svg = isoSvg(ctx(), ISO)
  assert.ok(svg.indexOf('data-level="1"') > svg.indexOf('data-level="0"'))
  const dy = (o: typeof ISO) => ((s = isoSvg(ctx(), o)) => Number(lvl(s, 0)![3]) - Number(lvl(s, 1)![3]))()
  assert.ok(Math.abs(dy(ISO) - GAPS[ISO.gap]!) < 0.2)
  assert.ok(Math.abs(dy(tweak(ISO, 'gap', '0'))) < 0.2)
  assert.equal(grp(svg, 'up').replace(/data-tid="up"/, ''), grp(isoSvg(ctx(), tweak(ISO, 'gap', '0')), 'up').replace(/data-tid="up"/, ''))
  assert.match(svg, /data-slab="g"[^]*>Main<[^]*data-slab="r"[^]*>Roof</)
})
test('opacity is continuous per level; hiding a level or turning never changes the fit', () => {
  const svg = isoSvg(ctx(), ISO)
  assert.deepEqual([lvl(svg, 0)![1], lvl(svg, 1)![1]], ['1', '0.5'])
  assert.equal(lvl(isoSvg(ctx(), tweak(ISO, 'op', '1:35')), 1)![1], '0.35')
  assert.equal(tweak(ISO, 'op', '1:140').op[1], 100)
  const hid = isoSvg(ctx(), tweak(ISO, 'hide', '1'))
  assert.equal(lvl(hid, 1), null)
  assert.doesNotMatch(hid, /data-tid="up"/)
  assert.equal(vb(hid), vb(svg))
  assert.equal(vb(isoSvg(ctx(), tweak(ISO, 'rot', '37'))), vb(svg))
  assert.match(isoSvg(ctx(), tweak(tweak(ISO, 'hide', '1'), 'hide', '1')), /data-tid="up"/)
})
test('palette swaps fills and the legend', () => {
  const near = (pal: string) => grp(isoSvg(ctx(), tweak(ISO, 'pal', pal)), 'near')
  assert.match(near('status'), /fill-rose-100/)
  assert.match(near('area'), /fill-amber-200/)
  assert.match(near('section'), /fill="#0ea5e9"/)
  assert.match(near('server'), /fill-sky-600/)
  assert.match(near('server'), /<title>NEAR cap 2 occupied, server Ana<\/title>/)
  const key = legend(ctx(), tweak(ISO, 'pal', 'section'))
  assert.match(key, /Window <span[^>]*>1</)
  assert.match(key, /no section <span[^>]*>2</)
})
test('zones outline the slab with names; walls and dividers stand up; insight tables ring their top', () => {
  const w = world()
  Object.assign(w.ents, {z1: {id: 'z1', zone: {label: 'Lobby', kind: 'lobby'}, pos: {floor: 'g', x: 0, y: 500, w: 80, h: 60}}, dv: {id: 'dv', zone: {label: 'Screen', kind: 'divider'}, pos: {floor: 'g', x: 300, y: 300, w: 0, h: 48}}})
  const svg = isoSvg({...ctx(), w, alerts: {near: {level: 'crit', msg: 'x'}, far: {level: 'warn', msg: 'y'}}}, ISO)
  assert.match(svg, /data-izone="lobby"><title>Lobby<\/title><polygon[^>]*stroke-dasharray="5 4"[^]*>Lobby<\/text>/)
  assert.ok(svg.indexOf('data-izone="lobby"') > svg.indexOf('data-slab="g"') && svg.indexOf('data-izone="lobby"') < svg.indexOf('data-tid='))
  assert.match(svg, /data-izone="divider"><title>Screen<\/title><g data-p="wall"><polygon/)
  assert.doesNotMatch(svg, />Screen<\/text>/)
  assert.match(grp(svg, 'near'), /data-insight="crit"[^>]*stroke-rose-600/)
  assert.match(grp(svg, 'far'), /data-insight="warn"[^>]*stroke-amber-500/)
  assert.doesNotMatch(isoSvg(ctx(), ISO), /data-insight/)
})
test('each level carries its own grid, clipped to its own slabs', () => {
  const svg = isoSvg(ctx(), ISO)
  ;[0, 1].forEach(n => assert.match(svg, new RegExp(`data-level="${n}"[^]*?<clipPath id="iso-clip-${n}">[^]*?data-igrid clip-path="url\\(#iso-clip-${n}\\)"`)))
  assert.ok(count(svg, /<polyline/g) > 10)
})
test('stitched floors abut: slabs are unpadded hulls, so neighbours share their edge', () => {
  const w = world()
  Object.assign(w.ents, {b: {id: 'b', floor: {name: 'Bar', active: true, level: 0}}, bt: {...w.ents.far!, id: 'bt', pos: {floor: 'b', x: 140, y: 100, w: 40, h: 80}}})
  w.ents.near!.pos = {floor: 'g', x: 100, y: 140, w: 40, h: 40}
  const top = (svg: string, f: string) => ((g = svg.slice(svg.indexOf(`data-slab="${f}"`), svg.indexOf('</g>', svg.indexOf(`data-slab="${f}"`)))) => g.match(/points="([^"]+)"/g)!.at(-1)!.slice(8, -1).split(' '))()
  const svg = isoSvg({...ctx(), w}, ISO)
  assert.equal(top(svg, 'g').filter(p => top(svg, 'b').includes(p)).length, 2)
})
test('furniture: chairs (legs, seat, back), benches, a single pedestal on a + base along the chair sides', () => {
  const w = world()
  w.ents.far!.seating = {chairs: {l: 2}, bench: ['b']}
  const g = grp(isoSvg({...ctx(), w}, ISO), 'far')
  assert.equal(count(g, /data-p="chair"/g), 2)
  assert.equal(count(g, /data-p="bench"/g), 3) // the 40 px band (draw.ts contour) cut into cell segments, each a seat with its backrest
  assert.equal(count(g, /data-p="table"/g), 1)
  const tb = table({x: 0, y: 0, w: 32, h: 48}, [], Z.table, 'x')
  const span = (i: number) => ((f = tb.solids[i]!.foot) => [Math.max(...f.map(p => p[0])) - Math.min(...f.map(p => p[0])), Math.max(...f.map(p => p[1])) - Math.min(...f.map(p => p[1]))])()
  assert.ok(span(0)[0] > 20 && span(0)[1] === 0 && span(1)[1] > 30 && span(1)[0] === 0) // arms along x and y, not diagonal
  assert.ok(tb.solids[2]!.foot.length === 1 && tb.solids[2]!.post! < 4 && tb.solids[2]!.h > 10) // one thin pedestal
  assert.equal(tb.solids[3]!.z + tb.solids[3]!.h, Z.table)
})
test('round tops with petal chairs, high-tops taller, counters and stools from seating.top / seating.at, stool tables are stools', () => {
  const w = world()
  w.ents.far!.table = {...w.ents.far!.table!, shape: 'round'}
  w.ents.far!.seating = {chairs: {}, ring: 6}
  w.ents.near!.seating = {chairs: {}, top: [[0, 0], [1, 0], [1, 2], [2, 2], [2, 3], [0, 3]], at: [[1, 0, 'l'], [1, 1, 'l'], [0, 3, 't']]}
  w.ents.up!.table = {...w.ents.up!.table!, shape: 'stool'}
  const svg = isoSvg({...ctx(), w}, ISO)
  assert.equal(count(grp(svg, 'far'), /data-p="chair"/g), 6)
  assert.ok(grp(svg, 'far').match(/<polygon points="[^"]+"/g)!.some(p => p.split(' ').length === 21)) // a 20-gon top
  assert.equal(count(grp(svg, 'near'), /data-p="counter"/g), 4) // the L as one piece, cut into its 4 cells for the painter
  assert.equal(count(grp(svg, 'near'), /data-p="table"/g), 0)
  assert.equal(count(grp(svg, 'near'), /data-p="stool"/g), 3)
  assert.equal(count(grp(svg, 'up'), /data-p="stool"/g), 1)
  const labelY = (o: Entity['seating']) => ((v = world()) => ((v.ents.far!.seating = o), Number(grp(isoSvg({...ctx(), w: v}, ISO), 'far').match(/<text x="[^"]+" y="([^"]+)"/)![1])))()
  assert.ok(Math.abs(labelY({chairs: {l: 1}}) - labelY({chairs: {l: 1}, high: true}) - (Z.high - Z.table)) < 0.2)
})
test('painter: pieces sort on the axis that separates them under the turn; long walls sort per cell; tiles share no edges', () => {
  const A = {x0: 0, y0: 0, x1: 10, y1: 10, z0: 0, z1: 20}, B = {...A, x0: 12, x1: 20}
  assert.ok(before({deg: 0, c: [0, 0]})(A, B, 0, 0) < 0 && before({deg: 180, c: [0, 0]})(A, B, 0, 0) > 0)
  assert.ok(before({deg: 0, c: [0, 0]})({...A, z1: 5}, {...A, z0: 5, z1: 8}, 9, 0) < 0) // stacked: bottom first
  const w = world()
  Object.assign(w.ents, {dv: {id: 'dv', zone: {label: 'Screen', kind: 'divider'}, pos: {floor: 'g', x: 144, y: 100, w: 0, h: 32}}, nb: {...w.ents.far!, id: 'nb', pos: {floor: 'g', x: 152, y: 100, w: 32, h: 32}}})
  w.ents.far!.pos = {floor: 'g', x: 104, y: 100, w: 32, h: 32}
  const at = (svg: string, re: RegExp) => [...svg.matchAll(re)].map(m => m.index!)
  const ix = (o: typeof ISO) => ((svg = isoSvg({...ctx(), w}, o)) => ({far: at(svg, /data-tid="far" data-frag class/g), wall: at(svg, /data-p="wall"/g), nb: at(svg, /data-tid="nb" data-frag class/g)}))()
  const r0 = ix(ISO)
  assert.equal(r0.wall.length, 2) // 32 px of divider = 2 cell segments
  assert.ok(Math.max(...r0.far) < Math.min(...r0.wall) && Math.max(...r0.wall) < Math.min(...r0.nb))
  const r1 = ix(tweak(ISO, 'rot', '180'))
  assert.ok(Math.max(...r1.nb) < Math.min(...r1.wall) && Math.max(...r1.wall) < Math.min(...r1.far))
  const ts = [{x: 0, y: 0, w: 16, h: 16}, {x: 16, y: 0, w: 16, h: 16}]
  assert.deepEqual(outer(ts)(ts[0]!), [true, false, true, true]) // top, right (shared), bottom, left
})
test('an open booth follows the contour: a D-shaped top and one U bench in segments; middle-button presses never scroll the page', async () => {
  const w = world()
  w.ents.far!.table = {...w.ents.far!.table!, shape: 'booth'}
  w.ents.far!.pos = {floor: 'g', x: 100, y: 100, w: 64, h: 48}
  w.ents.far!.seating = {chairs: {}, open: 'b'}
  const g = grp(isoSvg({...ctx(), w}, ISO), 'far')
  assert.ok(count(g, /data-p="bench"/g) >= 8) // three sides and two round corners, a cell at most per segment
  assert.ok(g.split('data-p="table"')[1]!.match(/<polygon points="[^"]+"/g)!.some(p => p.split(' ').length > 9)) // the D: sampled arcs
  w.ents.far!.seating = undefined
  assert.equal(count(grp(isoSvg({...ctx(), w}, ISO), 'far'), /data-p="bench"/g), 2)
  const {app, el} = rig()
  app.apply(Object.values(world().ents).map(ent => ({op: 'add' as const, ent})))
  await settle()
  click(el, '[data-act="floorView"][data-id="iso"]')
  await settle()
  const svg = el.querySelector('[data-floor] svg[data-iso]')!
  ;['mousedown', 'auxclick'].forEach(k => ((e = new window.MouseEvent(k, {bubbles: true, cancelable: true, button: 1})) => (svg.dispatchEvent(e), assert.ok(e.defaultPrevented, k)))())
})
test('occupancy: a seated table fills its first covers red and outlines the rest; others stay plain', () => {
  const w = world()
  w.ents.far!.seating = {chairs: {l: 2, r: 1}}
  Object.assign(w.ents, {p1: {id: 'p1', party: {num: 1, label: 'W-1', prefix: 'W', kind: 'W', name: 'A', size: 2}}, s1x: {id: 's1x', slot: {table: 'far', party: 'p1', seatedAt: 0, turnAt: 0, status: 'ACTIVE'}}})
  const g = grp(isoSvg({...ctx(), w}, ISO), 'far')
  assert.match(g, /data-taken="2"/)
  const chairs = g.split('data-p="chair"').slice(1)
  assert.deepEqual(chairs.map(c => (/fill-rose-500/.test(c) ? 'on' : /fill-none stroke-rose-500/.test(c) ? 'off' : '?')), ['on', 'on', 'off'])
  assert.doesNotMatch(grp(isoSvg(ctx(), ISO), 'far'), /rose-500/)
})
test('camera: screen axes under the turn, the drag axis, distance along it, zoom about a point', () => {
  const t = {deg: 0, c: [0, 0] as [number, number]}
  const [ex, ey] = axes(t)
  assert.equal(axisOf(t, [ex![0] * 5, ex![1] * 5]), 0)
  assert.equal(axisOf(t, [ey![0] * 5, ey![1] * 5]), 1)
  assert.equal(axisOf(t, [0.2, -9]), 2)
  assert.ok(Math.abs(along(t, 0, [ex![0] * 10, ex![1] * 10]) - 10) < 1e-9)
  assert.equal(axisOf({...t, deg: 90}, [ex![0] * 5, ex![1] * 5]), 1) // a quarter turn: screen x-direction is now world y (negated)
  const fit = fitOf([100, 100], 50, 0, 40, 10)
  const cam = zoomTo(fit, {x: 0, y: 0, z: 1}, 2, [fit.x + 10, fit.y + 20])
  const v = seen(fit, cam), v0 = seen(fit, {x: 0, y: 0, z: 1})
  assert.ok(Math.abs((fit.x + 10 - v.x) / v.w - (fit.x + 10 - v0.x) / v0.w) < 1e-9 && cam.z === 2)
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
  assert.equal(f().querySelectorAll('[data-tid]:not([data-frag])').length, 3)
  const svg = () => f().querySelector('svg[data-iso]')!
  const range = f().querySelector<HTMLInputElement>('input[type="range"][data-lv="1"]')!
  range.value = '20'
  range.dispatchEvent(new window.Event('input', {bubbles: true}))
  assert.equal(svg().querySelector('[data-level="1"]')!.getAttribute('opacity'), '0.2')
  assert.equal(f().querySelector('output[data-op="1"]')!.textContent, '20%')
  const box = svg().getAttribute('viewBox')
  click(el, '[data-act="iso"][data-k="hide"][data-v="1"]')
  await settle()
  assert.equal(f().querySelectorAll('[data-tid]:not([data-frag])').length, 2)
  assert.equal(f().querySelector('[data-k="hide"][data-v="1"]')!.getAttribute('aria-pressed'), 'false')
  assert.equal(svg().getAttribute('viewBox'), box)
  const ptr = (type: string, target: Element, x: number, y: number, o: object = {}) => target.dispatchEvent(new window.MouseEvent(type, {bubbles: true, clientX: x, clientY: y, button: 0, ...o}))
  const rot = () => (app.store.state.ui as any).iso.rot
  const until = async (f: () => boolean) => { for (let i = 0; i < 150 && !f(); i++) await new Promise(r => setTimeout(r, 10)) } // frames ease the camera: wait for it to settle
  ptr('pointerdown', svg(), 10, 10); ptr('pointermove', svg(), 60, 10); ptr('pointerup', svg(), 60, 10)
  await until(() => Math.abs(rot() - 20) < 1e-6)
  await until(() => !!svg().querySelector('[data-layer="furn"] > *'))
  assert.ok(Math.abs(rot() - 20) < 1e-6) // 50 px of orbit
  ptr('pointerdown', svg().querySelector('[data-slab]')!, 10, 10); ptr('pointermove', svg(), 10, -40); ptr('pointerup', svg(), 10, -40)
  await until(() => Math.abs((app.store.state.ui as any).iso.shift?.[0]?.[2] ?? 0) >= 16)
  assert.ok(Math.abs((app.store.state.ui as any).iso.shift[0][2]) >= 16) // straight up the screen = the z axis, snapped to a cell
  ptr('pointerdown', svg(), 10, 10, {shiftKey: true}); ptr('pointermove', svg(), 40, 10, {shiftKey: true}); ptr('pointerup', svg(), 40, 10)
  await until(() => (app.store.state.ui as any).iso.cam.x < -1)
  assert.ok((app.store.state.ui as any).iso.cam.x < 0 && Math.abs(rot() - 20) < 1e-6)
  const tb = svg().querySelector('[data-tid="far"] polygon')!
  ptr('pointerdown', tb, 10, 10); ptr('pointerup', tb, 12, 11); tb.dispatchEvent(new window.MouseEvent('click', {bubbles: true}))
  await settle()
  assert.equal((app.store.state.ui as any).card?.table, 'far') // a press under 4 px is a click
  click(el, '[data-act="floorView"][data-id="2d"]')
  await settle()
  assert.ok(f().querySelector('[data-floors]'))
})
test('layers: a table state change redraws only that table; a unit move only the unit; the static layers stay the same nodes', async () => {
  const {app, el} = rig()
  app.apply([...Object.values(world().ents), {id: 'u1', body: {role: 'guest' as const, x: 120, y: 120, speed: 1, task: null, backlog: [], party: null}}].map(ent => ({op: 'add' as const, ent})))
  await settle()
  click(el, '[data-act="floorView"][data-id="iso"]')
  await settle()
  const svg = () => el.querySelector('[data-floor] svg[data-iso]')!
  const lay = (lv: number, k: string) => svg().querySelector(`[data-level="${lv}"] > [data-layer="${k}"]`)!
  const first = (lv: number, k: string) => lay(lv, k).firstElementChild!
  const nodes = (sel: string) => [...svg().querySelectorAll(sel)]
  assert.equal(svg().querySelectorAll('[data-level]').length, 2)
  assert.equal(nodes('[data-unit]').length, 1)
  const [slab, far, near, unit] = [first(0, 'base'), nodes('[data-tid="far"][data-frag]'), nodes('[data-tid="near"][data-frag]'), nodes('[data-unit]')[0]!]
  app.apply([{op: 'set', id: 'far', parts: {table: {...world().ents.far!.table!, status: 'occupied'}}}])
  await settle()
  assert.equal(first(0, 'base'), slab) // static layer untouched
  assert.deepEqual(nodes('[data-tid="near"][data-frag]'), near) // other tables keep their nodes
  assert.ok(nodes('[data-tid="far"][data-frag]').every((n, i) => n !== far[i])) // the changed table was redrawn
  assert.match(svg().querySelector('[data-tid="far"] title')!.textContent!, /occupied/)
  assert.equal(nodes('[data-unit]')[0], unit)
  app.apply([{op: 'set', id: 'u1', parts: {body: {...app.store.state.world.ents.u1!.body!, x: 200}}}])
  await settle()
  assert.notEqual(nodes('[data-unit]')[0], unit) // the unit node was swapped...
  assert.deepEqual(nodes('[data-tid="near"][data-frag]'), near) // ...and nothing else
  assert.equal(first(0, 'base'), slab)
  svg().dispatchEvent(new window.WheelEvent('wheel', {bubbles: true, cancelable: true, deltaY: -100}))
  await new Promise(r => setTimeout(r, 400))
  assert.equal(first(0, 'base'), slab) // zoom moves the viewBox only
  assert.ok(Number((app.store.state.ui as any).iso.cam.z) > 1)
})
