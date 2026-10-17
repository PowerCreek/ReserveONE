// Bookings read models (lane U14, E1): availability of a draft against the floor and the other bookings, and the reservation list by time slot.
import {bookOf, having, partsOf} from '../contracts/index.ts'
import type {Avail, AvailQ, BookAct, BookFilter, BookView, Ent, Entity, Id, Policy, ResRow, ResSlot, ResState, World} from '../contracts/index.ts'
import type {Pty} from './ents.ts'
import {spots} from './spots.ts'
import {mergesOf} from './merge.ts'
import {tableFreeAt} from './avail.ts'
import {clear, holds} from './reserved.ts'
import {selfSeated} from './seatcheck.ts'
import {areaOf} from './section.ts'
import {planned} from './plan.ts'
import {line} from './queue.ts'
import {intakeOf} from './bookrank.ts'
import {MIN, midnight} from './time.ts'
type Spot = Ent<'spot'>
const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5)
// ---- availability: the spots that can take the draft, minus the ones other bookings in its window (and the door, when it is soon) will need
const usable = (p: Policy, w: World) => (s: Spot) => s.spot.status !== 'blocked_private' && !s.spot.tables.some(t => selfSeated(p, w.ents[t]!))
const suits = (w: World, q: AvailQ) => (s: Spot) => s.spot.capacity >= q.size && (s.spot.tables.length > 1 || (w.ents[s.id]?.table?.min ?? 1) <= q.size) &&
  (!q.area || areaOf(w.ents[s.spot.tables[0]!]) === q.area) && (q.feats ?? []).every(f => s.spot.feats?.includes(f))
const tight = (a: Spot, b: Spot) => a.spot.capacity - b.spot.capacity || a.spot.tables.length - b.spot.tables.length || (a.id < b.id ? -1 : 1)
/** Singles and link groups; tables pushed together only when no single spot is big enough. */
const pool = (p: Policy, w: World, q: AvailQ): Spot[] => {
  const one = spots(w).filter(usable(p, w)).filter(suits(w, q))
  return (one.length ? one : mergesOf(p, w, t => t.table.status !== 'blocked_private' && !selfSeated(p, t)).filter(usable(p, w)).filter(suits(w, q))).sort(tight)
}
interface Rival {size: number}
const dur = (p: Policy, q: AvailQ) => (q.durationMin ?? p.seat.turnDefault) * MIN
/** Table-less bookings overlapping the window, largest first (they claim spots before the draft); parties at the door too when the time is soon. */
const rivals = (p: Policy, w: World, now: number, q: AvailQ, at: number): Rival[] => [
  ...having(w, 'party', 'reservation').filter(e => e.id !== q.skip && e.reservation.table === null && ['BOOKED', 'ARRIVED'].includes(e.reservation.status))
    .filter(e => e.reservation.at < at + dur(p, q) && e.reservation.at + e.reservation.durationMin * MIN > at && now - e.reservation.at <= p.seat.lateGraceMin * MIN).map(e => ({size: e.party.size})),
  ...(at <= now + p.host.clock.aheadMin * MIN ? line(p, w).filter(e => e.id !== q.skip && !e.reservation).map(e => ({size: e.party.size})) : []),
].sort((a, b) => b.size - a.size)
const overlaps = (a: Spot) => (b: Spot) => a.spot.tables.some(t => b.spot.tables.includes(t))
/** Each rival takes the tightest open spot it fits; what is left is the draft's. */
const claim = (open: Spot[], rs: Rival[]): {left: Spot[]; taken: number} =>
  rs.reduce((acc, r) => ((s = acc.left.find(x => x.spot.capacity >= r.size)) => (s ? {left: acc.left.filter(x => !overlaps(s)(x)), taken: acc.taken + 1} : acc))(), {left: open, taken: 0})
interface Probe {p: Policy; w: World; now: number; q: AvailQ; all: Spot[]; free: (t: Ent<'table'>) => number; hs: ReturnType<typeof holds>}
const openAt = (x: Probe, at: number) => x.all.filter(s => s.spot.tables.every(t => x.free(x.w.ents[t] as Ent<'table'>) <= at) && clear(x.hs, s.spot.tables, at, dur(x.p, x.q), x.p.seat.resetMin * MIN) === at)
const check = (x: Probe, at: number) => claim(openAt(x, at), rivals(x.p, x.w, x.now, x.q, at))
const WHY: [(a: {n: number; open: number; left: number}) => boolean, (a: {n: number; open: number; left: number; t: string; q: AvailQ}) => string][] = [
  [a => !a.n, a => `No table takes a party of ${a.q.size}${a.q.area ? ` in ${a.q.area}` : ''}${a.q.feats?.length ? ` with ${a.q.feats.join(', ')}` : ''}`],
  [a => !a.open, a => `Every fitting table is booked or seated at ${a.t}`],
  [a => !a.left, a => `Other bookings at ${a.t} need every fitting table`],
  [() => true, a => `${a.left} of ${a.n} fitting spots free at ${a.t}`],
]
const near = (x: Probe, at: number) => {
  const step = bookOf(x.p).slotMin / 2
  return Array.from({length: 16}, (_, i) => at + (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1) * step * MIN).filter(t => t >= x.now && check(x, t).left.length).slice(0, bookOf(x.p).altMax).sort((a, b) => a - b)
}
export const avail = (p: Policy, w: World, now: number, q: AvailQ): Avail => {
  const x: Probe = {p, w, now, q, all: pool(p, w, q), free: tableFreeAt(p, w, now), hs: holds(p, w, now, q.skip)}
  const open = openAt(x, q.at)
  const {left, taken} = claim(open, rivals(p, w, now, q, q.at))
  const a = {n: x.all.length, open: open.length, left: left.length, t: hhmm(q.at), q}
  return {ok: !!left.length, at: q.at, spots: left.map(s => ({id: s.id, label: s.spot.label, tables: s.spot.tables, area: areaOf(w.ents[s.spot.tables[0]!])})), taken, why: WHY.find(([t]) => t(a))![1](a), alts: left.length ? [] : near(x, q.at)}
}

