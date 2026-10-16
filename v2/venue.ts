// The real venue as data (C3): v1 `src/realFloors.ts` item lists + `src/seed.ts` sizing and flow, folded into v2 entities. Sections stay unassigned.
import type {Entity} from './contracts/index.ts'
type Shape = 'rect' | 'booth'
type Item = [id: string, label: string, cap: number, shape: Shape]
const rect = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'rect'])
const booth = (...xs: [string, string, number][]): Item[] => xs.map(([i, l, c]) => [i, l, c, 'booth'])
const nums = (ids: string[], cap: number) => ids.map((n): [string, string, number] => [`rf_${n}`, n, cap])
const main: Item[] = [
  ...booth(...['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map((n): [string, string, number] => [`rf_${n}`, n.toUpperCase(), 2])),
  ...booth(['rf_1', '1', 2], ['rf_2', '2', 4], ['rf_3', '3', 4], ['rf_4', '4', 4]),
  ...rect(...nums(['5', '6', '7', '8', '13', '14', '15', '16'], 2), ...nums(['9', '10', '11', '12', '17', '18', '19', '20', '21', '22', '23'], 4)),
  ...booth(['rf_24', '24', 6]),
]
const bar: Item[] = [
  ...booth(...Array.from({length: 12}, (_, i): [string, string, number] => [`rf_b${i + 1}`, `B${i + 1}`, 4])),
  ...rect(['rf_b14', 'B14', 4], ['rf_b15', 'B15', 2], ['rf_b16', 'B16', 4]),
  ...booth(['rf_b20', 'B20', 2]), ...rect(['rf_b21', 'B21', 4]), ...booth(['rf_b22', 'B22', 2]),
]
const patio: Item[] = rect(...Array.from({length: 7}, (_, i): [string, string, number] => [`rf_p${i + 1}`, `P${i + 1}`, 4]))
const upstairs: Item[] = rect(...Array.from({length: 7}, (_, i): [string, string, number] => [`rf_u${i + 1}`, `U${i + 1}`, 4]), ['rf_u8', 'U8', 6], ['rf_u9', 'U9', 4], ['rf_u10', 'U10', 2], ['rf_u_bar', 'Bar', 10])
const floors: [id: string, name: string, items: Item[]][] = [['rf1', 'Main Dining Room', main], ['rf2', 'Bar', bar], ['rf3', 'Patio', patio], ['rf4', 'Upstairs', upstairs]]
const size = (cap: number, shape: Shape): [number, number] => (shape === 'booth' ? [120, 80] : cap <= 2 ? [40, 80] : cap <= 4 ? [80, 80] : [Math.ceil(cap / 2) * 40, 80])
const CANVAS = [1200, 720] // v1 canvas the flow was laid out on
const GAP = 16, MARGIN = 40
/** v1 flow: left-to-right rows, wrapping before MAXX. Returns top-left corners and sizes in v1 pixels. */
const flow = (items: Item[]) => items.reduce<{x: number; y: number; out: {item: Item; x: number; y: number; w: number; h: number}[]}>((a, item) => {
  const [w, h] = size(item[2], item[3])
  const wrap = a.x + w > CANVAS[0] - MARGIN
  const [x, y] = wrap ? [MARGIN, a.y + h + GAP] : [a.x, a.y]
  return {x: x + w + GAP, y, out: [...a.out, {item, x, y, w, h}]}
}, {x: MARGIN, y: MARGIN, out: []}).out
/** Entities for the 4 floors and 66 tables, scaled from the v1 canvas onto the policy's floor size. */
export const venue = (floor: [number, number]): Entity[] => {
  const [kx, ky] = [floor[0] / CANVAS[0], floor[1] / CANVAS[1]]
  return floors.flatMap(([fid, name, items]): Entity[] => [
    {id: fid, floor: {name, active: true}},
    ...flow(items).map(({item: [id, label, capacity, shape], x, y, w, h}): Entity => ({
      id, pos: {floor: fid, x: Math.round(x * kx), y: Math.round(y * ky), w: Math.round(w * kx), h: Math.round(h * ky)},
      table: {label, capacity, min: 1, shape, status: 'available', waiter: null, section: null},
    })),
  ])
}
