import type {Ent, TStatus} from '../contracts/index.ts'
type T = Ent<'table'>
const why: Record<TStatus, (t: T) => string | undefined> = {
  blocked_private: t => `${t.table.label} is blocked (private event)`,
  occupied: t => `${t.table.label} is occupied by another party`,
  lapsed: t => `${t.table.label} is past its turn: clear it first`,
  available: () => undefined,
}
const cap = (ts: T[], size: number) => (ts.reduce((n, t) => n + t.table.capacity, 0) < size ? `Capacity too small for party of ${size}` : undefined)
/** First reason these tables cannot take the party, or undefined. */
export const refuse = (ts: T[], size: number): string | undefined => ts.map(t => why[t.table.status](t)).find(Boolean) ?? cap(ts, size)
