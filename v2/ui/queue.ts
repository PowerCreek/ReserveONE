// Queue + fast seating: size stepper with the engine's best fit, a progressive size strip, and the waiting list in tier order.
// "From the door list" (on while anyone waits): the Seat button names the door party it takes (StandView.bySize) and seats it, so no unmarked
// duplicate stays listed at the door; off, it seats a fresh walk-in. The party it would take is marked here and at the stand.
import type {App, Id, StandView} from '../contracts/index.ts'
import {run} from './act.ts'
import {ask} from './ask.ts'
import {esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {HEAT, btn, card, help, on, primary} from './tone.ts'
declare module '../contracts/kernel.ts' {
  interface UiState {fromDoor?: boolean} // the fast-seat door toggle (default on)
}
const SIZES = [1, 2, 3, 4, 5, 6, 7, 8]
const clamp = (n: number) => Math.min(12, Math.max(1, n))
export const refit = (app: App) => {
  const [it] = ask(app, 'fit', [uiOf(app).size]) ?? []
  Object.assign(app.store.state.ui, {pick: it?.label ?? '', tone: it ? HEAT[it.code] : ''})
}
/** One unfocused stand read per repaint (`ui.rev`), shared by the fast-seat button and the waiting list. */
const views = new WeakMap<App, {rev: number; v?: StandView}>()
const doorView = (app: App) => (views.get(app)?.rev === uiOf(app).rev ? views.get(app)! : views.set(app, {rev: uiOf(app).rev, v: ask(app, 'stand')}).get(app)!).v
/** The door party a fast seat of the current size takes (toggle on and someone of that size waits), else undefined. */
export const taker = (app: App, v: StandView | undefined = doorView(app)): Id | undefined => ((uiOf(app).fromDoor ?? true) ? v?.bySize[uiOf(app).size] : undefined)
const named = (v: StandView | undefined, id?: Id) => v?.door.find(r => r.party === id)
const quick = (app: App) => (taker(app) ? run(app, {do: 'seat', size: uiOf(app).size, from: 'door'}) : run(app, {do: 'seat', size: uiOf(app).size}))
const bump = (f: (app: App, ev: Event) => unknown) => (app: App, ev: Event) => (f(app, ev), uiOf(app).rev++)
const acts: Record<string, (app: App, ev: Event) => unknown> = {
  more: app => (uiOf(app).size = clamp(uiOf(app).size + 1)),
  less: app => (uiOf(app).size = clamp(uiOf(app).size - 1)),
  join: app => run(app, {do: 'join', size: uiOf(app).size}),
  quick,
  fromdoor: app => (uiOf(app).fromDoor = !(uiOf(app).fromDoor ?? true)),
  size: (app, ev) => (uiOf(app).size = clamp(Number((ev.target as Element).closest('[data-n]')?.getAttribute('data-n')))),
}
const strip = (app: App) => (ask(app, 'fit', SIZES) ?? []).map(f =>
  `<button type="button" data-act="size" data-n="${f.size}" aria-pressed="${f.size === uiOf(app).size}" class="${HEAT[f.code]} min-h-8 rounded px-2 text-xs tabular-nums text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 aria-pressed:ring-2 aria-pressed:ring-slate-900 dark:aria-pressed:ring-white" title="${esc(f.ready ? `Party of ${f.size}: ${f.label} is ready` : `Party of ${f.size}: ${f.label} in about ${f.waitMin}m`)}">${f.size}: ${esc(f.label)}${f.ready ? '' : ` ${f.waitMin}m`}</button>`).join('')
/** The seat button and the door toggle, named by who it takes. */
const seatLabel = (app: App, v?: StandView) => {
  const r = named(v, taker(app, v))
  return r ? `Seat ${r.name || r.label} x${r.size} from the door` : `Seat a new walk-in x${uiOf(app).size}`
}
const toggleOn = (app: App, v?: StandView) => (uiOf(app).fromDoor ?? true) && !!v?.door.length
const why = (app: App, v?: StandView) => (!v?.door.length ? 'Nobody is waiting at the door.' : !(uiOf(app).fromDoor ?? true) ? 'Off: seats a fresh walk-in; the door list stays as it is.' : taker(app, v) ? 'The party marked "Fast seat takes them" (here and at the stand) leaves the door list.' : `Nobody of ${uiOf(app).size} waiting: seats a fresh walk-in.`)
const fast = (app: App) => {
  const v = doorView(app)
  return `<div class="flex flex-wrap items-center gap-2"><button type="button" data-act="quick" data-takes="${esc(taker(app, v) ?? '')}" class="${primary}">${esc(seatLabel(app, v))}</button>` +
    `<button type="button" role="switch" data-act="fromdoor" aria-checked="${toggleOn(app, v)}" ${v?.door.length ? '' : 'disabled'} class="${toggleOn(app, v) ? on : btn}"><span aria-hidden="true">${toggleOn(app, v) ? '☑' : '☐'}</span> From the door list</button></div>` +
    `<p class="mt-1 ${help}">${esc(why(app, v))}</p>`
}
/** Fast-seat marker for the door party the Seat button would take (the queue rows and the stand's door cards). */
export const fastMark = '<span data-fastmark title="Will be seated by Fast seating (Queue tab): this party leaves the door list" class="inline-flex items-center gap-1 rounded bg-indigo-100 px-1 text-xs font-semibold text-indigo-950 dark:bg-indigo-950 dark:text-indigo-50"><span aria-hidden="true">⇢</span>Fast seat takes them</span>'
/** The waiting list in the engine's door order (policy.queue.tier, then waited); a booking shows no quote. */
const quote = (app: App, id: string) => {
  const q = app.store.state.world.ents[id]?.queue
  return q ? ` · quote ${q.quotedMin}m` : ' · booked'
}
const rows = (app: App) => {
  const v = doorView(app)
  return (v?.door ?? []).map(r =>
    `<li data-party="${esc(r.party)}" class="flex flex-wrap items-center gap-2 py-1 text-sm"><b class="w-12 tabular-nums">${esc(r.label)}</b><span class="grow">${esc(r.name)} x${r.size}</span>${taker(app, v) === r.party ? fastMark : ''}<span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">waited ${r.waitedMin}m${quote(app, r.party)}</span><button type="button" data-act="seat" data-id="${r.party}" class="${on}">Seat</button></li>`).join('')
}
export const queuePane = `<div class="grid gap-3 md:grid-cols-2"><div class="${card}"><h2 class="text-sm font-semibold">Fast seating</h2><p class="mb-2 ${help}">Seat a party by size in one click, at the best table that fits now.</p>
<div class="flex flex-wrap items-center gap-2"><button type="button" data-act="less" aria-label="One fewer guest" class="${btn}">−</button><span data-text="ui.size" class="w-6 text-center tabular-nums"></span><button type="button" data-act="more" aria-label="One more guest" class="${btn}">+</button>
<span class="text-sm">fits</span><b data-text="ui.pick" data-class="ui.tone" class="rounded px-2 py-1 text-white"></b><button type="button" data-act="join" class="${btn}">Add to queue</button></div>
<div data-fast="ui.rev" class="mt-2"></div>
<div data-fits="ui.rev" class="mt-3 flex flex-wrap gap-1"></div></div>
<div class="${card}"><h2 class="text-sm font-semibold">Waiting</h2><p class="mb-2 ${help}">The door list, next first.</p><ul data-queue="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div></div>`
export const queue = (app: App) => {
  Object.entries(acts).forEach(([n, f]) => app.act(n, bump(f)))
  app.binder(panel(app, 'data-fast', fast)).binder(panel(app, 'data-fits', strip)).binder(panel(app, 'data-queue', rows))
  ;['ui.size', 'ui.rev'].forEach(p => app.store.watch(p, () => refit(app), true))
}
