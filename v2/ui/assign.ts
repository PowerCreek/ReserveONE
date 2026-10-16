// Assignment panel (U5): day mode readout + manual override, per-area carve choice, Deal, piecemeal tops with balance. Engine calls go through `ask`; every write is a `commit` (undoable).
import {defaultPolicy, having} from '../contracts/index.ts'
import type {App, Carve, Components, Ent, Hold, Id, Patch, World} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {ask} from './ask.ts'
import {note} from './log.ts'
import {arg, esc, panel} from './render.ts'
import {btn, card, on} from './tone.ts'
const cfg = defaultPolicy.service
type Svc = Components['service']
const svcOf = (w: World): Svc => ({override: null, carve: {}, ...w.ents.service?.service})
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const nat = (a: string, b: string) => a.localeCompare(b, undefined, {numeric: true})
/** Active mode id: always the engine's answer (it owns the clock and the override); without the service the override, else the first mode. */
export const modeNow = (app: App): string => ask(app, 'modeAt') ?? svcOf(app.store.state.world).override ?? Object.keys(cfg.modes)[0]
/** Whether holds are in force now (policy.service.modes[mode].holds). */
export const live = (app: App) => cfg.modes[modeNow(app)]?.holds ?? false
export const holdsOf = (app: App): Hold[] => ask(app, 'holds') ?? []
export const carveOf = (w: World, area: Id): Carve => svcOf(w).carve[area] ?? cfg.areas[area].carve[0]
const labelOf = (mode: string) => cfg.modes[mode]?.label ?? mode
// ---- writes
const setSvc = (app: App, change: Partial<Svc>) => {
  const w = app.store.state.world
  const next = {...svcOf(w), ...change}
  commit(app, [w.ents.service ? {op: 'set', id: 'service', parts: {service: next}} : {op: 'add', ent: {id: 'service', service: next}}])
}
const acts: Record<string, (app: App, ev: Event) => void> = {
  svcmode: (app, ev) => {
    const to = arg(ev, 'to')
    setSvc(app, {override: to === 'auto' ? null : to})
    note(app, 'action', to === 'auto' ? 'Service mode follows the schedule' : `Service mode forced to ${labelOf(to)}`)
  },
  svccarve: (app, ev) => {
    const [area, to] = [arg(ev, 'area'), arg(ev, 'to') as Carve]
    cfg.areas[area]?.carve.includes(to) && (setSvc(app, {carve: {...svcOf(app.store.state.world).carve, [area]: to}}), note(app, 'action', `${cfg.areas[area].label}: ${to} (press Deal)`))
  },
  svctop: (app, ev) => {
    const w = app.store.state.world
    const [t, who] = [w.ents[arg(ev, 'tid')], w.ents[arg(ev, 'who')]]
    t?.table && who?.staff && (commit(app, [{op: 'set', id: t.id, parts: {assign: {staff: who.id}}}]), note(app, 'action', `${t.table.label} dealt to ${who.staff.name}`))
  },
  svcdeal: app => {
    const ps: Patch[] | undefined = ask(app, 'assign')
    ps?.length && commit(app, ps)
    note(app, ps ? 'action' : 'warn', ps ? (ps.length ? `Dealt: ${ps.length} change(s)` : 'Already dealt') : 'No assign service in the engine')
  },
}
// ---- views
const pill = (act: string, attrs: string, label: string, hot: boolean) => `<button data-act="${act}" ${attrs} class="${hot ? on : btn}">${esc(label)}</button>`
const modes = (app: App) => {
  const over = svcOf(app.store.state.world).override
  return [pill('svcmode', 'data-to="auto"', 'Follow schedule', over === null), ...Object.entries(cfg.modes).map(([id, m]) => pill('svcmode', `data-to="${id}"`, m.label, over === id))].join('')
}
const sched = () => cfg.schedule.map(s => `<span class="text-slate-500">${hhmm(s.from)} ${esc(labelOf(s.mode))}</span>`).join(' &rarr; ')
const readout = (app: App) => {
  const over = svcOf(app.store.state.world).override
  return `<p class="text-sm">Now: <b data-mode-now>${esc(labelOf(modeNow(app)))}</b> <span class="text-xs text-slate-500">${over ? 'manual override' : 'by schedule'}${live(app) ? '' : ' (no standing holds)'}</span></p>`
}
const servers = (w: World) => having(w, 'staff').filter(s => !s.staff.crew && s.staff.active)
const tablesOf = (w: World, area: Id) => having(w, 'table', 'area').filter(t => t.area.id === area).sort((a, b) => nat(a.table.label, b.table.label))
const holder = (w: World, id: Id) => w.ents[id].assign?.staff
/** Tops dealt per server in one area; `spread` = most minus fewest (1 or less is balanced). */
export const balance = (w: World, area: Id) => {
  const ts = tablesOf(w, area)
  const counts = servers(w).map(s => ({id: s.id, name: s.staff.name, n: ts.filter(t => holder(w, t.id) === s.id).length}))
  const ns = counts.map(c => c.n)
  return {counts, spread: counts.length ? Math.max(...ns) - Math.min(...ns) : 0}
}
const deal = (app: App) => {
  const n = ask(app, 'assign')?.length
  return pill('svcdeal', '', n === undefined ? 'Deal' : `Deal (${n ? `${n} change${n > 1 ? 's' : ''}` : 'balanced'})`, !!n)
}
const area = (app: App) => ([id, a]: [string, (typeof cfg.areas)[string]]) => {
  const w = app.store.state.world
  const picks = a.carve.length > 1 ? a.carve.map(c => pill('svccarve', `data-area="${id}" data-to="${c}"`, c === 'tops' ? 'piecemeal tops' : c === 'whole' ? 'whole area' : c, carveOf(w, id) === c)).join('') : ''
  return `<li data-area="${esc(id)}" class="flex flex-wrap items-center gap-2 py-1 text-sm"><b class="w-24">${esc(a.label)}</b><span class="text-xs text-slate-500">${carveOf(w, id)} | ${a.seen ? 'servers see seatings' : 'host tells the server'}</span>${picks}</li>`
}
const top = (w: World, ss: Ent<'staff'>[]) => (t: Ent<'table' | 'area'>) =>
  `<li data-top="${esc(t.id)}" class="flex flex-wrap items-center gap-1 py-1 text-sm"><b class="w-10">${esc(t.table.label)}</b>${ss.map(s => pill('svctop', `data-tid="${esc(t.id)}" data-who="${esc(s.id)}"`, s.staff.name, holder(w, t.id) === s.id)).join('')}</li>`
