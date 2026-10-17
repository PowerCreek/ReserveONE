// Strategy timeline: one row per table, grouped by section (else area), tables of one run kept together; bars on a ~2.5 h axis for
// seated-until, the planned reservation (StratView.lanes), holds and their gates (the world's `hold` components, strategyheld.ts), and pairs that can link (StratView.pairs).
import type {App, World} from '../contracts/index.ts'
import type {Lane, Pair, StratHold, StratView} from '../contracts/strategy.ts' // contracts/index re-exports two `Lane`s (desk, strategy): import this one directly
import {policyOf} from './ask.ts'
import {ref} from './links.ts'
import {esc} from './render.ts'
import {holdAt, lockSay, worldHolds} from './strategyheld.ts'
import {H, MIN, TURN, hhmm} from './strategykit.ts'
import {help} from './tone.ts'
const BAR: Record<string, {cls: string; say: string}> = {
  seated: {cls: 'bg-rose-500 dark:bg-rose-400', say: 'Seated until it frees'},
  planned: {cls: 'bg-indigo-500 dark:bg-indigo-400', say: 'Planned reservation (one turn)'},
  hold: {cls: 'bg-amber-400 ring-1 ring-amber-700 dark:bg-amber-500', say: 'Hold (kept clear)'},
  gate: {cls: 'border border-dashed border-amber-600 bg-amber-100 dark:bg-amber-950', say: 'Hold waiting for its gate'},
  pair: {cls: 'bg-emerald-600 dark:bg-emerald-400', say: 'Can link with a neighbour (parity)'},
}
const pct = (m: number) => `${(Math.max(0, Math.min(H, m)) / H * 100).toFixed(2)}%`
const span = (a: number, b: number) => `left:${pct(a)};width:${pct(Math.max(b, a + 2) - Math.max(0, a))}`
const bar = (kind: string, a: number, b: number, text: string) =>
  `<span tabindex="0" role="img" data-bar="${kind}" aria-label="${esc(text)}" title="${esc(text)}" class="absolute top-1 bottom-1 rounded-sm focus-visible:outline-2 focus-visible:outline-sky-500 ${BAR[kind]!.cls}" style="${span(a, b)}"></span>`
const seated = (l: Lane) => (l.freeIn > 0 ? bar('seated', 0, l.freeIn, `${l.label}: ${l.seated} seated, free in ${l.freeIn}m`) : '')
const planned = (now: number) => (l: Lane) => (l.next ? bar('planned', l.next.at, l.next.at + TURN, `${l.label}: ${l.next.label} x${l.next.size} at ${hhmm(now + l.next.at * MIN)}`) : '')
/** Minutes from now until a hold's gate opens (no gate: now; a table: when it frees; a time: that minute). */
const GATE: Record<string, (h: StratHold, ls: Lane[], now: number) => number> = {
  none: () => 0, free: (h, ls) => ls.find(l => l.table === (h.gate as {table: string}).table)?.freeIn ?? 0, at: (h, _l, now) => ((h.gate as {at: number}).at - now) / MIN,
}
export const opensIn = (h: StratHold, ls: Lane[], now: number) => Math.max(0, GATE[h.gate?.kind ?? 'none']!(h, ls, now))
const held = (app: App, ls: Lane[], hs: StratHold[], now: number) => (l: Lane) => hs.filter(h => h.tables.includes(l.table)).map(h => ((o = opensIn(h, ls, now), say = lockSay(app, h)) =>
  (o > 0 ? bar('gate', 0, o, `${say} (gate in ${Math.round(o)}m)`) : '') + bar('hold', o, (h.until - now) / MIN, say))()).join('')
