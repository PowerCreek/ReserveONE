// Seating strategy (lane E-S): plan turns ahead. Pure read `engine.strategy(policy, world, now, ctl)`; the host's levers are `StratCtl` data (kept in ui state, never in the world).
// Reservations rank first, then the priority queue, walk-ins are the opportunistic filler (see docs/v2/PROCEDURES.md). Everything is advisory: it ranks and warns, it never seats.
// Units: Lane.freeIn, Lane.next.at, Pair.at, Move.turn and Risk.at are minutes from now; StratHold.until and Gate.at are absolute ms (same clock as `now`); Lane.seated is guests.
import type {Id} from './model.ts'
/** What the host assumes about the next unknown party: a 2-top, a 3-4 top, a 5-6 top, or large (more than 5: no booths, they need elbow room). `none` = no assumption (only reservations count). */
export type Guess = 'none' | '2top' | '3-4top' | '5-6top' | 'large'
/** A condition on the floor's future that a hold waits for: a table frees (turns), or a clock minute. */
export type Gate = {kind: 'free'; table: Id} | {kind: 'at'; at: number}
/** A lever: keep `tables` clear (a hold) for `size` guests until `until`, once `gate` (if any) opens; `why` is the host's reason. */
export interface StratHold {id: string; tables: Id[]; size: number; until: number; gate?: Gate; why: string}
/** Everything the host sets in the panel. `behind` = sizes of parties known to be waiting behind the one at the door (a 2nd host called them), `at` = the party being addressed now (its size, if known). */
export interface StratCtl {guess: Guess; at?: number; behind: number[]; holds: StratHold[]}
/** One table's expected future in the horizon: when it is free (0 = now), what is planned at it, and its row neighbours (`run` = the string of adjacent tables it can link into). */
export interface Lane {table: Id; label: string; freeIn: number; seated: number; next: {party: Id; label: string; size: number; at: number} | null; run: Id[]; section: Id | null}
/** A suggested move for a size: seat at `tables` (merged if more than one), because `why`; `cost` = reservations or holds it would squeeze (0 = free of consequence), `turn` = minutes until those tables free again. */
export interface Move {size: number; tables: Id[]; label: string; merge: boolean; cost: number; turn: number; why: string[]}
/** A pattern the layout allows: tables `a` and `b` free at about the same time (parity), so `size` guests could be linked there at `at` minutes from now. */
export interface Pair {tables: Id[]; labels: string[]; size: number; at: number; why: string}
/** A caution on the plan: a reservation about to be squeezed, a lockout (nothing fits a size for long), an overloaded section. */
export interface Risk {kind: 'squeeze' | 'lockout' | 'section' | 'late'; text: string; party?: Id; size?: number; at?: number}
/** The server-balance row: covers now + planned per section (party-score by covers) so tip-earning stays level. */
export interface Share {staff: Id; name: string; now: number; planned: number}
export interface StratView {
  lanes: Lane[]
  /** Best move per size 1..8 under the current assumption (`guess`/`at`/`behind` pick which sizes the host cares about). */
  moves: Record<number, Move | null>
  /** The sizes the assumption covers (e.g. '3-4top' -> [3, 4]) and, when `behind` is known, the best joint placement of the party at the door plus the ones behind it. */
  sizes: number[]
  joint: Move[] | null
  pairs: Pair[]
  risks: Risk[]
  share: Share[]
  /** Holds whose gate has opened (now live) and ones still waiting. */
  live: string[]
  waiting: string[]
}
export interface Strategist {strategy: (p: import('./policy.ts').Policy, w: import('./model.ts').World, now: number, ctl: StratCtl) => StratView}
