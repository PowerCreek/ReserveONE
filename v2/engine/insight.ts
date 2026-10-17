// Predictive reads (Gemini-era overlays, policy.board.insight): each rule folds existing engine reads into zero or more insights; the board lists them worst first (E1, E2).
import {having, partsOf} from '../contracts/index.ts'
import type {Ent, Id, Insight, Policy, ServerRow, StandView, Tick, World} from '../contracts/index.ts'
import {planned} from './plan.ts'
import {ahead} from './rotate.ts'
import {freeUp} from './free.ts'
import {apply} from './patch.ts'
import {MIN} from './time.ts'
type Cfg = Policy['board']['insight']
export interface Ctx {p: Policy; w: World; now: number; ticks: Tick[]; view: StandView; servers: ServerRow[]; name: (t: Id) => string}
const cfg = (c: Ctx): Cfg => c.p.board.insight
const ins = (id: Insight['id'], level: Insight['level'], msg: string, tables: Id[] = [], staff: Id[] = [], at?: number): Insight => ({id, level, msg, tables, staff, ...(at === undefined ? {} : {at})})
const hm = (ms: number) => new Date(ms).toTimeString().slice(0, 5)
const who = (w: World, id: Id) => `${w.ents[id]?.party?.name || w.ents[id]?.party?.label || id} (${w.ents[id]?.party?.size ?? 0})`
const labels = (c: Ctx, ts: Id[]) => ts.map(c.name).filter((x, i, a) => a.indexOf(x) === i).join('+')
const cap = (w: World, ts: Id[]) => ts.reduce((n, t) => n + (w.ents[t]?.table?.capacity ?? 0), 0)
const live = (w: World, ts: Id[]) => having(w, 'slot').find(s => s.slot.status === 'ACTIVE' && ts.includes(s.slot.table))

// ---- brick: what a lease, a merged link or the head's top offer takes from a due reservation
interface Holder {kind: 'Lease' | 'Merge'; tables: Id[]; party: Id | null}
const shortOf = (p: Policy, w: World, now: number) => planned(p, w, now).filter(x => !x.spot).map(x => x.party)
const holders = (w: World): Holder[] => [
  ...having(w, 'party', 'lease').map((e): Holder => ({kind: 'Lease', tables: e.lease.tables, party: e.id})),
  ...having(w, 'link').filter(l => l.link.merged).map((l): Holder => ({kind: 'Merge', tables: l.link.members, party: live(w, l.link.members)?.slot.party ?? null})),
]
/** The short reservations a holder's tables would place, were they free now. */
const rescued = (c: Ctx, base: Id[]) => (h: Holder) => {
  const after = shortOf(c.p, apply(c.w, freeUp(c.w, h.tables, c.now)), c.now)
  return base.filter(id => id !== h.party && !after.includes(id))
}
/** One brick per stranded reservation, naming every holder whose tables would place it (a lease or merge strands it). */
const stuck = (c: Ctx, hs: [Holder, Id[]][]) => (r: Id): Insight => {
  const by = hs.filter(([, rs]) => rs.includes(r)).map(([h]) => h)
  return ins('brick', 'crit', `${who(c.w, r)} stranded by ${by.map(h => `${h.kind} ${labels(c, h.tables)}`).join(', ')}`, by.flatMap(h => h.tables), [], c.w.ents[r]?.reservation?.at)
}
const held = (c: Ctx, base: Id[]): Insight[] => {
  const hs = holders(c.w).map((h): [Holder, Id[]] => [h, rescued(c, base)(h)])
  return [...new Set(hs.flatMap(([, rs]) => rs))].map(stuck(c, hs))
}
const headBrick = (c: Ctx): Insight[] => {
  const o = c.view.offers.find(x => x.spot)
  const sq = o?.squeezes ?? []
  return o && sq.length ? [ins('brick', 'warn', `${who(c.w, c.view.door[0].party)} at ${labels(c, partsOf(c.w, o.spot!))} strands ${sq.map(r => who(c.w, r)).join(', ')}`, partsOf(c.w, o.spot!), [], c.w.ents[sq[0]]?.reservation?.at)] : []
}
const brick = (c: Ctx): Insight[] => {
  const base = shortOf(c.p, c.w, c.now)
  return [...(base.length ? held(c, base) : []), ...headBrick(c)]
}

