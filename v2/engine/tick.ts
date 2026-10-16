import {having} from '../contracts/index.ts'
import type {Engine, HostEvent, Id, SimOut, World} from '../contracts/index.ts'
import {apply} from './patch.ts'
import {reconcile} from './reconcile.ts'
import {askedEvent} from './ask.ts'
import {settle} from './respond.ts'
import {progress} from './progress.ts'
import {complete} from './finish.ts'
import {assign} from './jobs.ts'
import type {Acc, Ctx, Stage} from './simctx.ts'
const stages: Stage[] = [progress, complete, assign]
const turn = (c: Ctx) => (a: Acc, id: Id): Acc => stages.reduce<Acc>((x, f) => f(c, id, x), {...a, done: null})
/** Requests raised since the previous tick (`at` in [now - dt, now)): each is announced exactly once, whoever raised it. */
const asked = (w: World, now: number, dt: number): HostEvent[] => having(w, 'request').filter(e => e.request.at >= now - dt && e.request.at < now).flatMap(e => askedEvent(w, e.id))
/** Housekeeping before the units move: lapse slots (reconcile), announce new requests, then let guests decide for themselves (settle: offers lapse, requests settle, patience runs out). */
const upkeep = (c: Ctx & {dtMs: number}, w: World): Acc => {
  const rec = reconcile(c.p, w, c.now)
  const w1 = apply(w, rec)
  const s = settle(c.p, w1, c.now)
  return {w: apply(w1, s.patches), out: {patches: [...rec, ...s.patches], events: [...asked(w1, c.now, c.dtMs), ...s.events]}, done: null}
}
/** One sim step: upkeep first, then every unit in id order advances its task, finishes it, and takes the next job; later units see earlier effects. */
export const tick: Engine['tick'] = (p, w, now, dtMs) => {
  const c = {p, now, dt: dtMs / 1000, dtMs}
  const start = upkeep(c, w)
  return having(start.w, 'body').map(e => e.id).sort().reduce(turn(c), start).out as SimOut
}
