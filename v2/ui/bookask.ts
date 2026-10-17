// The door to the booking desk (contracts/booking.ts): reads with policy/world/now bound, writes committed, narrated and logged like `run` (ui/act.ts).
import type {App, BookCmd, Booking, Outcome} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {policyOf} from './ask.ts'
import {narrate} from './act.ts'
import {note} from './log.ts'
import {uiOf} from './state.ts'
type Rest<F> = F extends (p: never, w: never, n: never, ...a: infer A) => unknown ? A : never
const none: Outcome = {ok: false, err: 'The booking desk is not available'}
/** Undefined when no booking desk is provided (views degrade). */
export const bk = <K extends keyof Booking>(app: App, k: K, ...a: Rest<Booking[K]>): ReturnType<Booking[K]> | undefined => {
  const {world, now} = app.store.state
  return (app.services.booking?.[k] as ((...x: unknown[]) => ReturnType<Booking[K]>) | undefined)?.(policyOf(app), world, now, ...a)
}
const outcomes: Record<'true' | 'false', (app: App, o: Outcome) => unknown> = {
  true: (app, o) => o.ok && (commit(app, o.patches), (!o.events.length || o.tone === 'warn') && note(app, o.tone, o.msg), narrate(app, o.events)),
  false: (app, o) => o.ok || note(app, 'warn', o.err),
}
/** Run one front-of-house command; every panel repaints after. */
export const book = (app: App, cmd: BookCmd): Outcome => {
  const o = bk(app, 'act', cmd) ?? none
  outcomes[String(o.ok) as 'true'](app, o)
  uiOf(app).rev++
  return o
}
/** Local wall clock for the sim time. */
export const hm = (t: number) => new Date(t).toTimeString().slice(0, 5)
export const ymd = (t: number) => ((d = new Date(t)) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)()
export const at = (date: string, time: string) => new Date(`${date}T${time || '00:00'}`).getTime()
