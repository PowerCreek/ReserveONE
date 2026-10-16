import {having} from '../contracts/index.ts'
import type {Components, Engine, Patch, Policy, Task, World} from '../contracts/index.ts'
import {center, nextNum, partyLabel} from './ents.ts'
import {eta} from './eta.ts'
import {add, set} from './patch.ts'
import {rand, weighted} from './rng.ts'
/** A guest body one second of walking short of the door, heading in. */
const arriving = (p: Policy, w: World, party: string): Components['body'] => {
  const d = center(w, 'door', p)
  const task: Task = {do: 'move', x: d.x, y: d.y}
  return {role: 'guest', x: d.x - p.sim.walkPxPerSec, y: d.y, speed: p.sim.walkPxPerSec, task, backlog: [], party}
}
const walkin = (p: Policy, w: World, now: number, seed: number): Patch[] => {
  const num = nextNum(w)
  const size = weighted(p.spawn.sizes, rand(seed, 0))
  const name = p.spawn.names[Math.floor(rand(seed, 1) * p.spawn.names.length)]
  const id = `pty${num}`
  return [add({id, party: {num, label: partyLabel('', 'W', num), prefix: '', kind: 'W', name, size, here: size}, queue: {since: now, quotedMin: Math.round(eta(p, w, now, size).waitMin), status: 'WAITING', from: null}, body: arriving(p, w, id)})]
}
const due = (p: Policy, w: World, now: number): Patch[] =>
  having(w, 'party', 'reservation').filter(r => r.reservation.status === 'BOOKED' && r.reservation.at <= now && !('body' in r))
    .map(r => set(r.id, {party: {...r.party, here: r.party.size}, reservation: {...r.reservation, status: 'ARRIVED'}, body: arriving(p, w, r.id)}))
/** Arrivals for this step: one seeded walk-in (queued at once, walking to the door) plus every booked reservation that is now due. */
export const spawn: Engine['spawn'] = (p, w, now, seed) => [...walkin(p, w, now, seed), ...due(p, w, now)]
