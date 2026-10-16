import {having} from '../contracts/index.ts'
import type {Components, Ent, Id, Policy, Ranked, Service, World} from '../contracts/index.ts'
import type {Hold as Standing} from '../contracts/index.ts'
import {holdsOn} from './modes.ts'
import {rankStaff} from './rotate.ts'
import {areaOf, carveOf, cands} from './section.ts'
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

// ---- standing holds (service modes): who holds each table, not when a table is promised away (that is `holds` above)
type Staff = Ent<'staff'>
const best = (rk: Ranked[], cs: Staff[]) => rk.find(r => cs.some(s => s.id === r.staff))?.staff ?? null
/** Per mode flag: who holds the table (sectioned: best-ranked holder by the area's carve; rotation: its waiter) and which rule decided. */
const ways = {
  true: (p: Policy, w: World, ss: Staff[], rk: Ranked[], t: Ent<'table'>) => ({staff: best(rk, cands[carveOf(p, w, areaOf(t))](ss, t)), by: carveOf(p, w, areaOf(t))}),
  false: (_p: Policy, _w: World, _ss: Staff[], _rk: Ranked[], t: Ent<'table'>) => ({staff: t.table.waiter, by: 'rotation' as const}),
}
/** Standing holder of every table under the active mode (`Service.holds`). */
export const standing: Service['holds'] = (p, w, now) => {
  const [ss, rk, way] = [having(w, 'staff'), rankStaff(p, having(w, 'staff'), now), ways[String(holdsOn(p, w, now)) as 'true' | 'false']]
  return having(w, 'table').map((t): Standing => ({table: t.id, area: areaOf(t), ...way(p, w, ss, rk, t)}))
}
