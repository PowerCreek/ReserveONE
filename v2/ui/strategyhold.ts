// Strategy levers: draft a hold (tables, size, how long, an optional gate: when table X frees / at a time, a reason), then list and remove holds.
// Holds are ui state (`ui.strat.holds`) handed to the engine as StratCtl; nothing is written to the world.
import type {App} from '../contracts/index.ts'
import type {Gate, Lane, StratHold, StratView} from '../contracts/strategy.ts'
import {esc} from './render.ts'
import {MIN, blankDraft, clamp, hhmm, stratOf, str} from './strategykit.ts'
import type {Draft} from './strategykit.ts'
import {opensIn} from './strategyline.ts'
import {btn, choice, field, ghost, help, ok} from './tone.ts'
const val = (ev: Event) => (ev.target as HTMLInputElement).value
const draft = (app: App) => stratOf(app).draft
const put = (app: App, d: Partial<Draft>) => void (stratOf(app).draft = {...draft(app), ...d})
const toggle = (ts: string[], t: string) => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t])
const GATES: Record<Draft['gate'], (d: Draft, now: number) => Gate | undefined> = {
  none: () => undefined, free: d => (d.gtab ? {kind: 'free', table: d.gtab} : undefined), at: (d, now) => ({kind: 'at', at: now + d.atMin * MIN}),
}
const nextId = (hs: StratHold[]) => `sh${hs.reduce((n, h) => Math.max(n, Number(h.id.slice(2)) || 0), 0) + 1}`
const made = (d: Draft, now: number, id: string): StratHold => ((g = GATES[d.gate](d, now)) => ({id, tables: d.tables, size: d.size, until: now + d.forMin * MIN, ...(g ? {gate: g} : {}), why: d.why.trim()}))()
const create = (app: App) => ((d = draft(app), hs = stratOf(app).holds) => d.tables.length && ((stratOf(app).holds = [...hs, made(d, app.store.state.now, nextId(hs))]), (stratOf(app).draft = {...blankDraft(), size: d.size})))()
export const holdActs: Record<string, (app: App, ev: Event) => unknown> = {
  'strat-pick': (app, ev) => put(app, {tables: toggle(draft(app).tables, str(ev, 'tid'))}),
  'strat-hsize-more': app => put(app, {size: clamp(draft(app).size + 1)}),
  'strat-hsize-less': app => put(app, {size: clamp(draft(app).size - 1)}),
  'strat-for': (app, ev) => put(app, {forMin: Number(val(ev))}),
  'strat-gate': (app, ev) => put(app, {gate: str(ev, 'g') as Draft['gate']}),
  'strat-gtab': (app, ev) => put(app, {gtab: val(ev)}),
  'strat-gat': (app, ev) => put(app, {atMin: Number(val(ev))}),
  'strat-why': (app, ev) => put(app, {why: val(ev)}),
  'strat-hold': create,
  'strat-unhold': (app, ev) => void (stratOf(app).holds = stratOf(app).holds.filter(h => h.id !== str(ev, 'id'))),
}
const pick = (d: Draft) => (l: Lane) => ((p = d.tables.includes(l.table)) => `<button type="button" data-act="strat-pick" data-tid="${esc(l.table)}" aria-pressed="${p}" class="${p ? 'min-h-8 rounded bg-amber-500 px-2 text-xs font-semibold text-amber-950' : 'min-h-8 rounded bg-slate-200 px-2 text-xs text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100'} focus-visible:outline-2 focus-visible:outline-sky-500">${esc(l.label)}</button>`)()
const MINS = [15, 30, 45, 60, 90, 120, 150]
const opts = (sel: number, now: number) => MINS.map(m => `<option value="${m}"${m === sel ? ' selected' : ''}>${m}m (${hhmm(now + m * MIN)})</option>`).join('')
const tabs = (ls: Lane[], sel: string) => `<option value="">Pick a table</option>${ls.map(l => `<option value="${esc(l.table)}"${l.table === sel ? ' selected' : ''}>${esc(l.label)} (free in ${l.freeIn}m)</option>`).join('')}`
const GATE_UI: Record<Draft['gate'], (d: Draft, v: StratView, now: number) => string> = {
  none: () => '',
  free: (d, v) => `<label class="flex items-center gap-2 text-xs">When this table frees <select data-on="change:strat-gtab" class="${field}">${tabs(v.lanes, d.gtab)}</select></label>`,
  at: (d, _v, now) => `<label class="flex items-center gap-2 text-xs">At <select data-on="change:strat-gat" class="${field}">${opts(d.atMin, now)}</select></label>`,
}
const PICKS = [['none', 'No gate (now)'], ['free', 'When a table frees'], ['at', 'At a time']] as const
const gateRadio = (d: Draft) => PICKS.map(([g, l]) =>
  `<button type="button" role="radio" aria-checked="${d.gate === g}" data-act="strat-gate" data-g="${g}" class="${choice(d.gate === g)}">${l}</button>`).join('')
