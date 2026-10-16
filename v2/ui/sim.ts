// Sim stepper: the clock calls `step`; engine.tick moves units and emits events, each of which is logged and pinged on the floor.
import type {App, SimOut} from '../contracts/index.ts'
import {ask} from './ask.ts'
import {narrate} from './act.ts'
import {fade} from './log.ts'
import {uiOf} from './state.ts'
const idle: SimOut = {patches: [], events: []}
export const spawn = (app: App, n: number) =>
  Array.from({length: n}, () => app.apply(ask(app, 'spawn', uiOf(app).seed++) ?? []))
const arrivals = (app: App, dtMs: number) => {
  const u = uiOf(app)
  u.acc += (dtMs / 60000) * u.rate
  const n = Math.floor(u.acc)
  u.acc -= n
  spawn(app, n)
}
export const step = (app: App, dtMs: number) => {
  app.store.state.now += dtMs
  fade(app)
  const out = ask(app, 'tick', dtMs) ?? idle
  narrate(app, out.events) // before the patches: departed parties and bodies are still in the world
  app.apply(out.patches)
  app.apply(ask(app, 'reconcile') ?? [])
  arrivals(app, dtMs)
  return out.events
}
