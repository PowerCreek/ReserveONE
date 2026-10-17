// Strategy levers: draft a hold (tables, size or a named party, how long, an optional gate: when table X frees / at a time, a reason) and save it
// as world state through the desk (`run {do: 'hold'}`); the list reads the world's holds (live / waiting on its gate / expired), each with Release (`unhold`).
// Only the draft form lives in ui state (`ui.strat.draft`); every placement path in the engine honours a saved hold.
import {having} from '../contracts/index.ts'
import type {App, Ent, Entity, Id} from '../contracts/index.ts'
import type {Gate, Lane, StratHold, StratView} from '../contracts/strategy.ts'
import {run} from './act.ts'
import {esc} from './render.ts'
import {forWho, holdSay, isOpen, seatsOf, worldHolds} from './strategyheld.ts'
import {MIN, blankDraft, clamp, hhmm, stratOf, str} from './strategykit.ts'
import type {Draft} from './strategykit.ts'
import {btn, choice, field, ghost, help, ok} from './tone.ts'
const val = (ev: Event) => (ev.target as HTMLInputElement).value
const draft = (app: App) => stratOf(app).draft
const put = (app: App, d: Partial<Draft>) => void (stratOf(app).draft = {...draft(app), ...d})
const toggle = (ts: string[], t: string) => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t])
const GATES: Record<Draft['gate'], (d: Draft, now: number) => Gate | undefined> = {
  none: () => undefined, free: d => (d.gtab ? {kind: 'free', table: d.gtab} : undefined), at: (d, now) => ({kind: 'at', at: now + d.atMin * MIN}),
}
/** The desk command for the draft (until = now + duration, or after the gate when it has one at a time). */
const cmdOf = (d: Draft, now: number) => ((g = GATES[d.gate](d, now)) => ({do: 'hold' as const, tables: d.tables, size: d.size, until: (g?.kind === 'at' ? g.at : now) + d.forMin * MIN, ...(g ? {gate: g} : {}), why: d.why.trim(), ...(d.party ? {party: d.party} : {})}))()
const create = (app: App) => ((d = draft(app)) => run(app, cmdOf(d, app.store.state.now)).ok && (stratOf(app).draft = {...blankDraft(), size: d.size}))()
/** Parties a hold can name: reservations, call-aheads and parties at the door (anyone not seated or gone), with their size. */
const seated = (app: App) => new Set(having(app.store.state.world, 'slot').filter(s => s.slot.status !== 'COMPLETED').map(s => s.slot.party))
const waiting = (app: App) => ((s = seated(app)) => (having(app.store.state.world, 'party') as (Ent<'party'> & Entity)[]).filter(p => !s.has(p.id) && !p.intake?.gone && (p.reservation || p.queue || p.intake)))()
const kind = (p: ReturnType<typeof waiting>[number]) => (p.reservation ? 'reservation' : p.intake?.via === 'call' ? 'call-ahead' : 'at the door')
const forParty = (app: App, id: Id) => put(app, {party: id, ...(id ? {size: app.store.state.world.ents[id]?.party?.size ?? draft(app).size} : {})})
export const holdActs: Record<string, (app: App, ev: Event) => unknown> = {
  'strat-pick': (app, ev) => put(app, {tables: toggle(draft(app).tables, str(ev, 'tid'))}),
  'strat-hsize-more': app => put(app, {size: clamp(draft(app).size + 1)}),
  'strat-hsize-less': app => put(app, {size: clamp(draft(app).size - 1)}),
  'strat-for': (app, ev) => put(app, {forMin: Number(str(ev, 'm')), custom: false}),
  'strat-for-custom': app => put(app, {custom: true}),
  'strat-for-min': (app, ev) => put(app, {forMin: clamp(Math.round(Number(val(ev))) || 1, 1, 480)}),
  'strat-party': (app, ev) => forParty(app, val(ev)),
  'strat-gate': (app, ev) => put(app, {gate: str(ev, 'g') as Draft['gate']}),
  'strat-gtab': (app, ev) => put(app, {gtab: val(ev)}),
  'strat-gat': (app, ev) => put(app, {atMin: Number(val(ev))}),
  'strat-why': (app, ev) => put(app, {why: val(ev)}),
  'strat-hold': create,
  'strat-unhold': (app, ev) => run(app, {do: 'unhold', id: str(ev, 'id')}),
}
const pick = (d: Draft) => (l: Lane) => ((p = d.tables.includes(l.table)) => `<button type="button" data-act="strat-pick" data-tid="${esc(l.table)}" aria-pressed="${p}" class="${p ? 'min-h-8 rounded bg-amber-500 px-2 text-xs font-semibold text-amber-950' : 'min-h-8 rounded bg-slate-200 px-2 text-xs text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100'} focus-visible:outline-2 focus-visible:outline-sky-500">${esc(l.label)}</button>`)()
const AT = [15, 30, 45, 60, 90, 120, 150]
const opts = (sel: number, now: number) => AT.map(m => `<option value="${m}"${m === sel ? ' selected' : ''}>${m}m (${hhmm(now + m * MIN)})</option>`).join('')
const tabs = (ls: Lane[], sel: string) => `<option value="">Pick a table</option>${ls.map(l => `<option value="${esc(l.table)}"${l.table === sel ? ' selected' : ''}>${esc(l.label)} (free in ${l.freeIn}m)</option>`).join('')}`
const GATE_UI: Record<Draft['gate'], (d: Draft, v: StratView, now: number) => string> = {
  none: () => '',
  free: (d, v) => `<label class="flex items-center gap-2 text-xs">When this table frees <select data-on="change:strat-gtab" class="${field}">${tabs(v.lanes, d.gtab)}</select></label>`,
  at: (d, _v, now) => `<label class="flex items-center gap-2 text-xs">From <select data-on="change:strat-gat" class="${field}">${opts(d.atMin, now)}</select></label>`,
}
const PICKS = [['none', 'No gate (now)'], ['free', 'When a table frees'], ['at', 'At a time']] as const
const gateRadio = (d: Draft) => PICKS.map(([g, l]) => `<button type="button" role="radio" aria-checked="${d.gate === g}" data-act="strat-gate" data-g="${g}" class="${choice(d.gate === g)}">${l}</button>`).join('')
const LONG = [15, 30, 45, 60]
const durations = (d: Draft) => LONG.map(m => ((p = !d.custom && d.forMin === m) => `<button type="button" role="radio" aria-checked="${p}" data-act="strat-for" data-m="${m}" class="${choice(p)}">${m} min</button>`)()).join('') +
  `<button type="button" role="radio" aria-checked="${d.custom}" data-act="strat-for-custom" class="${choice(d.custom)}">Custom</button>` +
  (d.custom ? `<label class="flex items-center gap-1 text-xs"><input type="number" min="1" max="480" value="${d.forMin}" data-on="change:strat-for-min" aria-label="Hold minutes" class="${field} w-20" /> min</label>` : '')
