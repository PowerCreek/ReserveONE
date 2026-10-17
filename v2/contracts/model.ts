// Entity/component vocabulary (C5). Entity = {id, ...components}; behaviour lives in functions keyed by component name.
// Times are epoch ms. Sizes are covers. A "spot" is a seatable thing: one table or a link group (v1 "Unit").
import type {Task} from './sim.ts'
import type {Carve} from './service.ts'
export type Id = string
export type TStatus = 'available' | 'leased' | 'occupied' | 'lapsed' | 'blocked_private' // leased = held for a party being led and settled (not seated yet): out of every offer and plan
export type PType = 'W' | 'P' | 'R' | 'V' // walk-in, priority (late res), reservation, VIP
export type Heat = 'HOT_GREEN' | 'CAUTION_WAIT' | 'NO_TABLE' | 'WARM_AMBER'
export type Level = 'need' | 'strong' | 'soft' // how binding a preference is; need = never relaxed
export type Accord = 'all' | 'most' | 'one' // consensus: how much of the party shares the want
/** A qualifier: the party wants (or avoids) a feature, at a level, for a reason (policy.host.whys), with a degree of consensus. */
export interface Want {feat: string; level: Level; why: string; accord: Accord; avoid?: boolean; said?: boolean} // said = volunteered, else the host must ask
/** What a server preference is about; every given key must match (a table's area, any of its feats or shape, a party size range, a table capacity range). */
export interface PrefOn {area?: Id[]; feats?: string[]; shape?: string[]; size?: [min: number, max: number]; cap?: [min: number, max: number]}
/** A server's soft preference, always ranked below the rotation: `avoid` keeps tables matching `on` away from them, `prefer` steers matching tables to them first. `give`: firm = held unless every other eligible unit is bogged down too (or none can take it); yield = "I'll do it if nobody can" (held whenever anyone else can take it). */
export interface Pref {id: string; kind: 'avoid' | 'prefer'; on: PrefOn; give: 'firm' | 'yield'; note: string; at: number}
/** What a preference did at one seating: met = satisfied at no cost, enforced = it moved the table to someone else (or to this server), overridden = the rotation's obligation won (all bogged, nobody else could), with why. */
export interface PrefMark {staff: Id; pref: string; state: 'met' | 'enforced' | 'overridden'; why: string}
export type Ask = 'open' | 'offered' | 'granted' | 'declined'
/** Body sides: top, right, bottom, left (level frame). */
export type Side = 't' | 'r' | 'b' | 'l'
/** stand = a host stand or POS cubby; room = restrooms and back rooms; prop = a kept fixture (a spare chair); divider = a shoulder-height partition (a line on a cell edge, no walking margin across it). */
export type ZoneKind = 'area' | 'walkway' | 'aisle' | 'lobby' | 'stairs' | 'door' | 'wall' | 'stand' | 'room' | 'prop' | 'divider'
export interface Components {
  floor: {name: string; active: boolean; level?: number} // level = storey (0 ground, 1 roof; default 0); floors on one level share one coordinate frame (stitched side by side), so `pos` places a table in its level's frame
  section: {name: string; color: string; minOccupancy?: number; minTurns?: number}
  pos: {floor: Id; x: number; y: number; w: number; h: number}
  table: {label: string; capacity: number; min: number; shape: 'rect' | 'booth' | 'stool'; status: TStatus; waiter: Id | null; section: Id | null}
  link: {members: Id[]; merged?: boolean} // link group; members[0] is primary; `merged` = pushed together at seating, dissolved when the tables clear (engine.freeUp)
  adj: {with: Id[]; last?: boolean} // table: neighbours it can be pushed together with (venue data); last = merges using this table are a last resort (the centre lane), offered only when no other merge is ready
  party: {num: number; label: string; prefix: string; kind: PType; name: string; size: number; here?: number}
  reservation: {at: number; durationMin: number; table: Id | null; status: 'BOOKED' | 'ARRIVED' | 'SEATED' | 'NO_SHOW' | 'QUEUED'; phone: string; notes: string}
  queue: {since: number; quotedMin: number; status: 'WAITING' | 'SEATED'; from: Id | null}
  slot: {table: Id; party: Id; seatedAt: number; turnAt: number; endedAt?: number; status: 'ACTIVE' | 'LAPSED' | 'COMPLETED'; told?: {by: Id; at: number}; prefs?: PrefMark[]} // told = the host told this table's server (needed where policy.service.areas[area].seen is false)
  staff: {name: string; active: boolean; sections: Id[]; lastSeatedAt: number | null; tally: number; skip: number; maxCovers: number; weight?: number; area?: Id; crew?: string[]; prefs?: Pref[]} // weight = rotation participants this unit counts as (default 1; a bartender pair = 2); area = the only area it serves (default any); crew = a pair's names
  event: {name: string; tables: Id[]; start: number; end: number; locked: Id[]; reclaimed: boolean}
  spot: {tables: Id[]; label: string; capacity: number; status: TStatus; floor: Id; section: Id | null; feats?: string[]; last?: boolean} // derived by engine.spots; last = a merge through a last-resort table
  zone: {label: string; kind: ZoneKind} // a demarcated part of the building (with `pos`): drawn as dashed outlines and labels in the floor views; `door` and `stairs` mark the way in and up
  seating: {chairs: Partial<Record<Side, number>>; bench?: Side[]; turn?: boolean} // table (venue data, grid cells): chairs = loose chairs per side of the body, each in the one-cell seat band on that side (guests reach them through the walking margin or the aisle beyond); bench = sides with fixed upholstery (one cell, never moved); turn = the body may turn 90° to join neighbours on its short edges (a long table seated from the aisles). Absent = fixed seating inside the footprint (booths) or exempt (patio)
  feat: {tags: string[]} // table features (policy.host.feats ids); a spot unions its members' tags
  lease: {spot: Id; tables: Id[]; at: number; until: number; step: string; prefs?: PrefMark[]} // party: the tables leased to it while it is led and settles; at `until` (policy.host.clock.leaseMin) it is seated unless it raised a concern
  wants: {list: Want[]; heard: string[]} // party qualifiers; `heard` = feat ids the host recorded at intake
  offer: {spot: Id; step: string; gives: string[]; lacks: string[]; at: number; status: 'open' | 'accepted' | 'declined' | 'lapsed'; declined?: Id[]} // ladder proposal to a party; declined = spots the party already said no to
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
