// The real venue as data (C3): v1 `src/realFloors.ts` item lists + `src/seed.ts` sizing, folded into v2 entities, laid out on the owner's spacing grammar. Each table carries its `area` tag (crew.ts deals sections).
import {defaultPolicy} from './contracts/index.ts'
import type {Components, Entity, Side} from './contracts/index.ts'
type Shape = 'rect' | 'booth' | 'stool' | 'round'
type Seating = Components['seating']
type Rect = [x: number, y: number, w: number, h: number]
type Pt = [x: number, y: number]
/** Body kinds (cells): [w, h, shape, seating]. Owner's spacing: a chair side has a one-cell seat band outside the body; a bench side is fixed upholstery (one cell); between neighbours a one-cell walking margin, shared where the sides are exposed. 4-tops sit on their long edges (2 chairs a side, centred on the grid lines) and turn 90° to join on their short edges in a pinch. Booths are fixed inside their footprint; the patio is exempt. */
const KIND = {
  four: [2, 3, 'rect', {chairs: {l: 2, r: 2}, turn: true}], six: [2, 4, 'rect', {chairs: {l: 3, r: 3}}], quad: [2, 2, 'rect', {chairs: {l: 1, r: 1}}],
  booth: [4, 3, 'booth', {chairs: {}, open: 'b'}], boothUp: [4, 3, 'booth', {chairs: {}, open: 't'}], bq4: [3, 2, 'rect', {chairs: {t: 2}, bench: ['b']}], bq2: [2, 2, 'rect', {chairs: {t: 1}, bench: ['b']}],
  cornerBL: [3, 2, 'rect', {chairs: {t: 1}, bench: ['b', 'l']}], cornerBR: [3, 2, 'rect', {chairs: {t: 1}, bench: ['b', 'r']}],
  smallBL: [2, 2, 'booth', {chairs: {t: 1}, bench: ['b', 'l']}], smallBR: [2, 2, 'booth', {chairs: {t: 1}, bench: ['b', 'r']}], smallTL: [2, 2, 'booth', {chairs: {b: 1}, bench: ['t', 'l']}],
  bqTop: [3, 2, 'rect', {chairs: {b: 2}, bench: ['t']}], two: [2, 2, 'rect', {chairs: {b: 1}}], desk: [3, 2, 'booth'],
  stool: [1, 1, 'stool'], round6: [3, 3, 'round', {chairs: {}, ring: 6}],
  hi4: [2, 3, 'rect', {chairs: {l: 2, r: 2}, high: true}], hi2: [2, 2, 'rect', {chairs: {l: 1, r: 1}, high: true}], hi6: [2, 5, 'rect', {chairs: {l: 3, r: 3}, high: true}],
} as const satisfies Record<string, readonly [number, number, Shape, Seating?]>
type Kind = keyof typeof KIND
/** One table: [id, label, capacity, kind, left, top] (cells, in its floor's frame). */
type Row = [id: string, label: string, cap: number, kind: Kind, x: number, y: number]
const r = (id: string, label: string, cap: number, kind: Kind, x: number, y: number): Row => [`rf_${id}`, label, cap, kind, x, y]
const t = (n: number, cap: number, kind: Kind, x: number, y: number) => r(String(n), `T${n}`, cap, kind, x, y)
/** Ground frame (cells), top to bottom: grotto and restrooms (y 0-11), booths T1-T4 on the top wall flush on the booth aisle (y 12-13), the middle band (quads and T9-T12) beside the host stand, the banquette aisle (y 18), banquettes T17-T23 and T24 on the bottom wall (y 23). The left strip (x 0-8) holds restrooms, stairs, stair wall, host stand and lobby; the restroom aisle (x 9-11) runs up the grotto's left wall; the lobby reaches the grotto's third cell, where the POS by T17 starts, and T1-T24 sit right of it; the walkway (x 58-60) parts main from the bar. */
const BOOTH_Y = 9, MID_Y = 14, BQ_Y = 20, BOTTOM = 23, WALK_X = 58, BAR_X = 62, CX = BAR_X + 2, BAR_Y = 7
const main: Row[] = [
  t(1, 6, 'booth', 31, BOOTH_Y), t(2, 6, 'booth', 46, BOOTH_Y), t(3, 6, 'booth', 50, BOOTH_Y), t(4, 6, 'booth', 54, BOOTH_Y),
  t(5, 2, 'quad', 18, MID_Y), t(6, 2, 'quad', 18, MID_Y + 2), t(7, 2, 'quad', 24, MID_Y), t(8, 2, 'quad', 24, MID_Y + 2),
  t(9, 4, 'four', 29, MID_Y), t(10, 4, 'four', 34, MID_Y), t(11, 4, 'four', 39, MID_Y), t(12, 4, 'four', 44, MID_Y),
  t(13, 2, 'quad', 49, MID_Y), t(14, 2, 'quad', 49, MID_Y + 2), t(15, 2, 'quad', 55, MID_Y), t(16, 2, 'quad', 55, MID_Y + 2),
  t(17, 4, 'cornerBL', 21, BQ_Y), t(18, 4, 'bq4', 25, BQ_Y), t(19, 2, 'bq2', 29, BQ_Y), t(20, 4, 'bq4', 32, BQ_Y), t(21, 2, 'bq2', 36, BQ_Y), t(22, 4, 'bq4', 39, BQ_Y), t(23, 4, 'cornerBR', 43, BQ_Y),
  t(24, 6, 'boothUp', 47, BOTTOM - 3),
  ...[3, 2, 1].map((n, i) => r(`g${n}`, `G${n}`, 4, 'four', 14, 1 + 4 * i)), ...[6, 5, 4].map((n, i) => r(`g${n}`, `G${n}`, 4, 'four', 22, 1 + 4 * i)),
]
/** Bar (right of the walkway, same frame, same height): B20 B21 B22 on its top wall, stools B1-B3 over the counter's top arm, B4-B8 down its walkway arm, B9-B12 under its bottom arm, B13 (a 2-top, its one stowed chair tucked under it) next to B12; the stools, counter and B13 sit two cells in from the walkway; then B16 B15 B14 on the bottom wall two cells apart. */
const stools = (ns: number[], at: (i: number) => Pt) => ns.map((n, i) => r(`b${n}`, `B${n}`, 1, 'stool', ...at(i)))
const bar: Row[] = [
  r('b20', 'B20', 3, 'smallTL', BAR_X + 1, BAR_Y), r('b21', 'B21', 4, 'bqTop', BAR_X + 4, BAR_Y), r('b22', 'B22', 4, 'hi4', BAR_X + 8, BAR_Y),
  ...stools([3, 2, 1], i => [CX + 1 + i, BAR_Y + 4]), ...stools([4, 5, 6, 7, 8], i => [CX, BAR_Y + 5 + i]), ...stools([9, 10, 11, 12], i => [CX + 1 + i, BAR_Y + 10]),
  r('b13', 'B13', 2, 'two', BAR_X + 11, 16),
  r('b16', 'B16', 3, 'smallBL', BAR_X + 1, BQ_Y), r('b15', 'B15', 4, 'bq4', BAR_X + 5, BQ_Y), r('b14', 'B14', 3, 'smallBR', BAR_X + 10, BQ_Y),
]
const patio: Row[] = [
  ...[1, 2, 3].map((n, i) => r(`p${n}`, `P${n}`, 2, 'quad', [6, 12, 18][i]!, 1)), ...[4, 5, 6, 7].map((n, i) => r(`p${n}`, `P${n}`, 6, 'round6', [20, 14, 8, 2][i]!, 5)),
]
/** Roof (level 1; its frame's origin sits over the ground stairs). Top band: the top walk, its upper half the stairs down (half-turn, over the ground flight), a wall beside RT1 with the door under it facing right toward the bar; RT1 (4) and RT2 (2) high-tops. Then the snake (RT4's right chairs right under the door's bottom cell): RT4-RT6 right to left, three cells, RT7-RT10 left to right; RT3 (6-top high-top) an aisle off the L bar (10 high stools). */
/** The roof bar's ten high stools, numbered from the top down the left side, then along the bottom edge left to right (R1-R6, R7-R10); the L counter they face is a zone. */
const RBAR_AT: Pt = [24, 6]
const RBAR: [n: number, x: number, y: number][] = [...[1, 2, 3, 4, 5, 6].map((y, i): [number, number, number] => [i + 1, RBAR_AT[0] - 1, RBAR_AT[1] + y]), ...[0, 1, 2, 3].map((x, i): [number, number, number] => [7 + i, RBAR_AT[0] + x, RBAR_AT[1] + 8])]
const RBAR_TOP: [number, number][] = [[0, 0], [2, 0], [2, 6], [6, 6], [6, 8], [0, 8]]
const roof: Row[] = [
  r('rt1', 'RT1', 4, 'hi4', 15, 0), r('rt2', 'RT2', 2, 'hi2', 21, 0), r('rt3', 'RT3', 6, 'hi6', 19, 8),
  r('rt4', 'RT4', 4, 'four', 11, 8), r('rt5', 'RT5', 4, 'four', 6, 8), r('rt6', 'RT6', 4, 'four', 1, 8),
  ...[7, 8, 9, 10].map((n, i) => r(`rt${n}`, `RT${n}`, 4, 'four', 1 + 5 * i, 14)),
  ...RBAR.map(([n, x, y]) => r(`r${n}`, `R${n}`, 1, 'stool', x, y)),
]
/** Where each floor's rows land: storey and origin (cells, in the level frame). Main and bar are one drawing; the patio sits below the bottom wall with P1 on T17's line and the door's approach empty; the roof's origin is the ground stairs' top-left. */
const O: Pt = [1, 3]
const STAIRS: Rect = [0, 12, 9, 2]
const PATIO_AT: Pt = [O[0] + 10, O[1] + BOTTOM + 1]
const ROOF_AT: Pt = [O[0] + STAIRS[0], O[1] + STAIRS[1]]
type Frame = {level: number; at: Pt}
const floors: [id: string, name: string, rows: Row[], frame: Frame][] = [
  ['rf1', 'Main Dining Room', main, {level: 0, at: O}],
  ['rf2', 'Bar', bar, {level: 0, at: O}],
  ['rf3', 'Patio', patio, {level: 0, at: PATIO_AT}],
  ['rf4', 'Roof', roof, {level: 1, at: ROOF_AT}],
]
const moved = ([ax, ay]: Pt) => ([x, y, w, h]: Rect): Rect => [x + ax, y + ay, w, h]
const body = ([, , , k, x, y]: Row): Rect => [x, y, KIND[k][0], KIND[k][1]]
/** Every table placed in its level's frame (cells): the one fold over the frame rows. */
const LAID = floors.flatMap(([fid, , rows, f]) => rows.map(row => ({fid, row, r: moved(f.at)(body(row))})))
/** A body grown by its seat and bench bands: the cells the table takes. */
const seatOf = (k: Kind) => KIND[k][3] as Seating | undefined
const band = (k: Kind, s: Side) => (seatOf(k)?.chairs[s] || seatOf(k)?.bench?.includes(s) || seatOf(k)?.ring ? 1 : 0)
const grown = (k: Kind, [x, y, w, h]: Rect): Rect => [x - band(k, 'l'), y - band(k, 't'), w + band(k, 'l') + band(k, 'r'), h + band(k, 't') + band(k, 'b')]
/** Stools placed by cell (`at`) widen the footprint to cover them. */
const foot = (k: Kind, b: Rect): Rect => ((ps = seatOf(k)?.at ?? []) => (ps.length ? hull([b, ...ps.map(([x, y]): Rect => [b[0] + x, b[1] + y, 1, 1])], 0) : grown(k, b)))()
/** Area per floor; the six `rf_g*` tables on the main floor are the grotto. */
const areaOf: Record<string, string> = {rf1: 'main', rf2: 'bar', rf3: 'patio', rf4: 'roof'}
const area = (fid: string, id: string) => (id.startsWith('rf_g') ? 'grotto' : areaOf[fid]!)
/** Features (policy.host.feats ids) per floor, per shape and per table; a table carries the union. */
const byFloor: Record<string, string[]> = {rf1: [], rf2: ['loud'], rf3: ['patio', 'window', 'sunny'], rf4: ['quiet']}
const byShape: Record<Shape, string[]> = {booth: ['booth'], rect: ['chairs'], stool: ['stool'], round: ['chairs']}
/** Bench seating gets `banquette`: T17-T23 and the bar's B14-B16, B20, B21 (corner booths are banquettes with a chair). */
const benched = (k: Kind) => [...(seatOf(k)?.bench?.length ? ['banquette'] : []), ...(Object.keys(seatOf(k)?.chairs ?? {}).length ? ['chairs'] : [])]
/** B22 is a high-top the managers use as a desk: never offered to guests. */
const BLOCKED = ['rf_b22']
/** Tables by the entrance (lower-left, on T17's wall): the draft reaches them. */
const NEAR_DOOR = ['rf_17']
const byTable: Record<string, string[]> = {rf_1: ['window'], rf_2: ['window'], rf_9: ['accessible'], rf_10: ['accessible'], rf_24: ['roomy'], rf_rt3: ['roomy', 'hightop'], rf_rt1: ['hightop'], rf_rt2: ['hightop'], ...Object.fromEntries(RBAR.map(([n]) => [`rf_r${n}`, ['bar', 'hightop']])), rf_b22: ['hightop']}
const tags = (fid: string, [id, , , k]: Row) => [...new Set([...byShape[KIND[k][2]], ...(byFloor[fid] ?? []), ...(byTable[id] ?? []), ...benched(k), ...(NEAR_DOOR.includes(id) ? ['door'] : [])])]
/** Tables that push together (owner): each run joins neighbours in order, `across` joins tables facing over an aisle (roof rows). Any connected set of free tables is a merge option (engine.merges). */
const ids = (...xs: string[]) => xs.map(x => `rf_${x}`)
const RUNS = [
  ids('17', '18', '19', '20', '21', '22', '23'), ids('9', '10', '11', '12'), ids('g1', 'g2', 'g3'), ids('g4', 'g5', 'g6'), ids('b20', 'b21'), ids('b16', 'b15', 'b14'),
  ids('rt6', 'rt5', 'rt4'), ids('rt7', 'rt8', 'rt9', 'rt10'),
]
const ACROSS: [string, string][] = [['rt6', 'rt7'], ['rt5', 'rt8'], ['rt4', 'rt9']].map(([a, b]) => [`rf_${a}`, `rf_${b}`])
const EDGES = [...RUNS.flatMap(r => r.slice(1).map((b, i): [string, string] => [r[i]!, b])), ...ACROSS]
const NEIGHBOURS = EDGES.flatMap(([a, b]) => [[a, b], [b, a]] as const).reduce<Record<string, string[]>>((m, [a, b]) => ({...m, [a]: [...(m[a] ?? []), b].sort()}), {})
/** The centre lane (9-12): merged only in dire need of capacity, after every other option. */
const CENTRE = ids('9', '10', '11', '12')
const adjoin = (e: Entity): Entity => (NEIGHBOURS[e.id] ? {...e, adj: {with: NEIGHBOURS[e.id]!, ...(CENTRE.includes(e.id) && {last: true})}} : e)
/** Demarcations a host names (cells; `at` = the frame the rect is drawn in, default the ground origin; w or h 0 = a line on cell edges). Owner: the front door on the bottom wall lower-left, the lobby inside it, the patio entrance on the lobby's bottom wall, a POS between the lobby and T17 (T17's height), the host stand above the lobby against the stair wall (in line with the T5-T16 band); the half-turn stairs (2-cell flights) above the stair wall (a line), the lower flight flush on the booth aisle so you walk straight on; the restroom aisle (3 cells) up the grotto's left wall to the men's room, the restroom walk (3 cells) turning left to the ladies' room (a 3-cell gap between); the grotto's 2-cell entrance on the booth aisle between its two lanes; a POS between T24 and the walkway (T24's top; T24's right edge on T14's); the walkway runs down to the exit (no re-entry) on the bottom wall by B16's wall. */
type ZoneRow = [id: string, floor: string, label: string, kind: Components['zone']['kind'], r: Rect, at?: Pt, poly?: [number, number][]]
const LOBBY: Rect = [0, 18, 14, 5], DOOR: Rect = [1, BOTTOM, 2, 1], PATIO_DOOR: Rect = [10, BOTTOM, 3, 1], HOST: Rect = [0, 14, 9, 4], STAIR_WALL: Rect = [0, 14, 9, 0]
const BOOTH_AISLE: Rect = [9, 12, WALK_X - 9, 2], BANQUETTE_AISLE: Rect = [14, 18, WALK_X - 14, 1], WALKWAY: Rect = [WALK_X, 0, 3, BOTTOM]
const RR_AISLE: Rect = [9, 10, 3, 2], RR_WALK: Rect = [0, 7, 12, 3], MENS: Rect = [9, 0, 3, 7], LADIES: Rect = [0, 0, 6, 7]
const GROTTO_WALLS: Rect[] = [[12, 12, 6, 0], [20, 12, 6, 0], [12, 0, 14, 0], [12, 0, 0, 12], [26, 0, 0, 12]], GROTTO_DOOR: Rect = [18, 12, 2, 0]
const POS1: Rect = [14, BQ_Y - 1, 6, 4], POS2: Rect = [51, BQ_Y, WALK_X - 53, 3], EXIT: Rect = [WALK_X, BOTTOM, 3, 1]
/** Shoulder-height dividers: the quads' cross (lines on cell edges, no margin across them). */
const DIVIDERS: Rect[] = [[22, MID_Y, 0, 4], [17, MID_Y + 2, 10, 0], [53, MID_Y, 0, 4], [48, MID_Y + 2, 10, 0]]
/** Bar wall on the walkway's bar side: T4's bottom edge up to B20's back (the bar's top wall, B20 B21 B22 on it), and from two cells above B16 down to the exit. */
const BAR_WALLS: Rect[] = [[WALK_X + 3, BAR_Y, 0, BOOTH_Y + 3 - BAR_Y], [WALK_X + 3, BQ_Y - 2, 0, BOTTOM - BQ_Y + 2]]
const COUNTER: Rect = [CX + 1, BAR_Y + 5, 4, 5]
/** Roof top band: the top walk, its upper half the stairs down; the wall beside RT1, the door under it facing right toward the bar. */
const ROOF_WALK: Rect = [0, 0, 13, 8], ROOF_STAIRS: Rect = [0, 0, STAIRS[2], STAIRS[3]], ROOF_WALL: Rect = [13, 0, 1, 4], ROOF_DOOR: Rect = [13, 4, 1, 4]
const ZONES: ZoneRow[] = [
  ['z_lobby', 'rf1', 'Lobby', 'lobby', LOBBY], ['z_door', 'rf1', 'Front door', 'door', DOOR], ['z_patio_door', 'rf1', 'Patio entrance', 'door', PATIO_DOOR], ['z_host', 'rf1', 'Host stand', 'stand', HOST], ['z_stairs', 'rf1', 'Stairs to the roof', 'stairs', STAIRS], ['z_stair_wall', 'rf1', 'Stair wall', 'wall', STAIR_WALL],
  ['z_walkway', 'rf1', 'Walkway', 'walkway', WALKWAY], ['z_booth_aisle', 'rf1', 'Booth aisle', 'aisle', BOOTH_AISLE], ['z_banquette_aisle', 'rf1', 'Banquette aisle', 'aisle', BANQUETTE_AISLE],
  ['z_rr_aisle', 'rf1', 'Restroom aisle', 'aisle', RR_AISLE], ['z_rr_walk', 'rf1', 'Restroom walk', 'walkway', RR_WALK], ['z_mens', 'rf1', "Men's room", 'room', MENS], ['z_ladies', 'rf1', "Ladies' room", 'room', LADIES],
  ...GROTTO_WALLS.map((r, i): ZoneRow => [`z_grotto_wall${i + 1}`, 'rf1', 'Grotto wall', 'wall', r]), ['z_grotto_door', 'rf1', 'Grotto entrance', 'door', GROTTO_DOOR],
  ['z_pos1', 'rf1', 'POS', 'stand', POS1], ['z_pos2', 'rf1', 'POS (walkway)', 'stand', POS2], ['z_exit', 'rf1', 'Exit (no re-entry)', 'door', EXIT],
  ...DIVIDERS.map((d, i): ZoneRow => [`z_div${i + 1}`, 'rf1', 'Divider', 'divider', d]),
  ['z_counter', 'rf2', 'Bar counter', 'wall', COUNTER], ...BAR_WALLS.map((r, i): ZoneRow => [`z_bar_wall${i + 1}`, 'rf2', 'Bar wall', 'wall', r, O]),
  ['z_roof_walk', 'rf4', 'Top walk', 'walkway', ROOF_WALK, ROOF_AT], ['z_roof_stairs', 'rf4', 'Stairs down', 'stairs', ROOF_STAIRS, ROOF_AT],
  ['z_roof_bar', 'rf4', 'Roof bar counter', 'wall', [RBAR_AT[0], RBAR_AT[1], 6, 8], ROOF_AT, RBAR_TOP], ['z_roof_wall', 'rf4', 'Wall', 'wall', ROOF_WALL, ROOF_AT], ['z_roof_door', 'rf4', 'Roof door', 'door', ROOF_DOOR, ROOF_AT],
]
/** Area zones: the hull of the area's tables with their seat bands, one cell out; the grotto is its room (its opening flush on the booth aisle). */
const GROTTO: Rect = [12, 0, 14, 12]
const AREAS: [area: string, floor: string, label: string, r?: Rect][] = [['main', 'rf1', 'Main dining'], ['grotto', 'rf1', 'Grotto', GROTTO], ['bar', 'rf2', 'Bar'], ['patio', 'rf3', 'Patio'], ['roof', 'rf4', 'Roof']]
const lo = (rs: Rect[], a: number) => Math.min(...rs.map(r => r[a]!)), hi = (rs: Rect[], a: number) => Math.max(...rs.map(r => r[a]! + r[a + 2]!))
const hull = (rs: Rect[], m = 1): Rect => [lo(rs, 0) - m, lo(rs, 1) - m, hi(rs, 0) - lo(rs, 0) + 2 * m, hi(rs, 1) - lo(rs, 1) + 2 * m]
const areaZones = (): ZoneRow[] => AREAS.map(([a, fid, label, r]) => [`z_${a}`, fid, label, 'area', r ? moved(O)(r) : hull(LAID.filter(l => area(l.fid, l.row[0]) === a).map(l => foot(l.row[3], l.r))), [0, 0]])
/** Cells -> policy px. */
const G = defaultPolicy.sim.grid
const px = (g: number, [x, y, w, h]: Rect) => ({x: x * g, y: y * g, w: w * g, h: h * g})
const mid = ([x, y]: Pt): Pt => [(x + O[0] + 0.5) * G, (y + O[1] + 0.5) * G]
/** Where the crew stands at seed (policy px, cell centres, ground cells): the host at the stand, servers parked in the walkway, bartenders in the bar well, the busser in the banquette aisle; all clear of tables. */
export const POSTS = {host: mid([4, 16]), bus: mid([30, 18]), servers: [2, 6, 10, 18].map(y => mid([WALK_X + 1, y])), pairs: [BAR_Y + 6, BAR_Y + 8].map(y => mid([CX + 3, y]))}
/** The front door (policy px): the middle of its edge on the bottom wall (policy.sim.door is seeded to this). */
export const DOOR_AT: Pt = [(DOOR[0] + O[0] + DOOR[2] / 2) * G, (DOOR[1] + O[1]) * G]
const seating = (k: Kind) => ((s = seatOf(k)) => (s ? {seating: {...s, chairs: {...s.chairs}, ...(s.bench && {bench: [...s.bench]}), ...(s.top && {top: s.top.map(r => [...r])}), ...(s.at && {at: s.at.map(a => [...a])})} as Seating} : {}))()
/** Entities for the 4 floors, 67 tables and the zones, on whole cells of `g`. */
export const venue = (_floor?: [number, number], g = G): Entity[] => [
  ...floors.flatMap(([fid, name, , f]): Entity[] => [
    {id: fid, floor: {name, active: true, level: f.level}},
    ...LAID.filter(l => l.fid === fid).map(({row, r}): Entity => adjoin({
      id: row[0], area: {id: area(fid, row[0])}, feat: {tags: tags(fid, row)}, pos: {floor: fid, ...px(g, r)}, ...seating(row[3]),
      table: {label: row[1], capacity: row[2], min: 1, shape: KIND[row[3]][2], status: BLOCKED.includes(row[0]) ? 'blocked_private' : 'available', waiter: null, section: null},
    })),
  ]),
  ...[...areaZones(), ...ZONES].map(([id, floor, label, kind, r, at, poly]): Entity => ({id, zone: {label, kind, ...(poly ? {poly} : {})}, pos: {floor, ...px(g, moved(at ?? O)(r))}})),
]
