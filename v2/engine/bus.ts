import {having} from '../contracts/index.ts'
import type {BusItem, Engine, Ent, Policy, Ranked, World} from '../contracts/index.ts'
import {secsOf} from './ents.ts'
import {MIN} from './time.ts'
import {pickIn, rotate} from './rotate.ts'
import {queueOrder} from './queue.ts'
import {spots} from './spots.ts'
type Staff = Ent<'staff'>
const dueAt = (w: World, s: Ent<'spot'>) => Math.min(...having(w, 'slot').filter(x => x.slot.status === 'LAPSED' && s.spot.tables.includes(x.slot.table)).map(x => x.slot.turnAt))
const row = (p: Policy, w: World, now: number, rk: Ranked[], ss: Staff[], sizes: number[]) => (s: Ent<'spot'>): BusItem => {
  const pk = pickIn(ss, rk, secsOf(w, s.spot.tables))
  const pos = rk.findIndex(r => r.staff === pk.staff)
  const due = dueAt(w, s)
  return {table: s.spot.tables[0], staff: pk.staff, waitedMin: Number.isFinite(due) ? Math.max(0, (now - due) / MIN) : 0,
    priority: sizes.filter(n => n <= s.spot.capacity).length * p.alerts.busDemand + p.alerts.busBase + (pos >= 0 ? (rk.length - pos) * p.alerts.busRank : 0)}
}
/** Dirty (lapsed) spots in clearing order: demand x weight + base + rotation bonus for the next-up server's tables; ties by longest dirty. */
export const bus: Engine['bus'] = (p, w, now) => {
  const make = row(p, w, now, rotate(p, w, now), having(w, 'staff'), queueOrder(p, w).map(q => q.party.size))
  return spots(w).filter(s => s.spot.status === 'lapsed').map(make).sort((a, b) => b.priority - a.priority || b.waitedMin - a.waitedMin)
}
