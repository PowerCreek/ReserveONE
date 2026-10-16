// Entity/component vocabulary (C5). Entity = {id, ...components}; behaviour lives in functions keyed by component name.
// Times are epoch ms. Sizes are covers. A "spot" is a seatable thing: one table or a link group (v1 "Unit").
import type {Task} from './sim.ts'
export type Id = string
export type TStatus = 'available' | 'occupied' | 'lapsed' | 'blocked_private'
export type PType = 'W' | 'P' | 'R' | 'V' // walk-in, priority (late res), reservation, VIP
export type Heat = 'HOT_GREEN' | 'CAUTION_WAIT' | 'NO_TABLE' | 'WARM_AMBER'
export interface Components {
  floor: {name: string; active: boolean}
  section: {name: string; color: string; minOccupancy?: number; minTurns?: number}
  pos: {floor: Id; x: number; y: number; w: number; h: number}
  table: {label: string; capacity: number; min: number; shape: 'rect' | 'booth'; status: TStatus; waiter: Id | null; section: Id | null}
  link: {members: Id[]} // link group; members[0] is primary
  party: {num: number; label: string; prefix: string; kind: PType; name: string; size: number; here?: number}
  reservation: {at: number; durationMin: number; table: Id | null; status: 'BOOKED' | 'ARRIVED' | 'SEATED' | 'NO_SHOW' | 'QUEUED'; phone: string; notes: string}
  queue: {since: number; quotedMin: number; status: 'WAITING' | 'SEATED'; from: Id | null}
  slot: {table: Id; party: Id; seatedAt: number; turnAt: number; endedAt?: number; status: 'ACTIVE' | 'LAPSED' | 'COMPLETED'}
  staff: {name: string; active: boolean; sections: Id[]; lastSeatedAt: number | null; tally: number; skip: number; maxCovers: number}
  event: {name: string; tables: Id[]; start: number; end: number; locked: Id[]; reclaimed: boolean}
  spot: {tables: Id[]; label: string; capacity: number; status: TStatus; floor: Id; section: Id | null} // derived by engine.spots
  body: {role: 'guest' | 'host' | 'server' | 'busser'; x: number; y: number; speed: number; task: Task | null; backlog: Task[]; party: Id | null} // sim unit
}
export type Entity = {id: Id} & Partial<Components>
export type Ent<K extends keyof Components> = {id: Id} & {[P in K]: Components[P]}
export interface World {ents: Record<Id, Entity>; nextParty: number}
export const having = <K extends keyof Components>(w: World, ...ks: K[]): Ent<K>[] =>
  Object.values(w.ents).filter((e): e is Ent<K> => ks.every(k => k in e))
export type Patch = {op: 'set'; id: Id; parts: Partial<Components>} | {op: 'add'; ent: Entity} | {op: 'del'; id: Id}
