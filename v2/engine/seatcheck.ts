import type {Ent, Policy, TStatus} from '../contracts/index.ts'
type T = Ent<'table'>
const why: Record<TStatus, (t: T) => string | undefined> = {
  blocked_private: t => `${t.table.label} is blocked (private event)`,
  leased: t => `${t.table.label} is leased to another party`,
  occupied: t => `${t.table.label} is occupied by another party`,
  lapsed: t => `${t.table.label} is past its turn: clear it first`,
  available: () => undefined,
}
const cap = (ts: T[], size: number) => (ts.reduce((n, t) => n + t.table.capacity, 0) < size ? `Capacity too small for party of ${size}` : undefined)
const own = (p: Policy) => (t: T) => (p.seat.selfSeat.includes(t.table.shape) ? `${t.table.label} is first come, first served: the host does not seat it` : undefined)
/** Tables the host does not seat (policy.seat.selfSeat). */
export const selfSeated = (p: Policy, t: {table?: {shape: string}}) => p.seat.selfSeat.includes(t.table?.shape ?? '')
/** First reason these tables cannot take the party, or undefined. */
export const refuse = (p: Policy, ts: T[], size: number): string | undefined => ts.map(own(p)).find(Boolean) ?? ts.map(t => why[t.table.status](t)).find(Boolean) ?? cap(ts, size)
