// The real venue as data (C3): v1 `src/realFloors.ts` item lists + `src/seed.ts` sizing, folded into v2 entities, laid out on the owner's spacing grammar. Each table carries its `area` tag (crew.ts deals sections).
import {defaultPolicy} from './contracts/index.ts'
import type {Components, Entity, Side} from './contracts/index.ts'
type Shape = 'rect' | 'booth' | 'stool'
type Seating = Components['seating']
type Rect = [x: number, y: number, w: number, h: number]
type Pt = [x: number, y: number]
/** Body kinds (cells): [w, h, shape, seating]. Owner's spacing: a chair side has a one-cell seat band outside the body; a bench side is fixed upholstery (one cell); between neighbours a one-cell walking margin, shared where the sides are exposed. 4-tops sit on their long edges (2 chairs a side, centred on the grid lines) and turn 90° to join on their short edges in a pinch. Booths are fixed inside their footprint; the patio is exempt. */
const KIND = {
  four: [2, 3, 'rect', {chairs: {l: 2, r: 2}, turn: true}], six: [2, 4, 'rect', {chairs: {l: 3, r: 3}}], quad: [2, 2, 'rect', {chairs: {l: 1, r: 1}}],
  booth: [4, 3, 'booth'], bq4: [3, 2, 'rect', {chairs: {t: 2}, bench: ['b']}], bq2: [2, 2, 'rect', {chairs: {t: 1}, bench: ['b']}],
  cornerBL: [3, 2, 'rect', {chairs: {t: 1}, bench: ['b', 'l']}], cornerBR: [3, 2, 'rect', {chairs: {t: 1}, bench: ['b', 'r']}],
  smallBL: [2, 2, 'booth', {chairs: {t: 1}, bench: ['b', 'l']}], smallBR: [2, 2, 'booth', {chairs: {t: 1}, bench: ['b', 'r']}], smallTL: [2, 2, 'booth', {chairs: {b: 1}, bench: ['t', 'l']}],
  bqTop: [3, 2, 'rect', {chairs: {b: 2}, bench: ['t']}], two: [2, 2, 'rect', {chairs: {l: 1}}], desk: [3, 2, 'booth'],
  stool: [2, 2, 'stool'], patio2: [2, 2, 'rect'], patio4: [3, 3, 'rect'],
  hi4: [2, 2, 'rect', {chairs: {r: 2, b: 2}}], hi2: [2, 2, 'rect', {chairs: {l: 1, r: 1}}], hi6: [2, 4, 'rect', {chairs: {l: 3, r: 3}}],
  barFront: [1, 6, 'stool'], barFoot: [4, 1, 'stool'],
} as const satisfies Record<string, readonly [number, number, Shape, Seating?]>
type Kind = keyof typeof KIND
/** One table: [id, label, capacity, kind, left, top] (cells, in its floor's frame). */
type Row = [id: string, label: string, cap: number, kind: Kind, x: number, y: number]
const r = (id: string, label: string, cap: number, kind: Kind, x: number, y: number): Row => [`rf_${id}`, label, cap, kind, x, y]
const t = (n: number, cap: number, kind: Kind, x: number, y: number) => r(String(n), `T${n}`, cap, kind, x, y)
/** Ground frame (cells), top to bottom: grotto and restrooms (y 0-12), booths T1-T4 on the top wall flush on the booth aisle, the middle band (quads and T9-T12) beside the host stand, the banquette aisle, banquettes T17-T23 on the bottom wall (y 26). The left strip (x 0-8) holds restrooms, stairs, stair wall, host stand and lobby; the walkway (x 50-53) parts main from the bar. */
const BOOTH_Y = 9, MID_Y = 15, BQ_Y = 23, BOTTOM = 26, WALK_X = 50, BAR_X = 53
const main: Row[] = [
  t(1, 6, 'booth', 24, BOOTH_Y), t(2, 6, 'booth', 38, BOOTH_Y), t(3, 6, 'booth', 42, BOOTH_Y), t(4, 6, 'booth', 46, BOOTH_Y),
  t(5, 2, 'quad', 10, MID_Y), t(6, 2, 'quad', 10, MID_Y + 2), t(7, 2, 'quad', 16, MID_Y), t(8, 2, 'quad', 16, MID_Y + 2),
  t(9, 4, 'four', 21, MID_Y), t(10, 4, 'four', 26, MID_Y), t(11, 4, 'four', 31, MID_Y), t(12, 4, 'four', 36, MID_Y),
  t(13, 2, 'quad', 41, MID_Y), t(14, 2, 'quad', 41, MID_Y + 2), t(15, 2, 'quad', 47, MID_Y), t(16, 2, 'quad', 47, MID_Y + 2),
  t(17, 4, 'cornerBL', 13, BQ_Y), t(18, 4, 'bq4', 17, BQ_Y), t(19, 2, 'bq2', 21, BQ_Y), t(20, 4, 'bq4', 24, BQ_Y), t(21, 2, 'bq2', 28, BQ_Y), t(22, 4, 'bq4', 31, BQ_Y), t(23, 4, 'cornerBR', 35, BQ_Y),
  t(24, 6, 'booth', 41, BOTTOM - 3),
  ...[3, 2, 1].map((n, i) => r(`g${n}`, `G${n}`, 4, 'four', 12, 1 + 4 * i)), ...[6, 5, 4].map((n, i) => r(`g${n}`, `G${n}`, 4, 'four', 17, 1 + 4 * i)),
]
/** Bar (right of the walkway, same frame): B20/B21/B22 on its top wall, stools B1-B3 over the counter's top arm, B4-B8 down its walkway arm, B9-B12 under its bottom arm, B13 (a 2-top) and the spare chair at the right wall on B12's row, then B16, B15, B14 evenly along the bottom wall. */
const stools = (ns: number[], at: (i: number) => Pt) => ns.map((n, i) => r(`b${n}`, `B${n}`, 1, 'stool', ...at(i)))
const bar: Row[] = [
  r('b20', 'B20', 3, 'smallTL', BAR_X + 1, -1), r('b21', 'B21', 4, 'bqTop', BAR_X + 4, -1), r('b22', 'B22', 3, 'desk', BAR_X + 18, -1),
  ...stools([3, 2, 1], i => [BAR_X + 4 + 2 * i, 3]), ...stools([4, 5, 6, 7, 8], i => [BAR_X, 7 + 2 * i]), ...stools([9, 10, 11, 12], i => [BAR_X + 4 + 2 * i, 19]),
  r('b13', 'B13', 2, 'two', BAR_X + 19, 19),
  r('b16', 'B16', 3, 'smallBL', BAR_X + 1, BQ_Y), r('b15', 'B15', 4, 'bq4', BAR_X + 9, BQ_Y), r('b14', 'B14', 3, 'smallBR', BAR_X + 18, BQ_Y),
]
const patio: Row[] = [
  ...[1, 2, 3].map((n, i) => r(`p${n}`, `P${n}`, 4, 'patio2', [6, 12, 19][i]!, 0)), ...[4, 5, 6, 7].map((n, i) => r(`p${n}`, `P${n}`, 4, 'patio4', [19, 13, 6, 0][i]!, 8)),
]
/** Roof (level 1; its frame's origin sits over the ground stairs, so the flight arrives top-left). Top band: stairs, the stair corner (the way in, on its right), the top walk, a wall, RT1 and RT2 (high-tops). Then the snake: R1-R3 left to right (R3, a 6-top, under the gap between RT1 and RT2), R4-R6 right to left, R7-R10 left to right, an aisle between rows; RT3 (6-top high-top) centred on the L bar (6 front stools facing left, 4 under the foot) an aisle off it. */
const roof: Row[] = [
  r('r1', 'R1', 4, 'four', 6, 4), r('r2', 'R2', 4, 'four', 11, 4), r('r3', 'R3', 6, 'six', 16, 3),
  r('r4', 'R4', 4, 'four', 16, 9), r('r5', 'R5', 4, 'four', 11, 9), r('r6', 'R6', 4, 'four', 6, 9),
  ...[7, 8, 9, 10].map((n, i) => r(`r${n}`, `R${n}`, 4, 'four', 6 + 5 * i, 14)),
  r('rt1', 'RT1', 4, 'hi4', 14, 0), r('rt2', 'RT2', 2, 'hi2', 18, 0), r('rt3', 'RT3', 6, 'hi6', 21, 8),
  r('r_bar', 'Bar', 6, 'barFront', 26, 7), r('r_bar2', 'Bar L', 4, 'barFoot', 29, 13),
]
/** Where each floor's rows land: storey and origin (cells, in the level frame). Main and bar are one drawing; the patio sits below the bottom wall with P1 on T17's line and the door's approach empty; the roof's origin is the ground stairs' top-left. */
const O: Pt = [1, 3]
const STAIRS: Rect = [0, 6, 8, 8]
const PATIO_AT: Pt = [O[0] + 13 - 6, O[1] + BOTTOM + 1]
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
const band = (k: Kind, s: Side) => (seatOf(k)?.chairs[s] || seatOf(k)?.bench?.includes(s) ? 1 : 0)
const foot = (k: Kind, [x, y, w, h]: Rect): Rect => [x - band(k, 'l'), y - band(k, 't'), w + band(k, 'l') + band(k, 'r'), h + band(k, 't') + band(k, 'b')]
/** Area per floor; the six `rf_g*` tables on the main floor are the grotto. */
const areaOf: Record<string, string> = {rf1: 'main', rf2: 'bar', rf3: 'patio', rf4: 'roof'}
const area = (fid: string, id: string) => (id.startsWith('rf_g') ? 'grotto' : areaOf[fid]!)
/** Features (policy.host.feats ids) per floor, per shape and per table; a table carries the union. */
const byFloor: Record<string, string[]> = {rf1: [], rf2: ['loud'], rf3: ['patio', 'window', 'sunny'], rf4: ['quiet']}
const byShape: Record<Shape, string[]> = {booth: ['booth'], rect: ['chairs'], stool: ['stool']}
/** Bench seating gets `banquette`: T17-T23 and the bar's B14-B16, B20, B21 (corner booths are banquettes with a chair). */
const benched = (k: Kind) => [...(seatOf(k)?.bench?.length ? ['banquette'] : []), ...(Object.keys(seatOf(k)?.chairs ?? {}).length ? ['chairs'] : [])]
/** B22 is a high-top the managers use as a desk: never offered to guests. */
const BLOCKED = ['rf_b22']
/** Tables by the entrance (lower-left, on T17's wall): the draft reaches them. */
const NEAR_DOOR = ['rf_17']
const byTable: Record<string, string[]> = {rf_1: ['window'], rf_2: ['window'], rf_9: ['accessible'], rf_10: ['accessible'], rf_24: ['roomy'], rf_rt3: ['roomy', 'hightop'], rf_rt1: ['hightop'], rf_rt2: ['hightop'], rf_r_bar: ['bar'], rf_r_bar2: ['bar'], rf_b22: ['hightop']}
const tags = (fid: string, [id, , , k]: Row) => [...new Set([...byShape[KIND[k][2]], ...(byFloor[fid] ?? []), ...(byTable[id] ?? []), ...benched(k), ...(NEAR_DOOR.includes(id) ? ['door'] : [])])]
/** Tables that push together (owner): each run joins neighbours in order, `across` joins tables facing over an aisle (roof rows). Any connected set of free tables is a merge option (engine.merges). */
const ids = (...xs: string[]) => xs.map(x => `rf_${x}`)
const RUNS = [
  ids('17', '18', '19', '20', '21', '22', '23'), ids('9', '10', '11', '12'), ids('g1', 'g2', 'g3'), ids('g4', 'g5', 'g6'), ids('b20', 'b21'), ids('b16', 'b15', 'b14'),
  ids('r1', 'r2', 'r3'), ids('r6', 'r5', 'r4'), ids('r7', 'r8', 'r9', 'r10'),
]
const ACROSS: [string, string][] = [['r1', 'r6'], ['r2', 'r5'], ['r3', 'r4'], ['r6', 'r7'], ['r5', 'r8'], ['r4', 'r9']].map(([a, b]) => [`rf_${a}`, `rf_${b}`])
const EDGES = [...RUNS.flatMap(r => r.slice(1).map((b, i): [string, string] => [r[i]!, b])), ...ACROSS]
const NEIGHBOURS = EDGES.flatMap(([a, b]) => [[a, b], [b, a]] as const).reduce<Record<string, string[]>>((m, [a, b]) => ({...m, [a]: [...(m[a] ?? []), b].sort()}), {})
/** The centre lane (9-12): merged only in dire need of capacity, after every other option. */
const CENTRE = ids('9', '10', '11', '12')
const adjoin = (e: Entity): Entity => (NEIGHBOURS[e.id] ? {...e, adj: {with: NEIGHBOURS[e.id]!, ...(CENTRE.includes(e.id) && {last: true})}} : e)
/** Demarcations a host names (cells; `at` = the frame the rect is drawn in, default the ground origin). Owner: the front door on the bottom wall lower-left, facing out, the lobby inside it and the host stand above it against the stair wall (in line with the T5-T16 band); a POS cubby between the lobby and T17 (T17's height), another between T24 and the walkway; the walkway runs down to the exit (no re-entry) on the bottom wall, between that POS and the bar wall by B16. The stairs continue from the booth aisle's left end (their foot: lobby -> right, up, left); off that end an aisle runs up the grotto's left wall to the men's room, the restroom walk turning left to the ladies' room (a short gap between the two). */
type ZoneRow = [id: string, floor: string, label: string, kind: Components['zone']['kind'], r: Rect, at?: Pt]
const LOBBY: Rect = [0, 19, 8, 7], DOOR: Rect = [1, BOTTOM, 2, 1], HOST: Rect = [0, 15, 8, 4], STAIR_WALL: Rect = [0, 14, 8, 1]
const BOOTH_AISLE: Rect = [8, 12, WALK_X - 8, 3], BANQUETTE_AISLE: Rect = [8, 19, WALK_X - 8, 3], WALKWAY: Rect = [WALK_X, -2, 3, BOTTOM + 2]
const RR_AISLE: Rect = [8, 6, 2, 6], RR_WALK: Rect = [0, 4, 10, 2], MENS: Rect = [7, 0, 3, 4], LADIES: Rect = [0, 0, 4, 4]
const POS1: Rect = [8, 22, 4, 4], POS2: Rect = [45, 22, 5, 4], EXIT: Rect = [WALK_X, BOTTOM, 3, 1]
/** Shoulder-height dividers: the quads' cross (lines on cell edges, no margin across them). */
const DIVIDERS: Rect[] = [[14, MID_Y, 0, 4], [8, MID_Y + 2, 12, 0], [45, MID_Y, 0, 4], [39, MID_Y + 2, 11, 0]]
const COUNTER: Rect = [BAR_X + 2, 5, 10, 14], SPARE: Rect = [BAR_X + 17, 19, 1, 1]
/** Roof top band: stairs top-left, the stair corner (the way in on its right), the top walk on RT1's row, a wall between the walk and RT1; the bar's L counter behind its stools. */
const ROOF_STAIRS: Rect = [0, 0, 6, 3], ROOF_CORNER: Rect = [6, 0, 2, 3], ROOF_WALK: Rect = [8, 0, 5, 3], ROOF_WALL: Rect = [13, 0, 1, 3]
const ROOF_COUNTER: Rect = [27, 7, 2, 6], ROOF_FOOT: Rect = [27, 12, 6, 1]
const ZONES: ZoneRow[] = [
  ['z_lobby', 'rf1', 'Lobby', 'lobby', LOBBY], ['z_door', 'rf1', 'Front door', 'door', DOOR], ['z_host', 'rf1', 'Host stand', 'stand', HOST], ['z_stairs', 'rf1', 'Stairs to the roof', 'stairs', STAIRS], ['z_stair_wall', 'rf1', 'Stair wall', 'wall', STAIR_WALL],
  ['z_walkway', 'rf1', 'Walkway', 'walkway', WALKWAY], ['z_booth_aisle', 'rf1', 'Booth aisle', 'aisle', BOOTH_AISLE], ['z_banquette_aisle', 'rf1', 'Banquette aisle', 'aisle', BANQUETTE_AISLE],
  ['z_rr_aisle', 'rf1', 'Restroom aisle', 'aisle', RR_AISLE], ['z_rr_walk', 'rf1', 'Restroom walk', 'walkway', RR_WALK], ['z_mens', 'rf1', "Men's room", 'room', MENS], ['z_ladies', 'rf1', "Ladies' room", 'room', LADIES],
  ['z_pos1', 'rf1', 'POS', 'stand', POS1], ['z_pos2', 'rf1', 'POS (walkway)', 'stand', POS2], ['z_exit', 'rf1', 'Exit (no re-entry)', 'door', EXIT],
  ...DIVIDERS.map((d, i): ZoneRow => [`z_div${i + 1}`, 'rf1', 'Divider', 'divider', d]),
  ['z_counter', 'rf2', 'Bar counter', 'wall', COUNTER], ['z_spare', 'rf2', 'Spare chair', 'prop', SPARE],
  ['z_roof_stairs', 'rf4', 'Stairs down', 'stairs', ROOF_STAIRS, ROOF_AT], ['z_roof_corner', 'rf4', 'Stair corner', 'wall', ROOF_CORNER, ROOF_AT], ['z_roof_walk', 'rf4', 'Top walk', 'walkway', ROOF_WALK, ROOF_AT],
  ['z_roof_wall', 'rf4', 'Wall', 'wall', ROOF_WALL, ROOF_AT], ['z_roof_counter', 'rf4', 'Roof bar', 'wall', ROOF_COUNTER, ROOF_AT], ['z_roof_foot', 'rf4', 'Bar foot', 'wall', ROOF_FOOT, ROOF_AT],
]
/** Area zones: the hull of the area's tables with their seat bands, one cell out; the grotto is its room (its opening flush on the booth aisle). */
const GROTTO: Rect = [10, 0, 11, 12]
const AREAS: [area: string, floor: string, label: string, r?: Rect][] = [['main', 'rf1', 'Main dining'], ['grotto', 'rf1', 'Grotto', GROTTO], ['bar', 'rf2', 'Bar'], ['patio', 'rf3', 'Patio'], ['roof', 'rf4', 'Roof']]
const lo = (rs: Rect[], a: number) => Math.min(...rs.map(r => r[a]!)), hi = (rs: Rect[], a: number) => Math.max(...rs.map(r => r[a]! + r[a + 2]!))
const hull = (rs: Rect[]): Rect => [lo(rs, 0) - 1, lo(rs, 1) - 1, hi(rs, 0) - lo(rs, 0) + 2, hi(rs, 1) - lo(rs, 1) + 2]
const areaZones = (): ZoneRow[] => AREAS.map(([a, fid, label, r]) => [`z_${a}`, fid, label, 'area', r ? moved(O)(r) : hull(LAID.filter(l => area(l.fid, l.row[0]) === a).map(l => foot(l.row[3], l.r))), [0, 0]])
/** Cells -> policy px. */
const G = defaultPolicy.sim.grid
const px = (g: number, [x, y, w, h]: Rect) => ({x: x * g, y: y * g, w: w * g, h: h * g})
const mid = ([x, y]: Pt): Pt => [(x + O[0] + 0.5) * G, (y + O[1] + 0.5) * G]
/** Where the crew stands at seed (policy px, cell centres, ground cells): the host at the stand, servers parked in the walkway, bartenders in the bar well, the busser in the banquette aisle; all clear of tables. */
export const POSTS = {host: mid([4, 17]), bus: mid([30, 20]), servers: [2, 6, 10, 20].map(y => mid([51, y])), pairs: [9, 13].map(y => mid([BAR_X + 8, y]))}
/** The front door (policy px): the middle of its edge on the bottom wall (policy.sim.door is seeded to this). */
export const DOOR_AT: Pt = [(DOOR[0] + O[0] + DOOR[2] / 2) * G, (DOOR[1] + O[1]) * G]
const seating = (k: Kind) => ((s = seatOf(k)) => (s ? {seating: {...s, chairs: {...s.chairs}, ...(s.bench && {bench: [...s.bench]})} as Seating} : {}))()
/** Entities for the 4 floors, 72 tables and the zones, on whole cells of `g`. */
export const venue = (_floor?: [number, number], g = G): Entity[] => [
  ...floors.flatMap(([fid, name, , f]): Entity[] => [
    {id: fid, floor: {name, active: true, level: f.level}},
    ...LAID.filter(l => l.fid === fid).map(({row, r}): Entity => adjoin({
      id: row[0], area: {id: area(fid, row[0])}, feat: {tags: tags(fid, row)}, pos: {floor: fid, ...px(g, r)}, ...seating(row[3]),
      table: {label: row[1], capacity: row[2], min: 1, shape: KIND[row[3]][2], status: BLOCKED.includes(row[0]) ? 'blocked_private' : 'available', waiter: null, section: null},
    })),
  ]),
  ...[...areaZones(), ...ZONES].map(([id, floor, label, kind, r, at]): Entity => ({id, zone: {label, kind}, pos: {floor, ...px(g, moved(at ?? O)(r))}})),
]
