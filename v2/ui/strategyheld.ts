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
const clock = (at: number) => new Date(at).toISOString().slice(11, 16)
const tlabel = (w: World, t: Id) => w.ents[t]?.table?.label ?? t
/** Whom a hold is for: the named party as itself ('W-1 Patel x3'), else 'a party of 3'. A named hold never states a size of its own. */
export const forWho = (w: World, h: {party?: Id; size: number}) => ((p = w.ents[h.party ?? '']?.party) => (p ? `${p.label}${p.name ? ` ${p.name}` : ''} x${p.size}` : `a party of ${h.size}`))()
/** 'T9 + T10 (8 seats)': the held tables and the seats they give together. */
export const seatsOf = (w: World, ts: Id[]) => `${ts.map(t => tlabel(w, t)).join(' + ')} (${ts.reduce((n, t) => n + (w.ents[t]?.table?.capacity ?? 0), 0)} seats)`
const GATE_OPEN: Record<string, (w: World, now: number, h: StratHold) => boolean> = {
  none: () => true, at: (_w, now, h) => (h.gate as {at: number}).at <= now, free: (w, _n, h) => w.ents[(h.gate as {table: Id}).table]?.table?.status === 'available',
}
/** Whether the hold's gate has opened (no gate: open). */
export const isOpen = (w: World, now: number, h: StratHold) => GATE_OPEN[h.gate?.kind ?? 'none']!(w, now, h)
const GATE_SAY: Record<string, (w: World, h: StratHold) => string> = {free: (w, h) => `opens when ${tlabel(w, (h.gate as {table: Id}).table)} frees`, at: (_w, h) => `from ${clock((h.gate as {at: number}).at)}`}
const gateSay = (w: World, now: number, h: StratHold) => (h.until <= now ? `ended ${clock(h.until)}` : isOpen(w, now, h) ? 'live now' : GATE_SAY[h.gate!.kind]!(w, h))
/** The one hold sentence, everywhere a hold is shown: 'Hold T17 (4 seats) for W-1 Patel x3 until 14:15: <reason> · live now'. */
export const holdSay = (w: World, now: number, h: StratHold) => `Hold ${seatsOf(w, h.tables)} for ${forWho(w, h)} until ${clock(h.until)}: ${h.why || 'no reason given'} · ${gateSay(w, now, h)}`
/** The unexpired hold on a table, if any. */
export const holdAt = (app: App, tid: Id) => worldHolds(app.store.state.world).find(h => h.tables.includes(tid) && h.until > app.store.state.now)
export const lockSay = (app: App, h: StratHold) => holdSay(app.store.state.world, app.store.state.now, h)
/** The lock line wherever a table is named (card, timeline): '🔒 Hold T17 (4 seats) for ...'. */
export const heldLine = (app: App, tid: Id) => ((h = holdAt(app, tid)) => (h ? `<p data-held-line data-tid="${esc(tid)}" class="text-xs font-medium text-amber-800 dark:text-amber-300"><span aria-hidden="true">🔒</span> ${esc(lockSay(app, h))}</p>` : ''))()
/** The saved hold a refusal names (Outcome.held), as the full hold. */
const byRef = (app: App, id: string) => worldHolds(app.store.state.world).find(h => h.id === id)
/** Held tables a fresh party of `size` is refused at now, with the engine's own reason (its dry run of a seat there); never a hold named for `skip` (the door party being seated: its seat goes there by itself). */
const blocked = (app: App, size: number, skip?: Id) => [...new Set(worldHolds(app.store.state.world).filter(h => h.until > app.store.state.now && !(skip && h.party === skip)).flatMap(h => h.tables))]
  .filter(t => (app.store.state.world.ents[t]?.table?.capacity ?? 0) >= size)
  .map(t => ({t, d: dest(app, {do: 'seat', size, spot: t})})).filter(x => !x.d.ok && !!x.d.held && !(skip && x.d.held.party === skip))
const label = (app: App, t: Id) => app.store.state.world.ents[t]?.table?.label ?? t
const why = (app: App, d: {err: string; held?: {id: string}}) => ((h = byRef(app, d.held?.id ?? '')) => (h ? lockSay(app, h) : d.err))()
const ask1 = (app: App, size: number) => ({t, d}: {t: Id; d: {err: string; held?: {id: string}}}) =>
  `<li data-override="${esc(t)}" data-tid="${esc(t)}" class="flex flex-wrap items-center gap-2 py-1 text-xs"><span class="grow">${esc(why(app, d))}</span><button type="button" data-act="strat-force" data-tid="${esc(t)}" data-n="${size}" class="${ghost}">Seat anyway at ${esc(label(app, t))} (override)</button></li>`
const confirm = (app: App, f: {tid: Id; size: number}) =>
  `<div role="alertdialog" aria-label="Confirm override" data-force-confirm class="mt-2 flex flex-wrap items-center gap-2 rounded border border-rose-500 bg-rose-50 p-2 text-xs text-rose-950 dark:bg-rose-950 dark:text-rose-50"><span class="grow">Seat a party of ${f.size} at ${esc(label(app, f.tid))} anyway, over “${esc(((h = holdAt(app, f.tid)) => (h ? lockSay(app, h) : 'its hold'))())}”? This is logged.</span>` +
  `<button type="button" data-act="strat-force-yes" class="min-h-8 rounded-md bg-rose-600 px-3 font-semibold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-sky-500">Confirm override</button><button type="button" data-act="strat-force-no" class="${ghost}">Cancel</button></div>`
/** Under the fast-seat buttons: each held table that refuses this size, why, and Seat anyway (two steps). */
export const overrides = (app: App, skip?: Id) => ((size = uiOf(app).size, bs = blocked(app, size, skip), f = uiOf(app).force) =>
  (bs.length ? `<div data-overrides class="mt-2"><p class="${help}">Held tables skipped for x${size}:</p><ul>${bs.map(ask1(app, size)).join('')}</ul>${f ? confirm(app, f) : ''}</div>` : ''))()
/** The forced seat; the engine's outcome warns '(over a hold: ...)', so the log keeps it. */
const yes = (app: App, f: {tid: Id; size: number}) => land(app, run(app, {do: 'seat', size: f.size, spot: f.tid, force: true}))
export const forceActs: Record<string, (app: App, ev: Event) => unknown> = {
  'strat-force': (app, ev) => ((b = (ev.target as Element).closest('[data-act]')!) => (uiOf(app).force = {tid: b.getAttribute('data-tid')!, size: Number(b.getAttribute('data-n'))}))(),
  'strat-force-yes': app => ((f = uiOf(app).force) => ((uiOf(app).force = null), f && yes(app, {...f})))(),
  'strat-force-no': app => (uiOf(app).force = null),
}
