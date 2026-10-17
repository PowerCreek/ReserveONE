// Strategy kit (lane U17): the shared state, the one strategy read and the assumption acts for the Strategy tab panels (strategy*.ts).
// The host's levers (`StratCtl`) live in `ui.strat` (ui state, never the world). Advisory only: a suggestion sets the fast-seat stepper, nothing here seats.
import type {App, Id} from '../contracts/index.ts'
import type {Guess, StratCtl, StratView} from '../contracts/strategy.ts'
import {ask, policyOf} from './ask.ts'
import {gate, memo, stamp} from './memo.ts'
import {go} from './shell.ts'
import {uiOf} from './state.ts'
import {help} from './tone.ts'
declare module '../contracts/kernel.ts' {
  interface UiState {strat?: Strat; sv?: number} // sv = the tab's change counter (bumped by ui.strat / ui.rev / ui.tab)
}
/** The hold being drafted in the Levers panel (`forMin` / `atMin` = minutes from now). */
export interface Draft {tables: Id[]; size: number; forMin: number; gate: 'none' | 'free' | 'at'; gtab: Id; atMin: number; why: string}
export interface Strat extends StratCtl {draft: Draft}
export const MIN = 60000
/** The timeline's horizon (minutes) and the length drawn for a planned reservation's turn. */
export const H = 150
export const TURN = 75
export const blankDraft = (): Draft => ({tables: [], size: 2, forMin: 30, gate: 'none', gtab: '', atMin: 30, why: ''})
const blank = (): Strat => ({guess: 'none', behind: [], holds: [], draft: blankDraft()})
export const stratOf = (app: App): Strat => (app.store.state.ui.strat ??= blank())
/** The plain StratCtl handed to the engine (the draft stays in the UI). */
export const ctlOf = (app: App): StratCtl => ((c: Strat) => ({guess: c.guess, ...(c.at ? {at: c.at} : {}), behind: [...c.behind], holds: c.holds}))(JSON.parse(JSON.stringify(stratOf(app))))
/** The one strategy read: remembered per (world signature, minute, ctl); undefined when the engine has no strategist yet. */
export const viewOf = (app: App): StratView | undefined => ((c = ctlOf(app)) => memo(app, policyOf(app), 'strategy', [c], () => ask(app, 'strategy', c)))()
export const hhmm = (at: number) => new Date(at).toISOString().slice(11, 16)
/** A panel draw that only runs while the tab shows, and only when the world, the minute or the levers changed. */
const shown = (app: App, f: (app: App, v: StratView) => string) => {
  const g = gate(() => `${!!uiOf(app).on?.strategy}|${stamp(app)}|${JSON.stringify(stratOf(app))}`, () => (uiOf(app).on?.strategy ? ((v = viewOf(app)) => (v ? f(app, v) : none))() : ''))
  return () => g()
}
const none = `<p class="${help}">Needs engine.strategy (the planner is not provided yet).</p>`
const set = <K extends keyof Strat>(app: App, k: K, v: Strat[K]) => void (stratOf(app)[k] = v)
const clamp = (n: number, lo = 1, hi = 20) => Math.min(hi, Math.max(lo, n))
const num = (el: Element | null, k: string) => Number(el?.closest(`[data-${k}]`)?.getAttribute(`data-${k}`))
const at = (ev: Event, k: string) => num(ev.target as Element, k)
const str = (ev: Event, k: string) => (ev.target as Element).closest(`[data-${k}]`)?.getAttribute(`data-${k}`) ?? ''
/** Assumption acts: the guess, the party at the door, the known parties behind it, and Use (sets the fast-seat stepper and opens Queue). */
export const askActs: Record<string, (app: App, ev: Event) => unknown> = {
  'strat-guess': (app, ev) => set(app, 'guess', str(ev, 'g') as Guess),
  'strat-at-more': app => set(app, 'at', clamp((stratOf(app).at ?? 0) + 1)),
  'strat-at-less': app => set(app, 'at', (stratOf(app).at ?? 1) > 1 ? stratOf(app).at! - 1 : undefined),
  'strat-at-clear': app => set(app, 'at', undefined),
  'strat-behind': (app, ev) => set(app, 'behind', [...stratOf(app).behind, clamp(at(ev, 'n'))]),
  'strat-unbehind': (app, ev) => set(app, 'behind', stratOf(app).behind.filter((_, i) => i !== at(ev, 'i'))),
  'strat-use': (app, ev) => (Object.assign(uiOf(app), {size: clamp(at(ev, 'n'), 1, 12)}), go(app, 'queue'), uiOf(app).rev++),
}
export {set, str, at, clamp, shown}