const paired = (ps: Pair[]) => (l: Lane) => ps.filter(p => p.tables.includes(l.table)).map(p => bar('pair', p.at, p.at + 3, `${p.labels.join('+')} link for ${p.size} in ${p.at}m: ${p.why}`)).join('')
const nat = (a: string, b: string) => a.localeCompare(b, undefined, {numeric: true})
const groupOf = (app: App, w: World) => (l: Lane) => (l.section && w.ents[l.section]?.section?.name) || policyOf(app).service.areas[w.ents[l.table]?.area?.id ?? '']?.label || 'Other'
/** Sort key: a table sits by the first-labelled table of its run, so a run reads as one block. */
const runKey = (labels: Record<string, string>) => (l: Lane) => [...l.run, l.table].map(t => labels[t] ?? t).sort(nat)[0]!
const order = (ls: Lane[]) => ((ls2 = ls.map(l => [l.table, l.label] as const), k = runKey(Object.fromEntries(ls2))) => [...ls].sort((a, b) => nat(k(a), k(b)) || nat(a.label, b.label)))()
const groups = (app: App, ls: Lane[]) => Object.entries(order(ls).reduce<Record<string, Lane[]>>((m, l) => ((g = groupOf(app, app.store.state.world)(l)) => ({...m, [g]: [...(m[g] ?? []), l]}))(), {}))
const links = (l: Lane, labels: Record<string, string>) => (l.run.length ? `<span class="text-slate-500 dark:text-slate-400" title="Links with ${esc(l.run.map(t => labels[t] ?? t).join(', '))}"><span aria-hidden="true">⇔</span><span class="sr-only">links with ${esc(l.run.map(t => labels[t] ?? t).join(', '))}</span></span>` : '')
/** The lock marker on a held table's label. */
const lock = (app: App, l: Lane) => ((h = holdAt(app, l.table)) => (h ? `<span data-lock title="${esc(lockSay(app, h))}" class="text-amber-700 dark:text-amber-300"><span aria-hidden="true">🔒</span><span class="sr-only">${esc(lockSay(app, h))}</span></span>` : ''))()
const row = (app: App, v: StratView, labels: Record<string, string>) => (l: Lane) => ((now = app.store.state.now) =>
  `<li data-tid="${esc(l.table)}" data-lane class="grid grid-cols-[6.5rem_1fr] items-center gap-2"><div class="flex items-center gap-1 truncate text-xs">${ref(l.table, l.label)}${links(l, labels)}${lock(app, l)}</div>` +
  `<div class="relative h-6 rounded bg-slate-100 dark:bg-slate-900">${seated(l)}${planned(now)(l)}${held(app, v.lanes, worldHolds(app.store.state.world).filter(h => h.until > now), now)(l)}${paired(v.pairs)(l)}</div></li>`)()
const TICKS = [0, 30, 60, 90, 120, 150]
const axis = (now: number) => `<div aria-hidden="true" class="grid grid-cols-[6.5rem_1fr] gap-2 text-xs text-slate-600 dark:text-slate-300"><span>Table</span><div class="relative h-4">${TICKS.map(m => `<span class="absolute -translate-x-1/2 tabular-nums" style="left:${pct(m)}">${m ? `+${m}m` : hhmm(now)}</span>`).join('')}</div></div>`
const legend = `<ul aria-label="Legend" class="mb-2 flex flex-wrap gap-3 text-xs">${Object.entries(BAR).map(([k, b]) => `<li data-legend="${k}" class="flex items-center gap-1"><span aria-hidden="true" class="inline-block h-3 w-5 rounded-sm ${b.cls}"></span>${b.say}</li>`).join('')}</ul>`
const block = (app: App, v: StratView, labels: Record<string, string>) => ([g, ls]: [string, Lane[]]) =>
  `<li data-group="${esc(g)}"><h3 class="mt-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">${esc(g)}</h3><ul class="space-y-0.5">${ls.map(row(app, v, labels)).join('')}</ul></li>`
export const timeline = (app: App, v: StratView) => ((labels = Object.fromEntries(v.lanes.map(l => [l.table, l.label]))) =>
  `${legend}${axis(app.store.state.now)}<ul class="max-h-[32rem] overflow-y-auto">${groups(app, v.lanes).map(block(app, v, labels)).join('')}</ul>${v.lanes.length ? '' : `<p class="${help}">No tables in the plan.</p>`}`)()
