// Server preferences (wave 8): ONE chip and ONE editor, used by the Staff panel, the Dashboard server cards and the stand's offers.
// A chip says what a preference is about in policy labels, how firmly it holds, and its latest state (set / met / enforced / overridden, why as title).
// The editor's presets and custom form only dispatch `pref` / `unpref` through `run`; the engine decides what a preference does.
import type {App, Id, Policy, Pref, PrefMark, PrefOn, PrefRow, World} from '../contracts/index.ts'
import {run} from './act.ts'
import {policyOf} from './ask.ts'
import {arg, esc} from './render.ts'
import {uiOf} from './state.ts'
import {field, ghost, outline, primary} from './tone.ts'
/** `open` = the server whose custom form is shown (Staff tab); `quick` = the Dashboard server card showing its preset row. */
export interface PrefsUi {open: Id; quick: Id}
declare module '../contracts/kernel.ts' {
  interface UiState {prefs?: PrefsUi}
}
export interface Pc {p: Policy; w: World}
type State = PrefRow['state']
const pu = (app: App) => (uiOf(app).prefs ??= {open: '', quick: ''})

// ---- plain words from policy labels
const SHAPE: Record<string, string> = {rect: 'standard tables', booth: 'booths', stool: 'bar stools'}
const or = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}` : xs[0] ?? '')
const span = ([lo, hi]: [number, number]) => (lo === hi ? `${lo}` : hi >= 20 ? `${lo}+` : `${lo}–${hi}`)
const ABOUT: [keyof PrefOn, (p: Policy, v: never) => string][] = [
  ['area', (p, v: Id[]) => or(v.map(a => p.service.areas[a]?.label ?? a))], ['shape', (_p, v: string[]) => or(v.map(s => SHAPE[s] ?? s))],
  ['feats', (p, v: string[]) => `${or(v.map(f => p.host.feats[f]?.label ?? f))} tables`], ['cap', (_p, v: [number, number]) => `${span(v)}-seat tables`],
  ['size', (_p, v: [number, number]) => `for parties of ${span(v)}`],
]
/** "Grotto", "booths", "3+-seat tables for parties of 1–2". */
export const about = (p: Policy, on: PrefOn) => ABOUT.filter(([k]) => on[k] !== undefined).map(([k, f]) => (f as (p: Policy, v: unknown) => string)(p, on[k])).join(' ')
const VERB: Record<Pref['kind'], {say: string; icon: string; cls: string}> = {
  avoid: {say: 'Avoids', icon: '⊘', cls: 'border-rose-300 dark:border-rose-700'}, prefer: {say: 'Prefers', icon: '★', cls: 'border-emerald-300 dark:border-emerald-700'},
}
export const said = (p: Policy, x: Pref) => `${VERB[x.kind].say} ${about(p, x.on)}`
const GIVE: Record<Pref['give'], {say: string; hint: string}> = {
  firm: {say: 'firm', hint: 'Held unless every other server is bogged down too, or nobody else can take the table'},
  yield: {say: 'yields', hint: '"I\'ll do it if nobody can": held whenever anyone else can take the table'},
}
export const STATE: Record<State, {icon: string; say: string; cls: string}> = {
  set: {icon: '○', say: 'set', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100'},
  met: {icon: '✓', say: 'met', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'},
  enforced: {icon: '●', say: 'enforced', cls: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100'},
  overridden: {icon: '!', say: 'overridden', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'},
}

// ---- the one chip: kind + about + give + state; `edit` adds the give toggle and a remove button for that server
interface Opt {lead?: string; edit?: boolean}
const badge = (s: State, why: string) => `<span data-pstate="${s}" title="${esc(why)}" class="inline-flex items-center gap-0.5 rounded px-1 ${STATE[s].cls}"><span aria-hidden="true">${STATE[s].icon}</span>${STATE[s].say}</span>`
const giveOf = (who: Id, x: Pref, o: Opt) => (x.kind === 'prefer' ? '' : o.edit
  ? `<button type="button" data-act="pref-give" data-who="${esc(who)}" data-pid="${esc(x.id)}" title="${esc(`${GIVE[x.give].hint}. Click to switch.`)}" class="rounded px-1 underline decoration-dotted underline-offset-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-500 dark:hover:bg-slate-700">${GIVE[x.give].say}</button>`
  : `<span title="${esc(GIVE[x.give].hint)}">(${GIVE[x.give].say})</span>`)
const drop = (c: Pc, who: Id, x: Pref) => `<button type="button" data-act="unpref" data-who="${esc(who)}" data-pid="${esc(x.id)}" aria-label="${esc(`Remove ${c.w.ents[who]?.staff?.name ?? who}: ${said(c.p, x)}`)}" class="rounded px-1 text-slate-600 hover:bg-rose-100 hover:text-rose-800 focus-visible:outline-2 focus-visible:outline-sky-500 dark:text-slate-300 dark:hover:bg-rose-950">×</button>`
export const chip = (c: Pc, who: Id, x: Pref, s: State, why: string, o: Opt = {}) =>
  `<span data-pref="${esc(x.id)}" data-who="${esc(who)}" title="${esc(x.note)}" class="inline-flex flex-wrap items-center gap-1 rounded border bg-white px-1.5 py-0.5 text-xs dark:bg-slate-800 ${VERB[x.kind].cls}">` +
  `<span aria-hidden="true">${VERB[x.kind].icon}</span>${o.lead ? `<b>${esc(o.lead)}:</b> ` : ''}<span>${esc(o.lead ? said(c.p, x).toLowerCase() : said(c.p, x))}</span>${giveOf(who, x, o)}${badge(s, why)}${o.edit ? drop(c, who, x) : ''}</span>`
/** Every preference of one server as chips (`edit` = with give toggle and remove). */
export const chips = (c: Pc, who: Id, rows: PrefRow[], edit = false) => rows.map(r => chip(c, who, r.pref, r.state, r.why, {edit})).join('')
/** What a preference did to one offer, led by the server's name: "Ben skipped: avoids grotto (firm)". */
const LEAD: Record<`${Pref['kind']}:${PrefMark['state']}`, string> = {
  'avoid:enforced': 'skipped', 'avoid:met': '', 'avoid:overridden': 'serves anyway', 'prefer:enforced': 'steered here', 'prefer:met': '', 'prefer:overridden': 'passed over',
}
const prefOf = (w: World, m: PrefMark) => w.ents[m.staff]?.staff?.prefs?.find(x => x.id === m.pref)
const leadOf = (w: World, m: PrefMark, x: Pref) => [w.ents[m.staff]?.staff?.name ?? m.staff, LEAD[`${x.kind}:${m.state}`]].filter(Boolean).join(' ')
export const mark = (c: Pc) => (m: PrefMark) => {
  const x = prefOf(c.w, m)
  return x ? chip(c, m.staff, x, m.state, m.why, {lead: leadOf(c.w, m, x)}) : `<span data-pref="${esc(m.pref)}" class="text-xs">${esc(m.why)}</span>`
}
/** The rows a panel shows: the board's PrefRows when it has them, else each preference as `set`. */
export const rowsOf = (w: World, who: Id, rows?: PrefRow[]): PrefRow[] => rows ?? (w.ents[who]?.staff?.prefs ?? []).map(pref => ({pref, state: 'set', why: 'Set: no seating has tested it yet', at: null}))

// ---- presets: one-click CTAs (pressed when set; a second click removes)
export const PRESETS: {id: string; label: string; pref: (p: Policy) => Omit<Pref, 'at'>}[] = [
  {id: 'no-patio', label: 'No patio', pref: () => ({id: 'no-patio', kind: 'avoid', give: 'firm', on: {area: ['patio']}, note: 'No patio'})},
  {id: 'no-grotto', label: 'No grotto', pref: () => ({id: 'no-grotto', kind: 'avoid', give: 'firm', on: {area: ['grotto']}, note: 'No grotto'})},
  {id: 'main-only', label: 'Main floor only', pref: p => ({id: 'main-only', kind: 'avoid', give: 'firm', on: {area: Object.keys(p.service.areas).filter(a => a !== 'main')}, note: 'Main floor only'})},
  {id: 'my-booths', label: 'Prefer my booths', pref: () => ({id: 'my-booths', kind: 'prefer', give: 'yield', on: {shape: ['booth']}, note: 'Prefer my booths'})},
  {id: 'no-2-on-3', label: 'No 2-tops on 3+ tables', pref: () => ({id: 'no-2-on-3', kind: 'avoid', give: 'yield', on: {size: [1, 2], cap: [3, 99]}, note: 'No 2-tops on 3+ tables'})},
]
const has = (w: World, who: Id, id: string) => !!w.ents[who]?.staff?.prefs?.some(x => x.id === id)
const preset = (c: Pc, who: Id) => (x: (typeof PRESETS)[number]) =>
  `<button type="button" data-act="pref-preset" data-who="${esc(who)}" data-preset="${x.id}" aria-pressed="${has(c.w, who, x.id)}" title="${esc(said(c.p, {...x.pref(c.p), at: 0}))}" class="${has(c.w, who, x.id) ? primary : outline}">${has(c.w, who, x.id) ? '✓ ' : '+ '}${esc(x.label)}</button>`
export const presets = (c: Pc, who: Id) => `<div role="group" aria-label="${esc(`Quick preferences for ${c.w.ents[who]?.staff?.name ?? who}`)}" class="flex flex-wrap gap-1">${PRESETS.map(preset(c, who)).join('')}</div>`
/** The editor for one server: chips (give toggle, remove), presets, then the custom-form opener. */
export const editor = (c: Pc, who: Id, rows: PrefRow[]) => `<div data-prefs="${esc(who)}" class="mt-2 space-y-1">
<div class="flex flex-wrap gap-1">${chips(c, who, rows, true) || '<span class="text-xs text-slate-600 dark:text-slate-300">No preferences: the rotation alone decides.</span>'}</div>
<div class="flex flex-wrap items-center gap-1">${presets(c, who)}<button type="button" data-act="pref-open" data-who="${esc(who)}" class="${ghost}">Custom…</button></div></div>`

// ---- custom form (one server at a time; its HTML depends only on who is open, so typing survives repaints)
const box = (name: string, v: string, label: string) => `<label class="inline-flex min-h-8 items-center gap-1 text-xs"><input type="checkbox" name="${name}" value="${esc(v)}" class="size-4 accent-sky-600">${esc(label)}</label>`
const pick = (name: string, label: string, opts: [string, string][]) => `<label class="grid gap-0.5 text-xs">${label}<select name="${name}" class="${field}">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>`
const num = (name: string, label: string) => `<label class="grid gap-0.5 text-xs">${label}<input type="number" min="1" max="99" name="${name}" inputmode="numeric" class="${field} w-16 tabular-nums"></label>`
const group = (legend: string, body: string) => `<fieldset class="min-w-0"><legend class="text-xs font-semibold">${legend}</legend><div class="flex flex-wrap gap-x-3">${body}</div></fieldset>`
export const form = (app: App) => {
  const [p, w, who] = [policyOf(app), app.store.state.world, pu(app).open]
  return who && w.ents[who]?.staff ? `<div data-pform="${esc(who)}" class="space-y-2"><h2 class="text-sm font-semibold">Custom preference for ${esc(w.ents[who].staff!.name)}</h2>
