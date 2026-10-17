// Staff + rotation: engine.rotate order (next up first), duty toggle, skip bump, the busser's engine.bus order,
// and each server's preferences (ui/prefs.ts chips + editor; states from the board's PrefRows).
import {having} from '../contracts/index.ts'
import type {App, Ent, Hold, Id, PrefRow, World} from '../contracts/index.ts'
import {run} from './act.ts'
import {ask, policyOf} from './ask.ts'
import {assignPane, holdsOf} from './assign.ts'
import {boardOf} from './board.ts'
import {chips, editor, form, rowsOf} from './prefs.ts'
import {arg, esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {btn, card, help} from './tone.ts'
const change = (app: App, ev: Event) => run(app, {do: 'staff', id: arg(ev, 'id'), to: arg(ev, 'to') as 'duty' | 'skip'})
const ranked = (app: App) => {
  const staff = having(app.store.state.world, 'staff')
  return (ask(app, 'rotate') ?? staff.map(s => ({staff: s.id, score: 0}))).map(r => ({r, s: staff.find(x => x.id === r.staff)})).filter(x => x.s)
}
/** The board's preference rows and bogged flag per unit (only read while the Staff tab shows). */
interface Seen {rows: (id: Id) => PrefRow[]; bog: (id: Id) => boolean}
const seenOf = (app: App): Seen => {
  const sv = uiOf(app).on?.staff ? boardOf(app)?.servers : undefined
  return {rows: id => rowsOf(app.store.state.world, id, sv?.find(r => r.staff === id)?.prefs), bog: id => !!sv?.find(r => r.staff === id)?.bogged}
}
const pc = (app: App) => ({p: policyOf(app), w: app.store.state.world})
const bogged = '<span data-bogged title="Covers now are well above the floor\'s mean" class="whitespace-nowrap rounded bg-amber-100 px-1 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-50"><span aria-hidden="true">⚠</span> bogged down</span>'
const LABEL: Record<string, (on: boolean) => string> = {duty: on => (on ? 'Take off duty' : 'Put on duty'), skip: () => 'Skip a turn'}
const rows = (app: App) => {
  const v = seenOf(app)
  return ranked(app).map(({r, s}, i) =>
    `<li class="flex flex-wrap items-center gap-2 py-1 text-sm"><b class="w-6 tabular-nums">${i + 1}</b><span class="grow">${esc(s!.staff.name)}${s!.staff.active ? '' : ' (off)'}</span>${v.bog(s!.id) ? bogged : ''}` +
    `<span class="text-xs tabular-nums text-slate-600 dark:text-slate-300" title="covers seated today · turns to skip · rotation score">${s!.staff.tally} covers · skip ${s!.staff.skip} · score ${r.score.toFixed(2)}</span>` +
    ['duty', 'skip'].map(to => `<button type="button" data-act="staff" data-id="${s!.id}" data-to="${to}" class="${btn}">${LABEL[to](s!.staff.active)}</button>`).join('') +
    `<div class="flex w-full flex-wrap gap-1 pl-8">${chips(pc(app), s!.id, v.rows(s!.id))}</div></li>`).join('')
}
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
  `<p data-held="${by}" class="text-xs"><span class="text-slate-600 dark:text-slate-300">${LINE[by]}</span> ${esc(span(hs.map(h => lbl(w, h)).sort(nat)))}${esc(named[by] ? ` (${named[by](w, hs)})` : '')}</p>`
const covers = (s: Ent<'staff'>) => `covers ${s.staff.tally}${(s.staff.weight ?? 1) > 1 ? ` (${(s.staff.tally / (s.staff.weight ?? 1)).toFixed(1)} per weight)` : ''}`
const title = (app: App, s: Ent<'staff'>) => esc(s.staff.crew ? `${policyOf(app).service.areas[s.staff.area ?? '']?.label ?? s.staff.area ?? 'Pair'}: ${s.staff.crew.join(' + ')}` : s.staff.name)
const unit = (app: App, hs: Hold[], v: Seen) => (s: Ent<'staff'>) =>
  `<div data-unit="${esc(s.id)}" class="rounded border border-slate-200 p-2 dark:border-slate-700"><div class="flex flex-wrap items-center gap-2 text-sm"><b class="grow">${title(app, s)}${s.staff.active ? '' : ' (off)'}</b>` +
  `${s.staff.crew ? `<span class="rounded bg-violet-100 px-1 text-xs text-violet-950 dark:bg-violet-900 dark:text-violet-50">pair x${s.staff.weight ?? 2}</span>` : ''}${v.bog(s.id) ? bogged : ''}<span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">${covers(s)}</span></div>` +
  group(hs.filter(h => h.staff === s.id)).map(line(app.store.state.world)).join('') + editor(pc(app), s.id, v.rows(s.id)) + '</div>'
const units = (app: App) => {
  const [pairs, floor] = [having(app.store.state.world, 'staff').filter(s => s.staff.crew), having(app.store.state.world, 'staff').filter(s => !s.staff.crew)]
  const [hs, v] = [holdsOf(app), seenOf(app)]
  const sect = (h: string, us: Ent<'staff'>[]) => (us.length ? `<h3 class="mt-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">${h}</h3><div class="mt-1 grid gap-2 sm:grid-cols-2">${us.map(unit(app, hs, v)).join('')}</div>` : '')
  return sect('Servers', floor) + sect('Bartender pairs (one unit per level)', pairs)
}
const crewHead = `<h2 class="text-sm font-semibold">Crew</h2><p class="${help}">Who serves what in the active mode, and each server's preferences. The rotation always comes first; a preference only skips or nudges within it. Presets are one click; click again to remove.</p>`
export const staffPane = `<div class="space-y-3">${assignPane}<div data-units="ui.rev" class="${card}">${crewHead}</div><div data-prefform="ui.prefs" class="${card} empty:hidden"></div></div><div class="mt-3 grid gap-3 md:grid-cols-2"><div class="${card}"><h2 class="text-sm font-semibold">Rotation (next up first)</h2><p class="mb-2 ${help}">Who gets the next table, with the preferences that can skip them.</p><ul data-staff="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div>
<div class="${card}"><h2 class="text-sm font-semibold">Bus order</h2><p class="mb-2 ${help}">Tables to clear, longest waiting first.</p><ul data-bus="ui.rev"></ul></div></div>`
export const staff = (app: App) => app.act('staff', change).binder(panel(app, 'data-staff', rows)).binder(panel(app, 'data-bus', bus)).binder(panel(app, 'data-units', a => crewHead + units(a))).binder(panel(app, 'data-prefform', form))
