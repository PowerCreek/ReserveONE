// The one write path (desk seam): a Cmd goes to engine.act; its patches commit (undoable), its events are narrated, its line is logged. The UI builds no patches or events.
import type {App, Cmd, Outcome, Told} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {ask, policyOf} from './ask.ts'
import {crew, explain} from './events.ts'
import {note, ping} from './log.ts'
const none: Outcome = {ok: false, err: 'engine.act is not available'}
/** Log and ping events as plain sentences against the current world. */
export const narrate = (app: App, es: Told[]) =>
  es.map(e => explain(e, app.store.state.world, policyOf(app))).forEach(x => (note(app, x.kind, x.msg), ping(app, {kind: x.kind, msg: x.msg, x: x.x, y: x.y, floor: x.floor})))
/** The guest's own words, attributed to the party the command was about. */
const says = (app: App, cmd: Cmd, s?: string) => s && note(app, 'info', `${crew(app.store.state.world, 'party' in cmd ? cmd.party ?? '' : '')}: "${s}"`)
/** The outcome line is logged when no event narrates the command, or when it warns (e.g. a fallback server). */
const loud = (o: Extract<Outcome, {ok: true}>) => !o.events.length || o.tone === 'warn'
const outcomes: Record<'true' | 'false', (app: App, cmd: Cmd, o: Outcome) => unknown> = {
  true: (app, cmd, o) => o.ok && (commit(app, o.patches), loud(o) && note(app, o.tone, o.msg), says(app, cmd, o.says), narrate(app, o.events)),
  false: (app, _cmd, o) => o.ok || note(app, 'warn', o.err),
}
/** Run one host/manager command through the engine; returns the outcome so a caller can follow up (e.g. refocus). */
export const run = (app: App, cmd: Cmd): Outcome => {
  const o = ask(app, 'act', cmd) ?? none
  outcomes[String(o.ok) as 'true'](app, cmd, o)
  return o
}
