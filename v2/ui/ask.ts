// The only door to the engine: `ask` calls an engine function with policy/world/now bound.
import {defaultPolicy} from '../contracts/index.ts'
import type {App, HostEngine} from '../contracts/index.ts'
type Key = Exclude<keyof HostEngine, 'spots'>
type Rest<F> = F extends (p: never, w: never, n: never, ...a: infer A) => unknown ? A : never
type Out<F> = F extends (...a: never[]) => infer R ? R : never
type Fns = Record<string, ((...a: unknown[]) => unknown) | undefined>
/** Undefined when the engine does not (yet) provide `k`, so views degrade instead of throwing. */
export const ask = <K extends Key>(app: App, k: K, ...a: Rest<HostEngine[K]>): Out<HostEngine[K]> | undefined => {
  const {world, now} = app.store.state
  return (app.services.engine as unknown as Fns | undefined)?.[k]?.(defaultPolicy, world, now, ...a) as Out<HostEngine[K]> | undefined
}
