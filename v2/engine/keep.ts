// Walk-ins and reservations (E1): what seating a walk-in now would take from the reservations the temporal plan expects. The walk-in's tables are busy for an average turn; a reservation that no longer
// finds a spot free by its time (tables pushed together included, tables still occupied counted from when they turn over) is squeezed.
import type {Id, Placed, Policy, World} from '../contracts/index.ts'
import {planner, stay} from './plan.ts'
const none = (): Id[] => []
const short = (xs: Placed[]) => xs.filter(x => !x.spot).map(x => x.party)
/** `keeper(...)(taken)` = the reservations left without a spot if the `taken` tables go to a walk-in now (beyond those already short). `skip` = the party being seated. */
export const keeper = (p: Policy, w: World, now: number, skip?: Id) => {
  const plan = planner(p, w, now, skip)
  const base = plan.empty ? none() : short(plan.run())
  const gone = now + stay(p, w)
  return (taken: Id[]): Id[] => (plan.empty ? none() : short(plan.run(Object.fromEntries(taken.map(t => [t, gone])))).filter(id => !base.includes(id)))
}
