// Undo/redo as data (E2): snapshot stacks live in `state.ui.history`, not in module state.
import type {App, Plugin, State, World} from '../contracts/index.ts'
import {clone} from './path.ts'
export interface Hist {past: World[]; future: World[]}
declare module '../contracts/kernel.ts' {
  interface UiState {history?: Hist}
}
const cap = 50
type Side = keyof Hist
const hist = (s: State) => (s.ui.history ??= {past: [], future: []})
const push = (list: World[], w: World) => list.push(w) > cap && list.shift()
/** Snapshot the world before a change; clears redo. */
export const record = (app: App) => {
  const s = app.store.state
  push(hist(s).past, clone(s.world))
  hist(s).future = []
}
/** record + apply in one step. */
export const commit = (app: App, ps: Parameters<App['apply']>[0]) => (record(app), app.apply(ps))
const step = (from: Side, to: Side) => (app: App) => {
  const s = app.store.state
  const prev = hist(s)[from].pop()
  prev && (push(hist(s)[to], clone(s.world)), (s.world = clone(prev)))
  return !!prev
}
export const undo = step('past', 'future')
export const redo = step('future', 'past')
export const history: Plugin = app => {
  app.act('undo', a => undo(a)).act('redo', a => redo(a))
}
