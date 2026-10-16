// Time windows tables are promised away (E1): live reservations with a table, plus private events. Kept apart from the standing holds (holds.ts) so the planner can read them without the rotation.
import {having, partsOf} from '../contracts/index.ts'
import type {Components, Id, Policy, World} from '../contracts/index.ts'
import {MIN} from './time.ts'
export interface Hold {table: Id; start: number; end: number}
/** First time at or after `at` that a party needing `need` ms (and `rst` ms to reset) fits between the holds on these tables. */
export const clear = (hs: Hold[], tables: Id[], at: number, need: number, rst: number) =>
  hs.filter(h => tables.includes(h.table)).sort((a, b) => a.start - b.start).reduce((t, h) => (t + need > h.start && t < h.end + rst ? h.end + rst : t), at)
type Res = Components['reservation']
const live: Record<Res['status'], (r: Res, now: number, grace: number) => boolean> = {
  BOOKED: (r, now, grace) => now - r.at <= grace * MIN,
  ARRIVED: () => true,
  SEATED: () => false,
  NO_SHOW: () => false,
  QUEUED: () => false,
}
const ofRes = (p: Policy, w: World, now: number, skip?: Id): Hold[] =>
  having(w, 'party', 'reservation').filter(e => e.id !== skip && e.reservation.table !== null && live[e.reservation.status](e.reservation, now, p.seat.lateGraceMin))
    .flatMap(e => partsOf(w, e.reservation.table!).map(table => ({table, start: e.reservation.at, end: e.reservation.at + e.reservation.durationMin * MIN})))
const ofEvents = (p: Policy, w: World): Hold[] =>
  having(w, 'event').filter(e => !e.event.reclaimed).flatMap(e => e.event.tables.map(table => ({table, start: e.event.start - p.alerts.prepMin * MIN, end: e.event.end})))
/** Time windows a table is promised away: live reservations with a table, plus private events (prep lock first). */
export const holds = (p: Policy, w: World, now: number, skip?: Id): Hold[] => [...ofRes(p, w, now, skip), ...ofEvents(p, w)]

