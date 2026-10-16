import {having} from '../contracts/index.ts'
import type {Engine, Ent, Entity, Id, Pick, Policy, Ranked} from '../contracts/index.ts'
import {holdsOn, modeAt} from './modes.ts'
import {planned} from './plan.ts'
import {secsOf} from './ents.ts'
import {areaOf, carveOf, cands, fits} from './section.ts'
import {MIN} from './time.ts'
import {sift} from './prefs.ts'
type Staff = Ent<'staff'>
const idle = (p: Policy, now: number, s: Staff) => Math.min(p.rotation.idleCapMin, s.staff.lastSeatedAt === null ? p.rotation.idleCapMin : (now - s.staff.lastSeatedAt) / MIN)
/** Fair round robin by covers per rotation slot: lowest tally / `staff.weight` first (a bartender pair counts 2, so it takes twice the covers), idle time only breaks ties, skip demotes. */
/** `add` = covers a unit is already planned to take (upcoming reservations), counted against it by policy.plan.anticipate: the rotation defers it ahead of time. */
export const score = (p: Policy, now: number, s: Staff, add = 0) => -(s.staff.tally + add * p.plan.anticipate) / (s.staff.weight ?? 1) + idle(p, now, s) * p.rotation.idleWeight - s.staff.skip
export const rankStaff = (p: Policy, ss: Staff[], now: number, add: Record<Id, number> = {}): Ranked[] => ss.filter(s => s.staff.active).map(s => ({staff: s.id, score: score(p, now, s, add[s.id])})).sort((a, b) => b.score - a.score)
type Fore = {ss: Staff[]; add: Record<Id, number>}
/** Does the active mode rotate every unit over every area? */
const anywhere = (p: Policy, w: Parameters<Engine['rotate']>[1], now: number) => !holdsOn(p, w, now) && !!p.service.modes[modeAt(p, w, now)]?.anywhere
/** Who takes each planned reservation, in time order: the section holder when the mode holds tables, else the next in the rotation after the planned covers so far. */
const forecast = (p: Policy, w: Parameters<Engine['rotate']>[1], now: number, ss: Staff[], skip?: Id, until = Infinity): Record<Id, number> =>
  planned(p, w, now, skip).filter(x => x.spot && x.at <= until).reduce<Fore>((a, x) => {
    const rk = rankStaff(p, a.ss, now)
    const open = rk.find(q => anywhere(p, w, now) || x.tables.every(t => fits(areaOf(w.ents[t]))(a.ss.find(s => s.id === q.staff)!)))
    const who = holdsOn(p, w, now) ? pickIn(a.ss, rk, secsOf(w, x.tables)).staff : open?.staff ?? null
    return {ss: bump(a.ss, who, x.size, x.at), add: who ? {...a.add, [who]: (a.add[who] ?? 0) + x.size} : a.add}
  }, {ss, add: {}}).add
