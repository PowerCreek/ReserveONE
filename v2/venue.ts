// The real venue as data (C3): v1 `src/realFloors.ts` item lists + `src/seed.ts` sizing, folded into v2 entities. Each table carries its `area` tag (crew.ts deals sections).
import {defaultPolicy} from './contracts/index.ts'
import type {Components, Entity} from './contracts/index.ts'
type Shape = 'rect' | 'booth' | 'stool'
type Item = [id: string, label: string, cap: number, shape: Shape]
type Rect = [x: number, y: number, w: number, h: number]
const rect = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'rect'])
const stool = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'stool'])
const booth = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'booth'])
const run = (pre: string, lab: string, n: number, cap: number): [string, string, number][] => Array.from({length: n}, (_, i) => [`rf_${pre}${i + 1}`, `${lab}${i + 1}`, cap])
/** Main floor (tables T1-T24), per the owner: booths hold 6, the listed tables are 2-tops, every other table is a 4-top (DEFAULT_TOP: the owner wrote "2 top" for the rest, read as a typo for 4). */
const BOOTHS = ['1', '2', '3', '4', '24'], BOOTH_CAP = 6
const TWO_TOPS = ['5', '6', '7', '8', '13', '14', '15', '16', '19', '21']
const DEFAULT_TOP = 4
const mainItem = (n: string): Item => [`rf_${n}`, `T${n}`, BOOTHS.includes(n) ? BOOTH_CAP : TWO_TOPS.includes(n) ? 2 : DEFAULT_TOP, BOOTHS.includes(n) ? 'booth' : 'rect']
const main: Item[] = [...rect(...run('g', 'G', 6, 4)), ...Array.from({length: 24}, (_, i) => mainItem(String(i + 1)))]
const bar: Item[] = [...stool(...run('b', 'B', 12, 1)), ...booth(['rf_b14', 'B14', 3], ['rf_b16', 'B16', 3], ['rf_b20', 'B20', 3], ['rf_b22', 'B22', 3]), ...rect(['rf_b15', 'B15', 2], ['rf_b21', 'B21', 4])]
const patio: Item[] = rect(...run('p', 'P', 7, 4))
const roof: Item[] = [...rect(...run('r', 'R', 7, 4), ['rf_r8', 'R8', 6], ['rf_r9', 'R9', 4], ['rf_r10', 'R10', 2]), ...stool(['rf_r_bar', 'Bar', 10])]
/** Physical arrangement in grid cells (`policy.sim.grid` px each): every footprint is a whole-cell rectangle (centres fall on cell centres or grid lines), proportions close to the owner's floor images (~20.5 image px per cell). Rows are [table, left, top] in cells, local to their floor's frame `at`. */
const KIND = {two: [2, 2], four: [3, 3], booth: [4, 3], grotto: [3, 3], stool: [2, 2], corner: [3, 3], pair: [2, 2], high6: [5, 2], counter: [2, 14]} as const
type Kind = keyof typeof KIND
const spot = (k: Kind, ...xs: [string, number, number][]): [string, Rect][] => xs.map(([n, x, y]) => [`rf_${n}`, [x, y, ...KIND[k]]])
/** Roof (owner, from memory): R1-R4 the bottom row on T17's line; R5-R7 across the aisle from R1-R3; the roof bar on the right; R8 (6-top high-top, turned 180°: same footprint) centred on the bar's length one aisle left of it; R10 across the aisle above R8, to its left; R9 on the top edge, the first table along the walk from the stairs (top-left); a corner (wall) above R7. */
const ROOF_SPOTS = [
  ...spot('four', ['r1', 0, 11], ['r2', 5, 11], ['r3', 10, 11], ['r4', 15, 11], ['r5', 0, 5], ['r6', 5, 5], ['r7', 10, 5], ['r9', 20, 0]),
  ...spot('two', ['r10', 17, 2]), ...spot('high6', ['r8', 19, 6]), ...spot('counter', ['r_bar', 26, 0]),
]
const placed: Record<string, Rect> = Object.fromEntries([
  ...spot('booth', ['1', 13, 6], ['2', 21, 6], ['3', 25, 6], ['4', 29, 6]),
  ...spot('grotto', ['g3', 4, 1], ['g2', 4, 4], ['g1', 4, 7], ['g6', 8, 1], ['g5', 8, 4], ['g4', 8, 7]),
  ...spot('two', ['5', 2, 14], ['6', 2, 17], ['7', 5, 14], ['8', 5, 17], ['13', 28, 14], ['14', 28, 17], ['15', 31, 14], ['16', 31, 17], ['19', 12, 27], ['21', 19, 27]),
  ...spot('four', ['9', 9, 15], ['10', 14, 15], ['11', 19, 15], ['12', 24, 15], ['17', 4, 26], ['18', 8, 26], ['20', 15, 26], ['22', 22, 26], ['23', 27, 26]),
  ...spot('corner', ['24', 31, 26], ['b14', 47, 30], ['b16', 37, 30], ['b20', 37, 1], ['b22', 49, 1]),
  ...spot('stool', ['b1', 46, 7], ['b2', 43, 7], ['b3', 40, 7], ['b4', 37, 9], ['b5', 37, 12], ['b6', 37, 15], ['b7', 37, 18], ['b8', 37, 21], ['b9', 38, 24], ['b10', 41, 24], ['b11', 44, 24], ['b12', 47, 24]),
  ...spot('pair', ['b15', 42, 31]), ...spot('four', ['b21', 42, 1]),
  ...spot('two', ['p1', 6, 0], ['p2', 12, 0], ['p3', 19, 0]), ...spot('four', ['p7', 0, 8], ['p6', 6, 8], ['p5', 13, 8], ['p4', 19, 8]),
  ...ROOF_SPOTS,
])
/** Where each floor sits: its storey and where its rows' origin lands in the level frame (cells). Floors on one level share that frame. */
type Pt = [x: number, y: number]
type Frame = {level: number; at: Pt}
/** Owner: main, grotto and bar (one drawing, the bar right of main past the T4/T15/T16/T24 walkway) shift right together to make room for the lobby and stairs left of the T17-T24 wall. */
const MAIN_AT: Pt = [5, 0]
/** Owner: the patio sits below the bottom wall with P1 about in line with T17 and the door's approach (below the door) left empty (P7 starts right of it). */
const PATIO_AT: Pt = [4, 32]
/** The roof (level 1) is drawn over the main room: R1-R4 on T17's line. */
const ROOF_AT: Pt = [8, 15]
const floors: [id: string, name: string, items: Item[], frame: Frame][] = [
  ['rf1', 'Main Dining Room', main, {level: 0, at: MAIN_AT}],
  ['rf2', 'Bar', bar, {level: 0, at: MAIN_AT}],
  ['rf3', 'Patio', patio, {level: 0, at: PATIO_AT}],
  ['rf4', 'Roof', roof, {level: 1, at: ROOF_AT}],
]
const moved = ([ax, ay]: Pt) => ([x, y, w, h]: Rect): Rect => [x + ax, y + ay, w, h]
/** Every table placed in its level's frame (cells): the one fold over the frame rows. */
const LAID = floors.flatMap(([fid, , items, f]) => items.map(item => ({fid, item, r: moved(f.at)(placed[item[0]]!)})))
/** Area per floor; the six `rf_g*` tables on the main floor are the grotto. */
const areaOf: Record<string, string> = {rf1: 'main', rf2: 'bar', rf3: 'patio', rf4: 'roof'}
const area = (fid: string, id: string) => (id.startsWith('rf_g') ? 'grotto' : areaOf[fid]!)
/** Features (policy.host.feats ids) per floor, per shape and per table; a table carries the union. */
const byFloor: Record<string, string[]> = {rf1: [], rf2: ['loud'], rf3: ['patio', 'window', 'sunny'], rf4: ['quiet']}
const byShape: Record<Shape, string[]> = {booth: ['booth'], rect: ['chairs'], stool: ['stool']}
/** Upholstered bench seating (2 guests) along the wall opposite chairs (2 guests) in the aisle: main 17-23 and the bar's outer perimeter (B15, B21). Corner booths are benches with one chair; a bench only fits 3 at the table surface. */
const WALL = [...['17', '18', '19', '20', '21', '22', '23'].map(n => `rf_${n}`), 'rf_b15', 'rf_b21'], CORNERS = ['rf_b14', 'rf_b16', 'rf_b20']
const upholstery: Record<string, string[]> = Object.fromEntries([...WALL.map(id => [id, ['banquette']]), ...CORNERS.map(id => [id, ['chairs']])])
/** B22 is a high-top the managers use as a desk: never offered to guests. */
const BLOCKED = ['rf_b22']
/** Tables by the entrance (lower-left, on T17's wall): the draft reaches them. */
const NEAR_DOOR = ['rf_17']
const byTable: Record<string, string[]> = {rf_1: ['window'], rf_2: ['window'], rf_9: ['accessible'], rf_10: ['accessible'], rf_24: ['roomy'], rf_r8: ['roomy', 'hightop'], rf_r9: ['hightop'], rf_r10: ['hightop'], rf_r_bar: ['bar'], rf_b22: ['hightop'], ...upholstery}
const tags = (fid: string, id: string, shape: Shape) => [...byShape[shape], ...(byFloor[fid] ?? []), ...(byTable[id] ?? []), ...(NEAR_DOOR.includes(id) ? ['door'] : [])]
/** Tables that push together (owner): each run joins neighbours in order, `across` joins tables facing over an aisle (roof: R5-R7 face R1-R3). Any connected set of free tables is a merge option (engine.merges). */
const RUNS = [
  ['17', '18', '19', '20', '21', '22', '23'].map(n => `rf_${n}`), ['9', '10', '11', '12'].map(n => `rf_${n}`),
  ['rf_g1', 'rf_g2', 'rf_g3'], ['rf_g4', 'rf_g5', 'rf_g6'], ['rf_b20', 'rf_b21'], ['rf_b14', 'rf_b15', 'rf_b16'],
  ['rf_r1', 'rf_r2', 'rf_r3', 'rf_r4'], ['rf_r5', 'rf_r6', 'rf_r7'],
]
const ACROSS: [string, string][] = [['rf_r1', 'rf_r5'], ['rf_r2', 'rf_r6'], ['rf_r3', 'rf_r7']]
const EDGES = [...RUNS.flatMap(r => r.slice(1).map((b, i): [string, string] => [r[i]!, b])), ...ACROSS]
const NEIGHBOURS = EDGES.flatMap(([a, b]) => [[a, b], [b, a]] as const).reduce<Record<string, string[]>>((m, [a, b]) => ({...m, [a]: [...(m[a] ?? []), b].sort()}), {})
/** The centre lane (9-12): merged only in dire need of capacity, after every other option. */
const CENTRE = ['9', '10', '11', '12'].map(n => `rf_${n}`)
const adjoin = (e: Entity): Entity => (NEIGHBOURS[e.id] ? {...e, adj: {with: NEIGHBOURS[e.id]!, ...(CENTRE.includes(e.id) && {last: true})}} : e)
/** Demarcations a host names (cells; `at` = the frame the rect is drawn in). Owner: the front door is on the bottom wall (T17's) in the lower-left corner, facing out; the lobby (host stand) just inside it; the stairs behind the stand (lobby -> right, up, left to their foot; first flight rises left, second right). */
type ZoneRow = [id: string, floor: string, label: string, kind: Components['zone']['kind'], r: Rect, at?: Pt]
const LOBBY: Rect = [1, 25, 7, 4], DOOR: Rect = [1, 29, 2, 1], STAIRS: Rect = [1, 20, 5, 4], STAIR_WALL: Rect = [1, 24, 5, 1]
const WALKWAY: Rect = [34, 0, 3, 30], BOOTH_AISLE: Rect = [2, 10, 32, 4], BANQUETTE_AISLE: Rect = [3, 19, 31, 7]
/** Roof: the stairs arrive top-left (above R5/R6), the walk runs right along the top edge to R9, the corner above R7 (R7 -> right, up, left to the stairs). */
const ROOF_STAIRS: Rect = [0, 0, 8, 4], ROOF_WALK: Rect = [8, 0, 12, 2], ROOF_CORNER: Rect = [8, 2, 5, 3]
const ZONES: ZoneRow[] = [
  ['z_lobby', 'rf1', 'Lobby', 'lobby', LOBBY], ['z_door', 'rf1', 'Front door', 'door', DOOR], ['z_stairs', 'rf1', 'Stairs to the roof', 'stairs', STAIRS], ['z_stair_wall', 'rf1', 'Stair wall', 'wall', STAIR_WALL],
  ['z_walkway', 'rf1', 'Walkway', 'walkway', WALKWAY, MAIN_AT], ['z_booth_aisle', 'rf1', 'Booth aisle', 'aisle', BOOTH_AISLE, MAIN_AT], ['z_banquette_aisle', 'rf1', 'Banquette aisle', 'aisle', BANQUETTE_AISLE, MAIN_AT],
  ['z_roof_stairs', 'rf4', 'Stairs down', 'stairs', ROOF_STAIRS, ROOF_AT], ['z_roof_walk', 'rf4', 'Top walk', 'walkway', ROOF_WALK, ROOF_AT], ['z_roof_corner', 'rf4', 'Stair corner', 'wall', ROOF_CORNER, ROOF_AT],
]
/** Area zones: the hull of the area's tables, one cell out. */
const AREAS: [area: string, floor: string, label: string][] = [['main', 'rf1', 'Main dining'], ['grotto', 'rf1', 'Grotto'], ['bar', 'rf2', 'Bar'], ['patio', 'rf3', 'Patio'], ['roof', 'rf4', 'Roof']]
const lo = (rs: Rect[], a: number) => Math.min(...rs.map(r => r[a]!)), hi = (rs: Rect[], a: number) => Math.max(...rs.map(r => r[a]! + r[a + 2]!))
const hull = (rs: Rect[]): Rect => [lo(rs, 0) - 1, lo(rs, 1) - 1, hi(rs, 0) - lo(rs, 0) + 2, hi(rs, 1) - lo(rs, 1) + 2]
const areaZones = (): ZoneRow[] => AREAS.map(([a, fid, label]) => [`z_${a}`, fid, label, 'area', hull(LAID.filter(l => area(l.fid, l.item[0]) === a).map(l => l.r))])
/** Cells -> policy px. */
const G = defaultPolicy.sim.grid
const px = (g: number, [x, y, w, h]: Rect) => ({x: x * g, y: y * g, w: w * g, h: h * g})
const mid = ([x, y]: Pt): Pt => [(x + 0.5) * G, (y + 0.5) * G]
/** Where the crew stands at seed (policy px, cell centres): the host at the stand in the lobby, servers parked in the walkway, bartenders in the bar well, the busser in the banquette aisle; all clear of tables. */
export const POSTS = {host: mid([4, 26]), bus: mid([24, 22]), servers: [2, 4, 6, 8].map(y => mid([40, y])), pairs: [14, 18].map(y => mid([48, y]))}
/** Entities for the 4 floors, 66 tables and the zones, on whole cells of `g` (the layout is fixed in cells; it fits the default 960x720 floor). */
export const venue = (_floor?: [number, number], g = G): Entity[] => [
  ...floors.flatMap(([fid, name, , f]): Entity[] => [
    {id: fid, floor: {name, active: true, level: f.level}},
    ...LAID.filter(l => l.fid === fid).map(({item: [id, label, capacity, shape], r}): Entity => adjoin({
      id, area: {id: area(fid, id)}, feat: {tags: tags(fid, id, shape)}, pos: {floor: fid, ...px(g, r)},
      table: {label, capacity, min: 1, shape, status: BLOCKED.includes(id) ? 'blocked_private' : 'available', waiter: null, section: null},
    })),
  ]),
  ...[...areaZones(), ...ZONES].map(([id, floor, label, kind, r, at]): Entity => ({id, zone: {label, kind}, pos: {floor, ...px(g, moved(at ?? [0, 0])(r))}})),
]
