// Derived-read memo (the ui/desk seam): engine reads stay pure, this file remembers them by the identity of the world's components.
// `stamp(app)` = (world signature, now-minute): the signature mixes the identity of every entity and component, so any patch changes it;
// unit bodies are left out (they move every tick and no read below looks at them), so motion alone invalidates nothing.
import type {App} from '../contracts/index.ts'
import {raw} from '../kernel/store.ts'
const MIN = 60000
const ids = new WeakMap<object, number>()
let next = 1
/** A stable small number per object (changes when a patch replaces the object). */
export const tag = (o: unknown): number => (o && typeof o === 'object' ? (ids.get(o) ?? (ids.set(o, next), next++)) : 0)
const mix = (h: number, n: number) => (Math.imul(h, 31) + n) | 0
const sum = (s: string) => [...s].reduce((h, c) => mix(h, c.charCodeAt(0)), 7)
const entSig = (h: number, e: Record<string, unknown>) => Object.keys(e).reduce((a, k) => (k === 'body' ? mix(a, 1) : mix(mix(a, sum(k)), typeof e[k] === 'object' ? tag(e[k]) : sum(String(e[k])))), mix(h, tag(e)))
/** Signature of the parts of a world that engine reads depend on. */
export const sigOf = (w: {ents: Record<string, unknown>; nextParty: number}): number =>
  Object.values(w.ents).reduce<number>((h, e) => entSig(h, e as Record<string, unknown>), mix(tag(w), w.nextParty))
interface Mem {ver: number; at: number; sig: number; stamp: string; eng: unknown; pol: unknown; map: Map<string, unknown>; runs: Record<string, number>}
const mems = new WeakMap<App, Mem>()
/** One tracker per app: `ver` counts world writes (the watcher is registered on first use, before any cache exists), the signature is computed lazily once per `ver`. */
export const track = (app: App): Mem => mems.get(app) ?? ((m: Mem) => (mems.set(app, m), app.store.watch('world', () => m.ver++), m))({ver: 0, at: -1, sig: 0, stamp: '', eng: null, pol: null, map: new Map(), runs: {}})
const sigNow = (app: App, m: Mem) => (m.at === m.ver ? m.sig : ((m.at = m.ver), (m.sig = sigOf(raw(app.store.state.world) as never))))
/** The cache key every derived read and every gated panel shares: world signature + now-minute. */
export const stamp = (app: App): string => `${sigNow(app, track(app))}|${Math.floor(app.store.state.now / MIN)}`
/** Remember `f()` for (name, args) until the world or the minute changes (or the engine/policy service is swapped). */
export const memo = <T>(app: App, pol: unknown, name: string, args: unknown[], f: () => T): T => {
  const m = track(app)
  const [st, eng] = [stamp(app), app.services.engine]
  ;(m.stamp !== st || m.eng !== eng || m.pol !== pol) && (m.map.clear(), Object.assign(m, {stamp: st, eng, pol}))
  const k = `${name}${JSON.stringify(args)}`
  return (m.map.has(k) ? m.map.get(k) : ((m.runs[name] = (m.runs[name] ?? 0) + 1), m.map.set(k, f()).get(k))) as T
}
/** How many times each memoised read was really computed (tests, profiling). */
export const runs = (app: App): Record<string, number> => track(app).runs
/** A draw that is skipped while its key is unchanged: returns the last html. `count` reads how many real draws ran. */
export const gate = (key: () => string, draw: () => string) => {
  const last = {k: '', html: '', ok: false, n: 0}
  const f = () => ((k = key()) => (last.ok && last.k === k ? last.html : ((last.html = draw()), (last.k = k), (last.ok = true), last.n++, last.html)))()
  return Object.assign(f, {count: () => last.n})
}
/** A derived change counter `ui.<name>`: bumped on a write at/under/above any of `paths`, so a panel binds to the few keys it reads instead of all of `ui`. */
export const counter = (app: App, name: 'ctl' | 'bv' | 'nav', paths: string[]) =>
  paths.forEach(p => app.store.watch(p, () => ((u = app.store.state.ui as {[K in typeof name]?: number}) => (u[name] = (u[name] ?? 0) + 1))()))
const BOOK_READS = ['avail', 'list', 'wait'] as const
/** The booking desk's reads join the memo too (writes, `act`, stay as they were); the desk reads the plain world, not the store Proxy. Call once the booking service is provided. */
export const seam = (app: App) => {
  const b = app.services.booking
  b && app.provide('booking', Object.fromEntries(BOOK_READS.map(k => [k, (p: never, w: never, n: never, ...a: unknown[]) => memo(app, p, `bk:${k}`, a, () => (b[k] as (...x: unknown[]) => unknown)(p, raw(w), n, ...a))])) as never)
}