/** Covers leased to each unit (led, not seated yet) count like seated covers, so the next lease goes round. */
const leasedTo = (w: Parameters<Engine['rotate']>[1]) => having(w, 'party', 'lease').reduce<Record<Id, number>>((m, e) => ((s?: Id | null) => (s ? {...m, [s]: (m[s] ?? 0) + e.party.size} : m))(w.ents[e.lease.tables[0] ?? '']?.table?.waiter), {})
const counted = (w: Parameters<Engine['rotate']>[1]): Staff[] => { const led = leasedTo(w); return having(w, 'staff').map(s => (led[s.id] ? {...s, staff: {...s.staff, tally: s.staff.tally + led[s.id]}} : s)) }
/** Covers each unit is planned to take from reservations due by `until` (the rotation's forecast, leased covers counted). */
export const ahead = (p: Policy, w: Parameters<Engine['rotate']>[1], now: number, until: number) => forecast(p, w, now, counted(w), undefined, until)
export const rotate: Engine['rotate'] = (p, w, now, skip) => { const ss = counted(w); return rankStaff(p, ss, now, forecast(p, w, now, ss, skip)) }
/** Best-ranked server covering any of the sections, else the top server overall (fallback). */
export const pickIn = (ss: Staff[], rank: Ranked[], secs: Id[]): Pick => {
  const hit = rank.find(r => ss.find(s => s.id === r.staff)?.staff.sections.some(x => secs.includes(x)))
  return {staff: (hit ?? rank[0])?.staff ?? null, fallback: !hit}
}
interface Ctx {p: Policy; w: Parameters<Engine['rotate']>[1]; now: number; ss: Staff[]; rk: Ranked[]; ts: Entity[]; any: boolean}
const holder = (c: Ctx, id: Id) => c.ss.find(s => s.id === id)!
/** Sectioned: the holders of any table (section, dealt top, or area pair, by the table's carve), in rank order. */
const rows = (c: Ctx) => c.ts.map(t => carveOf(c.p, c.w, areaOf(t))).map((by, i) => ({by, cs: cands[by](c.ss, c.ts[i])}))
const holders = (c: Ctx) => { const rs = rows(c); return c.rk.filter(r => rs.some(x => x.cs.some(s => s.id === r.staff))) }
const carved = (c: Ctx, id: Id | null) => rows(c).find(x => x.cs.some(s => s.id === id))?.by
/** Rotation: every ranked unit where the mode says `anywhere` (every server and bartender over every area), else units whose `staff.area` is unset or the tables' area. */
const fitted = (c: Ctx) => c.rk.filter(r => c.any || c.ts.every(t => fits(areaOf(t))(holder(c, r.staff))))
interface Way {list: (c: Ctx) => Ranked[]; by: (c: Ctx, id: Id | null) => Pick['by']; fallback: boolean}
const WAYS: Record<'true' | 'false', Way> = {true: {list: holders, by: carved, fallback: false}, false: {list: fitted, by: () => 'rotation', fallback: false}}
const REST: Way = {list: fitted, by: () => 'fallback', fallback: true}
/** The mode's candidates, else (nobody holds or fits) ranked units fitting the area, flagged fallback. */
const wayOf = (c: Ctx) => [WAYS[String(holdsOn(c.p, c.w, c.now)) as 'true' | 'false'], REST].map(x => ({x, list: x.list(c)})).find(y => y.list.length) ?? {x: REST, list: []}
const ctxOf = (p: Policy, w: Parameters<Engine['rotate']>[1], now: number, skip?: Id): Omit<Ctx, 'ts'> => ({p, w, now, ss: having(w, 'staff'), rk: rotate(p, w, now, skip), any: anywhere(p, w, now)})
const tablesAt = (w: Parameters<Engine['rotate']>[1], ids: Id[]) => ids.flatMap(i => (w.ents[i]?.table ? [w.ents[i]] : []))
/** Who serves a seating of these tables (party of `size`, default the `skip` party's): the mode's candidates, then server prefs (engine/prefs.ts) within that order. */
export const serverOf = (p: Policy, w: Parameters<Engine['rotate']>[1], now: number, tables: Id[], skip?: Id, size?: number): Pick => {
  const c: Ctx = {...ctxOf(p, w, now, skip), ts: tablesAt(w, tables)}
  const {x, list} = wayOf(c)
  const s = sift(p, w, now, list, c.ts, size ?? w.ents[skip ?? '']?.party?.size ?? NaN)
  return {staff: s.staff, fallback: x.fallback, by: x.by(c, s.staff), ...(s.prefs.length ? {prefs: s.prefs} : {})}
}
export const serverFor: Engine['serverFor'] = (p, w, now, tables, skip) => serverOf(p, w, now, tables, skip)
/** The would-be server of any tables before prefs (ranked once): what table choice weighs a spot's prefs against. */
export const taker = (p: Policy, w: Parameters<Engine['rotate']>[1], now: number, skip?: Id) => {
  const base = ctxOf(p, w, now, skip)
  return (tables: Id[]) => wayOf({...base, ts: tablesAt(w, tables)}).list[0]?.staff ?? null
}
/** Simulated staff after seating `size` covers with server `id` at `at`: tally up, last seated, every skip cleared. */
export const bump = (ss: Staff[], id: Id | null, size: number, at: number): Staff[] =>
  ss.map(s => (id === null ? s : {...s, staff: {...s.staff, skip: 0, ...(s.id === id ? {tally: s.staff.tally + size, lastSeatedAt: at} : {})}}))
