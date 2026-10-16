import type {Components, Policy} from '../contracts/index.ts'
import {MIN} from './time.ts'
export type EvState = 'RESERVED_PENDING' | 'BLOCKED_PREP' | 'ACTIVE_EVENT' | 'EXPIRING_WARNING' | 'EXPIRED_RECLAIMED'
/** What reconcile does in each state: lock the event's tables, give them back, or nothing. */
export const mode: Record<EvState, 'lock' | 'free' | 'none'> = {RESERVED_PENDING: 'none', BLOCKED_PREP: 'lock', ACTIVE_EVENT: 'lock', EXPIRING_WARNING: 'lock', EXPIRED_RECLAIMED: 'free'}
const marks = (p: Policy, e: Components['event']): [number, EvState][] =>
  [[e.start - p.alerts.prepMin * MIN, 'RESERVED_PENDING'], [e.start, 'BLOCKED_PREP'], [e.end - p.alerts.warnMin * MIN, 'ACTIVE_EVENT'], [e.end, 'EXPIRING_WARNING']]
/** Private-event lifecycle derived from time only (SPEC §8): the first boundary still ahead names the state. */
export const eventState = (p: Policy, e: Components['event'], now: number): EvState => marks(p, e).find(([t]) => now < t)?.[1] ?? 'EXPIRED_RECLAIMED'
