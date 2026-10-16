// The sim clock: a wall-time interval that runs while `ui.running`, advancing sim time by TICK_MS * speed. Also the header read-out.
import {having} from '../contracts/index.ts'
import type {App} from '../contracts/index.ts'
import {hms} from './geo.ts'
import {panel} from './render.ts'
import {step} from './sim.ts'
import {uiOf} from './state.ts'
export const TICK_MS = 100
const stats = (app: App) => {
  const {world, now} = app.store.state
  const queued = having(world, 'party', 'queue').filter(p => p.queue.status === 'WAITING').length
  const tables = having(world, 'table')
  return `${hms(now)} UTC | queue ${queued} | busy ${tables.filter(t => t.table.status !== 'available').length}/${tables.length}`
}
export const clockPane = '<span data-clock="ui.rev" class="font-mono text-sm"></span>'
export const clock = (app: App) => {
  let timer: ReturnType<typeof setInterval> | undefined
  const run = (live: unknown) => (clearInterval(timer), (timer = live ? setInterval(() => step(app, TICK_MS * uiOf(app).speed), TICK_MS) : undefined))
  app.store.watch('ui.running', run)
  app.binder(panel(app, 'data-clock', stats))
}
