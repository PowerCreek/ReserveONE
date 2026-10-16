// Built-in binder table (C3): one entry per data-* attribute whose value is a store path. Extra binders: app.binder(b).
import type {Binder} from '../contracts/index.ts'
import {render} from './each.ts'
const base = (el: Element) => ((el as HTMLElement).dataset.base ??= el.className)
const lit = new Map<unknown, string | null>([[true, ''], [false, null], [null, null], [undefined, null]])
const attrOf = (v: unknown) => (lit.has(v) ? lit.get(v)! : String(v))
const setAttr = (el: Element, v: unknown) => {
  const n = el.getAttribute('data-as')!
  const s = attrOf(v)
  return s === null ? el.removeAttribute(n) : el.setAttribute(n, s)
}
export const builtin: Binder[] = [
  {attr: 'data-text', apply: (el, v) => (el.textContent = String(v ?? ''))},
  {attr: 'data-class', apply: (el, v) => (el.className = `${base(el)} ${v ?? ''}`.trim())},
  {attr: 'data-attr', apply: setAttr}, // `data-attr="ui.x" data-as="disabled"`; true -> present, false/null -> removed
  {attr: 'data-show', apply: (el, v) => ((el as HTMLElement).hidden = !v)},
  {attr: 'data-each', apply: (el, v) => render(el, el.getAttribute('data-each')!, v)},
]
