// Desk (wave 4): the one seam between the engine and every panel. Writes are commands as data (`act`), reads are view models (`stand`).
// The UI renders a view and dispatches a Cmd; it never builds patches, events or domain rules itself.
import type {Id, Patch, Pref, PrefMark, PType, Want} from './model.ts'
import type {Carve} from './service.ts'
import type {HostEvent, ServiceEvent, SimEvent} from './sim.ts'
import type {BusItem, Bucket, Option, Placed, Quote, Rung} from './engine.ts'
import type {Policy} from './policy.ts'
import type {Stage} from './host.ts'
import type {World} from './model.ts'
/** Every host/manager write as data. `lease` holds a spot for a party while it is led and settles; `seat` makes a seating (no `spot` = the best ready spot; no `party` = a fresh walk-in of `size`). */
export type Cmd =
  | {do: 'lease'; party: Id; spot: Id; step: string} // one click at the stand: the spot is leased to the party (led there); it settles into a seat by itself
  | {do: 'release'; party: Id} // hand a lease back (the party wants something else): tables free, party at the door
  | {do: 'seat'; party?: Id; spot?: Id; step?: string; size?: number; from?: 'door'} // from door: a size-only fast seat takes the party at the door that `StandView.bySize` names (it leaves the door list) instead of minting a fresh one // a leased party: confirm its lease now; else seat directly
  | {do: 'decline'; party: Id; spot: Id; step: string} // the party said no to this spot; it leaves the party's offers
  | {do: 'hear'; party: Id; feat: string} // the host asked about a qualifier
  | {do: 'tell'; table: Id}
  | {do: 'reply'; party: Id; response: string} // answer an open table-change request
  | {do: 'join'; size: number; name?: string} // walk-in onto the waiting list, quoted by engine.eta
  | {do: 'reserve'; size: number; name: string; inMin: number; phone?: string}
  | {do: 'mark'; party: Id; status: 'ARRIVED' | 'NO_SHOW'}
  | {do: 'mode'; to: string | null} // service override; null = follow the schedule
  | {do: 'carve'; area: Id; to: Carve}
  | {do: 'top'; table: Id; staff: Id}
  | {do: 'deal'}
  | {do: 'extend'; table: Id; min: number} // camper: push the seated party's turn time out
  | {do: 'clear'; table: Id} // force clear: the party left; slot completed, tables free (merged links dissolve)
  | {do: 'reassign'; table: Id; staff: Id} // move a seated table to another server (tallies follow the covers)
  | {do: 'pref'; staff: Id; pref: Pref} // set (add or replace by id) a server preference
  | {do: 'unpref'; staff: Id; id: string}
  | {do: 'staff'; id: Id; to: 'duty' | 'skip'} // toggle on duty, or skip one turn of the rotation
