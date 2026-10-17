// Layered drawing helpers (shared by the iso view and the 2D plan): a layer is a <g> that owns its children and is touched only when its change key moves.
const memo = new WeakMap<Element, {keys: string[]; htmls: string[]}>()
/** Keep a layer of keyed items in step with `items` ([key, html]; empty html = nothing drawn): same keys in the same order patch only the items whose html changed, anything else repaints the layer. */
export const reconcile = (layer: Element, items: [string, string][]) => {
  const now = items.filter(x => x[1]), old = memo.get(layer)
  const same = old && old.keys.length === now.length && old.keys.every((k, i) => k === now[i]![0])
  same ? now.forEach((x, i) => old.htmls[i] !== x[1] && ((layer.children[i] as Element).outerHTML = x[1])) : (layer.innerHTML = now.map(x => x[1]).join(''))
  memo.set(layer, {keys: now.map(x => x[0]), htmls: now.map(x => x[1])})
  return same ? now.filter((x, i) => old.htmls[i] !== x[1]).length : now.length
}
const last = new WeakMap<Element, string>()
/** Set a layer's markup when its key changed; returns whether it did. */
export const fill = (layer: Element, key: string, html: () => string) => (last.get(layer) === key ? false : (last.set(layer, key), (layer.innerHTML = html()), true))
export const forget = (layer: Element) => (last.delete(layer), memo.delete(layer))
/** Swap one node for fresh markup. */
export const swap = (el: Element | null, html: string) => el && ((el.outerHTML = html), true)
/** A new svg group. */
export const group = (doc: Document, attrs: Record<string, string> = {}) => {
  const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  Object.entries(attrs).forEach(([k, v]) => g.setAttribute(k, v))
  return g
}

const sigs = new WeakMap<Element, {keys: string[]; sigs: string[]}>()
/** Like `reconcile`, but each item carries a cheap signature and builds its html only when the signature moved (same keys in the same order patch just those items). */
export const reconcileSig = (layer: Element, items: [string, string, () => string][]) => {
  const old = sigs.get(layer)
  const same = old && old.keys.length === items.length && old.keys.every((k, i) => k === items[i]![0])
  same ? items.forEach((x, i) => old.sigs[i] !== x[1] && ((layer.children[i] as Element).outerHTML = x[2]())) : (layer.innerHTML = items.map(x => x[2]()).join(''))
  sigs.set(layer, {keys: items.map(x => x[0]), sigs: items.map(x => x[1])})
}
