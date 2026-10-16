// Wiring (C7): seed a clean slate with the real venue, provide the engine, mount the ui last. `persist` stays opt-in.
import {App} from './kernel/index.ts'
import {Engine} from './engine/index.ts'
import {ui} from './ui/index.ts'
import {defaultPolicy} from './contracts/index.ts'
import type {Entity, State} from './contracts/index.ts'
import {venue} from './venue.ts'
const [dx, dy] = defaultPolicy.sim.door
const door = (floor: string): Entity => ({id: 'door', pos: {floor, x: dx, y: dy, w: 0, h: 0}})
const entities = () => [...venue(defaultPolicy.sim.floor), door('rf1')]
export const seed = (): State => ({now: Date.now(), ui: {size: 2, pick: '', tone: ''}, world: {nextParty: 1, ents: Object.fromEntries(entities().map(e => [e.id, e]))}})
export const build = () => App.create(seed()).use(app => app.provide('engine', Engine)).use(ui)
export const start = (el: Element) => build().mount(el)
if (typeof document !== 'undefined' && document.getElementById('app')) start(document.getElementById('app')!)