export type Told = SimEvent | HostEvent | ServiceEvent
/** A command's result: patches to commit, events to narrate, one line for the log (`says` = the guest's words, when they answer). */
export type Outcome = {ok: true; patches: Patch[]; events: Told[]; msg: string; tone: 'ok' | 'warn' | 'action'; says?: string} | {ok: false; err: string}
/** One party at the door, next first (policy.queue.tier, then waited). */
export interface DoorRow {party: Id; label: string; name: string; size: number; kind: PType; waitedMin: number}
/** A ladder rung the host can seat in one step, with who would serve it. */
export interface Offer extends Rung {server: Id | null; prefs: PrefMark[]} // prefs = what server preferences did to this pick
export interface ReqRow {party: Id; table: Id; reason: string; stage: Stage; options: Option[]}
/** A seated table and whether its server knows (area seen, told, or still pending a tell). */
/** A leased spot: the party is led there and settles until `until`; `concern` = it raised a table-change request meanwhile (the lease waits for the host). */
export interface LeaseRow {party: Id; spot: Id; tables: Id[]; at: number; until: number; concern: boolean}
export interface SeatedRow {party: Id; table: Id; area: Id; server: Id | null; aware: 'seen' | 'told' | 'pending'}
/** Everything the host stand shows, derived from the world. `focus` = the party in focus (the asked one when still at the door, else the next). */
export interface StandView {
  door: DoorRow[]
  bySize: Record<number, Id> // party size -> the door party a fast seat of that size takes (first in door order)
  focus: Id | null
  wants: Want[] // recorded for the focus party (said, or heard)
  denied: string[] // asked about, the party had no want
  unasked: string[] // feats the host can still ask about
  offers: Offer[] // spot-bearing rungs first; a wait rung keeps spot null
  rotation: Id[] // units in turn order while the active mode rotates, else empty
  mode: string
  outlook: Placed[]
  requests: ReqRow[]
  leased: LeaseRow[]
  seated: SeatedRow[]
}
/** Dashboard (wave 5): one read model for reading the service at a glance. Every number is derived from the world; the UI only lays it out. */
export interface Kpi {id: string; label: string; value: string; tone: 'ok' | 'warn' | 'crit' | 'info'; hint: string} // value preformatted ("34/120", "62%", "12m")
/** One bar on a table's timeline: `slot` seated now (to = turn time, `over` when past it), `done` finished seating, `res` a reservation holding this table, `plan` where the temporal plan puts an unassigned reservation, `event` a private-event lock. */
export interface Bar {kind: 'slot' | 'done' | 'res' | 'plan' | 'event'; from: number; to: number; party: Id | null; label: string; size: number; late?: boolean; over?: boolean}
export interface Lane {table: Id; label: string; floor: Id; capacity: number; bars: Bar[]}
export interface Tick {start: number; end: number; turns: number} // header bucket: seatings due to turn in it (v1 deluge/drought)
export interface Gantt {from: number; to: number; now: number; lanes: Lane[]; ticks: Tick[]; unplaced: Bar[]} // lanes for tables with any bar in the window; unplaced = reservations the plan cannot place
export type SpotState = 'open' | 'reserved' | 'leased' | 'seated' | 'lapsed' | 'blocked'
export interface LedgerChip {spot: Id; label: string; covers?: number; at?: number} // covers seated, or the next reservation time
export interface Move {table: Id; label: string; kind: 'in' | 'out'; covers: number}
export interface Activity {start: number; end: number; net: number; moves: Move[]} // seat (+) and clear (-) per interval, newest first
export interface SectionRow {section: Id; name: string; occ: number; turns: number; need: number; under: boolean}
/** One preference as the panels show it: set = established, nothing tested it yet; then the latest outcome on a seating (met / enforced / overridden, with why); bogged = the unit counts as bogged down now. */
export interface PrefRow {pref: Pref; state: 'set' | PrefMark['state']; why: string; at: number | null}
export interface ServerRow {staff: Id; name: string; rank: number; tally: number; seated: number; tables: number; weight: number; active: boolean; sections: SectionRow[]; prefs: PrefRow[]; bogged: boolean; area: Id | null} // seated = covers at their tables now; area = bar staff's own area (null = a floor server, the only units the floor rotation and its balance read)
/** One predictive read (Gemini-era overlays): brick = a merge or lease strands a due reservation; pressure = a turn deluge or drought ahead; imbalance = servers' projected covers diverge; punctual = late grace shrinks at peak load; reclaim = joined tables could split to seat waiting parties. */
export interface Insight {id: 'brick' | 'pressure' | 'imbalance' | 'punctual' | 'reclaim'; level: 'info' | 'warn' | 'crit'; msg: string; tables: Id[]; staff: Id[]; at?: number}
export interface BoardOpt {ivMin?: number; pastMin?: number; aheadMin?: number} // interval for turnover/activity/ticks (default 15), gantt window around now (default 60 back, 180 ahead)
export interface Board {
  kpis: Kpi[] // seated/occupancy, waiting + longest wait, quote accuracy, average turn, turning next interval, arriving next interval, to bus, late, no-shows, covers today
  gantt: Gantt
  turnover: Bucket[]
  ledger: Record<SpotState, LedgerChip[]>
  activity: Activity[]
  servers: ServerRow[] // rotation order
  bus: BusItem[]
  quotes: Quote[] // walk-in quote per size 1-6 (what to tell a walk-in)
  insights: Insight[] // worst first
  next: string // task readout: the one thing to do now, as the host would say it ("WALK-IN (4) -> T12 -> Ana")
}
export type DeskFn<A extends unknown[], R> = (p: Policy, w: World, now: number, ...a: A) => R
export interface Desk {
  act: DeskFn<[cmd: Cmd], Outcome>
  stand: DeskFn<[focus?: Id], StandView>
  board: DeskFn<[opt?: BoardOpt], Board>
}
