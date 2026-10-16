// Integration rig: the real engine + real ui mounted in jsdom, exactly as main.ts builds them (minus the venue seed).
import type {App as AppT, SimOut, State} from '../contracts/index.ts'
import {Engine} from '../engine/index.ts'
import {App} from '../kernel/index.ts'
import {load, step, ui} from '../ui/index.ts'
import {dom} from './dom.ts'
const empty = (): State => ({now: 0, ui: {size: 2, pick: '', tone: ''}, world: {nextParty: 1, ents: {}}})
export const real = () => {
  const el = dom().getElementById('app')!
  const app: AppT = App.create(empty()).use(a => a.provide('engine', Engine)).use(ui)
  return {el, app: app.mount(el)}
}
/** Run one preset headless: load it, then step the clock `sec` times at `dtMs`; returns every sim event in order. */
export const run = (app: AppT, preset: string, sec: number, dtMs = 1000): SimOut['events'] => (load(app, preset), Array.from({length: sec}, () => step(app, dtMs)).flat())
export const count = (evs: SimOut['events']) => evs.reduce<Record<string, number>>((n, e) => ({...n, [e.ev]: (n[e.ev] ?? 0) + 1}), {})
