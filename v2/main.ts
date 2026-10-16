import {App} from './kernel/index.ts'
import {fit} from './engine/index.ts'
import {ui} from './ui/index.ts'
import type {Entity, State} from './contracts/index.ts'
const table = (id: string, capacity: number): Entity => ({id, table: {label: id, capacity, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}})
export const seed = (): State => ({now: 0, ui: {size: 2, pick: '', tone: ''}, world: {nextParty: 1, ents: {t2: table('T2', 2), t4: table('T4', 4), t6: table('T6', 6)}}})
export const build = () => App.create(seed()).use(app => app.provide('engine', {fit})).use(ui)
export const start = (el: Element) => build().mount(el)
if (typeof document !== 'undefined' && document.getElementById('app')) start(document.getElementById('app')!)
