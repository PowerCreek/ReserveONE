// Staff + rotation: engine.rotate order (next up first), duty toggle, skip bump, and the busser's engine.bus order.
import {having} from '../contracts/index.ts'
import type {App, Ent, Hold, World} from '../contracts/index.ts'
import {run} from './act.ts'
import {ask, policyOf} from './ask.ts'
import {assignPane, holdsOf} from './assign.ts'
import {arg, esc, panel} from './render.ts'
import {btn, card} from './tone.ts'
const change = (app: App, ev: Event) => run(app, {do: 'staff', id: arg(ev, 'id'), to: arg(ev, 'to') as 'duty' | 'skip'})
const ranked = (app: App) => {
  const staff = having(app.store.state.world, 'staff')
  return (ask(app, 'rotate') ?? staff.map(s => ({staff: s.id, score: 0}))).map(r => ({r, s: staff.find(x => x.id === r.staff)})).filter(x => x.s)
}
const rows = (app: App) => ranked(app).map(({r, s}, i) =>
  `<li class="flex items-center gap-2 py-1 text-sm"><b class="w-6">${i + 1}</b><span class="grow">${esc(s!.staff.name)}${s!.staff.active ? '' : ' (off)'}</span>` +
  `<span class="text-xs text-slate-500">tally ${s!.staff.tally} skip ${s!.staff.skip} score ${r.score.toFixed(2)}</span>` +
  ['duty', 'skip'].map(to => `<button data-act="staff" data-id="${s!.id}" data-to="${to}" class="${btn}">${to}</button>`).join('') + '</li>').join('')
const bus = (app: App) => (ask(app, 'bus') ?? []).map(b =>
  `<li class="py-1 text-sm">${esc(app.store.state.world.ents[b.table]?.table?.label ?? b.table)} waited ${b.waitedMin}m ${b.staff ? `by ${esc(app.store.state.world.ents[b.staff]?.staff?.name ?? b.staff)}` : '(unassigned)'}</li>`).join('')
// ---- unit cards: a server (weight 1) or a bartender pair (one weighted unit per level) with what it holds in the active mode
const LINE: Record<string, string> = {chunk: 'Section', whole: 'Section', tops: 'Tops', level: 'Level', rotation: 'Serving'}
const nat = (a: string, b: string) => a.localeCompare(b, undefined, {numeric: true})
const span = (ls: string[]) => (ls.length > 4 ? `${ls[0]}-${ls.at(-1)} (${ls.length})` : ls.join(' '))
const lbl = (w: World, h: Hold) => w.ents[h.table]?.table?.label ?? h.table
const secs = (w: World, hs: Hold[]) => [...new Set(hs.map(h => w.ents[h.table]?.table?.section ?? ''))].filter(Boolean).map(id => w.ents[id]?.section?.name ?? id).join(', ')
const named: Record<string, (w: World, hs: Hold[]) => string> = {chunk: secs, whole: secs}
const group = (hs: Hold[]) => Object.entries(hs.reduce<Record<string, Hold[]>>((a, h) => ({...a, [h.by]: [...(a[h.by] ?? []), h]}), {}))
const line = (w: World) => ([by, hs]: [string, Hold[]]) =>
  `<p data-held="${by}" class="text-xs"><span class="text-slate-500">${LINE[by]}</span> ${esc(span(hs.map(h => lbl(w, h)).sort(nat)))}${esc(named[by] ? ` (${named[by](w, hs)})` : '')}</p>`
const covers = (s: Ent<'staff'>) => `covers ${s.staff.tally}${(s.staff.weight ?? 1) > 1 ? ` (${(s.staff.tally / (s.staff.weight ?? 1)).toFixed(1)} per weight)` : ''}`
const title = (app: App, s: Ent<'staff'>) => esc(s.staff.crew ? `${policyOf(app).service.areas[s.staff.area ?? '']?.label ?? s.staff.area ?? 'Pair'}: ${s.staff.crew.join(' + ')}` : s.staff.name)
const unit = (app: App, hs: Hold[]) => (s: Ent<'staff'>) =>
  `<div data-unit="${esc(s.id)}" class="rounded border border-slate-200 p-2 dark:border-slate-700"><div class="flex items-center gap-2 text-sm"><b class="grow">${title(app, s)}${s.staff.active ? '' : ' (off)'}</b>` +
  `${s.staff.crew ? `<span class="rounded bg-violet-100 px-1 text-xs dark:bg-violet-900">pair x${s.staff.weight ?? 2}</span>` : ''}<span class="text-xs text-slate-500">${covers(s)}</span></div>` +
  group(hs.filter(h => h.staff === s.id)).map(line(app.store.state.world)).join('') + '</div>'
const units = (app: App) => {
  const [pairs, floor] = [having(app.store.state.world, 'staff').filter(s => s.staff.crew), having(app.store.state.world, 'staff').filter(s => !s.staff.crew)]
  const hs = holdsOf(app)
  const sect = (h: string, us: Ent<'staff'>[]) => (us.length ? `<h3 class="mt-2 text-xs font-semibold uppercase text-slate-500">${h}</h3><div class="mt-1 grid gap-2 sm:grid-cols-2">${us.map(unit(app, hs)).join('')}</div>` : '')
  return sect('Servers', floor) + sect('Bartender pairs (one unit per level)', pairs)
}
export const staffPane = `<div class="space-y-3">${assignPane}<div data-units="ui.rev" class="${card}"><h2 class="text-sm font-semibold">Crew</h2></div></div><div class="mt-3 grid gap-3 md:grid-cols-2"><div class="${card}"><h2 class="mb-2 text-sm font-semibold">Rotation (next up first)</h2><ul data-staff="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div>
<div class="${card}"><h2 class="mb-2 text-sm font-semibold">Bus order</h2><ul data-bus="ui.rev"></ul></div></div>`
export const staff = (app: App) => app.act('staff', change).binder(panel(app, 'data-staff', rows)).binder(panel(app, 'data-bus', bus)).binder(panel(app, 'data-units', a => `<h2 class="text-sm font-semibold">Crew</h2>${units(a)}`))
