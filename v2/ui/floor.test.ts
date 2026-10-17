import test from 'node:test'
import assert from 'node:assert/strict'
import {settle} from '../test/dom.ts'
import {load} from './index.ts'
import {ZOOM, floorSvg, tabList} from './floor.ts'
import {SEATED, alertsOf, chips, contour, seatedAt, seatsOf, table, unit, zonesOf} from './draw.ts'
import {defaultPolicy, having} from '../contracts/index.ts'
import {venue} from '../venue.ts'
import {click, rig} from './rig.ts'
import type {Entity} from '../contracts/index.ts'
import {floorOf, rays} from './geo.ts'
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
  assert.deepEqual([...f().querySelectorAll('[data-floors] button')].map(b => b.textContent), ['Ground: all 3/3', 'Main 1/1', 'Patio 2/2']) // one level stitches both floors
  assert.equal(f().querySelector('[data-floors] [aria-checked="true"]')!.getAttribute('data-id'), 'f1') // the first floor is on show
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

const DOOR = {x: defaultPolicy.sim.door[0], y: defaultPolicy.sim.door[1]}
const real = () => ({nextParty: 1, ents: Object.fromEntries([...venue(defaultPolicy.sim.floor), {id: 'door', pos: {floor: 'rf1', ...DOOR, w: 0, h: 0}}].map(e => [e.id, e]))}) // door as main.ts seeds it, from policy
const vb = (svg: string) => svg.match(/viewBox="([^"]+)"/)![1]!.split(' ').map(Number)
type B = {x: number; y: number; w: number; h: number}
const inside = ([x, y, w, h]: number[], p: B) => p.x >= x! && p.y >= y! && p.x + p.w <= x! + w! && p.y + p.h <= y! + h!
test('2D viewBox fits the shown floor (tables, zones and the door), or the whole stitched level, at the frame aspect', () => {
  const w = real()
  const [W, H] = defaultPolicy.sim.floor
  const tabs = tabList(w)
  assert.deepEqual(tabs.map(t => t.name), ['Ground: all', 'Main Dining Room', 'Bar', 'Patio', 'Roof'])
  const box = Object.fromEntries(tabs.map(t => [t.id, vb(floorSvg(w, [], t.id))]))
  const mine = (t: {ids: string[]}) => [...having(w, 'table', 'pos'), ...having(w, 'zone', 'pos')].filter(x => t.ids.includes(x.pos.floor)).map(x => x.pos)
  const doorIn = (t: {ids: string[]}) => (t.ids.includes('rf1') ? [{...DOOR, w: 0, h: 0}] : [])
  tabs.forEach(t => [...mine(t), ...doorIn(t)].forEach(p => assert.ok(inside(box[t.id]!, p), `${JSON.stringify(p)} in ${t.id}`)))
  assert.ok(having(w, 'zone').length >= 10 && mine(tabs[1]!).length > having(w, 'table', 'pos').filter(x => x.pos.floor === 'rf1').length) // the main floor's zones count in its fit
  Object.values(box).forEach(b => assert.ok(Math.abs(b[2]! / b[3]! - W / H) < 0.01))
  ;['rf1', 'rf2', 'rf3', 'rf4'].forEach(id => assert.ok(box[id]![2]! < box['lv:0']![2]! || id === 'rf4', `${id} zooms in past the level`))
  assert.ok(box.rf2![2]! < W && box.rf3![2]! < W) // bar and patio fill the panel
  const span = (ps: B[], a: 'x' | 'y', d: 'w' | 'h') => Math.max(...ps.map(p => p[a] + p[d])) - Math.min(...ps.map(p => p[a]))
  tabs.forEach(t => ((ps = [...mine(t), ...doorIn(t)]) => assert.ok([Math.abs(box[t.id]![2]! - span(ps, 'x', 'w') - 88), Math.abs(box[t.id]![3]! - span(ps, 'y', 'h') - 88), Math.abs(box[t.id]![2]! - W / ZOOM)].some(d => d <= 1), `${t.id} is tight on one side (or at the zoom cap)`))())
  const fit = vb(floorSvg(w, [{x: 2000, y: 2000, kind: 'seated', msg: '', ttl: 3, floor: 'rf2'}], 'rf2'))
  assert.ok(fit[0]! + fit[2]! >= 2000 && fit[1]! + fit[3]! >= 2000) // a ping on the floor stays in view
})

