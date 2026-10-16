// The only door to the engine: `ask` calls an engine function with policy/world/now bound. The policy is a provided service (main.ts), `policyOf` reads it.
import {defaultPolicy} from '../contracts/index.ts'
import type {App, HostEngine, Policy} from '../contracts/index.ts'
declare module '../contracts/kernel.ts' {
  interface Services {policy?: Policy}
}
type Key = Exclude<keyof HostEngine, 'spots'>
type Rest<F> = F extends (p: never, w: never, n: never, ...a: infer A) => unknown ? A : never
type Out<F> = F extends (...a: never[]) => infer R ? R : never
type Fns = Record<string, ((...a: unknown[]) => unknown) | undefined>
/** The policy every view and engine call reads: the provided one, else the default. */
export const policyOf = (app: App): Policy => (app.services.policy as Policy | undefined) ?? defaultPolicy
/** Undefined when the engine does not (yet) provide `k`, so views degrade instead of throwing. */
export const ask = <K extends Key>(app: App, k: K, ...a: Rest<HostEngine[K]>): Out<HostEngine[K]> | undefined => {
  const {world, now} = app.store.state
  return (app.services.engine as unknown as Fns | undefined)?.[k]?.(policyOf(app), world, now, ...a) as Out<HostEngine[K]> | undefined
}