// ---- pressure: turns per interval over the horizon (deluge), or a stretch with none while the list waits (drought)
type Run = {from: number; to: number}
const span = (c: Ctx) => c.ticks.filter(t => t.end > c.now && t.start < c.now + cfg(c).horizonMin * MIN)
const turning = (c: Ctx, t: Tick) => having(c.w, 'slot').filter(s => s.slot.status === 'ACTIVE' && s.slot.turnAt >= t.start && s.slot.turnAt < t.end).map(s => s.slot.table)
const deluge = (c: Ctx): Insight[] => span(c).filter(t => t.turns >= cfg(c).delugeTurns).map(t => ins('pressure', 'warn', `Deluge: ${t.turns} turns at ${hm(t.start)}`, turning(c, t), [], t.start))
const grow = (rs: Run[], t: Tick): Run[] => (t.turns ? rs : rs.at(-1)?.to === t.start ? [...rs.slice(0, -1), {...rs.at(-1)!, to: t.end}] : [...rs, {from: t.start, to: t.end}])
const clip = (c: Ctx) => (r: Run): Run => ({from: Math.max(r.from, c.now), to: Math.min(r.to, c.now + cfg(c).horizonMin * MIN)})
const drought = (c: Ctx): Insight[] => {
  const dry = span(c).reduce(grow, []).map(clip(c)).filter(r => r.to - r.from >= cfg(c).droughtMin * MIN)
  return c.view.door.length ? dry.map(r => ins('pressure', 'warn', `Drought: no turn ${hm(r.from)}-${hm(r.to)}, ${c.view.door.length} waiting`, [], [], r.from)) : []
}

// ---- imbalance: projected covers per server (tally, which already holds the covers seated now, + planned reservations within the horizon), per rotation weight
const imbalance = (c: Ctx): Insight[] => {
  const add = ahead(c.p, c.w, c.now, c.now + cfg(c).horizonMin * MIN)
  const load = c.servers.filter(s => s.active && !s.area).map(s => ({s, n: (s.tally + (add[s.staff] ?? 0)) / s.weight})).sort((a, b) => b.n - a.n)
  const [hi, lo] = [load[0], load.at(-1)]
  return hi && lo && hi.n - lo.n > cfg(c).imbalanceCovers ? [ins('imbalance', 'warn', `${hi.s.name} ${Math.round(hi.n)} vs ${lo.s.name} ${Math.round(lo.n)} covers by ${hm(c.now + cfg(c).horizonMin * MIN)}`, [], [hi.s.staff, lo.s.staff])] : []
}

// ---- punctual: at peak load (the list at policy length), booked reservations past the shorter grace are as good as late
type Res = Ent<'party' | 'reservation'>
const tardy = (c: Ctx) => (r: Res) => r.reservation.status === 'BOOKED' && c.now - r.reservation.at > cfg(c).peakGraceMin * MIN && c.now - r.reservation.at <= c.p.seat.lateGraceMin * MIN
const punctual = (c: Ctx): Insight[] => {
  const rs = having(c.w, 'party', 'reservation').filter(tardy(c)).sort((a, b) => a.reservation.at - b.reservation.at)
  const msg = `Peak (${c.view.door.length} waiting): ${rs.map(r => who(c.w, r.id)).join(', ')} past ${cfg(c).peakGraceMin}m, treat as late`
  return c.view.door.length >= cfg(c).peakQueue && rs.length ? [ins('punctual', 'warn', msg, rs.flatMap(r => (r.reservation.table ? partsOf(c.w, r.reservation.table) : [])), [], rs[0].reservation.at)] : []
}

// ---- reclaim: joined tables a seated or leased party does not need (from the end of the run), or a merge with nobody on it, while a waiting party fits them
const tail = (w: World, ts: Id[], size: number) => { const i = ts.findIndex((_, k) => cap(w, ts.slice(0, k + 1)) >= size); return i < 0 ? [] : ts.slice(i + 1) }
type Joined = {tables: Id[]; spare: Id[]}
const merged = (w: World) => (l: Ent<'link'>): Joined => {
  const s = live(w, l.link.members)
  return {tables: l.link.members, spare: s ? tail(w, l.link.members, w.ents[s.slot.party]?.party?.size ?? 0) : l.link.members}
}
const joined = (w: World): Joined[] => [
  ...having(w, 'link').filter(l => l.link.merged).map(merged(w)),
  ...having(w, 'party', 'lease').filter(e => e.lease.tables.length > 1).map(e => ({tables: e.lease.tables, spare: tail(w, e.lease.tables, e.party.size)})),
]
const tl = (w: World, ts: Id[]) => ts.map(t => w.ents[t]?.table?.label ?? t).join('+')
const reclaim = (c: Ctx): Insight[] => joined(c.w).filter(j => j.spare.length).flatMap(j => {
  const d = c.view.door.find(r => r.size <= cap(c.w, j.spare))
  return d ? [ins('reclaim', 'info', `Split ${labels(c, j.tables)}: ${who(c.w, d.party)} fits ${tl(c.w, j.spare)}`, j.spare)] : []
})

const RULES: ((c: Ctx) => Insight[])[] = [brick, deluge, drought, imbalance, punctual, reclaim]
const RANK: Record<Insight['level'], number> = {crit: 0, warn: 1, info: 2}
/** Every predictive read, worst first (rule order within a level). */
export const insights = (c: Ctx): Insight[] => RULES.flatMap(f => f(c)).sort((a, b) => RANK[a.level] - RANK[b.level])
