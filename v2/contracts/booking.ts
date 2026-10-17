// Front-of-house intake (lane U14): bookings, call-aheads, the wait list and one priority order. Writes are `BookCmd`s through the booking desk
// (`Booking.act` -> Outcome, composed from engine.act join/reserve/mark), reads are view models. The priority order is policy data (`policy.book`), never code.
import type {Components, Id, Level, PType, World} from './model.ts'
import type {Policy} from './policy.ts'
import type {Outcome} from './desk.ts'
/** How a party reached the desk: a booking, a call-ahead (phoned, promised an arrival time), or a walk-in. */
export type Via = 'book' | 'call' | 'walk'
export type GoneWhy = 'cancel' | 'left' | 'removed' | 'noshow'
/** One manual move in the order: `pts` added to the party's priority, with the host's reason. */
export interface Bump {at: number; pts: number; why: string}
/** The front-of-house record on a party. `eta` = a call-ahead's promised arrival; `here` = when it checked in; `quote` = minutes quoted on the phone;
 *  `texted` = when the host sent "your table is ready"; `gone` = cancelled / left / removed (the queue or reservation component is stripped, `was` keeps the booking). */
export interface Intake {via: Via; flags: string[]; feats: string[]; area: Id | null; phone?: string; notes?: string; bump: number; bumps: Bump[]; eta?: number; here?: number; quote?: number; texted?: number; gone?: {at: number; why: GoneWhy; note: string}; was?: Components['reservation']}
declare module './model.ts' {
  interface Components {intake: Intake}
}
/** A scored term of the priority order (`label` says why, `pts` how much). */
export interface Term {id: string; label: string; pts: number}
export interface FlagDef {label: string; pts: number; feat?: string} // feat = the table feature the flag also asks for (accessibility -> accessible)
/** Priority order (higher first): base points per way in, per party kind, per flag; points per minute waited (from the later of its promise and now's start) and once past its quote;
 *  a late arrival (past `graceMin`) loses `late` points; manual bumps add their points. Ties: waited longer first. */
export interface BookPolicy {
  via: Record<Via, {label: string; pts: number}>
  kind: Record<PType, {label: string; pts: number}>
  flags: Record<string, FlagDef>
  perMin: number
  overQuote: number
  late: number
  graceMin: Record<'book' | 'call', number>
  bumpWhys: Record<string, string> // reason id -> label offered when bumping
  replyMin: number // after a "table ready" text, minutes before the row reads "no reply yet"
  slotMin: number // reservation timeline slot
  altMax: number // alternative times offered when a slot is full
  want: {level: Level; why: string; feats: Record<string, {level: Level; why: string}>} // a requested feature becomes a said want at this level (per-feat override)
}
export const defaultBooking: BookPolicy = {
  via: {book: {label: 'Reservation', pts: 300}, call: {label: 'Call-ahead', pts: 200}, walk: {label: 'Walk-in', pts: 100}},
  kind: {W: {label: 'Walk-in', pts: 0}, R: {label: 'Reservation', pts: 0}, P: {label: 'Priority', pts: 60}, V: {label: 'VIP', pts: 150}},
  flags: {vip: {label: 'VIP', pts: 150}, access: {label: 'Accessibility', pts: 120, feat: 'accessible'}, elder: {label: 'Elderly guest', pts: 60}, kids: {label: 'Small children', pts: 40}},
  perMin: 3,
  overQuote: 40,
  late: -220,
  graceMin: {book: 15, call: 10},
  bumpWhys: {host: 'Host call', apology: 'Make up for a long wait', vip: 'Regular / VIP', access: 'Accessibility', fit: 'Table fits them now', defer: 'Asked to wait'},
  replyMin: 5,
  slotMin: 30,
  altMax: 4,
  want: {level: 'strong', why: 'comfort', feats: {accessible: {level: 'need', why: 'mobility'}}},
}
declare module './policy.ts' {
  interface Policy {book?: BookPolicy} // absent = defaultBooking
}
export const bookOf = (p: Policy): BookPolicy => p.book ?? defaultBooking
/** What a booking asks for; `at` = epoch ms (the wizard's date + time). */
export interface Draft {size: number; name: string; at: number; phone?: string; notes?: string; feats?: string[]; flags?: string[]; area?: Id | null; durationMin?: number}
/** Every front-of-house write as data. `book`/`edit` = reservations; `call` = a call-ahead with an ETA (minutes from now); `walk` = a walk-in on the wait list (quoted by engine.eta);
 *  `arrive` = check in (a reservation is ARRIVED, a call-ahead joins the door list keeping its promised place); `noshow`; `leave` = cancel / left / removed; `bump` = move in the order
 *  (`to` = up past the one ahead, down below the one behind, or top), always with a reason; `text` = the "table ready" message was sent. */
