// Queue + fast seating: size stepper with the engine's best fit, a progressive size strip, and the waiting list in tier order.
import {defaultPolicy, having} from '../contracts/index.ts'
import type {App} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {ask} from './ask.ts'
import {note} from './log.ts'
import {enroll} from './party.ts'
import {esc, panel} from './render.ts'
import {seatNow} from './seat.ts'
import {uiOf} from './state.ts'
import {HEAT, btn, card, on} from './tone.ts'
const SIZES = [1, 2, 3, 4, 5, 6, 7, 8]
const clamp = (n: number) => Math.min(12, Math.max(1, n))
export const refit = (app: App) => {
  const [it] = ask(app, 'fit', [uiOf(app).size]) ?? []
  Object.assign(app.store.state.ui, {pick: it?.label ?? '', tone: it ? HEAT[it.code] : ''})
}
const join = (app: App) => {
  const size = uiOf(app).size
  const quote = ask(app, 'eta', size)?.waitMin ?? 0
  commit(app, enroll(app, 'W', size, 'walk-in', now => ({queue: {since: now, quotedMin: quote, status: 'WAITING', from: null}})))
  note(app, 'action', `Queued a party of ${size} (quote ${quote}m)`)
}
const acts: Record<string, (app: App, ev: Event) => unknown> = {
  more: app => (uiOf(app).size = clamp(uiOf(app).size + 1)),
  less: app => (uiOf(app).size = clamp(uiOf(app).size - 1)),
  join,
  quick: app => seatNow(app, {size: uiOf(app).size, kind: 'W'}),
  size: (app, ev) => (uiOf(app).size = clamp(Number((ev.target as Element).closest('[data-n]')?.getAttribute('data-n')))),
}
const strip = (app: App) => (ask(app, 'fit', SIZES) ?? []).map(f =>
  `<button data-act="size" data-n="${f.size}" class="${HEAT[f.code]} rounded px-2 py-1 text-xs text-white" title="${esc(f.label)}">${f.size}: ${esc(f.label)}${f.ready ? '' : ` ${f.waitMin}m`}</button>`).join('')
const rows = (app: App) => {
  const {world, now} = app.store.state
  const tier = defaultPolicy.queue.tier
  return having(world, 'party', 'queue').filter(p => p.queue.status === 'WAITING').sort((a, b) => tier[a.party.kind] - tier[b.party.kind] || a.queue.since - b.queue.since).map(p =>
    `<li class="flex items-center gap-2 py-1 text-sm"><b class="w-10">${esc(p.party.label)}</b><span class="grow">${esc(p.party.name)} x${p.party.size}</span><span class="text-xs text-slate-500">${Math.floor((now - p.queue.since) / 60000)}m / quote ${p.queue.quotedMin}m</span><button data-act="seat" data-id="${p.id}" class="${on}">Seat</button></li>`).join('')
}
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
