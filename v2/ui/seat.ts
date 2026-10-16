// Seating from the UI: one entry (`seatNow`) turns a SeatReq into an engine Decision, applies its patches through the undoable kernel commit, logs the verdict.
import type {App, Decision, Ent, SeatReq} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {ask} from './ask.ts'
import {note} from './log.ts'
import {arg} from './render.ts'
const none: Decision = {ok: false, err: 'engine.seat is not available'}
const outcome: Record<'true' | 'false', (app: App, d: Decision) => unknown> = {
  true: (app, d) => d.ok && (commit(app, d.patches), note(app, d.tone, d.msg)),
  false: (app, d) => d.ok || note(app, 'warn', d.err),
}
export const seatNow = (app: App, req: SeatReq) => {
  const d = ask(app, 'seat', req) ?? none
  return outcome[String(d.ok) as 'true'](app, d)
}
/** A queued or reserved party seats as itself: component keys present on the entity become the request's ids. */
export const reqOf = (e: Ent<'party'>): SeatReq => ({
  size: e.party.size, kind: e.party.kind, party: e.id,
  ...Object.fromEntries((['queue', 'reservation'] as const).filter(k => k in e).map(k => [k, e.id])),
})
export const seat = (app: App) => app.act('seat', (a, ev) => {
  const e = a.store.state.world.ents[arg(ev, 'id')]
  return e?.party && seatNow(a, reqOf(e as Ent<'party'>))
})