// ---- reservation list: one row per booking (cancelled ones keep theirs in `intake.was`), grouped into time slots
type Res = NonNullable<Entity['reservation']>
const resOf = (e: Entity): Res | undefined => e.reservation ?? (e.intake?.gone?.why === 'cancel' ? e.intake.was : undefined)
const STATE: Record<Res['status'], (p: Policy, r: Res, now: number) => ResState> = {
  BOOKED: (p, r, now) => (now - r.at > p.seat.lateGraceMin * MIN ? 'LATE' : 'BOOKED'), ARRIVED: () => 'ARRIVED', QUEUED: () => 'ARRIVED', SEATED: () => 'SEATED', NO_SHOW: () => 'NO_SHOW',
}
const stateOf = (p: Policy, e: Entity, r: Res, now: number): ResState => (e.reservation ? STATE[r.status](p, r, now) : 'CANCELLED')
const ACTS: Record<ResState, BookAct[]> = {BOOKED: ['arrive', 'noshow', 'edit', 'cancel'], LATE: ['arrive', 'noshow', 'edit', 'cancel'], ARRIVED: ['seat', 'edit', 'cancel'], SEATED: [], NO_SHOW: [], CANCELLED: []}
const label = (w: World, ids: Id[]) => ids.map(t => w.ents[t]?.table?.label ?? t).join('+')
const tableOf = (w: World, r: Res, plan: Map<Id, Id[]>, id: Id): ResRow['table'] =>
  r.table ? {label: label(w, partsOf(w, r.table)), tables: partsOf(w, r.table), planned: false} : plan.get(id)?.length ? {label: label(w, plan.get(id)!), tables: plan.get(id)!, planned: true} : null
const rowOf = (p: Policy, w: World, now: number, plan: Map<Id, Id[]>) => (e: Pty): ResRow => {
  const r = resOf(e)!
  const i = intakeOf(e)
  const state = stateOf(p, e, r, now)
  const table = tableOf(w, r, plan, e.id)
  return {party: e.id, label: e.party.label, name: e.party.name, size: e.party.size, at: r.at, durationMin: r.durationMin, state, lateMin: state === 'LATE' ? Math.floor((now - r.at) / MIN) : 0,
    table, area: i.area ?? (table ? areaOf(w.ents[table.tables[0]!]) : null), phone: r.phone, notes: r.notes, feats: i.feats, flags: i.flags, acts: ACTS[state]}
}
const OPEN: ResState[] = ['BOOKED', 'LATE', 'ARRIVED']
const keep = (f: BookFilter) => (r: ResRow) => (!f.state || f.state === 'all' || (f.state === 'open' ? OPEN.includes(r.state) : r.state === f.state))
const sized = (f: BookFilter) => (r: ResRow) => !f.size || (r.size >= f.size[0] && r.size <= f.size[1])
const inArea = (f: BookFilter) => (r: ResRow) => !f.area || f.area === 'all' || r.area === f.area
const slotOf = (p: Policy, at: number) => Math.floor(at / (bookOf(p).slotMin * MIN)) * bookOf(p).slotMin * MIN
const slots = (p: Policy, rs: ResRow[]): ResSlot[] =>
  [...rs.reduce((m, r) => m.set(slotOf(p, r.at), [...(m.get(slotOf(p, r.at)) ?? []), r]), new Map<number, ResRow[]>())].sort(([a], [b]) => a - b)
    .map(([start, rows]) => ({start, rows, covers: rows.filter(r => r.state !== 'CANCELLED' && r.state !== 'NO_SHOW').reduce((n, r) => n + r.size, 0)}))
const NONE: Record<ResState, number> = {BOOKED: 0, LATE: 0, ARRIVED: 0, SEATED: 0, NO_SHOW: 0, CANCELLED: 0}
/** The day's bookings (`f.day`, default today) by slot; `counts` per state across the day before the state filter (the filter chips). */
export const list = (p: Policy, w: World, now: number, f: BookFilter = {}): BookView => {
  const day = midnight(f.day ?? now)
  const plan = new Map(planned(p, w, now).map(x => [x.party, x.tables]))
  const all = (having(w, 'party') as Pty[]).filter(e => resOf(e) && midnight(resOf(e)!.at) === day).map(rowOf(p, w, now, plan)).filter(sized(f)).filter(inArea(f))
  const shown = all.filter(keep(f)).sort((a, b) => a.at - b.at || (a.party < b.party ? -1 : 1))
  return {slots: slots(p, shown), counts: all.reduce((m, r) => ({...m, [r.state]: m[r.state] + 1}), NONE), covers: shown.filter(r => OPEN.includes(r.state) || r.state === 'SEATED').reduce((n, r) => n + r.size, 0), total: shown.length}
}
