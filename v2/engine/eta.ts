import type {Engine, Policy} from '../contracts/index.ts'
import {plan} from './fit.ts'
import {queueOrder} from './queue.ts'
/** Quotable window: floor to the seat quantum, two quanta wide (v1: 5-minute floor, +10). */
const span = (p: Policy, wait: number) => {
  const lo = Math.floor(Math.max(0, wait) / p.seat.quantumMin) * p.seat.quantumMin
  return {lo, hi: wait <= 0 ? 0 : lo + 2 * p.seat.quantumMin}
}
/** Walk-in quote: plan everyone already queued, then the new party, and read the last item. */
export const eta: Engine['eta'] = (p, w, now, size) => {
  const ahead = queueOrder(p, w).map(q => q.party.size)
  const it = plan(p, w, now, [...ahead, size]).slice(-1)[0]
  return {size, ahead: ahead.length, ready: it.ready, none: it.code === 'NO_TABLE', waitMin: it.waitMin, ...span(p, it.waitMin), label: it.label, at: it.spot ? it.at : null}
}
