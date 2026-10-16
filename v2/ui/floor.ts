// Floor view (U2, U3): top-down SVG of one floor at a time (tabs pick it), with sections, tables and their feature chips, link groups, door, units, task lines and pings.
import {having} from '../contracts/index.ts'
import type {App, Hold, Id, World} from '../contracts/index.ts'
import {badge, chips, door, link, ping, section, table, unit} from './draw.ts'
import {H, W, doorFloor, floorOf} from './geo.ts'
import {holdsOf, live} from './assign.ts'
import {presets} from './presets.ts'
import {arg, esc, panel} from './render.ts'
import {btn, card, on} from './tone.ts'
import {uiOf} from './state.ts'
import type {Fx} from './state.ts'
declare module '../contracts/kernel.ts' {
  interface UiState {floorId?: string}
}
export const floorPane = `<div data-floor="ui.rev" class="${card}"></div>`
const pick = (id: string) => `<button data-act="scenario" data-id="${id}" class="${btn}">${esc(presets[id].label)}</button>`
const empty = `<div class="flex flex-col items-center gap-3 p-10 text-slate-500"><p>No floor yet. Load a scenario to start the sim.</p><div class="flex flex-wrap gap-2">${Object.keys(presets).map(pick).join('')}</div></div>`
/** The floor on show: the chosen one if it exists, else the first (undefined when the world declares none, which shows everything). */
export const shown = (w: World, chosen?: Id) => {
  const ids = having(w, 'floor').map(f => f.id)
  return ids.includes(chosen ?? '') ? chosen : ids[0]
}
const here = (fid?: Id) => <T extends {pos: {floor: Id}}>(e: T) => fid === undefined || e.pos.floor === fid
/** What the active service mode paints on the floor: who holds each table, and whether section tints are in force. */
export interface Holding {holds: Hold[]; live: boolean}
/** `fid` filters tables, link groups, units and pings to one floor; the door shows on its own floor. */
export const floorSvg = (w: World, fx: Fx[], fid?: Id, held: Holding = {holds: [], live: true}) => {
  const ts = having(w, 'table', 'pos').filter(here(fid))
  const secs = having(w, 'section').map(s => section(s, ts.filter(t => t.table.section === s.id), held.live))
  const links = having(w, 'link').filter(k => fid === undefined || floorOf(w, k.link.members[0]) === fid)
  const at = doorFloor(w)
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full rounded bg-slate-100 dark:bg-slate-900" role="img" aria-label="restaurant floor">` + [
    ...secs, ...links.map(link(w)), ...ts.map(table), ...ts.map(badge(w, held.holds)), ...ts.map(chips), ...(fid === undefined || at === undefined || at === fid ? [door] : []),
    ...having(w, 'body').filter(b => fid === undefined || floorOf(w, b.id) === fid).map(unit(w)),
    ...fx.filter(f => fid === undefined || !f.floor || f.floor === fid).map(ping),
  ].join('') + '</svg>'
}
const tab = (w: World, fid?: Id) => (f: {id: Id; floor: {name: string}}) => {
  const ts = having(w, 'table', 'pos').filter(t => t.pos.floor === f.id)
  const free = ts.filter(t => t.table.status === 'available').length
  return `<button data-act="floor" data-id="${esc(f.id)}" class="${f.id === fid ? on : btn}">${esc(f.floor.name)} <span class="text-xs opacity-75">${free}/${ts.length}</span></button>`
}
/** Tabs only when there is a choice to make. */
export const tabsOf = (w: World, fid?: Id) => {
  const fs = having(w, 'floor')
  return fs.length > 1 ? `<nav data-floors class="mb-2 flex flex-wrap gap-1">${fs.map(tab(w, fid)).join('')}</nav>` : ''
}
const draw = (app: App) => {
  const w = app.store.state.world
  const fid = shown(w, uiOf(app).floorId)
  return having(w, 'table', 'pos').length ? tabsOf(w, fid) + floorSvg(w, uiOf(app).fx, fid, {holds: holdsOf(app), live: live(app)}) : empty
}
export const floor = (app: App) => {
  app.act('floor', (a, ev) => ((uiOf(a).floorId = arg(ev, 'id')), uiOf(a).rev++))
  app.binder(panel(app, 'data-floor', draw))
}
