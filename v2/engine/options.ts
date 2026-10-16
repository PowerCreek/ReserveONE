// Host service: which responses the host may give to an open request, and the spot each would use (policy.host.options, reasons).
import {having} from '../contracts/index.ts'
import type {Ask, Coach, Components, Ent, Id, Option, Policy, ReasonDef, World} from '../contracts/index.ts'
import {partyOf} from './ents.ts'
import type {Pty} from './ents.ts'
import {spotOf} from './ask.ts'
import {spots} from './spots.ts'
type Spot = Ent<'spot'>
/** An open request resolved against the world: who, how big, what they ask for, where they sit now. */
export interface Case {party: Id; size: number; def: ReasonDef; req: Components['request']; cur?: Spot}
export const caseOf = (p: Policy, w: World, party: Id, live: Ask[] = ['open']): Case | undefined => {
  const req = w.ents[party]?.request
  const who = partyOf(w, party)
  const def = req && p.host.reasons[req.reason]
  return req && live.includes(req.status) && who && def ? {party, size: who.party.size, def, req, cur: spotOf(p, w, req.table)} : undefined
}
const tagsOf = (w: World, s: Spot): string[] => [...new Set([...(s.spot.feats ?? []), ...s.spot.tables.flatMap(t => w.ents[t]?.feat?.tags ?? [])])]
const full = (d: ReasonDef, tags: string[]) => d.seek.every(f => tags.includes(f)) && !d.avoid.some(f => tags.includes(f))
const grade = (d: ReasonDef, tags: string[]) => d.seek.filter(f => tags.includes(f)).length - d.avoid.filter(f => tags.includes(f)).length
/** Would the party accept this spot for its reason? Need-level reasons accept only a full match; others any improvement or full match. */
export const likes = (w: World, c: Case, s: Spot) => full(c.def, tagsOf(w, s)) || (c.def.level !== 'need' && grade(c.def, tagsOf(w, s)) > grade(c.def, c.cur ? tagsOf(w, c.cur) : []))
const claimed = (w: World, party: Id): Id[] => (having(w, 'party') as Pty[]).filter(e => e.id !== party).flatMap(e => [e.offer?.status === 'open' ? e.offer.spot : [], e.request?.status === 'offered' ? e.request.spot ?? [] : []].flat())
const pool = (w: World, c: Case): Spot[] => spots(w).filter(s => s.spot.capacity >= c.size && s.id !== c.cur?.id && !claimed(w, c.party).includes(s.id))
const tight = (a: Spot, b: Spot) => a.spot.capacity - b.spot.capacity || a.id.localeCompare(b.id)
const frees = (w: World, c: Case) => pool(w, c).filter(s => s.spot.status === 'available')
const turn = (w: World, s: Spot) => Math.min(Infinity, ...s.spot.tables.flatMap(t => having(w, 'slot').filter(x => x.slot.table === t && x.slot.status === 'ACTIVE').map(x => x.slot.turnAt)))
const bare = (d: ReasonDef) => !d.seek.length && !d.avoid.length
type Pick = (w: World, c: Case) => Spot | undefined
/** Spot finder per response id; any response without a row uses '*' (a free spot meeting the reason). */
const picks: Record<string, Pick> = {
  '*': (w, c) => frees(w, c).filter(s => full(c.def, tagsOf(w, s))).sort(tight)[0],
  offer: (w, c) => frees(w, c).filter(s => bare(c.def) || grade(c.def, tagsOf(w, s)) > grade(c.def, c.cur ? tagsOf(w, c.cur) : [])).sort((a, b) => grade(c.def, tagsOf(w, b)) - grade(c.def, tagsOf(w, a)) || tight(a, b))[0],
  hold: (w, c) => pool(w, c).filter(s => ['occupied', 'lapsed'].includes(s.spot.status) && full(c.def, tagsOf(w, s))).sort((a, b) => turn(w, a) - turn(w, b) || tight(a, b))[0],
}
export const pick = (w: World, c: Case, response: string): Spot | undefined => (picks[response] ?? picks['*'])(w, c)
const fill = (host: string, s?: Spot) => host.replace('{spot}', s?.spot.label ?? 'another table')
const line = (p: Policy, w: World, c: Case, id: string): Option => {
  const r = p.host.responses[id]
  const s = pick(w, c, id)
  return {response: id, label: r.label, say: fill(r.host, s), spot: r.host.includes('{spot}') ? s?.id ?? null : null}
}
/** Responses for the open request: `options[reason] ?? options['*']`, each with the host script filled in and the spot it would use. */
export const options: Coach['options'] = (p, w, _now, party) => {
  const c = caseOf(p, w, party)
  const ids = c ? p.host.options[c.req.reason] ?? p.host.options['*'] ?? [] : []
  return c ? ids.filter(id => p.host.responses[id]).map(id => line(p, w, c, id)) : []
}
