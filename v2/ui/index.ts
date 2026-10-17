// UI plugin (C7): each concern is a small plugin; this file only lists them. Sim mode is the first tab, the dashboard second.
import {history} from '../kernel/index.ts'
import type {App, Plugin} from '../contracts/index.ts'
import {assign} from './assign.ts'
import {alerts, alertsPane} from './alerts.ts'
import {reserve, bookPane} from './book.ts'
import {clock} from './clock.ts'
import {controls, controlsPane} from './controls.ts'
import {logPane} from './eventlog.ts'
import {board, boardPane, kpiPane, nextPane} from './board.ts'
import {openCard} from './card.ts'
import {floor, floorPane} from './floor.ts'
import {prefs} from './prefs.ts'
import {queue, queuePane} from './queue.ts'
import {runner} from './runner.ts'
import {seat} from './seat.ts'
import {shell, tabs} from './shell.ts'
import {init, uiOf as view} from './state.ts'
import {staff, staffPane} from './staff.ts'
import {stand, standPane} from './stand.ts'
export * from './state.ts'
export {step, spawn} from './sim.ts'
export {load, START} from './scenario.ts'
export {presets} from './presets.ts'
const simPane = `${kpiPane}<div class="grid gap-3 lg:grid-cols-[1fr_22rem]"><div class="space-y-3">${controlsPane}${nextPane}${floorPane}</div><div class="space-y-3">${standPane}${logPane}</div></div>`
const panes = {sim: simPane, board: boardPane, queue: queuePane, book: bookPane, staff: staffPane, alerts: alertsPane}
/** Any change to the world or the clock bumps `ui.rev`, the one path every repainting panel binds to. */
const live = (app: App) => ['world', 'now'].forEach(p => app.store.watch(p, () => view(app).rev++))
const parts: Plugin[] = [history, tabs, controls, floor, prefs, queue, seat, reserve, staff, assign, stand, board, alerts, clock, runner, live]
export const ui: Plugin = app => {
  init(app)
  app.provide('card', {open: (a: App, t: string) => openCard(a, t)}) // the table card (U10a) for every panel's table chips
  parts.forEach(p => app.use(p))
  app.view(el => (el.innerHTML = shell(panes)))
}
