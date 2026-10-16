// Deep-Proxy store (C8): every write under a path notifies watchers at/under/above it.
import type {Off, Store} from '../contracts/index.ts'
import {join, near, read} from './path.ts'
const RAW = Symbol('raw')
export const raw = <T>(v: T): T => (v as any)?.[RAW] ?? v // unwrap a store Proxy so proxies never nest
export function createStore<S extends object>(init: S): Store<S> {
  const subs = new Set<(p: string) => void>()
  const tell = (p: string) => [...subs].forEach(s => s(p))
  const lift = (v: any, path: string): any => (v && typeof v === 'object' ? new Proxy(v, trap(path)) : v)
  const trap = (base: string): ProxyHandler<any> => ({
    get: (t, k, r) => (k === RAW ? t : lift(Reflect.get(t, k, r), join(base, k))),
    set: (t, k, v) => {
      const next = raw(v)
      const same = k in t && Object.is(t[k], next)
      return Reflect.set(t, k, next) && (same || tell(join(base, k)), true)
    },
    deleteProperty: (t, k) => {
      const had = k in t
      return Reflect.deleteProperty(t, k) && (had && tell(join(base, k)), true)
    },
  })
  const state = lift(init, '')
  const watch = (path: string, fn: (v: unknown) => void, now = false): Off => {
    const sub = (p: string) => near(p, path) && fn(read(state, path))
    subs.add(sub)
    now && fn(read(state, path))
    return () => subs.delete(sub)
  }
  return {state, watch}
}
