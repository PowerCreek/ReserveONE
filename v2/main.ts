// Wiring (C7): seed the real venue with its crew, provide the engine, mount the ui last. `persist` stays opt-in.
import {App} from './kernel/index.ts'
import {Engine} from './engine/index.ts'
import {spawn, ui} from './ui/index.ts'
import {defaultPolicy} from './contracts/index.ts'
import type {Plugin, State} from './contracts/index.ts'
import {staffed} from './crew.ts'
import {venue} from './venue.ts'
const entities = () => staffed(venue(defaultPolicy.sim.floor))
/** Fresh load: the venue dealt into sections, tops and bartender pairs (crew.ts), a host stand and a busser. Arrivals are off until Play, but the +guest buttons and the opening party work at once. */
export const seed = (): State => ({now: Date.now(), ui: {size: 2, pick: '', tone: '', rate: 0.5}, world: {nextParty: 1, ents: Object.fromEntries(entities().map(e => [e.id, e]))}})
const engine: Plugin = app => app.provide('engine', Engine)
const opening: Plugin = app => spawn(app, 1) // one party at the door so the stand has someone to greet
export const build = () => App.create(seed()).use(engine).use(ui).use(opening)
export const start = (el: Element) => build().mount(el)
if (typeof document !== 'undefined' && document.getElementById('app')) start(document.getElementById('app')!)
