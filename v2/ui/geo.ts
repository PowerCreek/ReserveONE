// Floor geometry: one canvas, a door, and where an entity (table, body, party's guest) sits on it.
import {defaultPolicy, having} from '../contracts/index.ts'
import type {Entity, Id, World} from '../contracts/index.ts'
export const [W, H] = defaultPolicy.sim.floor
export const DOOR = {x: defaultPolicy.sim.door[0], y: defaultPolicy.sim.door[1]}
type Pt = {x: number; y: number}
const mid = (e?: Entity): Pt | undefined =>
  (e?.pos && {x: e.pos.x + e.pos.w / 2, y: e.pos.y + e.pos.h / 2}) ?? (e?.body && {x: e.body.x, y: e.body.y}) ?? undefined
const guestOf = (w: World, party: Id) => having(w, 'body').find(b => b.body.party === party)
export const locate = (w: World, id: Id): Pt => mid(w.ents[id]) ?? mid(guestOf(w, id)) ?? DOOR
export const hms = (ms: number) => new Date(ms).toISOString().slice(11, 19)
/** Floor a unit or party is on: its own `pos`, else the table of its task or active slot, else the door's floor (the sim plane). */
export const doorFloor = (w: World): Id | undefined => w.ents.door?.pos?.floor
const taskTable = (e?: Entity) => {
  const t = e?.body?.task
  return t && 'table' in t ? t.table : undefined
}
const seatOf = (w: World, party: Id) => having(w, 'slot').find(s => s.slot.party === party && s.slot.status === 'ACTIVE')?.slot.table
export const floorOf = (w: World, id: Id): Id | undefined => {
  const e = w.ents[id]
  const t = taskTable(e) ?? taskTable(guestOf(w, id)) ?? seatOf(w, e?.body?.party ?? id)
  return e?.pos?.floor ?? w.ents[t ?? '']?.pos?.floor ?? doorFloor(w)
}
/** Storey of a floor (0 when unset): floors on one level share its frame. */
export const levelOf = (w: World, fid?: Id) => w.ents[fid ?? '']?.floor?.level ?? 0
/** A level tab id (`lv:<n>`) names every floor on that storey; a floor id names itself; undefined = everything. */
export const LV = 'lv:'
export const floorsOf = (w: World, sel?: Id): Id[] | undefined =>
  sel?.startsWith(LV) ? having(w, 'floor').filter(f => levelOf(w, f.id) === Number(sel.slice(LV.length))).map(f => f.id) : sel === undefined ? undefined : [sel]
export type Box = {x: number; y: number; w: number; h: number}
/** The box over boxes (a point is a 0x0 box); undefined when there are none. */
export const hull = (bs: Box[]): Box | undefined => {
  const [x0, y0, x1, y1] = [Math.min(...bs.map(b => b.x)), Math.min(...bs.map(b => b.y)), Math.max(...bs.map(b => b.x + b.w)), Math.max(...bs.map(b => b.y + b.h))]
  return bs.length ? {x: x0, y: y0, w: x1 - x0, h: y1 - y0} : undefined
}
/** A viewBox over `b` plus margin `m`, grown about its centre to aspect `a` (w/h) and at least `min` wide (a small floor zooms at most W/min). */
export const fitBox = (b: Box, m: number, a: number, min = 0): Box => {
  const w = Math.max(b.w + 2 * m, (b.h + 2 * m) * a, min)
  return {x: Math.round(b.x + b.w / 2 - w / 2), y: Math.round(b.y + b.h / 2 - w / a / 2), w: Math.round(w), h: Math.round(w / a)}
}
export const boxStr = (b: Box) => [b.x, b.y, b.w, b.h].map(n => +n.toFixed(2)).join(' ')
/** 2D camera over the fitted box: pan (frame px, added to the fitted origin) and zoom (1 = the fit; >1 magnifies about the fit's centre). */
export interface Cam {x: number; y: number; z: number}
export const CAM: Cam = {x: 0, y: 0, z: 1}
export const ZOOMS = [0.5, 4] as const // camera zoom range
export const clampZ = (z: number) => Math.min(ZOOMS[1], Math.max(ZOOMS[0], z))
/** The visible box: the fit scaled by 1/z about its centre, then panned. */
export const seen = (fit: Box, c: Cam): Box => ((w = fit.w / c.z, h = fit.h / c.z) => ({x: fit.x + fit.w / 2 - w / 2 + c.x, y: fit.y + fit.h / 2 - h / 2 + c.y, w, h}))()
/** Zoom to `z` keeping the frame point at fraction (fx, fy) of the visible box still (the cursor's spot stays under the cursor). */
export const zoomAt = (fit: Box, c: Cam, z: number, fx = 0.5, fy = 0.5): Cam => {
  const [v, n] = [seen(fit, c), seen(fit, {...c, z: clampZ(z)})]
  return {x: c.x + (v.x + fx * v.w) - (n.x + fx * n.w), y: c.y + (v.y + fy * v.h) - (n.y + fy * n.h), z: clampZ(z)}
}
const mod = (a: number, n: number) => ((a % n) + n) % n
/** Grid rays along one axis, relative to the visible origin `offset`: the first sits at -(offset mod cell), then one every `cell` across `span` (O(span / cell) lines; panning by d shifts them by -d, by a whole cell returns the same set). */
export const rays = (offset: number, span: number, cell: number): number[] =>
  ((first = -mod(offset, cell)) => Array.from({length: Math.floor((span - first) / cell) + 1}, (_, i) => first + i * cell))()
/** Which grid line a ray is in frame terms (its index from the frame origin): every 4th draws a shade stronger. */
export const lineNo = (offset: number, rel: number, cell: number) => Math.round((offset + rel) / cell)
/** Storeys present, ascending; a world without floors has the ground only. */
export const levels = (w: World) => {
  const ls = having(w, 'floor').map(f => levelOf(w, f.id))
  return [...new Set(ls.length ? ls : [0])].sort((a, b) => a - b)
}
const LEVEL_NAME = ['Ground', 'Roof']
export const levelName = (lv: number) => LEVEL_NAME[lv] ?? `Level ${lv}`
