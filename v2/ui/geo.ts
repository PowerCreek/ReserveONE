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
