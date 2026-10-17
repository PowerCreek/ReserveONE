// Server preferences (wave 8): soft avoid / prefer rules ranked below the rotation (E1, data first).
// The rotation (or the section holders) gives the order; prefs only skip or nudge within it, and every effect is a PrefMark.
import {having} from '../contracts/index.ts'
import type {Ent, Entity, Id, Policy, Pref, PrefMark, PrefOn, Ranked, World} from '../contracts/index.ts'
import {areaOf} from './section.ts'
type Staff = Ent<'staff'>
type State = PrefMark['state']

// ---- matching: every given key of `on` must hold for the tables and the party size
interface Look {area: Id[]; feats: string[]; shape: string[]; cap: number; size: number}
const look = (ts: Entity[], size: number): Look =>
  ({area: ts.map(areaOf), feats: ts.flatMap(t => t.feat?.tags ?? []), shape: ts.map(t => t.table?.shape ?? ''), cap: ts.reduce((n, t) => n + (t.table?.capacity ?? 0), 0), size})
const span = ([lo, hi]: [number, number], n: number) => n >= lo && n <= hi
const meet = (want: string[], have: string[]) => have.some(x => want.includes(x))
type Rule = (v: never, l: Look) => boolean
const RULES: Record<keyof PrefOn, Rule> = {
  area: (v: string[], l: Look) => meet(v, l.area), feats: (v: string[], l: Look) => meet(v, l.feats), shape: (v: string[], l: Look) => meet(v, l.shape),
  size: (v: [number, number], l: Look) => span(v, l.size), cap: (v: [number, number], l: Look) => span(v, l.cap),
}
/** Does a preference's `on` cover these tables (one table or a spot's members) for a party of `size` (NaN = unknown: size ranges never match)? */
export const matches = (on: PrefOn, ts: Entity[], size: number) => {
  const l = look(ts, size)
  return (Object.keys(on) as (keyof PrefOn)[]).every(k => on[k] === undefined || (RULES[k] as (v: unknown, l: Look) => boolean)(on[k], l))
}
/** A unit's preferences of one kind that cover these tables. */
export const hits = (s: Entity | undefined, kind: Pref['kind'], ts: Entity[], size: number) => (s?.staff?.prefs ?? []).filter(x => x.kind === kind && matches(x.on, ts, size))

// ---- bogged down: covers now (seated + leased) per weight, above the floor mean by policy.prefs.bogged (floor units only: bar staff keep to their own area)
const wt = (s: Staff) => s.staff.weight ?? 1
const seatedBy = (w: World) => having(w, 'slot').filter(s => s.slot.status === 'ACTIVE').map(s => [w.ents[s.slot.table]?.table?.waiter, w.ents[s.slot.party]?.party?.size ?? 0] as const)
const leasedBy = (w: World) => having(w, 'party', 'lease').map(e => [w.ents[e.lease.tables[0] ?? '']?.table?.waiter, e.party.size] as const)
const load = (w: World) => [...seatedBy(w), ...leasedBy(w)].reduce<Record<Id, number>>((m, [id, n]) => (id ? {...m, [id]: (m[id] ?? 0) + n} : m), {})
/** Per active unit: is it bogged down right now? */
export const bogged = (p: Policy, w: World, _now: number): Record<Id, boolean> => {
  const [n, ss] = [load(w), having(w, 'staff').filter(s => s.staff.active && !s.staff.area)]
  const mean = ss.reduce((a, s) => a + (n[s.id] ?? 0), 0) / (ss.reduce((a, s) => a + wt(s), 0) || 1)
  return Object.fromEntries(ss.map(s => [s.id, (n[s.id] ?? 0) / wt(s) - mean >= p.prefs.bogged]))
}

// ---- the filter step: tiers decide who may take the tables, the (boosted) rotation order decides among them
type Cls = 'free' | 'firm' | 'yield'
interface Row {r: Ranked; s: Staff; avoid: Pref[]; prefer: Pref[]; cls: Cls; bog: boolean}
interface Tier {take: Cls[]; when: (rs: Row[]) => boolean; why: string}
/** firm = held while a free unit is not bogged; then balance wins (free + firm by rotation); yield = only when nobody free; firm alone = obligated. */
const TIERS: Tier[] = [
  {take: ['free'], when: rs => rs.some(x => x.cls === 'free' && !x.bog), why: 'others can take it'},
  {take: ['free', 'firm'], when: rs => rs.some(x => x.cls === 'free'), why: 'every other server is bogged down too'},
  {take: ['yield'], when: rs => rs.some(x => x.cls === 'yield'), why: 'nobody else can take it'},
  {take: ['firm'], when: () => true, why: 'nobody else can take it'},
]
const clsOf = (avoid: Pref[]): Cls => (avoid.some(x => x.give === 'firm') ? 'firm' : avoid.length ? 'yield' : 'free')
const rowOf = (w: World, ts: Entity[], size: number, bog: Record<Id, boolean>) => (r: Ranked): Row => {
  const s = w.ents[r.staff] as Staff
  const avoid = hits(s, 'avoid', ts, size)
  return {r, s, avoid, prefer: hits(s, 'prefer', ts, size), cls: clsOf(avoid), bog: !!bog[r.staff]}
}
/** A prefer is worth at most one seating of this party (size / weight), so the rotation stays primary. */
const bonus = (p: Policy, size: number) => (x: Row) => (x.prefer.length ? Math.min(p.prefs.prefer, (size || 1) / wt(x.s)) : 0)
const boosted = (p: Policy, size: number, rs: Row[]) => { const b = bonus(p, size); return [...rs].sort((x, y) => y.r.score + b(y) - (x.r.score + b(x))) }
const choose = (rs: Row[]) => { const t = TIERS.find(x => x.when(rs))!; return {t, pick: rs.find(x => t.take.includes(x.cls))} }

