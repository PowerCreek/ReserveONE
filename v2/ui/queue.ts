// Queue + fast seating: size stepper with the engine's best fit, a progressive size strip, and the waiting list in tier order.
import type {App} from '../contracts/index.ts'
import {run} from './act.ts'
import {ask} from './ask.ts'
import {esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {HEAT, btn, card, on} from './tone.ts'
const SIZES = [1, 2, 3, 4, 5, 6, 7, 8]
const clamp = (n: number) => Math.min(12, Math.max(1, n))
export const refit = (app: App) => {
  const [it] = ask(app, 'fit', [uiOf(app).size]) ?? []
  Object.assign(app.store.state.ui, {pick: it?.label ?? '', tone: it ? HEAT[it.code] : ''})
}
const acts: Record<string, (app: App, ev: Event) => unknown> = {
  more: app => (uiOf(app).size = clamp(uiOf(app).size + 1)),
  less: app => (uiOf(app).size = clamp(uiOf(app).size - 1)),
  join: app => run(app, {do: 'join', size: uiOf(app).size}),
  quick: app => run(app, {do: 'seat', size: uiOf(app).size}),
  size: (app, ev) => (uiOf(app).size = clamp(Number((ev.target as Element).closest('[data-n]')?.getAttribute('data-n')))),
}
const strip = (app: App) => (ask(app, 'fit', SIZES) ?? []).map(f =>
  `<button data-act="size" data-n="${f.size}" class="${HEAT[f.code]} rounded px-2 py-1 text-xs text-white" title="${esc(f.label)}">${f.size}: ${esc(f.label)}${f.ready ? '' : ` ${f.waitMin}m`}</button>`).join('')
/** The waiting list in the engine's door order (policy.queue.tier, then waited); a booking shows no quote. */
const quote = (app: App, id: string) => {
  const q = app.store.state.world.ents[id]?.queue
  return q ? ` / quote ${q.quotedMin}m` : ' / booked'
}
const rows = (app: App) => (ask(app, 'stand')?.door ?? []).map(r =>
  `<li class="flex items-center gap-2 py-1 text-sm"><b class="w-10">${esc(r.label)}</b><span class="grow">${esc(r.name)} x${r.size}</span><span class="text-xs text-slate-500">${r.waitedMin}m${quote(app, r.party)}</span><button data-act="seat" data-id="${r.party}" class="${on}">Seat</button></li>`).join('')
export const queuePane = `<div class="grid gap-3 md:grid-cols-2"><div class="${card}"><h2 class="mb-2 text-sm font-semibold">Fast seating</h2>
<div class="flex flex-wrap items-center gap-2"><button data-act="less" class="${btn}">-</button><span data-text="ui.size" class="w-6 text-center"></span><button data-act="more" class="${btn}">+</button>
<span>fits</span><b data-text="ui.pick" data-class="ui.tone" class="rounded px-2 py-1 text-white"></b><button data-act="quick" class="${on}">Seat now</button><button data-act="join" class="${btn}">Add to queue</button></div>
<div data-fits="ui.rev" class="mt-3 flex flex-wrap gap-1"></div></div>
<div class="${card}"><h2 class="mb-2 text-sm font-semibold">Waiting</h2><ul data-queue="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div></div>`
export const queue = (app: App) => {
  Object.entries(acts).forEach(([n, f]) => app.act(n, f))
  app.binder(panel(app, 'data-fits', strip)).binder(panel(app, 'data-queue', rows))
  ;['ui.size', 'ui.rev'].forEach(p => app.store.watch(p, () => refit(app), true))
}
