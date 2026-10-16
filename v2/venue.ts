// The real venue as data (C3): v1 `src/realFloors.ts` item lists + `src/seed.ts` sizing and flow, folded into v2 entities. Each table carries its `area` tag (crew.ts deals sections).
import {defaultPolicy} from './contracts/index.ts'
import type {Entity} from './contracts/index.ts'
type Shape = 'rect' | 'booth'
type Item = [id: string, label: string, cap: number, shape: Shape]
const rect = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'rect'])
const booth = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'booth'])
/** Main floor (tables 1-24), per the owner: booths hold 6, the listed tables are 2-tops, every other table is a 4-top (DEFAULT_TOP: the owner wrote "2 top" for the rest, read as a typo for 4). */
const BOOTHS = ['1', '2', '3', '4', '24'], BOOTH_CAP = 6
const TWO_TOPS = ['5', '6', '7', '8', '13', '14', '15', '16', '19', '21']
const DEFAULT_TOP = 4
const mainItem = (n: string): Item => [`rf_${n}`, n, BOOTHS.includes(n) ? BOOTH_CAP : TWO_TOPS.includes(n) ? 2 : DEFAULT_TOP, BOOTHS.includes(n) ? 'booth' : 'rect']
const main: Item[] = [
  ...booth(...['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map((n): [string, string, number] => [`rf_${n}`, n.toUpperCase(), 2])),
  ...Array.from({length: 24}, (_, i) => mainItem(String(i + 1))),
]
/** Physical arrangement of the main floor in v1 pixels (top-left): booths along the top wall, the grotto booths in the right-hand corner, rows of tables below; neighbours sit one GAP apart. Other floors keep the reading-order flow. */
const row = (ids: string[], x: number, y: number, step: number): [string, [number, number]][] => ids.map((n, i) => [`rf_${n}`, [x + step * i, y]])
const placed: Record<string, [number, number]> = Object.fromEntries([
  ...row(['1', '2', '3', '4'], 40, 40, 136), ...row(['g1', 'g2', 'g3'], 640, 40, 136), ...row(['g4', 'g5', 'g6'], 640, 136, 136),
  ...row(['5', '6', '7', '8'], 40, 160, 56), ...row(['9', '10', '11', '12'], 40, 280, 96), ...row(['13', '14', '15', '16'], 40, 400, 56),
  ...row(['17', '18'], 480, 280, 96), ...row(['19'], 672, 280, 0), ...row(['20', '21'], 480, 400, 96), ...row(['22'], 632, 400, 0), ...row(['23'], 480, 496, 0), ...row(['24'], 1040, 320, 0),
])
const bar: Item[] = [
  ...booth(...Array.from({length: 12}, (_, i): [string, string, number] => [`rf_b${i + 1}`, `B${i + 1}`, 4])),
  ...rect(['rf_b14', 'B14', 4], ['rf_b15', 'B15', 2], ['rf_b16', 'B16', 4]),
  ...booth(['rf_b20', 'B20', 2]), ...rect(['rf_b21', 'B21', 4]), ...booth(['rf_b22', 'B22', 2]),
]
const patio: Item[] = rect(...Array.from({length: 7}, (_, i): [string, string, number] => [`rf_p${i + 1}`, `P${i + 1}`, 4]))
const upstairs: Item[] = rect(...Array.from({length: 7}, (_, i): [string, string, number] => [`rf_u${i + 1}`, `U${i + 1}`, 4]), ['rf_u8', 'U8', 6], ['rf_u9', 'U9', 4], ['rf_u10', 'U10', 2], ['rf_u_bar', 'Bar', 10])
const floors: [id: string, name: string, items: Item[]][] = [['rf1', 'Main Dining Room', main], ['rf2', 'Bar', bar], ['rf3', 'Patio', patio], ['rf4', 'Upstairs', upstairs]]
/** Area per floor; the six `rf_g*` booths on the main floor are the grotto. */
const areaOf: Record<string, string> = {rf1: 'main', rf2: 'bar', rf3: 'patio', rf4: 'upstairs'}
const area = (fid: string, id: string) => (id.startsWith('rf_g') ? 'grotto' : areaOf[fid]!)
/** Features (policy.host.feats ids) per floor, per shape and per table; a table carries the union. */
const byFloor: Record<string, string[]> = {rf1: [], rf2: ['loud'], rf3: ['patio', 'window', 'sunny'], rf4: ['quiet']}
const byShape: Record<Shape, string[]> = {booth: ['booth'], rect: ['chairs']}
const byTable: Record<string, string[]> = {rf_g1: ['door'], rf_g2: ['door'], rf_1: ['window'], rf_2: ['window'], rf_9: ['accessible'], rf_10: ['accessible'], rf_24: ['roomy'], rf_u8: ['roomy'], rf_u_bar: ['bar'], rf_b20: ['hightop'], rf_b22: ['hightop']}
const tags = (fid: string, id: string, shape: Shape) => [...byShape[shape], ...(byFloor[fid] ?? []), ...(byTable[id] ?? [])]
const size = (cap: number, shape: Shape): [number, number] => (shape === 'booth' ? [120, 80] : cap <= 2 ? [40, 80] : cap <= 4 ? [80, 80] : [Math.ceil(cap / 2) * 40, 80])
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
const fixed = (item: Item): Laid => {
  const [x, y] = placed[item[0]]!
  const [w, h] = size(item[2], item[3])
  return {item, x, y, w, h}
}
/** Items with a physical position (`placed`) keep it; the rest flow in reading order. */
const flow = (items: Item[]): Laid[] => [...items.filter(i => i[0] in placed).map(fixed), ...flowed(items.filter(i => !(i[0] in placed)))]
type Box = NonNullable<Entity['pos']>
const gap = (a: Box, b: Box) => Math.hypot(Math.max(0, a.x - b.x - b.w, b.x - a.x - a.w), Math.max(0, a.y - b.y - b.h, b.y - a.y - a.h))
const near = (e: Entity, o: Entity, g: number) => o.id !== e.id && o.area?.id === e.area?.id && o.pos!.floor === e.pos!.floor && gap(e.pos!, o.pos!) <= g
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
    ...flow(items).map(({item: [id, label, capacity, shape], x, y, w, h}): Entity => ({
      id, area: {id: area(fid, id)}, feat: {tags: tags(fid, id, shape)}, pos: {floor: fid, x: Math.round(x * kx), y: Math.round(y * ky), w: Math.round(w * kx), h: Math.round(h * ky)},
      table: {label, capacity, min: 1, shape, status: 'available', waiter: null, section: null},
    })),
  ]))
}
