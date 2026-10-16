// Kernel public API (C6-C8): fluent App, Proxy store, MutationObserver binders, factories, rule interpreter.
import type {Components, Entity, Id, Patch, World} from './model.ts'
import type {Engine} from './engine.ts'
export type Off = () => void
/** Lane C augments with `declare module '../contracts/kernel.ts' { interface UiState {...} }`; no cross-lane edits. */
export interface UiState {}
export interface State {world: World; now: number; ui: UiState}
export interface Store<S extends object> {
  readonly state: S // deep Proxy; every write notifies watchers
  watch(path: string, fn: (v: unknown) => void, immediate?: boolean): Off // dotted path; fires on writes at/under/above it
}
export interface Binder {attr: string; apply(el: Element, v: unknown): void} // `attr="state.path"` on an element binds it; MutationObserver attaches/detaches
export type Sel = {[K in keyof Components]?: {[F in keyof Components[K]]?: unknown | {eq?: unknown; ne?: unknown; gt?: number; gte?: number; lt?: number; lte?: number; in?: unknown[]}}}
export interface Rule {id: string; when: Sel; require?: Sel; apply?: Record<string, unknown>; msg?: string}
export interface Verdict {ok: boolean; msgs: string[]; applied: Record<string, unknown>[]}
export interface Factories {
  entity<K extends keyof Components>(id: Id, parts: Pick<Components, K>): {id: Id} & Pick<Components, K>
  component<K extends keyof Components>(k: K, defaults: Components[K]): (over?: Partial<Components[K]>) => Components[K]
}
export interface Services {engine: Engine; rules: {run(rules: Rule[], ent: Entity): Verdict}; make: Factories}
export interface App {
  readonly store: Store<State>
  readonly services: Services
  use(p: Plugin): App
  provide<K extends keyof Services>(k: K, part: Partial<Services[K]>): App
  binder(b: Binder): App
  view(fn: (el: Element, app: App) => void): App // rendered on mount
  act(name: string, fn: (app: App, ev: Event) => void): App // `data-act="name"` click delegation
  apply(ps: Patch[]): App // apply engine patches into the store
  mount(el: Element): App
}
export type Plugin = (app: App) => void
export interface AppStatic {create(init: State): App}
