// Walk-ins and reservations (E1): what seating a walk-in now would take from reservations about to arrive. A reservation with no table of its own still needs a spot (a table, or tables pushed together) by its time.
import {having} from '../contracts/index.ts'
import type {Ent, Id, Policy, World} from '../contracts/index.ts'
import {spots} from './spots.ts'
import {merges} from './merge.ts'
import {freeAt} from './avail.ts'
import {MIN} from './time.ts'
type Party = Ent<'party' | 'reservation'>
const live = (p: Policy, now: number) => (e: Party) => e.reservation.status === 'ARRIVED' || (e.reservation.status === 'BOOKED' && now - e.reservation.at <= p.seat.lateGraceMin * MIN)
/** Reservations with no table of their own, arriving (or arrived) within clock.aheadMin, biggest party first. `skip` = the party being seated (its own reservation is not competition). */
export const due = (p: Policy, w: World, now: number, skip?: Id): Party[] =>
  having(w, 'party', 'reservation').filter(e => e.id !== skip && e.reservation.table === null && live(p, now)(e) && e.reservation.at <= now + p.host.clock.aheadMin * MIN)
    .sort((a, b) => b.party.size - a.party.size || a.reservation.at - b.reservation.at)
type Left = {used: Id[]; short: Id[]}
const none = (): string[] => []
/** `keeper(...)(taken)` = the due reservations left without a spot if the `taken` tables go elsewhere now (beyond those already short). Greedy: largest party first, tightest spot free by its time. */
export const keeper = (p: Policy, w: World, now: number, skip?: Id) => {
  const rs = due(p, w, now, skip)
  const at = freeAt(p, w, now)
  const pool = rs.length ? [...spots(w), ...merges(p, w)].filter(s => s.spot.status !== 'blocked_private') : []
  const tight = (a: Ent<'spot'>, b: Ent<'spot'>) => +!!a.spot.last - +!!b.spot.last || a.spot.capacity - b.spot.capacity || a.spot.tables.length - b.spot.tables.length
  const place = (a: Left, r: Party): Left => {
    const pick = pool.filter(s => s.spot.capacity >= r.party.size && at(s) <= r.reservation.at && !s.spot.tables.some(t => a.used.includes(t))).sort(tight)[0]
    return pick ? {...a, used: [...a.used, ...pick.spot.tables]} : {...a, short: [...a.short, r.id]}
  }
  const short = (taken: Id[]) => rs.reduce(place, {used: taken, short: none()}).short
  const base = rs.length ? short([]) : none()
  return (taken: Id[]): Id[] => (rs.length ? short(taken).filter(id => !base.includes(id)) : none())
}
