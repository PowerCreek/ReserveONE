import {having} from '../contracts/index.ts'
import type {Engine, Ent, Entity, Id, Pick, Policy, Ranked} from '../contracts/index.ts'
import {holdsOn, modeAt} from './modes.ts'
import {planned} from './plan.ts'
import {secsOf} from './ents.ts'
import {areaOf, carveOf, cands, fits} from './section.ts'
import {MIN} from './time.ts'
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
const forecast = (p: Policy, w: Parameters<Engine['rotate']>[1], now: number, skip?: Id): Record<Id, number> =>
  planned(p, w, now, skip).filter(x => x.spot).reduce<Fore>((a, x) => {
    const rk = rankStaff(p, a.ss, now)
    const open = rk.find(q => anywhere(p, w, now) || x.tables.every(t => fits(areaOf(w.ents[t]))(a.ss.find(s => s.id === q.staff)!)))
    const who = holdsOn(p, w, now) ? pickIn(a.ss, rk, secsOf(w, x.tables)).staff : open?.staff ?? null
    return {ss: bump(a.ss, who, x.size, x.at), add: who ? {...a.add, [who]: (a.add[who] ?? 0) + x.size} : a.add}
  }, {ss: having(w, 'staff'), add: {}}).add
export const rotate: Engine['rotate'] = (p, w, now, skip) => rankStaff(p, having(w, 'staff'), now, forecast(p, w, now, skip))
/** Best-ranked server covering any of the sections, else the top server overall (fallback). */
export const pickIn = (ss: Staff[], rank: Ranked[], secs: Id[]): Pick => {
  const hit = rank.find(r => ss.find(s => s.id === r.staff)?.staff.sections.some(x => secs.includes(x)))
  return {staff: (hit ?? rank[0])?.staff ?? null, fallback: !hit}
}
interface Ctx {p: Policy; w: Parameters<Engine['rotate']>[1]; ss: Staff[]; rk: Ranked[]; ts: Entity[]; any: boolean}
const holder = (c: Ctx, id: Id) => c.ss.find(s => s.id === id)!
/** Sectioned: best-ranked holder of any table (section, dealt top, or area pair, by the table's carve). */
const held = (c: Ctx): Pick | undefined => {
  const rows = c.ts.map(t => carveOf(c.p, c.w, areaOf(t))).map((by, i) => ({by, cs: cands[by](c.ss, c.ts[i])}))
  const hit = c.rk.find(r => rows.some(x => x.cs.some(s => s.id === r.staff)))
  return hit && {staff: hit.staff, fallback: false, by: rows.find(x => x.cs.some(s => s.id === hit.staff))!.by}
}
const fitted = (c: Ctx) => c.rk.find(r => c.any || c.ts.every(t => fits(areaOf(t))(holder(c, r.staff))))
/** Rotation: the best-ranked unit; where the mode says `anywhere` that is every server and bartender over every area, else a unit whose `staff.area` is unset or the tables' area. */
const spun = (c: Ctx): Pick | undefined => { const hit = fitted(c); return hit && {staff: hit.staff, fallback: false, by: 'rotation'} }
const rest = (c: Ctx): Pick => ({staff: fitted(c)?.staff ?? null, fallback: true, by: 'fallback'})
const ways: Record<'true' | 'false', (c: Ctx) => Pick | undefined> = {true: held, false: spun}
/** Who serves a seating of these tables: standing holds in sectioned mode, rotation otherwise; no taker = ranked unit fitting the area, flagged fallback. */
export const serverFor: Engine['serverFor'] = (p, w, now, tables, skip) => {
  const c: Ctx = {p, w, ss: having(w, 'staff'), rk: rotate(p, w, now, skip), ts: tables.flatMap(i => w.ents[i]?.table ? [w.ents[i]] : []), any: anywhere(p, w, now)}
  return ways[String(holdsOn(p, w, now)) as 'true' | 'false'](c) ?? rest(c)
}
/** Simulated staff after seating `size` covers with server `id` at `at`: tally up, last seated, every skip cleared. */
export const bump = (ss: Staff[], id: Id | null, size: number, at: number): Staff[] =>
  ss.map(s => (id === null ? s : {...s, staff: {...s.staff, skip: 0, ...(s.id === id ? {tally: s.staff.tally + size, lastSeatedAt: at} : {})}}))
