// Entity/component vocabulary (C5). Entity = {id, ...components}; behaviour lives in functions keyed by component name.
// Times are epoch ms. Sizes are covers. A "spot" is a seatable thing: one table or a link group (v1 "Unit").
import type {Task} from './sim.ts'
import type {Carve} from './service.ts'
export type Id = string
export type TStatus = 'available' | 'occupied' | 'lapsed' | 'blocked_private'
export type PType = 'W' | 'P' | 'R' | 'V' // walk-in, priority (late res), reservation, VIP
export type Heat = 'HOT_GREEN' | 'CAUTION_WAIT' | 'NO_TABLE' | 'WARM_AMBER'
export type Level = 'need' | 'strong' | 'soft' // how binding a preference is; need = never relaxed
export type Accord = 'all' | 'most' | 'one' // consensus: how much of the party shares the want
/** A qualifier: the party wants (or avoids) a feature, at a level, for a reason (policy.host.whys), with a degree of consensus. */
export interface Want {feat: string; level: Level; why: string; accord: Accord; avoid?: boolean; said?: boolean} // said = volunteered, else the host must ask
export type Ask = 'open' | 'offered' | 'granted' | 'declined'
export interface Components {
  floor: {name: string; active: boolean}
  section: {name: string; color: string; minOccupancy?: number; minTurns?: number}
  pos: {floor: Id; x: number; y: number; w: number; h: number}
  table: {label: string; capacity: number; min: number; shape: 'rect' | 'booth' | 'stool'; status: TStatus; waiter: Id | null; section: Id | null}
  link: {members: Id[]; merged?: boolean} // link group; members[0] is primary; `merged` = pushed together at seating, dissolved when the tables clear (engine.freeUp)
  adj: {with: Id[]; last?: boolean} // table: neighbours it can be pushed together with (venue data); last = merges using this table are a last resort (the centre lane), offered only when no other merge is ready
  party: {num: number; label: string; prefix: string; kind: PType; name: string; size: number; here?: number}
  reservation: {at: number; durationMin: number; table: Id | null; status: 'BOOKED' | 'ARRIVED' | 'SEATED' | 'NO_SHOW' | 'QUEUED'; phone: string; notes: string}
  queue: {since: number; quotedMin: number; status: 'WAITING' | 'SEATED'; from: Id | null}
  slot: {table: Id; party: Id; seatedAt: number; turnAt: number; endedAt?: number; status: 'ACTIVE' | 'LAPSED' | 'COMPLETED'; told?: {by: Id; at: number}} // told = the host told this table's server (needed where policy.service.areas[area].seen is false)
  staff: {name: string; active: boolean; sections: Id[]; lastSeatedAt: number | null; tally: number; skip: number; maxCovers: number; weight?: number; area?: Id; crew?: string[]} // weight = rotation participants this unit counts as (default 1; a bartender pair = 2); area = the only area it serves (default any); crew = a pair's names
  event: {name: string; tables: Id[]; start: number; end: number; locked: Id[]; reclaimed: boolean}
  spot: {tables: Id[]; label: string; capacity: number; status: TStatus; floor: Id; section: Id | null; feats?: string[]; last?: boolean} // derived by engine.spots; last = a merge through a last-resort table
  feat: {tags: string[]} // table features (policy.host.feats ids); a spot unions its members' tags
  wants: {list: Want[]; heard: string[]} // party qualifiers; `heard` = feat ids the host recorded at intake
  offer: {spot: Id; step: string; gives: string[]; lacks: string[]; at: number; status: 'open' | 'accepted' | 'declined' | 'lapsed'} // ladder proposal to a party
  request: {reason: string; stage: 'arrived' | 'seated'; table: Id; at: number; status: Ask; spot: Id | null} // re-seat request after the host led the party
  mood: {score: number} // guest sentiment, starts 0; changes are `mood` events
  area: {id: Id} // table: its area (policy.service.areas id); absent = main
  assign: {staff: Id} // table: a top dealt piecemeal to this server (carve `tops`); ignored while the active mode has no holds
  service: {override: string | null; carve: Record<Id, Carve>} // singleton entity `service`: manual mode override (null = follow the schedule) and the chosen carve per area
  body: {role: 'guest' | 'host' | 'server' | 'busser'; x: number; y: number; speed: number; task: Task | null; backlog: Task[]; party: Id | null} // sim unit
}
export type Entity = {id: Id} & Partial<Components>
export type Ent<K extends keyof Components> = {id: Id} & {[P in K]: Components[P]}
export interface World {ents: Record<Id, Entity>; nextParty: number}
export const having = <K extends keyof Components>(w: World, ...ks: K[]): Ent<K>[] =>
  Object.values(w.ents).filter((e): e is Ent<K> => ks.every(k => k in e))
/** A merge candidate is a spot with no entity yet: its id names its tables (`m:a+b`). A link entity, once seated, names the same tables in `members`. */
export const mergeId = (tables: Id[]): Id => `m:${[...tables].sort().join('+')}`
export const isMerge = (id: Id) => id.startsWith('m:')
/** The tables a spot id stands for: a link's members, a merge id's parts, else the table itself. */
export const partsOf = (w: World, id: Id): Id[] => w.ents[id]?.link?.members ?? (isMerge(id) ? id.slice(2).split('+') : [id])
export type Patch = {op: 'set'; id: Id; parts: Partial<Components>} | {op: 'add'; ent: Entity} | {op: 'del'; id: Id}
