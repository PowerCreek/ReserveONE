import {having} from '../contracts/index.ts'
import type {Engine, Id} from '../contracts/index.ts'
import {apply} from './patch.ts'
import {reconcile} from './reconcile.ts'
import {progress} from './progress.ts'
import {complete} from './finish.ts'
import {assign} from './jobs.ts'
import type {Acc, Ctx, Stage} from './simctx.ts'
const stages: Stage[] = [progress, complete, assign]
const turn = (c: Ctx) => (a: Acc, id: Id): Acc => stages.reduce<Acc>((x, f) => f(c, id, x), {...a, done: null})
/** One sim step: housekeeping first, then every unit in id order advances its task, finishes it, and takes the next job; later units see earlier effects. */
export const tick: Engine['tick'] = (p, w, now, dtMs) => {
  const rec = reconcile(p, w, now)
  const start: Acc = {w: apply(w, rec), out: {patches: rec, events: []}, done: null}
  return having(w, 'body').map(e => e.id).sort().reduce(turn({p, now, dt: dtMs / 1000}), start).out
}
