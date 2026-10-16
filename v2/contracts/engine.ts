// Engine public API (E1-E3): every function is pure, `(policy, world, now, ...args) => output`. Mutation is expressed as Patch[].
import type {Ent, Heat, Id, Level, PType, Patch, Want, World} from './model.ts'
import type {Policy} from './policy.ts'
import type {HostEvent, SimOut} from './sim.ts'
import type {Hold} from './service.ts'
export type Decide<A extends unknown[], R> = (p: Policy, w: World, now: number, ...a: A) => R
export interface SeqItem {size: number; spot: Id | null; tables: Id[]; label: string; waitMin: number; at: number; code: Heat; ready: boolean}
export interface Look {depth: number; code: Heat; msg: string; at: number | null}
export interface SeatReq {size: number; kind: PType; prefix?: string; party?: Id; queue?: Id; reservation?: Id; tables?: Id[]; floor?: Id; durationMin?: number}
export type Decision = {ok: true; patches: Patch[]; msg: string; tone: 'ok' | 'warn'} | {ok: false; err: string}
export interface Quote {size: number; ahead: number; ready: boolean; none: boolean; waitMin: number; lo: number; hi: number; label: string; at: number | null}
export interface Bucket {start: number; end: number; now: boolean; proj: boolean; inCovers: number; inParties: number; outCovers: number; outParties: number; net: number}
export interface Ranked {staff: Id; score: number}
export interface Pick {staff: Id | null; fallback: boolean; by?: Hold['by'] | 'fallback'} // by = which hold or rotation chose the server
export interface BusItem {table: Id; staff: Id | null; waitedMin: number; priority: number}
export interface Alert {kind: 'late' | 'lapsed' | 'event' | 'section'; ref: Id; level: 'info' | 'warn' | 'crit'; msg: string}
/** One upcoming reservation as planned: the spot it will sit at (a table, or tables pushed together) and when that spot is free; spot null = nothing will be free in time. */
export interface Placed {party: Id; size: number; at: number; spot: Id | null; tables: Id[]; label: string; free: number; merge: boolean}
export interface Engine {
  spots: (w: World) => Ent<'spot'>[] // derive seatable spots (tables + link groups)
  fit: Decide<[sizes: number[]], SeqItem[]> // seating/fit: progressive sequence (SPEC §3)
  lookahead: Decide<[sizes: number[], probes?: number[]], Record<number, Look>>
  seat: Decide<[req: SeatReq], Decision> // auto or manual seating -> patches (slot, table status, staff tally)
  eta: Decide<[size: number], Quote> // turnover/ETA: quote for a new walk-in
  turnover: Decide<[intervalMin: number], Bucket[]>
  rotate: Decide<[skip?: Id], Ranked[]> // rotation/fair-share by covers, plus the covers each unit is planned to take from upcoming reservations (policy.plan.anticipate); `skip` = a reservation party being seated (its own plan is not counted)
  serverFor: Decide<[tables: Id[], skip?: Id], Pick>
  outlook: Decide<[], Placed[]> // temporal plan: where each upcoming, table-less reservation will sit, given when occupied tables turn over
  bus: Decide<[], BusItem[]>
  alerts: Decide<[], Alert[]>
  reconcile: Decide<[], Patch[]> // lapse overdue slots, lock/unlock private events (idempotent)
  tick: Decide<[dtMs: number], SimOut> // sim tick: assign tasks, advance bodies, emit events
  spawn: Decide<[seed: number], Patch[]> // sim arrivals (walk-ins + due reservations)
}

// Host service (wave 2): matching, fallback ladder, re-seat responses. Same shape as Engine; lanes implement `Coach`, the lead wires `HostEngine`.
export interface Miss {feat: string; level: Level; why: string}
export interface Fit {spot: Id; score: number; met: string[]; missed: Miss[]; waitMin: number; ready: boolean; squeezes: Id[]} // one candidate for a party, best first; squeezes = reservations about to arrive that would be left without a spot if this one is taken
export interface Rung {step: string; spot: Id | null; gives: string[]; lacks: Miss[]; waitMin: number; say: string; squeezes?: Id[]} // one proposal the host can voice; need-level wants are never lacks
export interface Option {response: string; label: string; say: string; spot: Id | null} // a response the host may give to an open request
export interface Reply {patches: Patch[]; events: HostEvent[]; move: 'swap' | 'offer' | 'stay'; mood: number; says: string}
export interface Coach {
  intake: Decide<[party: Id, heard: Want['feat'][]], Decision> // record the qualifiers the host asked about (`wants.heard`)
  match: Decide<[party: Id, within?: Id[]], Fit[]> // score preference fit per spot (policy.host.score); needs are hard filters
  ladder: Decide<[party: Id], Rung[]> // when the top match misses wants: policy.host.ladder steps in order, each a proposal
  ask: Decide<[party: Id, reason: string], Decision> // party raises a re-seat request (policy.host.reasons) -> `request` component
  options: Decide<[party: Id], Option[]> // responses offered for the open request (policy.host.options)
  respond: Decide<[party: Id, response: string], Reply> // apply a response row: patches (move/offer), events, mood delta
}

// Service modes (wave 3). `modeAt` and `assign` are new; `serverFor` and `rotate` keep their signatures but read the mode (sectioned: holds; rotation: cover tally / weight among units whose `area` fits).
export interface Service {
  modeAt: Decide<[], string> // active mode id: `service.override`, else the schedule row for the local minute of day (policy.service)
  holds: Decide<[], Hold[]> // standing holder of every table under the active mode (rotation: the table's waiter or null)
  assign: Decide<[mode?: string], Patch[]> // deal the crew: contiguous `table.section` chunks (main), whole or `assign` tops (grotto, patio), levels to bartender pairs; balanced by weight, idempotent; rotation = no patches
  knows: Decide<[table: Id], boolean> // the table's server knows of its seating: area `seen`, or the active slot is `told`
  tell: Decide<[table: Id], Decision> // host action: set `slot.told`; refuses with a reason when the area is seen, nothing is seated, or no server holds the table
}
export type HostEngine = Engine & Coach & Service