<p class="text-xs text-slate-600 dark:text-slate-300">Rotation comes first; a preference only skips or nudges within it. Pick at least one of areas, shapes, features, seats or party size.</p>
<div class="flex flex-wrap gap-3">${pick('kind', 'Kind', [['avoid', 'Avoid these tables'], ['prefer', 'Prefer these tables']])}${pick('give', 'How firm (avoid)', [['firm', 'Firm: held unless all are bogged'], ['yield', "Yields: I'll do it if nobody can"]])}</div>
${group('Areas', Object.entries(p.service.areas).map(([id, a]) => box('area', id, a.label)).join(''))}${group('Table shape', Object.entries(SHAPE).map(([id, l]) => box('shape', id, l)).join(''))}
${group('Table features', Object.entries(p.host.feats).map(([id, f]) => box('feats', id, f.label)).join(''))}
<div class="flex flex-wrap gap-3">${num('cap-lo', 'Seats from')}${num('cap-hi', 'Seats to')}${num('size-lo', 'Party from')}${num('size-hi', 'Party to')}<label class="grid grow gap-0.5 text-xs">Note<input name="note" placeholder="e.g. knee, no stairs" class="${field}"></label></div>
<div class="flex flex-wrap gap-2"><button type="button" data-act="pref-add" data-who="${esc(who)}" class="${primary}">Add preference</button><button type="button" data-act="pref-open" data-who="" class="${ghost}">Close</button></div></div>` : ''
}
const ticked = (f: Element, n: string) => [...f.querySelectorAll<HTMLInputElement>(`[name="${n}"]:checked`)].map(i => i.value)
const val = (f: Element, n: string) => f.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${n}"]`)?.value ?? ''
const pair = (f: Element, k: string): [number, number] | undefined => (val(f, `${k}-lo`) || val(f, `${k}-hi`) ? [Number(val(f, `${k}-lo`) || 1), Number(val(f, `${k}-hi`) || 99)] : undefined)
const full = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined)
/** The form's choices as a PrefOn (empty keys left out). */
export const onOf = (f: Element): PrefOn => Object.fromEntries(Object.entries({area: ticked(f, 'area'), shape: ticked(f, 'shape'), feats: ticked(f, 'feats'), cap: pair(f, 'cap'), size: pair(f, 'size')}).filter(([, v]) => full(v)))
const custom = (app: App, f: Element, who: Id): Pref => {
  const on = onOf(f)
  const n = app.store.state.world.ents[who]?.staff?.prefs?.length ?? 0
  return {id: `c${n + 1}-${app.store.state.now.toString(36)}`, kind: val(f, 'kind') as Pref['kind'], give: val(f, 'give') as Pref['give'], on, note: val(f, 'note') || about(policyOf(app), on), at: app.store.state.now}
}

