// Engine public API (E1-E3): every function is pure, `(policy, world, now, ...args) => output`. Mutation is expressed as Patch[].
import type {Ent, Heat, Id, PType, Patch, World} from './model.ts'
import type {Policy} from './policy.ts'
import type {SimOut} from './sim.ts'
export type Decide<A extends unknown[], R> = (p: Policy, w: World, now: number, ...a: A) => R
export interface SeqItem {size: number; spot: Id | null; tables: Id[]; label: string; waitMin: number; at: number; code: Heat; ready: boolean}
export interface Look {depth: number; code: Heat; msg: string; at: number | null}
export interface SeatReq {size: number; kind: PType; prefix?: string; party?: Id; queue?: Id; reservation?: Id; tables?: Id[]; floor?: Id; durationMin?: number}
export type Decision = {ok: true; patches: Patch[]; msg: string; tone: 'ok' | 'warn'} | {ok: false; err: string}
export interface Quote {size: number; ahead: number; ready: boolean; none: boolean; waitMin: number; lo: number; hi: number; label: string; at: number | null}
export interface Bucket {start: number; end: number; now: boolean; proj: boolean; inCovers: number; inParties: number; outCovers: number; outParties: number; net: number}
export interface Ranked {staff: Id; score: number}
export interface Pick {staff: Id | null; fallback: boolean}
export interface BusItem {table: Id; staff: Id | null; waitedMin: number; priority: number}
export interface Alert {kind: 'late' | 'lapsed' | 'event' | 'section'; ref: Id; level: 'info' | 'warn' | 'crit'; msg: string}
export interface Engine {
  spots: (w: World) => Ent<'spot'>[] // derive seatable spots (tables + link groups)
  fit: Decide<[sizes: number[]], SeqItem[]> // seating/fit: progressive sequence (SPEC §3)
  lookahead: Decide<[sizes: number[], probes?: number[]], Record<number, Look>>
  seat: Decide<[req: SeatReq], Decision> // auto or manual seating -> patches (slot, table status, staff tally)
  eta: Decide<[size: number], Quote> // turnover/ETA: quote for a new walk-in
  turnover: Decide<[intervalMin: number], Bucket[]>
  rotate: Decide<[], Ranked[]> // rotation/fair-share by covers
  serverFor: Decide<[tables: Id[]], Pick>
  bus: Decide<[], BusItem[]>
  alerts: Decide<[], Alert[]>
  reconcile: Decide<[], Patch[]> // lapse overdue slots, lock/unlock private events (idempotent)
  tick: Decide<[dtMs: number], SimOut> // sim tick: assign tasks, advance bodies, emit events
  spawn: Decide<[seed: number], Patch[]> // sim arrivals (walk-ins + due reservations)
}