// ---- grid: rays across the visible box, offset by the camera
const G = defaultPolicy.sim.grid
const lines = (svg: string) => ((g = svg.slice(svg.indexOf('<g data-grid'), svg.indexOf('</g>', svg.indexOf('<g data-grid')))) =>
  [...g.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"[^>]*class="([^"]+)"/g)].map(m => ({x1: +m[1]!, y1: +m[2]!, x2: +m[3]!, y2: +m[4]!, cls: m[5]!})))()
/** Vertical rays relative to the visible box's left edge. */
const rel = (svg: string) => ((b = vb(svg)) => lines(svg).filter(l => l.x1 === l.x2).map(l => +(l.x1 - b[0]!).toFixed(2)))()
const near = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) < 0.01)
test('grid lines sit at -(offset mod cell) and repeat every cell: a 7 px pan moves them 7, a one-cell pan returns the same set', () => {
  const w = real()
  const at = (x: number, y = 0, z = 1) => floorSvg(w, [], 'rf1', undefined, {cam: {x, y, z}})
  const [base, by7, byCell] = [at(0), at(7), at(G)]
  const b = vb(base)
  assert.ok(near([rel(base)[0]!], [-((b[0]! % G) + G) % G])) // first line at -(offset mod cell)
  assert.ok(rel(base).every((x, i, xs) => i === 0 || Math.abs(x - xs[i - 1]! - G) < 0.01)) // one per cell
  const m = (x: number) => +(((x % G) + G) % G).toFixed(2)
  const wrap = (x: number) => (x <= -G + 0.001 ? x + G : x)
  assert.ok(near([rel(by7)[0]!], [wrap(rel(base)[0]! - 7)]) && rel(by7).every(x => m(x) === m(rel(base)[0]! - 7))) // every line moved by 7
  assert.deepEqual(rays(3, 100, G), [-3, 13, 29, 45, 61, 77, 93]) // the helper itself: first at -(3 mod 16)
  assert.deepEqual(rays(10, 100, G), rays(3, 100, G).map(x => x - 7)) // pan 7: every ray 7 over
  assert.deepEqual(rays(3 + G, 100, G), rays(3, 100, G)) // pan a cell: the same set
  assert.ok(near(rel(byCell), rel(base))) // a whole cell: the same set
  const ls = lines(base), [vx, vy, vw, vh] = b
  assert.ok(ls.filter(l => l.x1 === l.x2).length <= Math.floor(vw! / G) + 2 && ls.filter(l => l.y1 === l.y2).length <= Math.floor(vh! / G) + 2) // bounded by the visible span
  assert.ok(ls.every(l => (l.x1 === l.x2 ? l.y1 === vy && l.y2 === vy! + vh! : l.x1 === vx && l.x2 === vx! + vw!))) // full-length rays
  const strong = ls.filter(l => l.x1 === l.x2 && /slate-400/.test(l.cls)).map(l => Math.round(l.x1 / G))
  assert.ok(strong.length && strong.every(n => n % 4 === 0)) // every 4th line a shade stronger
  const zoomed = vb(at(0, 0, 2))
  assert.ok(Math.abs(zoomed[2]! - vw! / 2) < 0.01 && lines(at(0, 0, 2)).length < ls.length) // zoom halves the box; fewer lines
  assert.doesNotMatch(floorSvg(w, [], 'rf1', undefined, {grid: false}), /data-grid/)
})
test('zones draw dashed with their labels on the shown floor: door points out, stairs show their flight', () => {
  const w = real()
  const main = floorSvg(w, [], 'rf1')
  assert.deepEqual([...new Set([...main.matchAll(/data-zone="([^"]+)"/g)].map(m => m[1]))].sort(), ['aisle', 'area', 'divider', 'door', 'lobby', 'room', 'stairs', 'stand', 'walkway', 'wall'])
  ;['Lobby', 'Front door', 'Stairs to the roof', 'Walkway', 'Booth aisle', 'Banquette aisle', 'Main dining', 'Grotto', 'Host stand'].forEach(l => assert.match(main, new RegExp(`>${l}</text>`)))
  assert.match(main, />UP</)
  assert.match(main, /data-zone="door"[^]*?<polygon/) // the outward arrow
  assert.ok(main.indexOf('data-zone=') < main.indexOf('data-tid=')) // under the tables
  assert.doesNotMatch(main, />DOOR</) // the door zone replaces the old door mark
  const roof = floorSvg(w, [], 'rf4')
  assert.match(roof, />Stairs down</)
  assert.match(roof, />DOWN</)
  assert.doesNotMatch(roof, /Lobby/)
  assert.doesNotMatch(floorSvg(w, [], 'rf2'), /data-zone="lobby"/)
})
test('insight tables get a warn or crit outline; info is not outlined', () => {
  const w = real()
  const svg = floorSvg(w, [], 'rf1', undefined, {alerts: alertsOf([
    {id: 'brick', level: 'crit', msg: 'strands a booking', tables: ['rf_1'], staff: []}, {id: 'pressure', level: 'warn', msg: 'deluge', tables: ['rf_1', 'rf_2'], staff: []},
    {id: 'reclaim', level: 'info', msg: 'split', tables: ['rf_3'], staff: []},
  ])})
  assert.deepEqual([...svg.matchAll(/data-insight="(\w+)" data-tid-alert="([^"]+)"/g)].map(m => [m[2], m[1]]), [['rf_1', 'crit'], ['rf_2', 'warn']])
  assert.match(svg, /data-tid-alert="rf_1"><title>strands a booking<\/title><rect[^>]*stroke-rose-600/)
  assert.match(svg, /data-tid-alert="rf_2"><title>deluge<\/title><rect[^>]*stroke-amber-500/)
})
test('camera: zoom buttons, fit, grid toggle and arrow keys move the 2D view', async () => {
  const {app, el} = rig()
  load(app, 'rush')
  await settle()
  const svg = () => el.querySelector('[data-floor] svg[data-plan]')!
  const w0 = Number(svg().getAttribute('viewBox')!.split(' ')[2])
  click(el, '[data-act="cam"][data-k="in"]')
  await settle()
  assert.equal(app.store.state.ui.cam!.z, 1.25)
  assert.ok(Math.abs(Number(svg().getAttribute('viewBox')!.split(' ')[2]) - w0 / 1.25) < 0.01)
  const x0 = Number(svg().getAttribute('viewBox')!.split(' ')[0])
  svg().dispatchEvent(new el.ownerDocument.defaultView!.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))
  assert.equal(Number(svg().getAttribute('viewBox')!.split(' ')[0]), x0 + G) // live: the same svg moves one cell
  click(el, '[data-act="cam"][data-k="fit"]')
  await settle()
  assert.deepEqual(app.store.state.ui.cam, {x: 0, y: 0, z: 1})
  click(el, '[data-act="grid"]')
  await settle()
  assert.ok(!svg().querySelector('[data-grid]'))
  assert.equal(el.querySelector('[data-act="grid"]')!.getAttribute('aria-pressed'), 'false')
})
const four = (seating?: Entity['seating']): Entity => ({id: 'q', pos: {floor: 'g', x: 160, y: 160, w: 32, h: 48}, table: {label: 'Q', capacity: 4, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}, ...(seating ? {seating} : {})})
const rects = (svg: string) => [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m => m.slice(1).map(Number) as [number, number, number, number])
test('seating: a 2x3-cell 4-top with chairs l:2 r:2 draws four 70% chairs on the grid lines, under the label; none without seating', () => {
  const svg = table({nextParty: 1, ents: {}}, [])(four({chairs: {l: 2, r: 2}}) as never)
  const cs = rects(svg.slice(svg.indexOf('<g data-seats'), svg.indexOf('</g>'))).map(([x, y, w, h]) => [x + w / 2, y + h / 2, w])
  assert.deepEqual(cs.map(c => c.map(v => +v.toFixed(2))), [[152, 176, 11.2], [152, 192, 11.2], [200, 176, 11.2], [200, 192, 11.2]]) // bands x 144..160 and 192..208; y at 1 and 2 cells below top
  assert.ok(svg.indexOf('data-seats') < svg.indexOf('>Q<') && svg.includes('pointer-events-none'))
  assert.doesNotMatch(table({nextParty: 1, ents: {}}, [])(four() as never), /data-seats/)
})
test('seating: a corner bench b+l is one L of two bands that meet', () => {
  const g = seatsOf(four({chairs: {}, bench: ['b', 'l']}) as never)
  assert.deepEqual(g.benches, [{x: 144, y: 208, w: 48, h: 16}, {x: 144, y: 160, w: 16, h: 48}]) // the bottom band reaches out over the left band's foot
})
test('a divider zone is one solid line with no fill and no label; a prop is quiet too', () => {
  const z = (id: string, kind: 'divider' | 'prop' | 'stand', x: number, y: number, w: number, h: number): Entity => ({id, zone: {label: id.toUpperCase(), kind}, pos: {floor: 'g', x, y, w, h}})
  const svg = zonesOf({nextParty: 1, ents: {}}, [z('dv', 'divider', 100, 100, 0, 48), z('pr', 'prop', 10, 10, 16, 16), z('st', 'stand', 200, 200, 64, 32)] as never)
  const dv = svg.slice(svg.indexOf('data-zone="divider"'), svg.indexOf('</g>', svg.indexOf('data-zone="divider"')))
  assert.match(dv, /<line x1="100" y1="100" x2="100" y2="148"[^>]*stroke-width="2"/)
  assert.doesNotMatch(dv, /<rect|<text|dasharray/)
  assert.doesNotMatch(svg, />(DV|PR)<\/text>/)
  assert.match(svg, />ST<\/text>/)
})
// ---- occupancy, party chip, shapes (U12)
const tb = (id: string, x: number, seating?: Entity['seating'], shape: 'rect' | 'round' | 'stool' | 'booth' = 'rect', cap = 4): Entity =>
  ({id, pos: {floor: 'g', x, y: 160, w: 32, h: 48}, table: {label: id.toUpperCase(), capacity: cap, min: 1, shape, status: 'occupied', waiter: null, section: null}, ...(seating ? {seating} : {})})
const sat = (party: string, tbl: string, size: number): Entity[] => [{id: party, party: {num: 1, label: 'W1', prefix: 'W', kind: 'W', name: 'Chen', size}},
  {id: `s-${party}`, slot: {table: tbl, party, seatedAt: 0, turnAt: 1, status: 'ACTIVE'}}]
const world = (...es: Entity[]) => ({nextParty: 1, ents: Object.fromEntries(es.map(e => [e.id, e]))})
const count = (svg: string, cls: string) => svg.split(`class="${cls}"`).length - 1
test('occupancy: a seated table fills its taken places red and outlines the rest; a link fills primary first; free tables keep their tone', () => {
  const w = world(tb('a', 100, {chairs: {l: 2, r: 2}}), tb('b', 200, {chairs: {l: 2, r: 2}}), tb('c', 300, {chairs: {l: 1, r: 1}}), {id: 'k', link: {members: ['a', 'b']}}, ...sat('p1', 'a', 6))
  assert.deepEqual(['a', 'b', 'c'].map(t => seatedAt(w, t)), [4, 2, 0])
  const [a, b] = ['a', 'b'].map(t => table(w, [])(w.ents[t] as never))
  assert.equal([count(a!, SEATED.on), count(a!, SEATED.off)].join(), '4,0')
  assert.equal([count(b!, SEATED.on), count(b!, SEATED.off)].join(), '2,2')
  const c = table(w, [])(w.ents.c as never)
  assert.ok(!c.includes(SEATED.off) && !c.includes(SEATED.on) && c.includes('fill-rose-300/70')) // occupied status, no party: the quiet tone
  assert.doesNotMatch(c, /emerald-300|green/) // never green on a seated or occupied table
  assert.match(a!, /data-party-chip[^]*👥[^]*>6<\/text>/) // the party chip on the primary only
  assert.doesNotMatch(b!, /data-party-chip/)
  assert.match(a!, /<text data-cap x="129" y="204" text-anchor="end"[^>]*>4p</) // capacity right-aligned inside the body
  assert.match(a!, /<rect x="100" y="160" width="32" height="48" rx="0"/) // sharp corners
  const guest = {id: 'g', body: {role: 'guest' as const, x: 1, y: 1, speed: 1, task: null, backlog: [], party: 'p1'}}
  assert.equal(unit(w)(guest), '') // the seated guest shows as the chip, not a dot
  assert.match(unit(world())(guest), /<circle/)
})
test('benches split into places: corner = 3 upholstered + a chair, small corner 2 + a chair, a banquette 4-top 2 + 2', () => {
  const at = (w: number, h: number, seating: Entity['seating'], cap = 4) => seatsOf({id: 'x', pos: {floor: 'g', x: 0, y: 0, w: w * G, h: h * G}, seating, table: {capacity: cap}} as never).places.map(p => p.kind)
  assert.deepEqual(at(3, 2, {chairs: {t: 1}, bench: ['b', 'l']}), ['bench', 'bench', 'bench', 'chair'])
  assert.deepEqual(at(2, 2, {chairs: {t: 1}, bench: ['b', 'l']}, 3), ['bench', 'bench', 'chair'])
  assert.deepEqual(at(3, 2, {chairs: {t: 2}, bench: ['b']}), ['bench', 'bench', 'chair', 'chair'])
  const w = world({...tb('q', 100, {chairs: {t: 1}, bench: ['b', 'l']}), pos: {floor: 'g', x: 100, y: 100, w: 48, h: 32}}, ...sat('p1', 'q', 3))
  const svg = table(w, [])(w.ents.q as never)
  assert.equal(svg.match(/data-bench/g)!.length, 3)
  assert.equal([count(svg, SEATED.on), count(svg, SEATED.off)].join(), '3,1')
})
test('round tops are circles with petal chairs; high chairs get their own mark; a counter top draws its pieces with one stool per entry', () => {
  const w = world(
    {...tb('r', 100, {chairs: {}, ring: 6}, 'round', 6), pos: {floor: 'g', x: 100, y: 100, w: 48, h: 48}},
    tb('h', 200, {chairs: {l: 2, r: 2}, high: true}),
    {...tb('l', 300, {chairs: {}, high: true, top: [[0, 0], [2, 0], [2, 6], [6, 6], [6, 8], [0, 8]], at: [[-1, 1, 'r'], [-1, 2, 'r'], [2, 8, 't']]}, 'stool', 10), pos: {floor: 'g', x: 300, y: 100, w: 96, h: 128}},
  )
  const [r, h, l] = ['r', 'h', 'l'].map(t => table(w, [])(w.ents[t] as never))
  assert.match(r!, /<circle cx="124" cy="124" r="24" stroke-width="2"/)
  assert.equal(r!.match(/data-petal/g)!.length, 6)
  assert.equal(h!.match(/data-high/g)!.length, 4)
  assert.match(l!, /<polygon data-top points="300,100 332,100 332,196 396,196 396,228 300,228"/) // one L polygon
  assert.doesNotMatch(l!, /width="96" height="128"/) // no body rect under the counter
  assert.equal(l!.match(/data-stool/g)!.length, 3)
  assert.match(l!, /data-stool cx="292" cy="124"/) // a cell left of the counter, one down
})
test('a zero-thickness wall is a line; a door on it is an opening with jambs, its arrow and name', () => {
  const z = (id: string, kind: 'wall' | 'door', x: number, y: number, w: number, h: number): Entity => ({id, zone: {label: id.toUpperCase(), kind}, pos: {floor: 'g', x, y, w, h}})
  const zs = [z('wl', 'wall', 0, 200, 320, 0), z('dr', 'door', 32, 192, 48, 16)]
  const svg = zonesOf(world(...zs), zs as never)
  assert.match(svg, /data-zone="wall" data-zid="wl" data-line><title>WL<\/title><line x1="0" y1="200" x2="320" y2="200" stroke-width="4"/)
  assert.match(svg, /data-zone="door" data-zid="dr" data-opening>[^]*<line x1="32" y1="200" x2="80" y2="200" stroke-width="6" data-gap/)
  assert.match(svg, /data-opening>[^]*<polygon/)
  assert.doesNotMatch(svg, />WL<\/text>/)
  assert.match(svg, />DR<\/text>/)
})
test('an open booth is a D: the table rounds away from the open side, one bench contour hugs it inside the body, cut into a place per cover', () => {
  const T = {...tb('bt', 100, {chairs: {}, open: 'b'}, 'booth', 6), pos: {floor: 'g', x: 100, y: 100, w: 64, h: 48}}
  const c = contour(T as never)
  const [xs, ys] = [c.table.map(p => p[0]), c.table.map(p => p[1])]
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [114, 150, 114, 148]) // inset 14 on three sides, flush on the open bottom
  assert.ok(c.table.some(p => Math.abs(p[0] - 132) < 0.01 && Math.abs(p[1] - 114) < 0.01) && !c.table.some(p => p[0] === 114 && p[1] === 114)) // the far side is a half-round
  assert.equal(c.bench.length, 1)
  const bx = c.bench[0]!.map(p => p[0]), by = c.bench[0]!.map(p => p[1])
  assert.deepEqual([Math.min(...bx), Math.max(...bx), Math.min(...by), Math.max(...by)], [100, 164, 100, 148]) // the band fills the body to its edges
  const places = seatsOf(T as never).places
  assert.deepEqual(places.map(p => p.kind), Array(6).fill('bench'))
  assert.ok(places.every(p => p.poly && p.poly.length > 3))
  const w = world(T, ...sat('p1', 'bt', 4))
  const svg = table(w, [])(w.ents.bt as never)
  assert.match(svg, /<polygon data-shaped points=/)
  assert.equal([count(svg, SEATED.on), count(svg, SEATED.off)].join(), '4,2')
  assert.doesNotMatch(svg, /<rect x="100" y="100" width="64"/) // no square body
  const up = contour({...T, seating: {chairs: {}, open: 't'}} as never).table.map(p => p[1])
  assert.deepEqual([Math.min(...up), Math.max(...up)], [100, 134]) // open on top: flush there
})
test('a corner booth rounds only its bench corner; the bench follows it; feature chips show on hover only', () => {
  const T = {...tb('cb', 100, {chairs: {t: 1}, bench: ['b', 'l']}), pos: {floor: 'g', x: 100, y: 100, w: 48, h: 32}, feat: {tags: ['banquette']}}
  const c = contour(T as never)
  assert.ok(!c.table.some(p => p[0] === 100 && p[1] === 132)) // the bottom-left corner is a quarter circle
  assert.ok([[100, 100], [148, 100], [148, 132]].every(([x, y]) => c.table.some(p => p[0] === x && p[1] === y))) // the others stay square
  assert.equal(c.bench.length, 1)
  const svg = table(world(T), [])(T as never)
  assert.equal(svg.match(/data-bench/g)!.length, 3)
  assert.match(svg, /<g data-feats class="hidden group-hover:inline"><g data-feat="banquette">/)
  assert.match(svg, /class="group cursor-pointer"/)
  assert.equal(chips(T as never), '')
})

test('2D layers: a table change swaps that table only, a unit move swaps the unit only, the zones layer stays', async () => {
  const {app, el} = rig()
  load(app, 'rush')
  await settle()
  const q = (s: string) => [...el.querySelectorAll(`[data-floor] svg[data-plan] ${s}`)]
  const [zones, t1, t2] = [q('[data-layer="zones"]')[0]!, q('[data-tid="t1"]')[0]!, q('[data-tid="t2"]')[0]!]
  const w = app.store.state.world
  app.apply([{op: 'set', id: 't1', parts: {table: {...w.ents.t1!.table!, status: 'occupied'}}}])
  await settle()
  assert.notEqual(q('[data-tid="t1"]')[0], t1)
  assert.equal(q('[data-tid="t2"]')[0], t2)
  assert.equal(q('[data-layer="zones"]')[0], zones)
  const g = q('[data-layer="units"] > g')
  const host = app.store.state.world.ents.host!
  app.apply([{op: 'set', id: 'host', parts: {body: {...host.body!, x: host.body!.x + 30}}}])
  await settle()
  const g2 = q('[data-layer="units"] > g')
  assert.equal(g2.filter((n, i) => n !== g[i]).length, 1)
  assert.equal(q('[data-tid="t2"]')[0], t2)
})