export type BookCmd =
  | ({do: 'book'} & Draft)
  | ({do: 'edit'; party: Id} & Partial<Draft> & {eta?: number})
  | {do: 'call'; size: number; name: string; etaMin: number; phone?: string; flags?: string[]; feats?: string[]; notes?: string}
  | {do: 'walk'; size: number; name: string; phone?: string; flags?: string[]; feats?: string[]; notes?: string}
  | {do: 'arrive'; party: Id}
  | {do: 'noshow'; party: Id}
  | {do: 'leave'; party: Id; why: Exclude<GoneWhy, 'noshow'>; note?: string}
  | {do: 'bump'; party: Id; to: 'up' | 'down' | 'top'; why: string}
  | {do: 'text'; party: Id}
/** Availability for a draft at its time: `spots` that can take it (tightest first), `taken` = how many of them other bookings in the window will need; `alts` = nearby times that work. */
export interface Avail {ok: boolean; at: number; spots: {id: Id; label: string; tables: Id[]; area: Id}[]; taken: number; why: string; alts: number[]}
export type AvailQ = Pick<Draft, 'size' | 'at' | 'durationMin' | 'feats' | 'area'> & {skip?: Id}
export type ResState = 'BOOKED' | 'LATE' | 'ARRIVED' | 'SEATED' | 'NO_SHOW' | 'CANCELLED'
export type BookAct = 'arrive' | 'seat' | 'noshow' | 'edit' | 'cancel'
/** One reservation row (the list, the timeline and the details read the same row). `table` = its own table, else where the plan puts it. */
export interface ResRow {party: Id; label: string; name: string; size: number; at: number; durationMin: number; state: ResState; lateMin: number; table: {label: string; tables: Id[]; planned: boolean} | null; area: Id | null; phone: string; notes: string; feats: string[]; flags: string[]; acts: BookAct[]}
export interface ResSlot {start: number; covers: number; rows: ResRow[]}
export interface BookFilter {state?: ResState | 'all' | 'open'; size?: [number, number]; area?: Id | 'all'; day?: number} // day = any ms in that local day (default today); open = booked, late or arrived
export interface BookView {slots: ResSlot[]; counts: Record<ResState, number>; covers: number; total: number}
/** One party in the priority order. `here` = at the door (a call-ahead past its ETA that has not checked in is listed, not here); `over` = waited past its quote. */
export interface QRow {party: Id; label: string; name: string; size: number; via: Via; kind: PType; flags: string[]; here: boolean; late: boolean; waitedMin: number; quotedMin: number | null; over: boolean; pts: number; why: Term[]; texted: number | null; noReply: boolean; rank: number}
/** A call-ahead still on its way (before its ETA). */
export interface CallRow {party: Id; label: string; name: string; size: number; eta: number; inMin: number; phone: string; flags: string[]}
export interface WaitView {rows: QRow[]; calls: CallRow[]}
export type BookFn<A extends unknown[], R> = (p: Policy, w: World, now: number, ...a: A) => R
export interface Booking {
  act: BookFn<[cmd: BookCmd], Outcome>
  avail: BookFn<[q: AvailQ], Avail>
  list: BookFn<[f?: BookFilter], BookView>
  wait: BookFn<[], WaitView>
}
declare module './kernel.ts' {
  interface Services {booking?: Booking}
}
