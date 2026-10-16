import type {App as AppT, AppStatic, Binder, Off, Patch, State, Store} from '../contracts/index.ts'
type Ents = Record<string, any>
const join = (base: string, k: string | symbol) => (base ? `${base}.${String(k)}` : String(k))
const near = (a: string, b: string) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.')
const read = (o: any, path: string) => path.split('.').reduce((v, k) => v?.[k], o)
export function createStore<S extends object>(init: S, subs = new Set<(p: string) => void>()): Store<S> {
  const lift = (v: any, path: string): any => (v && typeof v === 'object' ? new Proxy(v, trap(path)) : v)
  const trap = (base: string): ProxyHandler<any> => ({
    get: (t, k, r) => lift(Reflect.get(t, k, r), join(base, k)),
    set: (t, k, v, r) => Reflect.set(t, k, v, r) && (subs.forEach(s => s(join(base, k))), true),
  })
  const watch = (path: string, fn: (v: unknown) => void, now = false): Off => {
    const sub = (p: string) => near(p, path) && fn(read(init, path))
    subs.add(sub)
    now && fn(read(init, path))
    return () => subs.delete(sub)
  }
  return {state: lift(init, ''), watch}
}
const base = (el: HTMLElement) => (el.dataset.base ??= el.className)
const builtin: Binder[] = [
  {attr: 'data-text', apply: (el, v) => (el.textContent = String(v ?? ''))},
  {attr: 'data-class', apply: (el, v) => (el.className = `${base(el as HTMLElement)} ${v ?? ''}`)},
]
const found = (nodes: NodeList, sel: string) =>
  [...nodes].filter(n => n.nodeType === 1).flatMap(n => [n as Element, ...(n as Element).querySelectorAll(sel)]).filter(e => e.matches(sel))
function observe(root: Element, store: Store<State>, binders: Binder[]) {
  const sel = binders.map(b => `[${b.attr}]`).join(',')
  const live = new WeakMap<Element, Off[]>()
  const bind = (el: Element) => live.set(el, binders.filter(b => el.hasAttribute(b.attr)).map(b => store.watch(el.getAttribute(b.attr)!, v => b.apply(el, v), true)))
  const unbind = (el: Element) => live.get(el)?.forEach(off => off())
  const mo = new MutationObserver(rs => rs.forEach(r => (found(r.addedNodes, sel).forEach(bind), found(r.removedNodes, sel).forEach(unbind))))
  mo.observe(root, {childList: true, subtree: true})
}
const ops: Record<Patch['op'], (ents: Ents, p: any) => unknown> = {
  set: (ents, p) => Object.assign(ents[p.id], p.parts),
  add: (ents, p) => (ents[p.ent.id] = p.ent),
  del: (ents, p) => delete ents[p.id],
}
export const App: AppStatic = {
  create(init) {
    const store = createStore(init), binders = [...builtin], views: ((el: Element, a: AppT) => void)[] = []
    const acts: Record<string, (a: AppT, e: Event) => void> = {}
    const services = {} as AppT['services']
    const app: AppT = {
      store, services,
      use: p => (p(app), app),
      provide: (k, part) => ((services[k] as object) = {...services[k], ...part}, app),
      binder: b => (binders.push(b), app),
      view: fn => (views.push(fn), app),
      act: (name, fn) => ((acts[name] = fn), app),
      apply: ps => (ps.forEach(p => ops[p.op](store.state.world.ents, p)), app),
      mount: el => {
        observe(el, store, binders)
        el.addEventListener('click', e => acts[(e.target as Element).closest('[data-act]')?.getAttribute('data-act') ?? '']?.(app, e))
        views.forEach(v => v(el, app))
        return app
      },
    }
    return app
  },
}
