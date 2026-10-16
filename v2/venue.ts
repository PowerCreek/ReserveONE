// The real venue as data (C3): v1 `src/realFloors.ts` item lists + `src/seed.ts` sizing and flow, folded into v2 entities. Each table carries its `area` tag (crew.ts deals sections).
import {defaultPolicy} from './contracts/index.ts'
import type {Entity} from './contracts/index.ts'
type Shape = 'rect' | 'booth' | 'stool'
type Item = [id: string, label: string, cap: number, shape: Shape]
const rect = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'rect'])
const stool = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'stool'])
const booth = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'booth'])
/** Main floor (tables 1-24), per the owner: booths hold 6, the listed tables are 2-tops, every other table is a 4-top (DEFAULT_TOP: the owner wrote "2 top" for the rest, read as a typo for 4). */
const BOOTHS = ['1', '2', '3', '4', '24'], BOOTH_CAP = 6
const TWO_TOPS = ['5', '6', '7', '8', '13', '14', '15', '16', '19', '21']
const DEFAULT_TOP = 4
const mainItem = (n: string): Item => [`rf_${n}`, n, BOOTHS.includes(n) ? BOOTH_CAP : TWO_TOPS.includes(n) ? 2 : DEFAULT_TOP, BOOTHS.includes(n) ? 'booth' : 'rect']
const main: Item[] = [
  ...rect(...['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map((n): [string, string, number] => [`rf_${n}`, n.toUpperCase(), 4])),
  ...Array.from({length: 24}, (_, i) => mainItem(String(i + 1))),
]
/** Physical arrangement from the owner's floor images (centres in image px, scaled by K): each kind has one footprint. Floors without an image (upstairs) keep the reading-order flow. */
const KIND = {two: [38, 38], four: [56, 56], booth: [78, 50], grotto: [52, 52], stool: [30, 30], corner: [62, 62], pair: [40, 34]} as const
type Kind = keyof typeof KIND
const spot = (k: Kind, ...xs: [string, number, number][]): [string, [number, number, number, number]][] => xs.map(([n, cx, cy]) => [`rf_${n}`, [cx - KIND[k][0] / 2, cy - KIND[k][1] / 2, KIND[k][0], KIND[k][1]]])
const placed: Record<string, [x: number, y: number, w: number, h: number]> = Object.fromEntries([
  ...spot('booth', ['1', 305, 160], ['2', 463, 160], ['3', 547, 160], ['4', 631, 160]),
  ...spot('grotto', ['g3', 104, 43], ['g2', 104, 100], ['g1', 104, 157], ['g6', 180, 43], ['g5', 180, 100], ['g4', 180, 157]),
  ...spot('two', ['5', 71, 311], ['6', 71, 370], ['7', 134, 311], ['8', 134, 370], ['13', 593, 311], ['14', 593, 370], ['15', 662, 311], ['16', 662, 370], ['19', 272, 570], ['21', 415, 570]),
  ...spot('four', ['9', 220, 341], ['10', 320, 341], ['11', 420, 341], ['12', 520, 341], ['17', 108, 570], ['18', 200, 570], ['20', 340, 570], ['22', 487, 570], ['23', 580, 570]),
  ...spot('corner', ['24', 665, 570], ['b14', 672, 120], ['b16', 672, 322], ['b20', 75, 312], ['b22', 75, 60]),
  ...spot('stool', ['b1', 186, 146], ['b2', 186, 206], ['b3', 186, 266], ['b4', 232, 328], ['b5', 293, 328], ['b6', 354, 328], ['b7', 415, 328], ['b8', 476, 328], ['b9', 536, 309], ['b10', 536, 252], ['b11', 536, 195], ['b12', 536, 138]),
  ...spot('pair', ['b15', 672, 222]), ...spot('four', ['b21', 75, 213]),
  ...spot('four', ['p4', 47, 44], ['p5', 170, 44], ['p6', 302, 44], ['p7', 433, 44]), ...spot('two', ['p3', 60, 223], ['p2', 200, 223], ['p1', 320, 223]),
])
const S = 0.78, PAD = 14 // image px -> policy px (one uniform scale: footprints keep their proportions)
const bar: Item[] = [
  ...stool(...Array.from({length: 12}, (_, i): [string, string, number] => [`rf_b${i + 1}`, `B${i + 1}`, 1])),
  ...booth(['rf_b14', 'B14', 3], ['rf_b16', 'B16', 3], ['rf_b20', 'B20', 3], ['rf_b22', 'B22', 3]),
  ...rect(['rf_b15', 'B15', 2], ['rf_b21', 'B21', 4]),
]
const patio: Item[] = rect(...Array.from({length: 7}, (_, i): [string, string, number] => [`rf_p${i + 1}`, `P${i + 1}`, 4]))
const upstairs: Item[] = rect(...Array.from({length: 7}, (_, i): [string, string, number] => [`rf_u${i + 1}`, `U${i + 1}`, 4]), ['rf_u8', 'U8', 6], ['rf_u9', 'U9', 4], ['rf_u10', 'U10', 2], ['rf_u_bar', 'Bar', 10])
const floors: [id: string, name: string, items: Item[]][] = [['rf1', 'Main Dining Room', main], ['rf2', 'Bar', bar], ['rf3', 'Patio', patio], ['rf4', 'Upstairs', upstairs]]
/** Area per floor; the six `rf_g*` booths on the main floor are the grotto. */
const areaOf: Record<string, string> = {rf1: 'main', rf2: 'bar', rf3: 'patio', rf4: 'upstairs'}
const area = (fid: string, id: string) => (id.startsWith('rf_g') ? 'grotto' : areaOf[fid]!)
/** Features (policy.host.feats ids) per floor, per shape and per table; a table carries the union. */
const byFloor: Record<string, string[]> = {rf1: [], rf2: ['loud'], rf3: ['patio', 'window', 'sunny'], rf4: ['quiet']}
const byShape: Record<Shape, string[]> = {booth: ['booth'], rect: ['chairs'], stool: ['stool']}
/** Upholstered bench seating (2 guests) along the wall opposite chairs (2 guests) in the aisle: main 17-23 and the bar's outer perimeter (B15, B21). Corner booths are benches with one chair; a bench only fits 3 at the table surface. */
const WALL = [...['17', '18', '19', '20', '21', '22', '23'].map(n => `rf_${n}`), 'rf_b15', 'rf_b21'], CORNERS = ['rf_b14', 'rf_b16', 'rf_b20']
const upholstery: Record<string, string[]> = Object.fromEntries([...WALL.map(id => [id, ['banquette']]), ...CORNERS.map(id => [id, ['chairs']])])
/** B22 is a high-top the managers use as a desk: never offered to guests. */
const BLOCKED = ['rf_b22']
const byTable: Record<string, string[]> = {rf_g1: ['door'], rf_g2: ['door'], rf_1: ['window'], rf_2: ['window'], rf_9: ['accessible'], rf_10: ['accessible'], rf_24: ['roomy'], rf_u8: ['roomy'], rf_u_bar: ['bar'], rf_b22: ['hightop'], ...upholstery}
const tags = (fid: string, id: string, shape: Shape) => [...byShape[shape], ...(byFloor[fid] ?? []), ...(byTable[id] ?? [])]
const size = (cap: number, shape: Shape): [number, number] => (shape === 'stool' ? [40, 40] : shape === 'booth' ? [120, 80] : cap <= 2 ? [40, 80] : cap <= 4 ? [80, 80] : [Math.ceil(cap / 2) * 40, 80])
const CANVAS = [1200, 720] // v1 canvas the flow was laid out on
const GAP = 16, MARGIN = 40
type Laid = {item: Item; x: number; y: number; w: number; h: number}
/** v1 flow: left-to-right rows, wrapping before MAXX. Returns top-left corners and sizes in v1 pixels. */
const flowed = (items: Item[]) => items.reduce<{x: number; y: number; out: {item: Item; x: number; y: number; w: number; h: number}[]}>((a, item) => {
  const [w, h] = size(item[2], item[3])
  const wrap = a.x + w > CANVAS[0] - MARGIN
  const [x, y] = wrap ? [MARGIN, a.y + h + GAP] : [a.x, a.y]
  return {x: x + w + GAP, y, out: [...a.out, {item, x, y, w, h}]}
}, {x: MARGIN, y: MARGIN, out: []}).out
const fixed = ([kx, ky]: [number, number]) => (item: Item): Laid => {
  const [x, y, w, h] = placed[item[0]]!
  return {item, x: (x * S + PAD) / kx, y: (y * S + PAD) / ky, w: (w * S) / kx, h: (h * S) / ky}
}
/** Items with a physical position (`placed`) keep it; the rest flow in reading order. */
const flow = (items: Item[], k: [number, number]): Laid[] => [...items.filter(i => i[0] in placed).map(fixed(k)), ...flowed(items.filter(i => !(i[0] in placed)))]
type Box = NonNullable<Entity['pos']>
const gap = (a: Box, b: Box) => Math.hypot(Math.max(0, a.x - b.x - b.w, b.x - a.x - a.w), Math.max(0, a.y - b.y - b.h, b.y - a.y - a.h))
const span = (a: number, aw: number, b: number, bw: number) => a < b + bw && b < a + aw
/** Side by side (their extents overlap on one axis, so diagonal tables are not neighbours) and within gap g. */
const side = (a: Box, b: Box) => span(a.x, a.w, b.x, b.w) || span(a.y, a.h, b.y, b.h)
const near = (e: Entity, o: Entity, g: number) => o.id !== e.id && o.area?.id === e.area?.id && o.pos!.floor === e.pos!.floor && side(e.pos!, o.pos!) && gap(e.pos!, o.pos!) <= g
/** Neighbours per table (same floor and area, gap on the laid-out floor within policy.merge.gapPx), derived once here; the engine only reads `adj`. Only areas listed in policy.merge.areas have a physical layout. */
const adjoin = (es: Entity[]): Entity[] => {
  const pool = es.filter(e => e.table && defaultPolicy.merge.areas.includes(e.area?.id ?? ''))
  const nb = (e: Entity) => pool.filter(o => near(e, o, defaultPolicy.merge.gapPx)).map(o => o.id)
  const by = Object.fromEntries(pool.map(e => [e.id, nb(e)]))
  return es.map(e => (by[e.id]?.length ? {...e, adj: {with: by[e.id]!}} : e))
}
/** Entities for the 4 floors and 66 tables, scaled from the v1 canvas onto the policy's floor size. */
export const venue = (floor: [number, number]): Entity[] => {
  const [kx, ky] = [floor[0] / CANVAS[0], floor[1] / CANVAS[1]]
  return adjoin(floors.flatMap(([fid, name, items]): Entity[] => [
    {id: fid, floor: {name, active: true}},
    ...flow(items, [kx, ky]).map(({item: [id, label, capacity, shape], x, y, w, h}): Entity => ({
      id, area: {id: area(fid, id)}, feat: {tags: tags(fid, id, shape)}, pos: {floor: fid, x: Math.round(x * kx), y: Math.round(y * ky), w: Math.round(w * kx), h: Math.round(h * ky)},
      table: {label, capacity, min: 1, shape, status: BLOCKED.includes(id) ? 'blocked_private' : 'available', waiter: null, section: null},
    })),
  ]))
}
