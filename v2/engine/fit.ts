import {having} from '../contracts/index.ts'
import type {Ent, Engine, Id, Policy, Ranked, SeqItem, World} from '../contracts/index.ts'
import {spots} from './spots.ts'
import {merges} from './merge.ts'
import {holds} from './holds.ts'
import type {Hold} from './holds.ts'
import {avgTurn, freeAt} from './avail.ts'
import {bump, pickIn, rankStaff} from './rotate.ts'
import {secsOf} from './ents.ts'
import {MIN} from './time.ts'
/** floor: only that floor; skip: ignore this party's own reservation hold; busy: tables already promised (sim claims). */
export interface Opt {floor?: Id; skip?: Id; busy?: Id[]; merge?: boolean}
type Spot = Ent<'spot'>
interface Ctx {p: Policy; w: World; now: number; pool: Spot[]; pairs: Spot[]; holds: Hold[]; need: number; rst: number}
interface Run {free: Record<Id, number>; last: number; ss: Ent<'staff'>[]; out: SeqItem[]}
interface Cand {s: Spot; at: number; pos: number}
const pool = (o: Opt) => (all: Spot[]) => all.filter(s => s.spot.status !== 'blocked_private' && s.spot.floor === (o.floor ?? s.spot.floor) && !s.spot.tables.some(t => o.busy?.includes(t)))
const ctx = (p: Policy, w: World, now: number, o: Opt): Ctx => ({p, w, now, pool: pool(o)(spots(w)), pairs: o.merge === false ? [] : pool(o)(merges(w)), holds: holds(p, w, now, o.skip), need: (avgTurn(p, w) + p.seat.resetMin) * MIN, rst: p.seat.resetMin * MIN})
const push = (c: Ctx) => (at: number, h: Hold) => (at + c.need > h.start && at < h.end + c.rst ? h.end + c.rst : at)
const shift = (c: Ctx, s: Spot, at: number) => c.holds.filter(h => s.spot.tables.includes(h.table)).sort((a, b) => a.start - b.start).reduce(push(c), at)
const lead = (c: Ctx, run: Run, rk: Ranked[]) => (s: Spot) => {
  const k = pickIn(run.ss, rk, secsOf(c.w, s.spot.tables))
  return k.fallback ? rk.length : rk.findIndex(r => r.staff === k.staff)
}
const timed = (c: Ctx, run: Run, rk: Ranked[]) => {
  const pos = lead(c, run, rk)
  return (s: Spot): Cand => ({s, at: Math.max(c.now, shift(c, s, run.free[s.id])), pos: pos(s)})
}
/** A single table is preferred: merges (adjacent free pairs, smallest first) only join when no single fit is ready now. */
const cands = (c: Ctx, run: Run, rk: Ranked[], size: number): Cand[] => {
  const [one, two] = [c.pool, c.pairs].map(ss => ss.filter(s => s.spot.capacity >= size).map(timed(c, run, rk)))
  return [...one, ...(one.some(x => x.at <= c.now) ? [] : two.filter(x => x.at <= c.now))]
}
const order = (byPos: boolean) => (a: Cand, b: Cand) => a.s.spot.capacity - b.s.spot.capacity || (byPos ? a.pos - b.pos : 0) || a.at - b.at
const choose = (c: Ctx, cs: Cand[]) => {
  const free = cs.filter(x => x.at <= c.now)
  const near = cs.filter(x => x.at <= Math.min(...cs.map(y => y.at)) + c.p.seat.fitSlackMin * MIN)
  return [...(free.length ? free : near)].sort(order(free.length > 0))[0]
}
const seatAt = (c: Ctx, last: number, at: number) => {
  const q = c.p.seat.quantumMin * MIN
  const rel = Math.ceil(Math.max(0, at - c.now) / q) * q
  return rel === 0 ? c.now : Math.max(c.now + rel, last + c.p.seat.cadenceMin * MIN)
}
const item = (c: Ctx, size: number, s: Spot, at: number): SeqItem =>
  ({size, spot: s.id, tables: s.spot.tables, label: s.spot.label, waitMin: (at - c.now) / MIN, at, code: at <= c.now ? 'HOT_GREEN' : 'CAUTION_WAIT', ready: at <= c.now})
const miss = (size: number, now: number): SeqItem => ({size, spot: null, tables: [], label: '-', waitMin: 0, at: now, code: 'NO_TABLE', ready: false})
const claim = (c: Ctx, free: Record<Id, number>, s: Spot, until: number) =>
  Object.fromEntries(Object.entries(free).map(([id, at]) => [id, [...c.pool, ...c.pairs].find(y => y.id === id)!.spot.tables.some(t => s.spot.tables.includes(t)) ? until : at]))
const place = (c: Ctx, run: Run, size: number, x: Cand): Run => {
  const at = seatAt(c, run.last, x.at)
  const srv = pickIn(run.ss, rankStaff(c.p, run.ss, at), secsOf(c.w, x.s.spot.tables)).staff
  return {free: claim(c, run.free, x.s, at + c.need), last: at, ss: bump(run.ss, srv, size, at), out: [...run.out, item(c, size, x.s, at)]}
}
const step = (c: Ctx) => (run: Run, size: number): Run => {
  const rk = rankStaff(c.p, run.ss, c.now)
  const cs = cands(c, run, rk, size)
  return cs.length ? place(c, run, size, choose(c, cs)) : {...run, out: [...run.out, miss(size, c.now)]}
}
/** Progressive sequence (SPEC §3): tightest fit, ties broken by the next-up server, waits cascade through claimed spots. */
export const plan = (p: Policy, w: World, now: number, sizes: number[], o: Opt = {}): SeqItem[] => {
  const c = ctx(p, w, now, o)
  const at = freeAt(p, w, now)
  const run: Run = {free: Object.fromEntries([...c.pool, ...c.pairs].map(s => [s.id, at(s)])), last: -Infinity, ss: having(w, 'staff'), out: []}
  return sizes.reduce(step(c), run).out
}
export const fit: Engine['fit'] = (p, w, now, sizes) => plan(p, w, now, sizes)
