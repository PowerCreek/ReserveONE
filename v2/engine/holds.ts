import {having} from '../contracts/index.ts'
import type {Components, Id, Policy, World} from '../contracts/index.ts'
import {MIN} from './time.ts'
export interface Hold {table: Id; start: number; end: number}
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
    .map(e => ({table: e.reservation.table!, start: e.reservation.at, end: e.reservation.at + e.reservation.durationMin * MIN}))
const ofEvents = (p: Policy, w: World): Hold[] =>
  having(w, 'event').filter(e => !e.event.reclaimed).flatMap(e => e.event.tables.map(table => ({table, start: e.event.start - p.alerts.prepMin * MIN, end: e.event.end})))
/** Time windows a table is promised away: live reservations with a table, plus private events (prep lock first). */
export const holds = (p: Policy, w: World, now: number, skip?: Id): Hold[] => [...ofRes(p, w, now, skip), ...ofEvents(p, w)]
