import {having} from '../contracts/index.ts'
import type {Carve, Ent, Entity, Id, Policy, World} from '../contracts/index.ts'
import {MIN} from './time.ts'
/** Section underflow = low occupancy AND too few turns due soon (need: minTurns, else a share of its tables, at least 1). */
export const sectionStats = (p: Policy, w: World, now: number, s: Ent<'section'>) => {
  const ts = having(w, 'table').filter(t => t.table.section === s.id && t.table.status !== 'blocked_private')
  const occ = ts.length ? ts.filter(t => t.table.status !== 'available').length / ts.length : 0
  const turns = having(w, 'slot').filter(x => x.slot.status !== 'COMPLETED' && ts.some(t => t.id === x.slot.table) && x.slot.turnAt <= now + p.section.horizonMin * MIN).length
  const need = s.section.minTurns || Math.max(1, Math.round(ts.length * p.section.share))
  return {n: ts.length, occ, turns, need, under: ts.length > 0 && occ < (s.section.minOccupancy ?? p.section.minOcc) && turns < need}
}

// ---- who may hold a table (service modes): tables keyed by carve, never an if-ladder per area
type Staff = Ent<'staff'>
/** A table's area id (policy.service.areas); a table without the `area` component is in `main`. */
export const areaOf = (e?: Entity) => e?.area?.id ?? 'main'
/** The carve in force for an area: the `service` entity's choice when the area allows it, else the area's first carve. */
export const carveOf = (p: Policy, w: World, area: Id): Carve => {
  const ok = p.service.areas[area]?.carve ?? []
  const pick = w.ents.service?.service?.carve[area]
  return (pick && ok.includes(pick) ? pick : ok[0]) ?? 'chunk'
}
/** Can this unit serve the area? Unset `staff.area` = any area. */
export const fits = (area: Id) => (s: Staff) => !s.staff.area || s.staff.area === area
const bySection = (ss: Staff[], t: Entity) => ss.filter(s => !!t.table?.section && s.staff.sections.includes(t.table.section))
const byTop = (ss: Staff[], t: Entity) => ss.filter(s => s.id === t.assign?.staff)
const byLevel = (ss: Staff[], t: Entity) => ss.filter(s => !!s.staff.area && s.staff.area === areaOf(t))
/** Units that hold a table under each carve: section holders (chunk, whole), the dealt top, the area's bartender pair. */
export const cands: Record<Carve, (ss: Staff[], t: Entity) => Staff[]> = {chunk: bySection, whole: bySection, tops: byTop, level: byLevel}
