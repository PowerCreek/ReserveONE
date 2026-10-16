// Desk (wave 4): the one seam between the engine and every panel. Writes are commands as data (`act`), reads are view models (`stand`).
// The UI renders a view and dispatches a Cmd; it never builds patches, events or domain rules itself.
import type {Id, Patch, PType, Want} from './model.ts'
import type {Carve} from './service.ts'
import type {HostEvent, ServiceEvent, SimEvent} from './sim.ts'
import type {Option, Placed, Rung} from './engine.ts'
import type {Policy} from './policy.ts'
import type {Stage} from './host.ts'
import type {World} from './model.ts'
/** Every host/manager write as data. `seat`: one step (the offer is recorded as accepted and the party is seated at once); no `spot` = the best ready spot; no `party` = a fresh walk-in of `size`. */
export type Cmd =
  | {do: 'seat'; party?: Id; spot?: Id; step?: string; size?: number}
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
  | {do: 'staff'; id: Id; to: 'duty' | 'skip'} // toggle on duty, or skip one turn of the rotation
export type Told = SimEvent | HostEvent | ServiceEvent
/** A command's result: patches to commit, events to narrate, one line for the log (`says` = the guest's words, when they answer). */
export type Outcome = {ok: true; patches: Patch[]; events: Told[]; msg: string; tone: 'ok' | 'warn' | 'action'; says?: string} | {ok: false; err: string}
/** One party at the door, next first (policy.queue.tier, then waited). */
export interface DoorRow {party: Id; label: string; name: string; size: number; kind: PType; waitedMin: number}
/** A ladder rung the host can seat in one step, with who would serve it. */
export interface Offer extends Rung {server: Id | null}
export interface ReqRow {party: Id; table: Id; reason: string; stage: Stage; options: Option[]}
/** A seated table and whether its server knows (area seen, told, or still pending a tell). */
export interface SeatedRow {party: Id; table: Id; area: Id; server: Id | null; aware: 'seen' | 'told' | 'pending'}
/** Everything the host stand shows, derived from the world. `focus` = the party in focus (the asked one when still at the door, else the next). */
export interface StandView {
  door: DoorRow[]
  focus: Id | null
  wants: Want[] // recorded for the focus party (said, or heard)
  denied: string[] // asked about, the party had no want
  unasked: string[] // feats the host can still ask about
  offers: Offer[] // spot-bearing rungs first; a wait rung keeps spot null
  rotation: Id[] // units in turn order while the active mode rotates, else empty
  mode: string
  outlook: Placed[]
  requests: ReqRow[]
  seated: SeatedRow[]
}
export type DeskFn<A extends unknown[], R> = (p: Policy, w: World, now: number, ...a: A) => R
export interface Desk {
  act: DeskFn<[cmd: Cmd], Outcome>
  stand: DeskFn<[focus?: Id], StandView>
}
