// Sim controls: play/pause, step, speed, spawn, arrival rate, scenario presets. Acts are a table (C3), one binder repaints the bar.
import type {App} from '../contracts/index.ts'
import {step, spawn} from './sim.ts'
import {note} from './log.ts'
import {choices, load} from './scenario.ts'
import {counter, gate} from './memo.ts'
import {arg, esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {btn, on} from './tone.ts'
const SPEEDS = [1, 5, 30, 120]
const acts: Record<string, (app: App, ev: Event) => void> = {
  play: app => (uiOf(app).running = !uiOf(app).running),
  step: app => step(app, 5000),
  speed: (app, ev) => (uiOf(app).speed = Number(arg(ev, 'v'))),
  spawn: (app, ev) => (spawn(app, Number(arg(ev, 'n'))), note(app, 'action', `Spawned ${arg(ev, 'n')} walk-in(s)`)),
  rate: (app, ev) => (uiOf(app).rate = Math.max(0, Math.round((uiOf(app).rate + Number(arg(ev, 'd'))) * 10) / 10)),
  scenario: (app, ev) => load(app, arg(ev, 'id')),
  clearlog: app => (uiOf(app).log = []),
}
const b = (act: string, attrs: string, label: string, hot = false) => `<button data-act="${act}" ${attrs} class="${hot ? on : btn}">${esc(label)}</button>`
const draw = (app: App) => {
  const u = uiOf(app)
  const run = b('play', '', u.running ? 'Pause' : 'Play', u.running)
  const speeds = SPEEDS.map(v => b('speed', `data-v="${v}"`, `${v}x`, u.speed === v)).join('')
  const rate = `${b('rate', 'data-d="-0.5"', '-')}<span class="px-1 text-sm">${u.rate}/min</span>${b('rate', 'data-d="0.5"', '+')}`
  const spawns = [1, 5].map(n => b('spawn', `data-n="${n}"`, `+${n} guest${n > 1 ? 's' : ''}`)).join('')
  const scen = choices().map(c => b('scenario', `data-id="${c.id}" title="${esc(c.blurb)}"`, c.label, u.scenario === c.id)).join('')
  return `<div class="flex flex-wrap items-center gap-2">${run}${b('step', '', 'Step 5s')}<span class="mx-1">|</span>${speeds}<span class="mx-1">|</span>${spawns}<span class="mx-1">|</span>arrivals ${rate}</div><div class="mt-2 flex flex-wrap items-center gap-2"><span class="text-xs uppercase text-slate-500">Scenario</span>${scen}</div>`
}
export const controlsPane = '<div data-controls="ui.ctl" class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"></div>'
/** The bar reads four keys only: it repaints on those (`ui.ctl`), never on a tick, camera or hover write. */
export const controls = (app: App) => {
  counter(app, 'ctl', ['ui.running', 'ui.speed', 'ui.rate', 'ui.scenario'])
  app.binder(panel(app, 'data-controls', gate(() => `${uiOf(app).ctl}`, () => draw(app))))
  Object.entries(acts).forEach(([n, f]) => app.act(n, f))
}
