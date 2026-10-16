// Deal the crew for a mode with holds (Service.assign): chunk = contiguous slices of the area's tables, whole = one server holds the area's section, tops = single tables dealt one by one, level = nothing to deal (the pair's `staff.area`). Pure: patches only for what differs, so a second run is empty.
import {having} from '../contracts/index.ts'
import type {Carve, Components, Ent, Entity, Id, Patch, Policy, Service, World} from '../contracts/index.ts'
import {holdsOn} from './modes.ts'
import {add, apply, set} from './patch.ts'
import {areaOf, carveOf, fits} from './section.ts'
type Staff = Ent<'staff'>
type Tbl = Ent<'table'> & Entity
interface Acc {w: World; ps: Patch[]; load: Record<Id, number>} // load = tables each unit holds so far, in this deal
interface Ctx {p: Policy; area: Id; ts: Tbl[]; crew: Staff[]; whole: Id[]} // crew = active units that fit the area, by id; whole = every whole-carve section id
type Deal = (c: Ctx, a: Acc) => Acc
const tint = '#64748b' // colour of a section this deal creates
const natural = (a: Tbl, b: Tbl) => a.table.label.localeCompare(b.table.label, undefined, {numeric: true}) || a.id.localeCompare(b.id)
const diff = (t: Entity, parts: Partial<Components>): Patch[] => (Object.entries(parts) as [keyof Components, unknown][]).every(([k, v]) => JSON.stringify(t[k]) === JSON.stringify(v)) ? [] : [set(t.id, parts)]
const give = (a: Acc, ps: Patch[], id: Id, n: number): Acc => ({w: apply(a.w, ps), ps: [...a.ps, ...ps], load: {...a.load, [id]: (a.load[id] ?? 0) + n}})
const cost = (a: Acc) => (s: Staff) => ((a.load[s.id] ?? 0) + 1) / (s.staff.weight ?? 1)
/** The unit with the fewest tables per weight (ties: first by id). */
const lightest = (a: Acc, crew: Staff[]) => crew.reduce<Staff | undefined>((b, s) => (b && cost(a)(b) <= cost(a)(s) ? b : s), undefined)
const secOf = (t: Tbl, sec: Id) => diff(t, {table: {...t.table, section: sec}})
const ends = (n: number, ws: number[]) => ws.map((_, k) => Math.round((n * ws.slice(0, k + 1).reduce((x, y) => x + y, 0)) / ws.reduce((x, y) => x + y, 0)))
const own = (c: Ctx, s: Staff) => s.staff.sections.find(x => !c.whole.includes(x))
/** chunk: units that hold a section of their own, ordered by it, each takes a contiguous slice sized by weight. */
const chunk: Deal = (c, a) => {
  const us = c.crew.flatMap(s => own(c, s) ? [{s, sec: own(c, s)!}] : []).sort((x, y) => x.sec.localeCompare(y.sec, undefined, {numeric: true}))
  const to = ends(c.ts.length, us.map(u => u.s.staff.weight ?? 1))
  return c.ts.reduce((acc, t, i) => { const u = us[to.findIndex(e => i < e)]; return (u && give(acc, secOf(t, u.sec), u.s.id, 1)) ?? acc }, a)
}
const wholeSec = (area: Id, ts: Tbl[]) => ts.find(t => t.table.section)?.table.section ?? `sec_${area}`
/** whole: the area is one section; its current holder keeps it, else the lightest unit takes it. */
const whole: Deal = (c, a) => {
  const sec = wholeSec(c.area, c.ts)
  const keep = c.crew.find(s => s.staff.sections.includes(sec))
  const s = keep ?? lightest(a, c.crew)
  const ps = [...(a.w.ents[sec] ? [] : [add({id: sec, section: {name: c.p.service.areas[c.area]?.label ?? c.area, color: tint}})]), ...c.ts.flatMap(t => secOf(t, sec)), ...(s && !keep ? [set(s.id, {staff: {...s.staff, sections: [...s.staff.sections, sec]}})] : [])]
  return (s && give(a, ps, s.id, c.ts.length)) ?? a
}
/** tops: each table, in label order, to the unit with the fewest tables per weight, so totals even out across the whole crew. */
const top = (c: Ctx, a: Acc, t: Tbl): Acc => { const s = lightest(a, c.crew); return (s && give(a, diff(t, {assign: {staff: s.id}}), s.id, 1)) ?? a }
const tops: Deal = (c, a) => c.ts.reduce((acc, t) => top(c, acc, t), a)
const deal: Record<Carve, Deal> = {chunk, whole, tops, level: (_c, a) => a}
const phase = (p: Policy, w: World) => (area: Id) => Object.keys(deal).indexOf(carveOf(p, w, area))
/** Deal the crew for `mode` (default: the active one); a mode without holds deals nothing. */
export const assign: Service['assign'] = (p, w, now, mode) => {
  const on = mode ? p.service.modes[mode]?.holds : holdsOn(p, w, now)
  const crew = having(w, 'staff').filter(s => s.staff.active).sort((a, b) => a.id.localeCompare(b.id))
  const byArea = Object.entries((having(w, 'table') as Tbl[]).sort(natural).reduce<Record<Id, Tbl[]>>((m, t) => ({...m, [areaOf(t)]: [...(m[areaOf(t)] ?? []), t]}), {}))
  const wholes = byArea.filter(([a]) => carveOf(p, w, a) === 'whole').map(([a, ts]) => wholeSec(a, ts))
  const ctx = ([area, ts]: [Id, Tbl[]]): Ctx => ({p, area, ts, crew: crew.filter(fits(area)), whole: wholes})
  return (on && byArea.sort(([x], [y]) => phase(p, w)(x) - phase(p, w)(y)).map(ctx).reduce((a, c) => deal[carveOf(p, w, c.area)](c, a), {w, ps: [], load: {}} as Acc).ps) || []
}
