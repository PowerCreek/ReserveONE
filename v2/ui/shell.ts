// App shell: header (title, clock, undo/redo), view tabs, and one pane per tab shown by the kernel's `data-show`.
import type {App} from '../contracts/index.ts'
import {alertCount} from './alerts.ts'
import {modePane} from './assign.ts'
import {clockPane} from './clock.ts'
import {panel} from './render.ts'
import {uiOf} from './state.ts'
import {btn, on} from './tone.ts'
export const TABS = [['sim', 'Sim'], ['board', 'Dashboard'], ['queue', 'Queue'], ['book', 'Reservations'], ['staff', 'Staff'], ['alerts', 'Alerts']] as const
const tab = (app: App) => ([id, label]: (typeof TABS)[number]) => {
  const n = id === 'alerts' ? alertCount(app) : 0
  return `<button type="button" data-act="tab" data-id="${id}" aria-current="${uiOf(app).tab === id ? 'page' : 'false'}" class="${uiOf(app).tab === id ? on : btn}">${label}${n ? ` <b class="tabular-nums" aria-label="${n} alerts">${n}</b>` : ''}</button>`
}
export const shell = (panes: Record<string, string>) => `<div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
<header class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
<h1 class="font-semibold">reserveONE <span class="text-xs text-slate-600 dark:text-slate-300">v2 sim</span></h1>${clockPane}${modePane}
<button type="button" data-act="undo" class="${btn}">Undo</button><button type="button" data-act="redo" class="${btn}">Redo</button>
<nav data-tabs="ui" class="ml-auto flex flex-wrap gap-1"></nav></header>
<main class="p-3 sm:p-4">${TABS.map(([id]) => `<section data-show="ui.on.${id}" hidden>${panes[id]}</section>`).join('')}</main></div>`
/** Show one tab (the panels on the others stop reading). */
export const go = (app: App, id: string) => Object.assign(uiOf(app), {tab: id, on: Object.fromEntries(TABS.map(([t]) => [t, t === id]))})
export const tabs = (app: App) => {
  app.act('tab', (a, ev) => go(a, (ev.target as Element).closest('[data-id]')!.getAttribute('data-id')!))
  app.binder(panel(app, 'data-tabs', a => TABS.map(tab(a)).join('')))
}
