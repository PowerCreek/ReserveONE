// Entity lookups shared by every engine function (C5: components decide what an entity is).
import {having} from '../contracts/index.ts'
import type {Ent, Entity, Id, PType, Policy, World} from '../contracts/index.ts'
export type Pty = Ent<'party'> & Entity
export const isTable = (e?: Entity): e is Ent<'table'> => !!e && 'table' in e
export const partyOf = (w: World, id?: Id): Pty | undefined => {
  const e = w.ents[id ?? '']
  return e && 'party' in e ? (e as Pty) : undefined
}
export const secsOf = (w: World, tables: Id[]): Id[] => tables.flatMap(i => w.ents[i]?.table?.section ?? [])
export const partyLabel = (prefix: string, kind: PType, num: number) => [prefix, kind, num].filter(x => x !== '').join('-')
export const nextNum = (w: World) => having(w, 'party').reduce((m, e) => Math.max(m, e.party.num + 1), w.nextParty)
const PHASE = {ACTIVE: 'seated', LAPSED: 'gone', COMPLETED: 'gone'} as const
const newer = (a: Ent<'slot'> | undefined, s: Ent<'slot'>) => (a && a.slot.seatedAt > s.slot.seatedAt ? a : s)
export const slotOf = (w: World, party: Id | null) => having(w, 'slot').filter(s => s.slot.party === party).reduce<Ent<'slot'> | undefined>(newer, undefined)
/** door = no slot yet, seated = slot ACTIVE, gone = slot lapsed/completed (derived from data, E2). */
export const phase = (w: World, party: Id | null) => { const s = slotOf(w, party); return s ? PHASE[s.slot.status] : ('door' as const) }
/** Middle of an entity's `pos`; a world without a `door` entity puts the door at `policy.sim.door` (pass `p`). */
export const center = (w: World, id: Id, p?: Policy) => {
  const q = w.ents[id]?.pos
  const [dx, dy] = (id === 'door' && !q && p?.sim.door) || [0, 0]
  return {x: q ? q.x + q.w / 2 : dx, y: q ? q.y + q.h / 2 : dy}
}
