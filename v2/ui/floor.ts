// Floor view (U2): top-down SVG of sections, tables, link groups, door, moving units, task lines and event pings.
import {having} from '../contracts/index.ts'
import type {App, World} from '../contracts/index.ts'
import {door, link, ping, section, table, unit} from './draw.ts'
import {H, W} from './geo.ts'
import {presets} from './presets.ts'
import {esc, panel} from './render.ts'
import {btn, card} from './tone.ts'
import {uiOf} from './state.ts'
import type {Fx} from './state.ts'
export const floorPane = `<div data-floor="ui.rev" class="${card}"></div>`
const pick = (id: string) => `<button data-act="scenario" data-id="${id}" class="${btn}">${esc(presets[id].label)}</button>`
const empty = `<div class="flex flex-col items-center gap-3 p-10 text-slate-500"><p>No floor yet. Load a scenario to start the sim.</p><div class="flex flex-wrap gap-2">${Object.keys(presets).map(pick).join('')}</div></div>`
const sections = (w: World) => having(w, 'section').map(s => section(s, having(w, 'table', 'pos').filter(t => t.table.section === s.id)))
export const floorSvg = (w: World, fx: Fx[]) =>
  `<svg viewBox="0 0 ${W} ${H}" class="w-full rounded bg-slate-100 dark:bg-slate-900" role="img" aria-label="restaurant floor">` +
  [...sections(w), ...having(w, 'link').map(link(w)), ...having(w, 'table', 'pos').map(table), door, ...having(w, 'body').map(unit(w)), ...fx.map(ping)].join('') + '</svg>'
const draw = (app: App) => {
  const w = app.store.state.world
  return having(w, 'table', 'pos').length ? floorSvg(w, uiOf(app).fx) : empty
}
export const floor = (app: App) => app.binder(panel(app, 'data-floor', draw))
