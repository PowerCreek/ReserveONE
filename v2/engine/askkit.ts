// Test-only fixtures for the re-seat lane (not exported from index.ts).
import type {Entity, TStatus, World} from '../contracts/index.ts'
import {ask} from './ask.ts'
import {apply} from './patch.ts'
import {N, P, party, table, world} from './testkit.ts'
/** A tagged table. */
export const tagged = (id: string, cap: number, tags: string[], status: TStatus = 'available'): Entity => ({...table(id, cap, status), feat: {tags}})
/** Room: d1 by the door (draft), q1 quiet, a1 accessible, l1 loud; Garcia (pty1, 2) already led to d1. */
export const room = (stage: 'arrived' | 'seated' = 'arrived') => world([
  tagged('d1', 2, ['door']), tagged('q1', 2, ['quiet', 'window']), tagged('a1', 2, ['accessible']), tagged('l1', 4, ['loud']),
  party(1, 'W', 2, 'Garcia', stage === 'arrived' ? {offer: {spot: 'd1', step: 'exact', gives: [], lacks: [], at: N, status: 'accepted'}} : {}),
  ...(stage === 'seated' ? [{id: 's1', slot: {table: 'd1', party: 'pty1', seatedAt: N, turnAt: N + 3600000, status: 'ACTIVE' as const}}] : []),
].map(e => (stage === 'seated' && e.id === 'd1' ? {...e, table: {...e.table!, status: 'occupied' as const, waiter: 'w1'}} : e)))
/** Party pty1 raises `reason`; the world after the request lands. */
export const asking = (w: World, reason: string): World => { const r = ask(P, w, N, 'pty1', reason); return apply(w, r.ok ? r.patches : []) }
