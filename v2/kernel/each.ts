// `data-each="path"` list rendering keyed by id. Child `<template>` is stamped per row; `$` / `$.x` in data-* values
// of the row becomes `<path>.<seg>` / `<path>.<seg>.x`. `data-has="table,pos"` keeps only entities having those components.
type Row = {seg: string; key: string}
const rows = (v: unknown, has: string[]): Row[] =>
  Object.entries((v ?? {}) as Record<string, any>)
    .filter(([, it]) => has.every(k => it?.[k] != null))
    .map(([seg, it]) => ({seg, key: String(it?.id ?? seg)}))
const rebase = (el: Element, at: string) =>
  [...el.attributes].filter(a => a.name.startsWith('data-') && /^\$(\.|$)/.test(a.value)).forEach(a => el.setAttribute(a.name, at + a.value.slice(1)))
const stamp = (tpl: HTMLTemplateElement, r: Row, path: string) => {
  const el = tpl.content.firstElementChild!.cloneNode(true) as Element
  ;[el, ...el.querySelectorAll('*')].forEach(e => rebase(e, `${path}.${r.seg}`))
  Object.entries({'data-key': r.key, 'data-seg': r.seg}).forEach(([k, x]) => el.setAttribute(k, x))
  return el
}
const mine = (host: Element) => [...host.children].filter(c => c.hasAttribute('data-key'))
const reuse = (old: Map<string, Element>, r: Row) => (old.get(r.key)?.getAttribute('data-seg') === r.seg ? old.get(r.key) : undefined)
export function render(host: Element, path: string, v: unknown) {
  const tpl = host.querySelector<HTMLTemplateElement>(':scope > template')
  const want = rows(v, (host.getAttribute('data-has') ?? '').split(',').filter(Boolean))
  const old = new Map(mine(host).map(el => [el.getAttribute('data-key')!, el]))
  const next = want.map(r => reuse(old, r) ?? (tpl ? stamp(tpl, r, path) : null)).filter((e): e is Element => !!e)
  mine(host).filter(el => !next.includes(el)).forEach(el => el.remove())
  const cur = mine(host)
  host.append(...(cur.every((el, i) => el === next[i]) ? next.slice(cur.length) : next))
}
