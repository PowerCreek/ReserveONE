// Wait list + call-aheads + the priority queue (lane U14): add a walk-in with its quoted wait or a call-ahead with an ETA; one ordered list of everyone waiting,
// each row saying why it sits there (policy.book terms), with seat / check in, "table ready" text, bump up/down/top with a reason, and remove.
import {bookOf} from '../contracts/index.ts'
import type {App, CallRow, Policy, QRow} from '../contracts/index.ts'
import {ask, policyOf} from './ask.ts'
import {bk, book, hm} from './bookask.ts'
import {arg, esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {btn, card, ctaSm, field, ghost, help, ok, on} from './tone.ts'
export interface Wl {size: number; flags: string[]; cflags: string[]; why: string; rev: number}
declare module '../contracts/kernel.ts' {
  interface UiState {wl?: Wl}
}
const wlOf = (app: App) => uiOf(app).wl!
const inp = (n: string, label: string, type = 'text', extra = '') => `<label class="grid gap-0.5 text-xs"><span class="text-slate-600 dark:text-slate-300">${label}</span><input name="${n}" type="${type}" ${extra} data-on="input:wl-in change:wl-in" class="${field} w-full" /></label>`
const chip = (act: string, id: string, label: string, picked: boolean) => `<button type="button" role="checkbox" aria-checked="${picked}" data-act="${act}" data-id="${esc(id)}" class="${picked ? on : ghost}">${esc(label)}</button>`
const flags = (k: 'flags' | 'cflags', act: string) => (app: App) => `<div class="flex flex-wrap gap-1">${Object.entries(bookOf(policyOf(app)).flags).map(([id, f]) => chip(act, id, f.label, wlOf(app)[k].includes(id))).join('')}</div>`
/** What to tell the walk-in now: the engine's quote for the form's size. */
const quote = (app: App) => ((q = ask(app, 'eta', wlOf(app).size)) => (q ? `<p class="text-sm">Quote for ${q.size}: <b class="tabular-nums">${q.ready ? 'ready now' : q.none ? 'no table fits' : `${q.lo}-${q.hi} min`}</b> <span class="${help}">(${q.ahead} ahead)</span></p>` : `<p class="${help}">No quote: engine.eta not available.</p>`))()
export const waitForms = `<div data-form="wait" class="${card} space-y-2"><h2 class="text-sm font-semibold">Add to the wait list</h2><p class="${help}">A walk-in with a quoted wait; flags raise it in the order.</p>
<div class="grid grid-cols-[1fr_5rem] gap-2">${inp('wl-name', 'Name')}${inp('wl-size', 'Size', 'number', 'min="1" value="2" inputmode="numeric"')}</div>${inp('wl-phone', 'Phone (for the ready text)', 'tel')}
<div data-wlflags="ui.wl.rev"></div><div data-wlq="ui.rev"></div><button type="button" data-act="wl-add" class="${ctaSm}">Add to wait list</button></div>
<div data-form="call" class="${card} space-y-2"><h2 class="text-sm font-semibold">Call-ahead</h2><p class="${help}">A phoned-in party: it joins the queue at its ETA (check it in when it walks in) and reads late after the grace period.</p>
<div class="grid grid-cols-[1fr_5rem_5rem] gap-2">${inp('ca-name', 'Name')}${inp('ca-size', 'Size', 'number', 'min="1" value="2" inputmode="numeric"')}${inp('ca-eta', 'ETA (min)', 'number', 'min="0" value="15" inputmode="numeric"')}</div>${inp('ca-phone', 'Phone', 'tel')}
<div data-caflags="ui.wl.rev"></div><button type="button" data-act="ca-add" class="${ctaSm}">Add call-ahead</button>
<h3 class="pt-1 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">On their way</h3><p class="${help}">Call-aheads before their ETA, soonest first.</p><ul data-calls="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div>`
const call = (r: CallRow) => `<li data-call="${esc(r.party)}" class="flex flex-wrap items-center gap-2 py-1 text-sm"><b class="w-12">${esc(r.label)}</b><span class="grow">${esc(r.name)} x${r.size}</span><span class="text-xs tabular-nums">ETA ${hm(r.eta)} (in ${r.inMin}m)</span>
<button type="button" data-act="wl-do" data-to="arrive" data-id="${esc(r.party)}" class="${btn}">Check in</button><button type="button" data-act="wl-do" data-to="cancel" data-id="${esc(r.party)}" class="${ghost}">Cancel</button></li>`
const calls = (app: App) => ((v = bk(app, 'wait')) => (v?.calls.length ? v.calls.map(call).join('') : `<li class="py-1 ${help}">No call-aheads on their way.</li>`))()

// ---- the priority queue
const VIA: Record<QRow['via'], string> = {book: 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50', call: 'bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-50', walk: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}
const warn = 'rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white'
const pill = (cls: string, s: string) => `<span class="rounded-full px-2 py-0.5 text-xs ${cls}">${esc(s)}</span>`
const states = (p: Policy, r: QRow, now: number) => [
  ...r.flags.map(f => pill('bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50', bookOf(p).flags[f]?.label ?? f)),
  r.here ? '' : `<span class="${warn}">not here yet</span>`, r.late ? `<span class="${warn}">late</span>` : '', r.over ? `<span class="${warn}">past quote</span>` : '',
  r.texted !== null ? pill(r.noReply ? 'bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50' : 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50', r.noReply ? `texted ${Math.floor((now - r.texted) / 60000)}m ago, no reply` : 'texted: table ready') : '',
].join('')
const why = (r: QRow) => `<p class="text-xs text-slate-600 dark:text-slate-300" data-why>Why #${r.rank}: ${r.why.map(t => `${esc(t.label)} ${t.pts > 0 ? '+' : ''}${t.pts}`).join(' · ')} = <b class="tabular-nums">${r.pts}</b></p>`
const b = (to: string, id: string, label: string, cls: string, aria = '') => `<button type="button" data-act="wl-do" data-to="${to}" data-id="${esc(id)}" class="${cls}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${label}</button>`
const tools = (r: QRow, n: number) => [
  r.here ? `<button type="button" data-act="seat" data-id="${esc(r.party)}" class="${ok}">Seat</button>` : b('arrive', r.party, 'Check in', btn),
  b('text', r.party, r.texted === null ? 'Text: ready' : 'Text again', ghost),
  r.rank > 1 ? b('up', r.party, '↑', ghost, `Bump ${r.name} up`) + b('top', r.party, 'Top', ghost, `Bump ${r.name} to the top`) : '',
  r.rank < n ? b('down', r.party, '↓', ghost, `Bump ${r.name} down`) : '',
  r.here ? b('left', r.party, 'Left', ghost) + b('removed', r.party, 'Remove', ghost) : b('noshow', r.party, 'No-show', ghost),
].join('')
/** One priority row (`mark` = the fast-seat marker when the Seat button in Fast seating would take this party). */
export const qrow = (app: App, n: number, mark: (id: string) => string) => (r: QRow) =>
  `<li data-party="${esc(r.party)}" class="py-1.5"><div class="flex flex-wrap items-center gap-2 text-sm"><span class="w-6 text-right font-semibold tabular-nums">${r.rank}</span><b class="w-12 tabular-nums">${esc(r.label)}</b><span class="grow">${esc(r.name)} x${r.size}</span>${pill(VIA[r.via], bookOf(policyOf(app)).via[r.via].label)}${states(policyOf(app), r, app.store.state.now)}${mark(r.party)}<span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">waited ${r.waitedMin}m${r.quotedMin === null ? (r.via === 'book' ? ' · booked' : '') : ` · quote ${r.quotedMin}m`}</span></div>
${why(r)}<div class="mt-1 flex flex-wrap gap-1">${tools(r, n)}</div></li>`
export const qrows = (app: App, mark: (id: string) => string) => ((v = bk(app, 'wait')) => (v ? v.rows.map(qrow(app, v.rows.length, mark)).join('') : ''))()
/** The reason the next bump records (policy.book.bumpWhys). */
const whyPick = (app: App) => `<label class="flex items-center gap-2 text-xs"><span class="text-slate-600 dark:text-slate-300">Bump reason</span><select data-on="change:wl-why" class="${field}">${Object.entries(bookOf(policyOf(app)).bumpWhys).map(([id, l]) => `<option value="${esc(id)}"${wlOf(app).why === id ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`
export const queueHead = `<div data-qwhy="ui.wl.rev" class="mb-1"></div>`

// ---- acts
const val = (ev: Event, form: string, n: string) => (ev.target as Element).ownerDocument.querySelector<HTMLInputElement>(`[data-form="${form}"] [name=${n}]`)?.value ?? ''
const clear = (ev: Event, form: string, ns: string[]) => ns.forEach(n => ((i = (ev.target as Element).ownerDocument.querySelector<HTMLInputElement>(`[data-form="${form}"] [name=${n}]`)) => i && (i.value = ''))())
const added = (app: App, ev: Event, form: string, k: 'flags' | 'cflags', ok: boolean) => ok && (clear(ev, form, [`${form === 'wait' ? 'wl' : 'ca'}-name`, `${form === 'wait' ? 'wl' : 'ca'}-phone`]), (wlOf(app)[k] = []))
const ROW: Record<string, (app: App, id: string) => unknown> = {
  arrive: (a, id) => book(a, {do: 'arrive', party: id}), noshow: (a, id) => book(a, {do: 'noshow', party: id}), text: (a, id) => book(a, {do: 'text', party: id}),
  cancel: (a, id) => book(a, {do: 'leave', party: id, why: 'cancel'}), left: (a, id) => book(a, {do: 'leave', party: id, why: 'left'}), removed: (a, id) => book(a, {do: 'leave', party: id, why: 'removed'}),
  up: (a, id) => book(a, {do: 'bump', party: id, to: 'up', why: wlOf(a).why}), down: (a, id) => book(a, {do: 'bump', party: id, to: 'down', why: wlOf(a).why}), top: (a, id) => book(a, {do: 'bump', party: id, to: 'top', why: wlOf(a).why}),
}
const toggle = (k: 'flags' | 'cflags') => (app: App, ev: Event) => ((w = wlOf(app), id = arg(ev, 'id')) => (w[k] = w[k].includes(id) ? w[k].filter(x => x !== id) : [...w[k], id]))()
const ACTS: Record<string, (app: App, ev: Event) => unknown> = {
  'wl-in': (app, ev) => ((t = ev.target as HTMLInputElement) => t.name === 'wl-size' && (wlOf(app).size = Math.max(1, Number(t.value) || 1), uiOf(app).rev++))(),
  'wl-add': (app, ev) => added(app, ev, 'wait', 'flags', book(app, {do: 'walk', size: Number(val(ev, 'wait', 'wl-size')), name: val(ev, 'wait', 'wl-name'), phone: val(ev, 'wait', 'wl-phone'), flags: wlOf(app).flags}).ok),
  'ca-add': (app, ev) => added(app, ev, 'call', 'cflags', book(app, {do: 'call', size: Number(val(ev, 'call', 'ca-size')), name: val(ev, 'call', 'ca-name'), etaMin: Number(val(ev, 'call', 'ca-eta')), phone: val(ev, 'call', 'ca-phone'), flags: wlOf(app).cflags}).ok),
  'wl-flag': toggle('flags'), 'ca-flag': toggle('cflags'),
  'wl-why': (app, ev) => (wlOf(app).why = (ev.target as HTMLSelectElement).value),
  'wl-do': (app, ev) => ROW[arg(ev, 'to')]?.(app, arg(ev, 'id')),
}
export const waitlist = (app: App) => {
  Object.assign(uiOf(app), {wl: uiOf(app).wl ?? {size: 2, flags: [], cflags: [], why: Object.keys(bookOf(policyOf(app)).bumpWhys)[0] ?? 'host', rev: 0}})
  Object.entries(ACTS).forEach(([n, f]) => app.act(n, (a, ev) => (f(a, ev), wlOf(a).rev++)))
  ;([['data-wlflags', flags('flags', 'wl-flag')], ['data-caflags', flags('cflags', 'ca-flag')], ['data-wlq', quote], ['data-calls', calls], ['data-qwhy', whyPick]] as const).forEach(([attr, draw]) => app.binder(panel(app, attr, draw)))
}
