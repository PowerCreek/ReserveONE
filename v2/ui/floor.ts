// Floor view (U2, U3): one world, two views. 2D = top-down SVG of one floor or one whole stitched level (tabs pick it, the viewBox fits it), with sections, tables and their feature chips, link groups, door, units, task lines and pings. Iso = every level stacked in 3D (iso.ts).
import {having} from '../contracts/index.ts'
import type {App, Hold, Id, Policy, World} from '../contracts/index.ts'
import {policyOf} from './ask.ts'
import {badge, chips, door, link, ping, section, table, unit} from './draw.ts'
import {DOOR, H, LV, W, doorFloor, fitBox, floorOf, floorsOf, hull, levelName, levelOf, levels} from './geo.ts'
import {ISO, isoControls, isoSvg, tweak} from './iso.ts'
import type {Iso} from './iso.ts'
import {holdsOf, live} from './assign.ts'
import {presets} from './presets.ts'
import {arg, esc, panel} from './render.ts'
import {btn, card, ctaSm, ghost, on} from './tone.ts'
import {uiOf} from './state.ts'
import type {Fx} from './state.ts'
declare module '../contracts/kernel.ts' {
  interface UiState {floorId?: string; floorView?: '2d' | 'iso'; iso?: Iso}
}
export const floorPane = `<div data-floor="ui.rev" class="${card}"></div>`
const pick = (id: string) => `<button data-act="scenario" data-id="${id}" class="${btn}">${esc(presets[id].label)}</button>`
const empty = `<div class="flex flex-col items-center gap-3 p-10 text-slate-500"><p>No floor yet. Load a scenario to start the sim.</p><div class="flex flex-wrap gap-2">${Object.keys(presets).map(pick).join('')}</div></div>`
/** Tabs: per storey, a whole-level tab (when the level stitches several floors) and then each floor. */
export interface Tab {id: Id; name: string; ids: Id[]}
export const tabList = (w: World): Tab[] => levels(w).flatMap(lv => {
  const fs = having(w, 'floor').filter(f => levelOf(w, f.id) === lv)
  return [...(fs.length > 1 ? [{id: `${LV}${lv}`, name: `${levelName(lv)}: all`, ids: fs.map(f => f.id)}] : []), ...fs.map(f => ({id: f.id, name: f.floor.name, ids: [f.id]}))]
})
/** The tab on show: the chosen one if it exists, else the first floor (undefined when the world declares none, which shows everything). */
export const shown = (w: World, chosen?: Id) => (tabList(w).some(t => t.id === chosen) ? chosen : having(w, 'floor')[0]?.id)
/** What the active service mode paints on the floor: who holds each table, and whether section tints are in force. */
export interface Holding {holds: Hold[]; live: boolean}
const MARGIN = 44 // room for section names above and chips below the outer tables
export const ZOOM = 1.5 // the most a small floor is magnified
/** Everything the 2D view draws for `fid` (a floor, a level tab, or undefined = all): tables, link groups, units, pings, and whether the door shows. */
const scope = (w: World, fx: Fx[], fid?: Id) => {
  const fs = floorsOf(w, fid)
  const here = (f?: Id) => fs === undefined || fs.includes(f ?? '')
  const at = doorFloor(w)
  return {ts: having(w, 'table', 'pos').filter(t => here(t.pos.floor)), links: having(w, 'link').filter(k => here(floorOf(w, k.link.members[0]!))), door: fs === undefined || at === undefined || here(at),
    units: having(w, 'body').filter(b => here(floorOf(w, b.id))), fx: fx.filter(f => !f.floor || here(f.floor))}
}
/** The viewBox: the scope's tables, units, pings and door, plus a margin, at the frame's aspect (a small floor zooms at most ZOOM). */
const fitOf = (s: ReturnType<typeof scope>) => {
  const pts = [...s.units.map(b => ({x: b.body.x, y: b.body.y})), ...s.fx, ...(s.door ? [DOOR] : [])].map(p => ({x: p.x, y: p.y, w: 0, h: 0}))
  return fitBox(hull([...s.ts.map(t => t.pos), ...pts]) ?? {x: 0, y: 0, w: W, h: H}, MARGIN, W / H, W / ZOOM)
}
export const floorSvg = (w: World, fx: Fx[], fid?: Id, held: Holding = {holds: [], live: true}) => {
  const s = scope(w, fx, fid)
  const secs = having(w, 'section').map(x => section(x, s.ts.filter(t => t.table.section === x.id), held.live))
  return `<svg viewBox="${fitOf(s)}" class="max-h-[78vh] w-full rounded bg-slate-100 dark:bg-slate-900" role="img" aria-label="restaurant floor">` + [
    ...secs, ...s.links.map(link(w)), ...s.ts.map(table(w, held.holds)), ...s.ts.map(badge(w, held.holds)), ...s.ts.map(chips), ...(s.door ? [door] : []), ...s.units.map(unit(w)), ...s.fx.map(ping),
  ].join('') + '</svg>'
}
const tab = (w: World, p: Policy, fid?: Id) => (t: Tab) => {
  const ts = having(w, 'table', 'pos').filter(x => t.ids.includes(x.pos.floor) && !p.seat.selfSeat.includes(x.table.shape)) // stools are first come, first served: not the host's to count
  const free = ts.filter(x => x.table.status === 'available').length
  return `<button role="radio" aria-checked="${t.id === fid}" data-act="floor" data-id="${esc(t.id)}" class="${t.id === fid ? on : btn}">${esc(t.name)} <span class="text-xs opacity-75">${free}/${ts.length}</span></button>`
}
/** Tabs only when there is a choice to make. */
export const tabsOf = (w: World, p: Policy, fid?: Id) =>
  having(w, 'floor').length > 1 ? `<nav data-floors role="radiogroup" aria-label="floor" class="mb-2 flex flex-wrap gap-1">${tabList(w).map(tab(w, p, fid)).join('')}</nav>` : ''
