import type {Coach, Ent, Entity, Fit, Id, Miss, Policy, Want, World} from '../contracts/index.ts'
import {spots} from './spots.ts'
import {holds} from './holds.ts'
import type {Hold} from './holds.ts'
import {avgTurn, freeAt} from './avail.ts'
import {partyOf} from './ents.ts'
import type {Pty} from './ents.ts'
import {set} from './patch.ts'
import {MIN} from './time.ts'
type Spot = Ent<'spot'>
/** Everything match and ladder read: the party, what the host knows it wants, the spots and their fits (best first). */
export interface Env {p: Policy; w: World; now: number; party: Pty; wants: Want[]; by: Record<Id, Spot>; fits: Fit[]; holds: Hold[]; free: (s: Spot) => number; turn: number}
/** The host only knows what was volunteered (`said`) or asked and recorded (`heard`). */
export const known = (e: Entity): Want[] => (e.wants?.list ?? []).filter(x => x.said || e.wants?.heard.includes(x.feat))
const has = (s: Spot, x: Want) => (s.spot.feats ?? []).includes(x.feat)
const meets = (s: Spot, x: Want) => has(s, x) !== !!x.avoid
const weight = (p: Policy, x: Want) => p.host.score.level[x.level] * (p.host.whys[x.why]?.mult ?? 1) * p.host.score.accord[x.accord]
const gain = (p: Policy, s: Spot, x: Want) => (has(s, x) ? weight(p, x) * (x.avoid ? p.host.score.avoid : 1) : 0)
const score = (e: Env, s: Spot) => e.wants.reduce((n, x) => n + gain(e.p, s, x), 0) - e.p.host.score.slack * (s.spot.capacity - e.party.party.size)
const rst = (e: Env) => e.p.seat.resetMin * MIN
const push = (e: Env) => (at: number, h: Hold) => (at + e.turn > h.start && at < h.end + rst(e) ? h.end + rst(e) : at)
const when = (e: Env, s: Spot) => Math.max(e.now, e.holds.filter(h => s.spot.tables.includes(h.table)).sort((a, b) => a.start - b.start).reduce(push(e), e.free(s)))
const miss = (x: Want): Miss => ({feat: x.feat, level: x.level, why: x.why})
const fitOf = (e: Env) => (s: Spot): Fit => {
  const [met, missed] = [e.wants.filter(x => meets(s, x)), e.wants.filter(x => !meets(s, x))]
  const waitMin = (when(e, s) - e.now) / MIN
  return {spot: s.id, score: score(e, s), met: met.map(x => x.feat), missed: missed.map(miss), waitMin, ready: waitMin <= 0}
}
const best = (e: Env) => (a: Fit, b: Fit) => b.score - a.score || a.waitMin - b.waitMin || e.by[a.spot].spot.capacity - e.by[b.spot].spot.capacity || a.spot.localeCompare(b.spot)
const base = (p: Policy, w: World, now: number, party: Pty): Env =>
  ({p, w, now, party, wants: known(party), by: {}, fits: [], holds: holds(p, w, now, party.id), free: freeAt(p, w, now), turn: (avgTurn(p, w) + p.seat.resetMin) * MIN})
/** Fits for one party: needs are hard filters (a spot without a needed feature, or with an avoided one, is not a candidate). */
export const env = (p: Policy, w: World, now: number, id: Id, within?: Id[]): Env | undefined => {
  const party = partyOf(w, id)
  const e = party && base(p, w, now, party)
  const all = spots(w)
  const pool = all.filter(s => s.spot.status !== 'blocked_private' && s.spot.capacity >= (party?.party.size ?? 0) && (within ?? [s.id]).includes(s.id))
  const ok = (s: Spot) => !!e && e.wants.every(x => x.level !== 'need' || meets(s, x))
  const by = Object.fromEntries(all.map(s => [s.id, s]))
  return e && {...e, by, fits: pool.filter(ok).map(fitOf({...e, by})).sort(best({...e, by}))}
}
export const match: Coach['match'] = (p, w, now, id, within) => env(p, w, now, id, within)?.fits ?? []
const refuse = (p: Policy, w: World, id: Id, heard: string[]) =>
  [[!partyOf(w, id), `No party ${id}`], [heard.some(f => !(f in p.host.feats)), `Unknown feature in ${heard.join(', ')}`]].find(([bad]) => bad)?.[1] as string | undefined
const note = (e: Entity, heard: string[]) => known({...e, wants: {list: e.wants?.list ?? [], heard}}).filter(x => heard.includes(x.feat)).map(x => `${x.feat} (${x.level})`)
/** The host asked about these features and recorded the answers: they now count in `match`. Idempotent. */
export const intake: Coach['intake'] = (p, w, _now, id, heard) => {
  const err = refuse(p, w, id, heard)
  const e = w.ents[id] ?? {id}
  const list = e.wants?.list ?? []
  const seen = [...new Set([...(e.wants?.heard ?? []), ...heard])]
  const says = note(e, heard)
  return err ? {ok: false, err} : {ok: true, patches: [set(id, {wants: {list, heard: seen}})], msg: says.length ? `Heard ${says.join(', ')}` : 'Nothing special', tone: 'ok'}
}
