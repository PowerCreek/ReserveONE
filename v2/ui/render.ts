// C8: one factory turns a draw function into a data-* binder. Output is cached so unchanged HTML never replaces nodes (clicks survive ticks).
import type {App, Binder} from '../contracts/index.ts'
const ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ESC[c])
/** Reads `data-<k>` from the element that carries the clicked `data-act`. */
export const arg = (ev: Event, k: string) => (ev.target as Element).closest('[data-act]')?.getAttribute(`data-${k}`) ?? ''
export const panel = (app: App, attr: string, draw: (app: App) => string): Binder => {
  const last = new WeakMap<Element, string>()
  const wait = new WeakSet<Element>()
  const paint = (el: Element) => {
    const html = draw(app)
    wait.delete(el)
    last.get(el) !== html && (last.set(el, html), (el.innerHTML = html))
  }
  return {attr, apply: el => wait.has(el) || (wait.add(el), queueMicrotask(() => paint(el)))}
}
export const show: Binder = {attr: 'data-show', apply: (el, v) => el.classList.toggle('hidden', v !== el.getAttribute('data-pane'))}
