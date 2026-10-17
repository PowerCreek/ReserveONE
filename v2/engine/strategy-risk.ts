// Risks and server share (lane E-S): reservations the plan cannot place or a move would strand, sizes locked out, an overloaded section, late bookings; covers now + planned per floor server.
import {having} from '../contracts/index.ts'
import type {Id} from '../contracts/index.ts'
import type {Move, Risk, Share} from '../contracts/strategy.ts'
import {ahead} from './rotate.ts'
import {MIN} from './time.ts'
import {labelOf, mins} from './strategy-ctx.ts'
import type {SCtx} from './strategy-ctx.ts'
type Moves = Record<number, Move | null>
const floor = (c: SCtx) => having(c.w, 'staff').filter(s => s.staff.active && !s.staff.area)
const holder = (c: SCtx, table: Id) => floor(c).find(s => s.staff.sections.includes(c.w.ents[table]?.table?.section ?? ''))?.id ?? null
const add = (m: Record<Id, number>, id: Id | null, n: number) => (id ? {...m, [id]: (m[id] ?? 0) + n} : m)
/** Covers seated now, by the table's recorded server, else its section holder. */
const seatedBy = (c: SCtx) => having(c.w, 'slot').filter(s => s.slot.status === 'ACTIVE').reduce((m, s) => add(m, c.w.ents[s.slot.table]?.table?.waiter ?? holder(c, s.slot.table), c.w.ents[s.slot.party]?.party?.size ?? 0), {} as Record<Id, number>)
/** Covers due within the horizon: the rotation's forecast for table-less reservations, plus booked tables by section holder. */
const plannedBy = (c: SCtx) => c.res.filter(r => !c.w.ents[r.party]?.reservation?.table ? false : r.at <= c.now + c.p.plan.horizonMin * MIN).reduce((m, r) => add(m, holder(c, r.tables[0]!), r.size), ahead(c.p, c.w, c.now, c.now + c.p.plan.horizonMin * MIN))
export const shareOf = (c: SCtx): Share[] => {
  const [now, planned] = [seatedBy(c), plannedBy(c)]
  return floor(c).map(s => ({staff: s.id, name: s.staff.name, now: now[s.id] ?? 0, planned: planned[s.id] ?? 0}))
}
const load = (s: Share) => s.now + s.planned
const section = (c: SCtx, share: Share[]): Risk[] => {
  const mean = share.reduce((n, s) => n + load(s), 0) / (share.length || 1)
  return share.filter(s => load(s) - mean > c.p.board.insight.imbalanceCovers).map(s => ({kind: 'section', text: `${s.name} carries ${load(s)} covers, ${Math.round(load(s) - mean)} over the floor average`}))
}
const unplaced = (c: SCtx): Risk[] => c.unplaced.map(r => ({kind: 'squeeze', text: `${labelOf(c, r.party)} (${r.size}) has no table in the plan at ${mins(c, r.at)}m`, party: r.party, size: r.size, at: mins(c, r.at)}))
const stranded = (c: SCtx, moves: Moves, sizes: number[]): Risk[] =>
  sizes.flatMap(s => (moves[s]?.cost ? c.keep(moves[s]!.tables).map(id => ({kind: 'squeeze' as const, text: `seating a ${s} at ${moves[s]!.label} squeezes ${labelOf(c, id)}`, party: id, size: s})) : []))
const wait = (c: SCtx, m: Move) => m.turn - Math.round(c.stay / MIN)
const lockout = (c: SCtx, moves: Moves, sizes: number[]): Risk[] =>
  sizes.filter(s => !moves[s] || wait(c, moves[s]!) > c.p.board.insight.droughtMin).map(s => ({kind: 'lockout', text: moves[s] ? `nothing fits a ${s} for ${wait(c, moves[s]!)}m` : `nothing fits a ${s}`, size: s}))
const late = (c: SCtx): Risk[] => having(c.w, 'party', 'reservation').filter(e => e.reservation.status === 'BOOKED' && e.reservation.at < c.now)
  .map(e => ({kind: 'late', text: `${e.party.label} is ${Math.round((c.now - e.reservation.at) / MIN)}m late`, party: e.id, size: e.party.size, at: -Math.round((c.now - e.reservation.at) / MIN)}))
export const risksOf = (c: SCtx, moves: Moves, sizes: number[], share: Share[]): Risk[] =>
  [...unplaced(c), ...stranded(c, moves, sizes), ...lockout(c, moves, [...new Set([...sizes, ...c.ctl.behind])]), ...section(c, share), ...late(c)]