// ---- marks: what each covering pref did at this pick, with a plain why
interface Out {rs: Row[]; t: Tier; pick?: Row; plain?: Row}
const nm = (x?: Row) => x?.s.staff.name ?? 'nobody'
const STATE: Record<Pref['kind'], (o: Out, x: Row) => State> = {
  avoid: (o, x) => (x === o.pick ? 'overridden' : o.rs.indexOf(x) < o.rs.indexOf(o.pick!) ? 'enforced' : 'met'),
  prefer: (o, x) => (x !== o.pick ? 'overridden' : o.plain === o.pick ? 'met' : 'enforced'),
}
const WHY: Record<`${Pref['kind']}:${State}`, (o: Out) => string> = {
  'avoid:overridden': o => `overridden: ${o.t.why}, so the rotation obliges`, 'avoid:enforced': o => `held: ${nm(o.pick)} takes it`, 'avoid:met': o => `met: ${nm(o.pick)} was due anyway`,
  'prefer:met': () => 'met: next in the rotation anyway', 'prefer:enforced': o => `steered it here ahead of ${nm(o.plain)}`, 'prefer:overridden': o => `overridden: the rotation gives it to ${nm(o.pick)}`,
}
const mark = (o: Out, x: Row) => (pr: Pref): PrefMark => {
  const state = STATE[pr.kind](o, x)
  return {staff: x.s.id, pref: pr.id, state, why: `${x.s.staff.name}'s ${pr.kind} "${pr.note || pr.id}" ${WHY[`${pr.kind}:${state}`](o)}`}
}
const marks = (o: Out): PrefMark[] => o.rs.flatMap(x => [...x.avoid, ...x.prefer].map(mark(o, x)))
export interface Sifted {staff: Id | null; prefs: PrefMark[]}
const judged = (p: Policy, w: World, now: number, list: Ranked[], ts: Entity[], size: number): Sifted => {
  const plain = list.map(rowOf(w, ts, size, bogged(p, w, now)))
  const rs = boosted(p, size, plain)
  const c = choose(rs)
  return {staff: c.pick?.r.staff ?? null, prefs: marks({rs, ...c, plain: choose(plain).pick})}
}
const live = (w: World, list: Ranked[]) => list.some(r => w.ents[r.staff]?.staff?.prefs?.length)
/** Walk the candidates (rotation order, or the holders in sectioned mode): skip avoiders unless obliged, boost preferrers by at most one seating. */
export const sift = (p: Policy, w: World, now: number, list: Ranked[], ts: Entity[], size: number): Sifted =>
  (live(w, list) ? judged(p, w, now, list, ts, size) : {staff: list[0]?.staff ?? null, prefs: []})

// ---- table choice: the would-be server's prefs nudge a spot's match score, always below fit needs and squeezes
/** Avoid: policy.prefs.slack per spare seat (capped below half a squeeze); prefer: under one spare seat's host slack, so it only breaks fit ties. */
export const lean = (p: Policy, w: World, take: (tables: Id[]) => Id | null, size: number) => (s: Ent<'spot'>): number => {
  const [u, ts] = [w.ents[take(s.spot.tables) ?? ''], s.spot.tables.flatMap(t => w.ents[t] ?? [])]
  const avoid = hits(u, 'avoid', ts, size).length ? Math.min(p.host.score.squeeze / 2, p.prefs.slack * Math.max(0, s.spot.capacity - size)) : 0
  return (hits(u, 'prefer', ts, size).length ? Math.min(p.prefs.slack, p.host.score.slack) / 2 : 0) - avoid
}
/** Any unit holding a preference at all (else every pref step is skipped). */
export const anyPrefs = (w: World) => having(w, 'staff').some(s => s.staff.prefs?.length)
