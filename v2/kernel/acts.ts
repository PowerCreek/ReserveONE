// Event delegation to named acts: `data-act="name"` (click) and `data-on="input:name change:other"`.
import type {App} from '../contracts/index.ts'
export type Acts = Record<string, (a: App, e: Event) => void>
const types = ['click', 'input', 'change', 'keydown', 'keyup', 'submit']
const attrOf = (e: Event, attr: string) => (e.target as Element).closest?.(`[${attr}]`)?.getAttribute(attr) ?? ''
const named = (e: Event): string[] => [
  ...(e.type === 'click' ? [attrOf(e, 'data-act')] : []),
  ...attrOf(e, 'data-on').split(/\s+/).map(p => p.split(':')).filter(([t]) => t === e.type).map(([, n]) => n),
]
/** The `data-each` row key an event came from (for acts on list rows). */
export const keyOf = (e: Event) => (e.target as Element).closest('[data-key]')?.getAttribute('data-key') ?? null
export const delegate = (root: Element, app: App, acts: Acts) =>
  types.forEach(t => root.addEventListener(t, e => named(e).forEach(n => acts[n]?.(app, e))))
