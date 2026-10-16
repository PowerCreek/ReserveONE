// Fluent App builder (C7): every builder method is made by the one `fluent` factory; nothing edits the core.
import type {App as AppT, AppStatic, Binder, Plugin, Services} from '../contracts/index.ts'
import {delegate, type Acts} from './acts.ts'
import {builtin} from './binders.ts'
import {make} from './make.ts'
import {observe} from './observe.ts'
import {patch} from './patch.ts'
import {run} from './rules.ts'
import {createStore} from './store.ts'
type View = (el: Element, app: AppT) => void
const fluent = (back: () => AppT) => <A extends unknown[]>(f: (...a: A) => unknown) => (...a: A): AppT => (f(...a), back())
export const App: AppStatic = {
  create(init) {
    const store = createStore(init)
    const binders: Binder[] = [...builtin], views: View[] = [], acts: Acts = {}
    const services = {rules: {run}, make} as Services
    const f = fluent(() => app)
    const app: AppT = {
      store, services,
      use: f((p: Plugin) => p(app)),
      provide: f((k: keyof Services, part: object) => ((services[k] as object) = {...services[k], ...part})),
      binder: f((b: Binder) => binders.push(b)),
      view: f((v: View) => views.push(v)),
      act: f((n: string, fn: Acts[string]) => (acts[n] = fn)),
      apply: f((ps: Parameters<AppT['apply']>[0]) => patch(store.state.world.ents, ps)),
      mount: f((el: Element) => (observe(el, store, binders), delegate(el, app, acts), views.forEach(v => v(el, app)))),
    } as AppT
    return app
  },
}
