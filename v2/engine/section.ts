import {having} from '../contracts/index.ts'
import type {Ent, Policy, World} from '../contracts/index.ts'
import {MIN} from './time.ts'
/** Section underflow = low occupancy AND too few turns due soon (need: minTurns, else a share of its tables, at least 1). */
export const sectionStats = (p: Policy, w: World, now: number, s: Ent<'section'>) => {
  const ts = having(w, 'table').filter(t => t.table.section === s.id && t.table.status !== 'blocked_private')
  const occ = ts.length ? ts.filter(t => t.table.status !== 'available').length / ts.length : 0
  const turns = having(w, 'slot').filter(x => x.slot.status !== 'COMPLETED' && ts.some(t => t.id === x.slot.table) && x.slot.turnAt <= now + p.section.horizonMin * MIN).length
  const need = s.section.minTurns || Math.max(1, Math.round(ts.length * p.section.share))
  return {n: ts.length, occ, turns, need, under: ts.length > 0 && occ < (s.section.minOccupancy ?? p.section.minOcc) && turns < need}
}