const tops = (app: App) => (id: string) => {
  const w = app.store.state.world
  const b = balance(w, id)
  return `<div data-tops="${esc(id)}" class="mt-2"><h3 class="text-xs font-semibold uppercase text-slate-500">${esc(cfg.areas[id].label)} tops</h3>` +
    `<p data-balance class="text-xs ${b.spread > 1 ? 'text-amber-600' : 'text-slate-500'}">Balance: ${b.counts.map(c => `${esc(c.name)} ${c.n}`).join(' | ')} | spread ${b.spread}</p>` +
    `<ul class="divide-y divide-slate-200 dark:divide-slate-700">${tablesOf(w, id).map(top(w, servers(w))).join('')}</ul></div>`
}
const draw = (app: App) => {
  const w = app.store.state.world
  const piece = Object.keys(cfg.areas).filter(id => cfg.areas[id].carve.includes('tops') && carveOf(w, id) === 'tops' && tablesOf(w, id).length)
  return `<h2 class="mb-2 text-sm font-semibold">Service mode</h2>${readout(app)}<p class="my-1 text-xs">${sched()}</p>` +
    `<div class="flex flex-wrap items-center gap-2">${modes(app)}<span class="mx-1">|</span>${deal(app)}</div>` +
    `<ul class="mt-2 divide-y divide-slate-200 dark:divide-slate-700">${Object.entries(cfg.areas).map(area(app)).join('')}</ul>` +
    (piece.length && !live(app) ? '<p class="mt-2 text-xs text-slate-500">Tops are ignored while this mode has no standing holds.</p>' : '') + piece.map(tops(app)).join('')
}
const chip = (app: App) => `${esc(labelOf(modeNow(app)))} <span class="opacity-75">${svcOf(app.store.state.world).override ? 'manual' : 'schedule'}</span>`
export const assignPane = `<div data-assign="ui.rev" class="${card}"></div>`
export const modePane = '<span data-mode="ui.rev" class="rounded bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700"></span>'
export const assign = (app: App) => {
  Object.entries(acts).forEach(([n, f]) => app.act(n, f))
  app.binder(panel(app, 'data-assign', draw)).binder(panel(app, 'data-mode', chip))
}