const isoOf = (app: App) => ({...ISO, ...uiOf(app).iso})
const held = (app: App): Holding => ({holds: holdsOf(app), live: live(app)})
const ctx = (app: App) => ({w: app.store.state.world, holds: holdsOf(app), areas: policyOf(app).service.areas})
const flat = (app: App) => {
  const [w, fid] = [app.store.state.world, shown(app.store.state.world, uiOf(app).floorId)]
  return tabsOf(w, policyOf(app), fid) + floorSvg(w, uiOf(app).fx, fid, held(app))
}
const VIEWS: Record<string, (app: App) => string> = {
  '2d': flat,
  iso: app => isoControls(ctx(app), isoOf(app)) + isoSvg(ctx(app), isoOf(app), uiOf(app).fx),
}
const viewOf = (app: App) => uiOf(app).floorView ?? '2d'
const toggle = (v: string) => `<div role="radiogroup" aria-label="floor view" class="mb-2 inline-flex gap-1">${[['2d', '2D'], ['iso', 'Iso']].map(([k, l]) =>
  `<button type="button" role="radio" aria-checked="${v === k}" data-act="floorView" data-id="${k}" class="${v === k ? ctaSm : ghost}">${l}</button>`).join('')}</div>`
const draw = (app: App) => (having(app.store.state.world, 'table', 'pos').length ? toggle(viewOf(app)) + VIEWS[viewOf(app)]!(app) : empty)
/** Repaint replaces the panel's buttons: put keyboard focus back on the one just pressed. */
const refocus = (ev: Event) => {
  const b = (ev.target as Element).closest('[data-act]')
  const sel = b && ['data-act', 'data-id', 'data-k', 'data-v'].filter(a => b.hasAttribute(a)).map(a => `[${a}="${b.getAttribute(a)}"]`).join('')
  return sel && b.ownerDocument.activeElement === b && setTimeout(() => b.ownerDocument.querySelector<HTMLElement>(`[data-floor] ${sel}`)?.focus())
}
const ACTS: Record<string, (app: App, ev: Event) => void> = {
  floor: (a, ev) => (uiOf(a).floorId = arg(ev, 'id')),
  floorView: (a, ev) => (uiOf(a).floorView = arg(ev, 'id') === 'iso' ? 'iso' : '2d'),
  iso: (a, ev) => (uiOf(a).iso = tweak(isoOf(a), arg(ev, 'k'), arg(ev, 'v'))),
}
export const floor = (app: App) => {
  Object.entries(ACTS).forEach(([n, f]) => app.act(n, (a, ev) => (f(a, ev), uiOf(a).rev++, refocus(ev))))
  app.binder(panel(app, 'data-floor', draw))
}