const form = (app: App, v: StratView) => ((d = draft(app), now = app.store.state.now) =>
  `<div data-holdform class="space-y-2"><div role="group" aria-label="Tables to hold" class="flex max-h-32 flex-wrap gap-1 overflow-y-auto">${v.lanes.map(pick(d)).join('')}</div>` +
  `<div class="flex flex-wrap items-center gap-2 text-sm"><span>For</span><button type="button" data-act="strat-hsize-less" aria-label="Hold for one fewer" class="${btn}">−</button><b class="w-8 text-center tabular-nums">${d.size}</b><button type="button" data-act="strat-hsize-more" aria-label="Hold for one more" class="${btn}">+</button>` +
  `<label class="flex items-center gap-2 text-xs">until <select data-on="change:strat-for" class="${field}">${opts(d.forMin, now)}</select></label></div>` +
  `<div role="radiogroup" aria-label="Gate" class="flex flex-wrap gap-2">${gateRadio(d)}</div>${GATE_UI[d.gate](d, v, now)}` +
  `<label class="grid gap-0.5 text-xs"><span class="text-slate-600 dark:text-slate-300">Reason</span><input type="text" data-on="input:strat-why" value="${esc(d.why)}" placeholder="8:00 Rossi x6 needs T20+T21" class="${field} w-full" /></label>` +
  `<button type="button" data-act="strat-hold" ${d.tables.length ? '' : 'disabled'} class="${ok}">Hold ${esc(d.tables.length ? v.lanes.filter(l => d.tables.includes(l.table)).map(l => l.label).join('+') : 'tables')} for ${d.size}</button></div>`)()
const GATE_SAY: Record<string, (h: StratHold, v: StratView) => string> = {
  none: () => 'now', free: (h, v) => `when ${v.lanes.find(l => l.table === (h.gate as {table: string}).table)?.label ?? 'its table'} frees`, at: h => `at ${hhmm((h.gate as {at: number}).at)}`,
}
const state = (h: StratHold, v: StratView) => (v.live.includes(h.id) ? '<span class="rounded bg-amber-200 px-1 text-amber-950">live</span>' : v.waiting.includes(h.id) ? '<span class="rounded border border-dashed border-amber-600 px-1">waiting</span>' : '')
const item = (app: App, v: StratView) => (h: StratHold) =>
  `<li data-hold="${esc(h.id)}" class="flex flex-wrap items-center gap-2 py-1 text-xs">${h.tables.map(t => `<b data-tid="${esc(t)}">${esc(v.lanes.find(l => l.table === t)?.label ?? t)}</b>`).join('+')}` +
  `<span>for ${h.size} until ${hhmm(h.until)}, gate ${GATE_SAY[h.gate?.kind ?? 'none']!(h, v)}${opensIn(h, v.lanes, app.store.state.now) > 0 ? ` (opens in ${Math.round(opensIn(h, v.lanes, app.store.state.now))}m)` : ''}</span>${state(h, v)}` +
  `<span class="grow text-slate-600 dark:text-slate-300">${esc(h.why || 'no reason given')}</span><button type="button" data-act="strat-unhold" data-id="${esc(h.id)}" class="${ghost}">Remove</button></li>`
export const levers = (app: App, v: StratView) =>
  `${form(app, v)}<h3 class="mt-3 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">Holds</h3>` +
  (stratOf(app).holds.length ? `<ul class="divide-y divide-slate-200 dark:divide-slate-700">${stratOf(app).holds.map(item(app, v)).join('')}</ul>` : `<p class="${help}">No holds. A hold keeps tables clear in the plan; it never blocks the floor.</p>`)
