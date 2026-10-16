import {having} from '../contracts/index.ts'
import type {Ent, Id, Policy, TStatus, World} from '../contracts/index.ts'
import {expand} from './spots.ts'
import {MIN} from './time.ts'
/** Mean ACTIVE seating length clamped to policy.seat.turnMin; policy default when nobody is seated. */
export const avgTurn = (p: Policy, w: World) => {
  const a = having(w, 'slot').filter(s => s.slot.status === 'ACTIVE')
  const mean = a.reduce((n, s) => n + (s.slot.turnAt - s.slot.seatedAt) / MIN, 0) / a.length
  return a.length ? Math.min(p.seat.turnMin[1], Math.max(p.seat.turnMin[0], mean)) : p.seat.turnDefault
}
const turns = (w: World) => having(w, 'slot').filter(s => s.slot.status !== 'COMPLETED').flatMap(s => expand(w, [s.slot.table]).map(t => [t, s.slot.turnAt] as const)).reduce<Record<Id, number>>((m, [t, at]) => ({...m, [t]: Math.max(m[t] ?? 0, at)}), {})
interface X {p: Policy; now: number; turn: number; t: number}
const when: Record<TStatus, (x: X) => number> = {
  available: x => x.now,
  lapsed: x => x.now + x.p.seat.lapsedClearMin * MIN,
  occupied: x => (x.t ? Math.max(x.t + x.p.seat.resetMin * MIN, x.now + x.p.seat.quantumMin * MIN) : x.now + (x.turn / 2) * MIN),
  blocked_private: x => x.now, // excluded from the pool before this is asked
}
/** Earliest time each spot can start a new party (SPEC §3 availableAt). */
export const freeAt = (p: Policy, w: World, now: number) => {
  const turn = avgTurn(p, w)
  const at = turns(w)
  return (s: Ent<'spot'>) => when[s.spot.status]({p, now, turn, t: Math.max(0, ...s.spot.tables.map(i => at[i] ?? 0))})
}
/** Earliest time one table can start a new party: now when available, else when its party leaves (merged groups free together). */
export const tableFreeAt = (p: Policy, w: World, now: number) => {
  const turn = avgTurn(p, w)
  const at = turns(w)
  return (t: Ent<'table'>) => when[t.table.status]({p, now, turn, t: at[t.id] ?? 0})
}
