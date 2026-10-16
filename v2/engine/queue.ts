import {having} from '../contracts/index.ts'
import type {Entity, Policy, World} from '../contracts/index.ts'
import type {Pty} from './ents.ts'
const waiting = (e: Entity) => e.queue?.status === 'WAITING' || e.reservation?.status === 'ARRIVED'
const since = (e: Entity) => e.queue?.since ?? e.reservation?.at ?? 0
/** Single source of queue order (SPEC / HANDOFF): tier P < V < W/R, then longest waiting. Queue entries only. */
export const queueOrder = (p: Policy, w: World) =>
  having(w, 'party', 'queue').filter(q => q.queue.status === 'WAITING').sort((a, b) => p.queue.tier[a.party.kind] - p.queue.tier[b.party.kind] || a.queue.since - b.queue.since)
/** Everyone the host should seat next: queue WAITING plus ARRIVED reservations, same tier order. */
export const line = (p: Policy, w: World): Pty[] =>
  having(w, 'party').filter(waiting).sort((a, b) => p.queue.tier[a.party.kind] - p.queue.tier[b.party.kind] || since(a) - since(b)) as Pty[]
