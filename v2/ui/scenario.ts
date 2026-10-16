// Loading a scenario resets the world to a preset, starts the sim clock at a fixed evening, and seeds the opening guests.
import type {App} from '../contracts/index.ts'
import {note} from './log.ts'
import {layout, presets} from './presets.ts'
import {spawn} from './sim.ts'
import {uiOf} from './state.ts'
export const START = Date.UTC(2026, 9, 16, 17, 0)
export const load = (app: App, id: string) => {
  const p = presets[id]
  const s = app.store.state
  app.apply(layout(p, Object.keys(s.world.ents), START))
  s.now = START
  s.world.nextParty = 1
  Object.assign(uiOf(app), {scenario: id, rate: p.rate, speed: p.speed, running: false, acc: 0, log: [], fx: []})
  spawn(app, p.guests)
  note(app, 'info', `Loaded "${p.label}": ${p.blurb}`)
}
