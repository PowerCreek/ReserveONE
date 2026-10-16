// Staff + rotation: engine.rotate order (next up first), duty toggle, skip bump, and the busser's engine.bus order.
import {having} from '../contracts/index.ts'
import type {App, Ent, Patch} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {ask} from './ask.ts'
import {note} from './log.ts'
import {arg, esc, panel} from './render.ts'
import {btn, card} from './tone.ts'
const edit: Record<string, (s: Ent<'staff'>) => Partial<Ent<'staff'>['staff']>> = {duty: s => ({active: !s.staff.active}), skip: s => ({skip: s.staff.skip + 1})}
const change = (app: App, ev: Event) => {
  const s = app.store.state.world.ents[arg(ev, 'id')] as Ent<'staff'>
  const parts = {staff: {...s.staff, ...edit[arg(ev, 'to')](s)}}
  commit(app, [{op: 'set', id: s.id, parts} as Patch])
  note(app, 'action', `${s.staff.name}: ${arg(ev, 'to')}`)
}
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
export const staffPane = `<div class="grid gap-3 md:grid-cols-2"><div class="${card}"><h2 class="mb-2 text-sm font-semibold">Rotation (next up first)</h2><ul data-staff="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div>
<div class="${card}"><h2 class="mb-2 text-sm font-semibold">Bus order</h2><ul data-bus="ui.rev"></ul></div></div>`
export const staff = (app: App) => app.act('staff', change).binder(panel(app, 'data-staff', rows)).binder(panel(app, 'data-bus', bus))