// ---- acts: each dispatches one Cmd (or flips ui.prefs), then bumps ui.rev
const mine = (app: App, who: Id, id: string) => app.store.state.world.ents[who]?.staff?.prefs?.find(x => x.id === id)
const flip: Record<Pref['give'], Pref['give']> = {firm: 'yield', yield: 'firm'}
const toggle = (app: App, who: Id, id: string) => (mine(app, who, id)
  ? run(app, {do: 'unpref', staff: who, id})
  : run(app, {do: 'pref', staff: who, pref: {...PRESETS.find(x => x.id === id)!.pref(policyOf(app)), at: app.store.state.now}}))
const added = (app: App, ev: Event, who: Id) => run(app, {do: 'pref', staff: who, pref: custom(app, (ev.target as Element).closest('[data-pform]')!, who)}).ok && (pu(app).open = '')
const ACTS: Record<string, (app: App, ev: Event) => unknown> = {
  'pref-preset': (a, ev) => toggle(a, arg(ev, 'who'), arg(ev, 'preset')),
  'pref-give': (a, ev) => run(a, {do: 'pref', staff: arg(ev, 'who'), pref: {...mine(a, arg(ev, 'who'), arg(ev, 'pid'))!, give: flip[mine(a, arg(ev, 'who'), arg(ev, 'pid'))!.give]}}),
  unpref: (a, ev) => run(a, {do: 'unpref', staff: arg(ev, 'who'), id: arg(ev, 'pid')}),
  'pref-open': (a, ev) => (pu(a).open = arg(ev, 'who')),
  'pref-quick': (a, ev) => (pu(a).quick = pu(a).quick === arg(ev, 'who') ? '' : arg(ev, 'who')),
  'pref-add': (a, ev) => added(a, ev, arg(ev, 'who')),
}
export const prefs = (app: App) => {
  pu(app)
  Object.entries(ACTS).forEach(([n, f]) => app.act(n, (a, ev) => (f(a, ev), uiOf(a).rev++)))
}
