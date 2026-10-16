// Desk read model (wave 4): everything the host stand shows, derived from the world (E2). The stand renders this; it computes nothing itself.
import {having, partsOf} from '../contracts/index.ts'
import type {Desk, DoorRow, Ent, Entity, Id, Offer, Policy, ReqRow, SeatedRow, World} from '../contracts/index.ts'
import type {Pty} from './ents.ts'
import {line} from './queue.ts'
import {where} from './ask.ts'
import {known} from './match.ts'
import {ladder} from './ladder.ts'
import {serverFor, rotate} from './rotate.ts'
import {holdsOn, modeAt} from './modes.ts'
import {outlook} from './plan.ts'
import {options} from './options.ts'
import {areaOf} from './section.ts'
import {MIN} from './time.ts'
const since = (e: Pty) => e.queue?.since ?? e.reservation?.at ?? 0
const row = (now: number) => (e: Pty): DoorRow =>
  ({party: e.id, label: e.party.label, name: e.party.name, size: e.party.size, kind: e.party.kind, waitedMin: Math.max(0, Math.floor((now - since(e)) / MIN))})
/** The line (policy.queue.tier, then waited) minus parties the host already placed (led or seated). */
const door = (p: Policy, w: World, now: number): DoorRow[] => line(p, w).filter(e => !where(w, e.id)).map(row(now))
/** Recorded wants (said or heard), feats asked about with no want, feats still to ask. */
const intakeOf = (p: Policy, e?: Entity) => {
  const wants = e ? known(e) : []
  const heard = e?.wants?.heard ?? []
  const has = (f: string) => wants.some(x => x.feat === f)
  return {wants, denied: heard.filter(f => !has(f)), unasked: e ? Object.keys(p.host.feats).filter(f => !has(f) && !heard.includes(f)) : []}
}
/** Ladder rungs (declined spots already left out by the ladder), each with who would serve it; spot-bearing rungs first. */
const offers = (p: Policy, w: World, now: number, id: Id): Offer[] =>
  ladder(p, w, now, id).map(r => ({...r, server: r.spot ? serverFor(p, w, now, partsOf(w, r.spot), id).staff : null}))
    .sort((a, b) => Number(!a.spot) - Number(!b.spot))
const turns: Record<'true' | 'false', (p: Policy, w: World, now: number) => Id[]> = {true: () => [], false: (p, w, now) => rotate(p, w, now).map(r => r.staff)}
const requests = (p: Policy, w: World, now: number): ReqRow[] => having(w, 'party', 'request').filter(e => e.request.status === 'open')
  .map(e => ({party: e.id, table: e.request.table, reason: e.request.reason, stage: e.request.stage, options: options(p, w, now, e.id)}))
const ORDER: Record<SeatedRow['aware'], number> = {pending: 0, told: 1, seen: 2}
const aware = (p: Policy, w: World, s: Ent<'slot'>): SeatedRow['aware'] => (p.service.areas[areaOf(w.ents[s.slot.table])]?.seen ? 'seen' : s.slot.told ? 'told' : 'pending')
const seatedRow = (p: Policy, w: World) => (s: Ent<'slot'>): SeatedRow =>
  ({party: s.slot.party, table: s.slot.table, area: areaOf(w.ents[s.slot.table]), server: w.ents[s.slot.table]?.table?.waiter ?? null, aware: aware(p, w, s)})
const seated = (p: Policy, w: World): SeatedRow[] => having(w, 'slot').filter(s => s.slot.status === 'ACTIVE').map(seatedRow(p, w)).sort((a, b) => ORDER[a.aware] - ORDER[b.aware])
/** The host stand's view model: `focus` = the given party while it is still at the door, else the next one. */
export const stand: Desk['stand'] = (p, w, now, focus) => {
  const at = door(p, w, now)
  const f = (at.find(r => r.party === focus) ?? at[0])?.party ?? null
  const rest = {rotation: turns[String(holdsOn(p, w, now)) as 'true'](p, w, now), mode: modeAt(p, w, now), outlook: outlook(p, w, now), requests: requests(p, w, now), leased: [], seated: seated(p, w)}
  return {door: at, focus: f, ...intakeOf(p, w.ents[f ?? '']), offers: f ? offers(p, w, now, f) : [], ...rest}
}
