// MutationObserver binder runtime (C8): binds `[attr]` elements as they enter the DOM, unbinds as they leave.
import type {Binder, Off, State, Store} from '../contracts/index.ts'
const hits = (nodes: Iterable<Node>, sel: string) =>
  [...nodes].filter((n): n is Element => n.nodeType === 1).flatMap(n => [n, ...n.querySelectorAll(sel)]).filter(e => e.matches(sel))
export function observe(root: Element, store: Store<State>, binders: Binder[]): Off {
  const sel = binders.map(b => `[${b.attr}]`).join(',')
  const live = new WeakMap<Element, Off[]>()
  const wire = (el: Element, b: Binder) => store.watch(el.getAttribute(b.attr)!, v => b.apply(el, v), true)
  const bind = (el: Element) => live.has(el) || live.set(el, binders.filter(b => el.hasAttribute(b.attr)).map(b => wire(el, b)))
  const unbind = (el: Element) => (live.get(el)?.forEach(off => off()), live.delete(el))
  const mo = new MutationObserver(rs => rs.forEach(r => (hits(r.removedNodes, sel).forEach(unbind), hits(r.addedNodes, sel).forEach(bind))))
  hits([root], sel).forEach(bind)
  mo.observe(root, {childList: true, subtree: true})
  return () => (mo.disconnect(), hits([root], sel).forEach(unbind))
}
