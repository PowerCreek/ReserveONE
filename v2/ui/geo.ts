// Floor geometry: one canvas, a door, and where an entity (table, body, party's guest) sits on it.
import {having} from '../contracts/index.ts'
import type {Entity, Id, World} from '../contracts/index.ts'
export const W = 800
export const H = 520
export const DOOR = {x: 24, y: 260}
type Pt = {x: number; y: number}
const mid = (e?: Entity): Pt | undefined =>
  (e?.pos && {x: e.pos.x + e.pos.w / 2, y: e.pos.y + e.pos.h / 2}) ?? (e?.body && {x: e.body.x, y: e.body.y}) ?? undefined
const guestOf = (w: World, party: Id) => having(w, 'body').find(b => b.body.party === party)
export const locate = (w: World, id: Id): Pt => mid(w.ents[id]) ?? mid(guestOf(w, id)) ?? DOOR
export const clock = (ms: number) => new Date(ms).toISOString().slice(11, 19)
