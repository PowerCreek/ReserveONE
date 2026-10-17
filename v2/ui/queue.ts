// Queue + fast seating: size stepper with the engine's best fit, a progressive size strip, the wait-list and call-ahead forms, and the priority queue (bookq.ts).
// Two buttons: "Seat from the door" takes the door party the stepper size matches (else the first in priority order) and "Seat walk-in (new)" mints a fresh one;
// selecting a party in the queue or at the stand sets the stepper to its size. The party the door button would take is marked here and at the stand.
import type {App, Id, StandView} from '../contracts/index.ts'
import {run} from './act.ts'
import {ask} from './ask.ts'
import {bk, dest, goes, keep, land, landed} from './bookask.ts'
import {esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {overrides} from './strategyheld.ts'
import {HEAT, btn, card, help, primary} from './tone.ts'
import {qrows, queueHead, waitForms, waitlist} from './bookq.ts'
const SIZES = [1, 2, 3, 4, 5, 6, 7, 8]
const clamp = (n: number) => Math.min(12, Math.max(1, n))
export const refit = (app: App) => {
  const [it] = ask(app, 'fit', [uiOf(app).size]) ?? []
  Object.assign(app.store.state.ui, {pick: it?.label ?? '', tone: it ? HEAT[it.code] : ''})
}
/** One unfocused stand read per repaint (`ui.rev`), shared by the fast-seat buttons and the waiting list. */
const views = new WeakMap<App, {rev: number; v?: StandView}>()
const doorView = (app: App) => (views.get(app)?.rev === uiOf(app).rev ? views.get(app)! : views.set(app, {rev: uiOf(app).rev, v: ask(app, 'stand')}).get(app)!).v
const named = (v: StandView | undefined, id?: Id) => v?.door.find(r => r.party === id)
/** The door party "Seat from the door" takes: in priority order, the first at the door whose size matches the stepper, else the first at the door; none = undefined. */
export const taker = (app: App, v: StandView | undefined = doorView(app)): Id | undefined => {
  const door = new Set(v?.door.map(r => r.party))
  const order = (bk(app, 'wait')?.rows ?? []).filter(r => door.has(r.party))
  const size = uiOf(app).size
  return (order.find(r => r.size === size)?.party ?? v?.bySize[size] ?? order[0]?.party ?? v?.door[0]?.party)
}
const seatDoor = (app: App) => ((id = taker(app)) => id && land(app, run(app, {do: 'seat', party: id})))()
const seatNew = (app: App) => land(app, run(app, {do: 'seat', size: uiOf(app).size}))
const bump = (f: (app: App, ev: Event) => unknown) => (app: App, ev: Event) => (f(app, ev), uiOf(app).rev++)
const acts: Record<string, (app: App, ev: Event) => unknown> = {
  more: app => (uiOf(app).size = clamp(uiOf(app).size + 1)),
  less: app => (uiOf(app).size = clamp(uiOf(app).size - 1)),
  join: app => run(app, {do: 'join', size: uiOf(app).size}),
  seatdoor: seatDoor,
  quick: seatNew,
  'landed-x': app => (uiOf(app).landed = null),
  size: (app, ev) => (uiOf(app).size = clamp(Number((ev.target as Element).closest('[data-n]')?.getAttribute('data-n')))),
}
const strip = (app: App) => (ask(app, 'fit', SIZES) ?? []).map(f =>
  `<button type="button" data-act="size" data-n="${f.size}" aria-pressed="${f.size === uiOf(app).size}" class="${HEAT[f.code]} min-h-8 rounded px-2 text-xs tabular-nums text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 aria-pressed:ring-2 aria-pressed:ring-slate-900 dark:aria-pressed:ring-white" title="${esc(f.ready ? `Party of ${f.size}: ${f.label} is ready` : `Party of ${f.size}: ${f.label} in about ${f.waitMin}m`)}">${f.size}: ${esc(f.label)}${f.ready ? '' : ` ${f.waitMin}m`}</button>`).join('')
/** Each button names who or what it takes and says in one line why it cannot act. */
const doorDest = (app: App, v?: StandView) => ((id = taker(app, v)) => (id ? dest(app, {do: 'seat', party: id}) : undefined))()
const doorLabel = (app: App, v?: StandView) => ((r = named(v, taker(app, v))) => (r ? `Seat ${r.label} ${r.name} x${r.size} from the door` : 'Seat from the door'))()
/** The line under a button: where it will seat (the engine's own dry run), or why it cannot. */
const line = (d?: ReturnType<typeof dest>, none = '') => (d ? (d.ok ? `Goes to ${d.where}, ready now.` : d.err) : none)
const seatBtn = (act: string, label: string, d: ReturnType<typeof dest> | undefined, none: string, extra = '') => `<div class="grid gap-1"><button type="button" data-act="${act}" ${extra} ${d?.ok ? '' : 'disabled'} class="${d?.ok ? primary : `${btn} opacity-60`}">${esc(label)}</button><p data-dest class="${help}">${esc(line(d, none))}</p></div>`
const fast = (app: App) => {
  const v = doorView(app)
  return `<div class="grid gap-2 sm:grid-cols-2">${seatBtn('seatdoor', doorLabel(app, v), doorDest(app, v), 'Nobody is waiting at the door.', `data-takes="${esc(taker(app, v) ?? '')}"`)}${seatBtn('quick', `Seat walk-in (new) x${uiOf(app).size}`, dest(app, {do: 'seat', size: uiOf(app).size}), '')}</div>${overrides(app)}${landed(app)}`
}
/** Fast-seat marker for the door party the Seat button would take (the queue rows and the stand's door cards). */
export const fastMark = '<span data-fastmark title="Seat from the door (Fast seating, Queue tab) will take this party" class="inline-flex items-center gap-1 rounded bg-indigo-100 px-1 text-xs font-semibold text-indigo-950 dark:bg-indigo-950 dark:text-indigo-50"><span aria-hidden="true">⇢</span>Seat from the door takes them</span>'
/** The priority queue (bookq.ts): everyone waiting in the booking desk's policy order, each row with why it sits there; the fast-seat marker on the party Seat takes. */
const rows = (app: App) => ((t = taker(app)) => qrows(app, id => (t === id ? fastMark : '') + (doorView(app)?.door.some(r => r.party === id) ? goes(app, id) : '')))()
export const queuePane = `<div class="grid gap-3 md:grid-cols-2"><div class="space-y-3"><div class="${card}"><h2 class="text-sm font-semibold">Fast seating</h2><p class="mb-2 ${help}">Seat a party by size in one click, at the best table that fits now.</p>
<div class="flex flex-wrap items-center gap-2"><button type="button" data-act="less" aria-label="One fewer guest" class="${btn}">−</button><span data-text="ui.size" class="w-6 text-center tabular-nums"></span><button type="button" data-act="more" aria-label="One more guest" class="${btn}">+</button>
<span class="text-sm">fits</span><b data-text="ui.pick" data-class="ui.tone" class="rounded px-2 py-1 text-white"></b><button type="button" data-act="join" class="${btn}">Add to queue</button></div>
<div data-fast="ui.rev" class="mt-2"></div>
<div data-fits="ui.rev" class="mt-3 flex flex-wrap gap-1"></div></div>${waitForms}</div>
<div class="${card}"><h2 class="text-sm font-semibold">Priority queue</h2><p class="mb-2 ${help}">Everyone waiting, next first: reservations, then call-aheads, then walk-ins, raised by flags and time waited (policy). Each row says why.</p>${queueHead}<ul data-queue="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div></div>`
export const queue = (app: App) => {
  waitlist(app)
  Object.entries(acts).forEach(([n, f]) => app.act(n, bump(f)))
  app.binder(panel(app, 'data-fast', fast)).binder(panel(app, 'data-fits', strip)).binder(panel(app, 'data-queue', keep(rows)))
  ;['ui.size', 'ui.rev'].forEach(p => app.store.watch(p, () => refit(app), true))
}
