// The only door to the engine: `ask` calls an engine function with policy/world/now bound. The policy is a provided service (main.ts), `policyOf` reads it.
import {defaultPolicy} from '../contracts/index.ts'
import type {App, HostEngine, Policy} from '../contracts/index.ts'
import {raw} from '../kernel/store.ts'
import {memo} from './memo.ts'
declare module '../contracts/kernel.ts' {
  interface Services {policy?: Policy}
}
type Key = Exclude<keyof HostEngine, 'spots'>
type Rest<F> = F extends (p: never, w: never, n: never, ...a: infer A) => unknown ? A : never
type Out<F> = F extends (...a: never[]) => infer R ? R : never
type Fns = Record<string, ((...a: unknown[]) => unknown) | undefined>
/** The policy every view and engine call reads: the provided one, else the default. */
export const policyOf = (app: App): Policy => (app.services.policy as Policy | undefined) ?? defaultPolicy
/** The pure reads: computed once per (world signature, now-minute, args) in the memo seam, however many panels ask. Writers (act, ask, seat, spawn, tick, reconcile) are never remembered. */
const READS = new Set<Key>(['board', 'stand', 'eta', 'fit', 'alerts', 'holds', 'modeAt', 'rotate', 'bus', 'outlook', 'assign', 'serverFor', 'strategy'])
const call = (app: App, k: Key, a: unknown[]) => {
  const {world, now} = app.store.state
  return (app.services.engine as unknown as Fns | undefined)?.[k]?.(policyOf(app), raw(world), now, ...a) // the engine only reads: hand it the plain world, not a Proxy that wraps every property
}
/** Undefined when the engine does not (yet) provide `k`, so views degrade instead of throwing. */
export const ask = <K extends Key>(app: App, k: K, ...a: Rest<HostEngine[K]>): Out<HostEngine[K]> | undefined =>
  (READS.has(k) ? memo(app, policyOf(app), k, a, () => call(app, k, a)) : call(app, k, a)) as Out<HostEngine[K]> | undefined
