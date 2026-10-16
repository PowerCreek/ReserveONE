// Event log + floor pings live in ui state; every sim event and every player action goes through `note`.
import type {App} from '../contracts/index.ts'
import {ui} from './state.ts'
import type {Fx} from './state.ts'
const KEEP = 200
const TTL = 15 // pings last this many clock ticks (wall time, independent of sim speed)
export const note = (app: App, kind: string, msg: string) => {
  const u = ui(app)
  u.log = [{t: app.store.state.now, kind, msg}, ...u.log].slice(0, KEEP)
}
export const ping = (app: App, fx: Omit<Fx, 'ttl'>) => {
  const u = ui(app)
  u.fx = [...u.fx, {...fx, ttl: TTL}]
}
export const fade = (app: App) => {
  const u = ui(app)
  u.fx = u.fx.map(f => ({...f, ttl: f.ttl - 1})).filter(f => f.ttl > 0)
}