const partyPick = (app: App, d: Draft) => `<label class="flex flex-wrap items-center gap-2 text-xs">For party <select data-on="change:strat-party" class="${field}"><option value="">Any party of the size</option>${waiting(app).map(p =>
  `<option value="${esc(p.id)}"${p.id === d.party ? ' selected' : ''}>${esc(`${p.party.label}${p.party.name ? ` ${p.party.name}` : ''} x${p.party.size} (${kind(p)})`)}</option>`).join('')}</select></label>`
const sizeRow = (d: Draft) => `<div class="flex flex-wrap items-center gap-2 text-sm"><span>Size</span><button type="button" data-act="strat-hsize-less" aria-label="Hold for one fewer" class="${btn}">−</button><b class="w-8 text-center tabular-nums">${d.size}</b><button type="button" data-act="strat-hsize-more" aria-label="Hold for one more" class="${btn}">+</button></div>`
/** The button reads as the hold it will save: 'Hold T9 + T10 (8 seats) for W-1 Patel x3'. */
const holdBtn = (app: App, d: Draft) => ((w = app.store.state.world) => `<button type="button" data-act="strat-hold" ${d.tables.length ? '' : 'disabled'} class="${ok}">Hold ${esc(d.tables.length ? seatsOf(w, d.tables) : 'tables')} for ${esc(forWho(w, d.party ? {party: d.party, size: d.size} : {size: d.size}))}</button>`)()
const form = (app: App, v: StratView) => ((d = draft(app), now = app.store.state.now) =>
  `<div data-holdform class="space-y-2"><div role="group" aria-label="Tables to hold" class="flex max-h-32 flex-wrap gap-1 overflow-y-auto">${v.lanes.map(pick(d)).join('')}</div>${partyPick(app, d)}${d.party ? '' : sizeRow(d)}` +
  `<div role="radiogroup" aria-label="How long" class="flex flex-wrap items-center gap-2">${durations(d)}</div>` +
  `<div role="radiogroup" aria-label="Gate" class="flex flex-wrap gap-2">${gateRadio(d)}</div>${GATE_UI[d.gate](d, v, now)}` +
  `<label class="grid gap-0.5 text-xs"><span class="text-slate-600 dark:text-slate-300">Reason</span><input type="text" data-on="input:strat-why" value="${esc(d.why)}" placeholder="8:00 Rossi x6 needs T20+T21" class="${field} w-full" /></label>${holdBtn(app, d)}</div>`)()
/** live / waiting on its gate / expired (until passed; it no longer blocks, Release tidies it away). */
const STATE: Record<string, string> = {
  live: '<span data-state="live" class="rounded bg-amber-200 px-1 text-amber-950">live</span>',
  waiting: '<span data-state="waiting" class="rounded border border-dashed border-amber-600 px-1">waiting on gate</span>',
  expired: '<span data-state="expired" class="rounded bg-slate-200 px-1 text-slate-700 dark:bg-slate-700 dark:text-slate-200">expired</span>',
}
const stateOf = (app: App, h: StratHold) => (h.until <= app.store.state.now ? 'expired' : isOpen(app.store.state.world, app.store.state.now, h) ? 'live' : 'waiting')
const item = (app: App) => (h: StratHold) =>
  `<li data-hold="${esc(h.id)}" data-tid="${esc(h.tables.join(' '))}" class="flex flex-wrap items-center gap-2 py-1 text-xs">` +
  `<span class="grow">${esc(holdSay(app.store.state.world, app.store.state.now, h))}</span>${STATE[stateOf(app, h)]}` +
  `<button type="button" data-act="strat-unhold" data-id="${esc(h.id)}" class="${ghost}">Release</button></li>`
export const levers = (app: App, v: StratView) => ((hs = worldHolds(app.store.state.world)) =>
  `${form(app, v)}<h3 class="mt-3 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">Holds</h3>` +
  (hs.length ? `<ul class="divide-y divide-slate-200 dark:divide-slate-700">${hs.map(item(app)).join('')}</ul>` : `<p class="${help}">No holds. A saved hold keeps its tables from every other party until it ends; seat anyway is an explicit override.</p>`))()
