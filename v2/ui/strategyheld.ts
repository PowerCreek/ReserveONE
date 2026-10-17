// Saved table holds as the UI reads them: the world's `hold` components (the truth; engine/held.ts honours them on every placement path), grouped by id.
// Shared by the Strategy tab, the table card and the Queue's fast seat: the lock line, the hold state, and the override (seat anyway, force: true, after a confirm step).
import {having} from '../contracts/index.ts'
import type {App, Id, World} from '../contracts/index.ts'
import type {StratHold} from '../contracts/strategy.ts'
import {run} from './act.ts'
import {dest, land} from './bookask.ts'
import {esc} from './render.ts'
import {uiOf} from './state.ts'
import {ghost, help} from './tone.ts'
declare module '../contracts/kernel.ts' {
  interface UiState {force?: {tid: Id; size: number} | null} // the override waiting for its confirm
}
/** Saved holds, one per id with all its tables, in id order. */
export const worldHolds = (w: World): StratHold[] =>
  Object.values(having(w, 'hold').reduce<Record<string, StratHold>>((m, e) => ({...m, [e.hold.id]: {...e.hold, tables: [...(m[e.hold.id]?.tables ?? []), e.id]}}), {}))
export const forWho = (w: World, h: StratHold) => ((p = w.ents[h.party ?? '']?.party) => (p ? `${p.label}${p.name ? ` ${p.name}` : ''} x${p.size}` : `a ${h.size}`))()
const clock = (at: number) => new Date(at).toISOString().slice(11, 16)
/** The unexpired hold on a table, if any. */
export const holdAt = (app: App, tid: Id) => worldHolds(app.store.state.world).find(h => h.tables.includes(tid) && h.until > app.store.state.now)
export const lockSay = (app: App, h: StratHold) => `held until ${clock(h.until)} for ${forWho(app.store.state.world, h)}`
/** The lock line wherever a table is named (card, timeline): '🔒 held until 19:30 for R-3 Rossi x5'. */
export const heldLine = (app: App, tid: Id) => ((h = holdAt(app, tid)) => (h ? `<p data-held-line data-tid="${esc(tid)}" class="text-xs font-medium text-amber-800 dark:text-amber-300"><span aria-hidden="true">🔒</span> ${esc(lockSay(app, h))}${h.why ? `: ${esc(h.why)}` : ''}</p>` : ''))()
/** Held tables a fresh party of `size` is refused at now, with the engine's own reason (its dry run of a seat there). */
const blocked = (app: App, size: number) => [...new Set(worldHolds(app.store.state.world).filter(h => h.until > app.store.state.now).flatMap(h => h.tables))]
  .filter(t => (app.store.state.world.ents[t]?.table?.capacity ?? 0) >= size)
  .map(t => ({t, d: dest(app, {do: 'seat', size, spot: t})})).filter(x => !x.d.ok && / held /.test(x.d.err))
const label = (app: App, t: Id) => app.store.state.world.ents[t]?.table?.label ?? t
const ask1 = (app: App, size: number) => ({t, d}: {t: Id; d: {err: string}}) =>
  `<li data-override="${esc(t)}" data-tid="${esc(t)}" class="flex flex-wrap items-center gap-2 py-1 text-xs"><span class="grow">${esc(d.err)}</span><button type="button" data-act="strat-force" data-tid="${esc(t)}" data-n="${size}" class="${ghost}">Seat anyway at ${esc(label(app, t))} (override)</button></li>`
const confirm = (app: App, f: {tid: Id; size: number}) =>
  `<div role="alertdialog" aria-label="Confirm override" data-force-confirm class="mt-2 flex flex-wrap items-center gap-2 rounded border border-rose-500 bg-rose-50 p-2 text-xs text-rose-950 dark:bg-rose-950 dark:text-rose-50"><span class="grow">Seat a party of ${f.size} at ${esc(label(app, f.tid))} over its hold? This is logged.</span>` +
  `<button type="button" data-act="strat-force-yes" class="min-h-8 rounded-md bg-rose-600 px-3 font-semibold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-sky-500">Confirm override</button><button type="button" data-act="strat-force-no" class="${ghost}">Cancel</button></div>`
/** Under the fast-seat buttons: each held table that refuses this size, why, and Seat anyway (two steps). */
export const overrides = (app: App) => ((size = uiOf(app).size, bs = blocked(app, size), f = uiOf(app).force) =>
  (bs.length ? `<div data-overrides class="mt-2"><p class="${help}">Held tables skipped for x${size}:</p><ul>${bs.map(ask1(app, size)).join('')}</ul>${f ? confirm(app, f) : ''}</div>` : ''))()
/** The forced seat; the engine's outcome warns '(over a hold: ...)', so the log keeps it. */
const yes = (app: App, f: {tid: Id; size: number}) => land(app, run(app, {do: 'seat', size: f.size, spot: f.tid, force: true}))
export const forceActs: Record<string, (app: App, ev: Event) => unknown> = {
  'strat-force': (app, ev) => ((b = (ev.target as Element).closest('[data-act]')!) => (uiOf(app).force = {tid: b.getAttribute('data-tid')!, size: Number(b.getAttribute('data-n'))}))(),
  'strat-force-yes': app => ((f = uiOf(app).force) => ((uiOf(app).force = null), f && yes(app, {...f})))(),
  'strat-force-no': app => (uiOf(app).force = null),
}
