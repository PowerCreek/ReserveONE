import {having} from '../contracts/index.ts'
import type {Bucket, Components, Engine, World} from '../contracts/index.ts'
import {knobs} from './knobs.ts'
import {MIN, midnight} from './time.ts'
interface Ev {at: number; kind: 'in' | 'out'; covers: number; proj: boolean}
const ev = (at: number, kind: Ev['kind'], covers: number, proj: boolean): Ev => ({at, kind, covers, proj})
const ofSlot = (n: number, now: number, s: Components['slot']): Ev[] => {
  const rows = [
    [s.seatedAt <= now, ev(s.seatedAt, 'in', n, false)],
    [s.endedAt !== undefined, ev(s.endedAt ?? 0, 'out', n, false)],
    [s.endedAt === undefined && s.status !== 'COMPLETED', ev(Math.max(s.turnAt, now), 'out', n, true)],
  ] as const
  return rows.filter(([on]) => on).map(([, e]) => e)
}
/** Observed (seated / ended) and projected (turn times, due arrivals; overdue and late project to now) cover movements. */
export const events = (w: World, now: number): Ev[] => [
  ...having(w, 'slot').flatMap(s => ofSlot(w.ents[s.slot.party]?.party?.size ?? 0, now, s.slot)),
  ...having(w, 'party', 'reservation').filter(r => r.reservation.status === 'BOOKED' || r.reservation.status === 'ARRIVED').map(r => ev(Math.max(r.reservation.at, now), 'in', r.party.size, true)),
]
const sum = (xs: Ev[]) => xs.reduce((n, x) => n + x.covers, 0)
const bucket = (evs: Ev[], start: number, end: number, cur: boolean): Bucket => {
  const es = evs.filter(x => x.at >= start && x.at < end)
  const i = es.filter(x => x.kind === 'in')
  const o = es.filter(x => x.kind === 'out')
  return {start, end, now: cur, proj: es.some(x => x.proj), inCovers: sum(i), inParties: i.length, outCovers: sum(o), outParties: o.length, net: sum(i) - sum(o)}
}
/** Rows of `iv`-minute buckets aligned to local midnight: past rows, the current one, future rows. */
export const turnover: Engine['turnover'] = (_p, w, now, iv) => {
  const evs = events(w, now)
  const d0 = midnight(now)
  const cur = Math.floor((now - d0) / (iv * MIN))
  return Array.from({length: knobs.rows.past + knobs.rows.future + 1}, (_, i) => cur - knobs.rows.past + i).map(k => bucket(evs, d0 + k * iv * MIN, d0 + (k + 1) * iv * MIN, k === cur))
}
