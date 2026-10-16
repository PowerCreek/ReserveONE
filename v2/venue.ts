// The real venue as data (C3): v1 `src/realFloors.ts` item lists + `src/seed.ts` sizing, folded into v2 entities. Each table carries its `area` tag (crew.ts deals sections).
import type {Entity} from './contracts/index.ts'
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
/** Physical arrangement (centres in image px; each kind has one footprint). Main, bar and patio as drawn in the owner's floor images; the roof (no image) is drawn straight in the level frame from the owner's description: R1-R4 on T17-T24's line, R5-R7 one aisle in (across from R2-R4), R10/R9 two aisles in (R1/R2's ranks), R8 and the bar counter on the right over the ground-floor bar. */
const KIND = {two: [38, 38], four: [56, 56], booth: [78, 50], grotto: [52, 52], stool: [30, 30], corner: [62, 62], pair: [40, 34], high6: [96, 48], counter: [42, 320]} as const
type Kind = keyof typeof KIND
const spot = (k: Kind, ...xs: [string, number, number][]): [string, Rect][] => xs.map(([n, cx, cy]) => [`rf_${n}`, [cx - KIND[k][0] / 2, cy - KIND[k][1] / 2, KIND[k][0], KIND[k][1]]])
const placed: Record<string, Rect> = Object.fromEntries([
  ...spot('booth', ['1', 305, 160], ['2', 463, 160], ['3', 547, 160], ['4', 631, 160]),
  ...spot('grotto', ['g3', 104, 43], ['g2', 104, 100], ['g1', 104, 157], ['g6', 180, 43], ['g5', 180, 100], ['g4', 180, 157]),
  ...spot('two', ['5', 71, 311], ['6', 71, 370], ['7', 134, 311], ['8', 134, 370], ['13', 593, 311], ['14', 593, 370], ['15', 662, 311], ['16', 662, 370], ['19', 272, 570], ['21', 415, 570]),
  ...spot('four', ['9', 220, 341], ['10', 320, 341], ['11', 420, 341], ['12', 520, 341], ['17', 108, 570], ['18', 200, 570], ['20', 340, 570], ['22', 487, 570], ['23', 580, 570]),
  ...spot('corner', ['24', 665, 570], ['b14', 672, 120], ['b16', 672, 322], ['b20', 75, 312], ['b22', 75, 60]),
  ...spot('stool', ['b1', 186, 146], ['b2', 186, 206], ['b3', 186, 266], ['b4', 232, 328], ['b5', 293, 328], ['b6', 354, 328], ['b7', 415, 328], ['b8', 476, 328], ['b9', 536, 309], ['b10', 536, 252], ['b11', 536, 195], ['b12', 536, 138]),
  ...spot('pair', ['b15', 672, 222]), ...spot('four', ['b21', 75, 213]),
  ...spot('four', ['p4', 47, 44], ['p5', 170, 44], ['p6', 302, 44], ['p7', 433, 44]), ...spot('two', ['p3', 60, 223], ['p2', 200, 223], ['p1', 320, 223]),
  ...spot('four', ['r1', 150, 570], ['r2', 260, 570], ['r3', 370, 570], ['r4', 480, 570], ['r5', 260, 450], ['r6', 370, 450], ['r7', 480, 450], ['r9', 260, 330]),
  ...spot('two', ['r10', 150, 330]), ...spot('high6', ['r8', 880, 570]), ...spot('counter', ['r_bar', 1000, 346]),
])
/** A floor's bounds (image px) over its tables. */
const span = (lo: number[], hi: number[]) => [Math.min(...lo), Math.max(...hi)]
const box = (items: Item[]): Rect => {
  const rs = items.map(i => placed[i[0]]!)
  const [[x0, x1], [y0, y1]] = [0, 1].map(a => span(rs.map(r => r[a]!), rs.map(r => r[a]! + r[a + 2]!)))
  return [x0!, y0!, x1! - x0!, y1! - y0!]
}
/** Where each floor sits: its storey, clockwise quarter-turns about its own bounds, then where the turned bounds' top-left lands in the level frame (image px; default = as drawn). Floors on one level share that frame. */
type Frame = {level: number; turns: number; at?: [number, number]}
const MAIN = box(main), AISLE = 60
/** The owner has not said where the patio sits: assumed in front of main's bottom wall (below T17-T24), one aisle out. */
const PATIO_AT: [number, number] = [167, MAIN[1] + MAIN[3] + AISLE]
const floors: [id: string, name: string, items: Item[], frame: Frame][] = [
  ['rf1', 'Main Dining Room', main, {level: 0, turns: 0}],
  ['rf2', 'Bar', bar, {level: 0, turns: 1, at: [MAIN[0] + MAIN[2] + AISLE, MAIN[1]]}], // right of main, past the walkway along T4/T15/T16/T24
  ['rf3', 'Patio', patio, {level: 0, turns: 2, at: PATIO_AT}],
  ['rf4', 'Roof', roof, {level: 1, turns: 0}],
]
/** One clockwise quarter-turn of a rect inside a W x H box (y down); the box swaps sides. */
type Turn = [W: number, H: number, ...r: Rect]
const quarter = ([W, H, x, y, w, h]: Turn): Turn => [H, W, H - y - h, x, h, w]
/** A rect in its level frame: local to the floor's bounds, turned, then set at the frame's `at`. */
const framed = (b: Rect, f: Frame) => ([x, y, w, h]: Rect): Rect => {
  const [, , lx, ly, lw, lh] = Array.from({length: f.turns}).reduce<Turn>(t => quarter(t), [b[2], b[3], x - b[0], y - b[1], w, h])
  const [ax, ay] = f.at ?? [b[0], b[1]]
  return [lx + ax, ly + ay, lw, lh]
}
/** Every table placed in its level's frame (image px): the one fold over the frame rows. */
const LAID = floors.flatMap(([fid, , items, f]) => items.map(item => ({fid, item, r: framed(box(items), f)(placed[item[0]]!)})))
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
const byTable: Record<string, string[]> = {rf_g1: ['door'], rf_g2: ['door'], rf_1: ['window'], rf_2: ['window'], rf_9: ['accessible'], rf_10: ['accessible'], rf_24: ['roomy'], rf_r8: ['roomy', 'hightop'], rf_r9: ['hightop'], rf_r10: ['hightop'], rf_r_bar: ['bar'], rf_b22: ['hightop'], ...upholstery}
const tags = (fid: string, id: string, shape: Shape) => [...byShape[shape], ...(byFloor[fid] ?? []), ...(byTable[id] ?? [])]
/** Tables that push together (owner): each run joins neighbours in order, `across` joins tables facing over an aisle (roof: R5-R7 face R2-R4). Any connected set of free tables is a merge option (engine.merges). */
const RUNS = [
  ['17', '18', '19', '20', '21', '22', '23'].map(n => `rf_${n}`), ['9', '10', '11', '12'].map(n => `rf_${n}`),
  ['rf_g1', 'rf_g2', 'rf_g3'], ['rf_g4', 'rf_g5', 'rf_g6'], ['rf_b20', 'rf_b21'], ['rf_b14', 'rf_b15', 'rf_b16'],
  ['rf_r1', 'rf_r2', 'rf_r3', 'rf_r4'], ['rf_r5', 'rf_r6', 'rf_r7'],
]
const ACROSS: [string, string][] = [['rf_r2', 'rf_r5'], ['rf_r3', 'rf_r6'], ['rf_r4', 'rf_r7']]
const EDGES = [...RUNS.flatMap(r => r.slice(1).map((b, i): [string, string] => [r[i]!, b])), ...ACROSS]
const NEIGHBOURS = EDGES.flatMap(([a, b]) => [[a, b], [b, a]] as const).reduce<Record<string, string[]>>((m, [a, b]) => ({...m, [a]: [...(m[a] ?? []), b].sort()}), {})
/** The centre lane (9-12): merged only in dire need of capacity, after every other option. */
const CENTRE = ['9', '10', '11', '12'].map(n => `rf_${n}`)
const adjoin = (e: Entity): Entity => (NEIGHBOURS[e.id] ? {...e, adj: {with: NEIGHBOURS[e.id]!, ...(CENTRE.includes(e.id) && {last: true})}} : e)
/** Image px -> policy px: one uniform scale, the largest that fits every level's frame inside the policy floor with a PAD margin. */
const PAD = 14
const reach = (a: number) => Math.max(...LAID.map(l => l.r[a]! + l.r[a + 2]!))
const scale = (floor: [number, number]) => Math.min(...[0, 1].map(a => (floor[a]! - 2 * PAD) / reach(a)))
const scaled = (s: number, [x, y, w, h]: Rect) => ({x: Math.round(x * s + PAD), y: Math.round(y * s + PAD), w: Math.round(w * s), h: Math.round(h * s)})
/** Entities for the 4 floors and 66 tables, placed on the policy's floor size. */
export const venue = (floor: [number, number]): Entity[] => {
  const s = scale(floor)
  return floors.flatMap(([fid, name, , f]): Entity[] => [
    {id: fid, floor: {name, active: true, level: f.level}},
    ...LAID.filter(l => l.fid === fid).map(({item: [id, label, capacity, shape], r}): Entity => adjoin({
      id, area: {id: area(fid, id)}, feat: {tags: tags(fid, id, shape)}, pos: {floor: fid, ...scaled(s, r)},
      table: {label, capacity, min: 1, shape, status: BLOCKED.includes(id) ? 'blocked_private' : 'available', waiter: null, section: null},
    })),
  ])
}
