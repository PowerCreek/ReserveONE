// The only doors to the engine and the world: `ask` calls an engine function with policy/world/now bound; `commit` applies patches and bumps rev.
import {defaultPolicy} from '../contracts/index.ts'
import type {App, Engine, Patch} from '../contracts/index.ts'
import {ui} from './state.ts'
type Key = Exclude<keyof Engine, 'spots'>
type Rest<F> = F extends (p: never, w: never, n: never, ...a: infer A) => unknown ? A : never
type Out<F> = F extends (...a: never[]) => infer R ? R : never
type Fns = Record<string, ((...a: unknown[]) => unknown) | undefined>
/** Undefined when the engine does not (yet) provide `k`, so views degrade instead of throwing. */
export const ask = <K extends Key>(app: App, k: K, ...a: Rest<Engine[K]>): Out<Engine[K]> | undefined => {
  const {world, now} = app.store.state
  return (app.services.engine as unknown as Fns | undefined)?.[k]?.(defaultPolicy, world, now, ...a) as Out<Engine[K]> | undefined
}
export const commit = (app: App, ps: Patch[]) => (app.apply(ps), ui(app).rev++)
