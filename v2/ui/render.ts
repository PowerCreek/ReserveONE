// C8: one factory turns a draw function into a data-* binder. Output is cached, and a change is morphed into the live nodes (only what differs is touched), so a button keeps its node across ticks and a press is never lost.
import type {App, Binder} from '../contracts/index.ts'
const ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ESC[c])
/** Reads `data-<k>` from the element that carries the clicked `data-act`. */
export const arg = (ev: Event, k: string) => (ev.target as Element).closest('[data-act]')?.getAttribute(`data-${k}`) ?? ''
/** Panel roots: a parent's morph keeps their attributes in step and leaves their insides to their own panel. */
const owned = new WeakSet<Node>()
const attrs = (a: Element, b: Element) => {
  ;[...a.attributes].filter(x => !b.hasAttribute(x.name)).forEach(x => a.removeAttribute(x.name))
  ;[...b.attributes].filter(x => a.getAttribute(x.name) !== x.value).forEach(x => a.setAttribute(x.name, x.value))
}
const like = (a: Node, b: Node) => a.nodeType === b.nodeType && a.nodeName === b.nodeName
/** Make `a` (live) look like `b` (fresh): same-kind nodes are updated in place, the rest replaced; extra live nodes go. */
const morph = (a: Node, b: Node): void => {
  if (a.nodeType !== 1) return void (a.nodeValue !== b.nodeValue && (a.nodeValue = b.nodeValue))
  attrs(a as Element, b as Element)
  owned.has(a) || kids(a, b)
}
const kids = (a: Node, b: Node) => {
  const [xs, ys] = [[...a.childNodes], [...b.childNodes]]
  ys.forEach((y, i) => (xs[i] && like(xs[i]!, y) ? morph(xs[i]!, y) : xs[i] ? a.replaceChild(y, xs[i]!) : a.appendChild(y)))
  xs.slice(ys.length).forEach(x => a.removeChild(x))
}
const fresh = (el: Element, html: string) => ((t = el.ownerDocument.createElement('template')) => ((t.innerHTML = html), t.content))()
/** While a pointer is down, paints of the panel under it wait for the release (the click lands on the node that was pressed). */
let pressed: Element | null = null
const later = new Set<() => void>()
const hold = (d: Document) => (owned.has(d) || (owned.add(d), d.addEventListener('pointerdown', e => (pressed = e.target as Element), true), d.addEventListener('pointerup', release, true), d.addEventListener('pointercancel', release, true)))
const release = () => setTimeout(() => ((pressed = null), [...later].forEach(f => (later.delete(f), f()))))
export const panel = (app: App, attr: string, draw: (app: App) => string): Binder => {
  const last = new WeakMap<Element, string>()
  const wait = new WeakSet<Element>()
  const paint = (el: Element): void => {
    if (pressed && el.contains(pressed)) return void later.add(() => paint(el))
    const html = draw(app)
    wait.delete(el)
    const had = last.has(el)
    last.get(el) !== html && (last.set(el, html), had ? kids(el, fresh(el, html)) : (el.innerHTML = html))
  }
  return {attr, apply: el => (owned.add(el), hold(el.ownerDocument), wait.has(el) || (wait.add(el), queueMicrotask(() => paint(el))))}
}
