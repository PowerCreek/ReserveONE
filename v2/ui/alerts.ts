// Alerts: engine.alerts rendered as levelled cards; `alertCount` feeds the tab badge.
import type {App} from '../contracts/index.ts'
import {ask} from './ask.ts'
import {esc, panel} from './render.ts'
import {LEVEL, card} from './tone.ts'
export const alertCount = (app: App) => ask(app, 'alerts')?.length ?? 0
const rows = (app: App) => (ask(app, 'alerts') ?? []).map(a =>
  `<li class="border-l-4 ${LEVEL[a.level]} py-1 pl-2 text-sm"><b class="mr-2 uppercase">${a.kind}</b>${esc(a.msg)}</li>`).join('') || '<li class="text-sm text-slate-500">All clear.</li>'
export const alertsPane = `<div class="${card}"><h2 class="mb-2 text-sm font-semibold">Alerts</h2><ul data-alerts="ui.rev" class="space-y-1"></ul></div>`
export const alerts = (app: App) => app.binder(panel(app, 'data-alerts', rows))
