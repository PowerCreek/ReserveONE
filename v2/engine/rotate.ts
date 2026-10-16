import {having} from '../contracts/index.ts'
import type {Engine, Ent, Id, Pick, Policy, Ranked} from '../contracts/index.ts'
import {secsOf} from './ents.ts'
import {MIN} from './time.ts'
type Staff = Ent<'staff'>
const idle = (p: Policy, now: number, s: Staff) => Math.min(p.rotation.idleCapMin, s.staff.lastSeatedAt === null ? p.rotation.idleCapMin : (now - s.staff.lastSeatedAt) / MIN)
/** Fair round robin by cumulative covers: lowest tally first, idle time only breaks ties, skip demotes. */
export const score = (p: Policy, now: number, s: Staff) => -s.staff.tally + idle(p, now, s) * p.rotation.idleWeight - s.staff.skip
export const rankStaff = (p: Policy, ss: Staff[], now: number): Ranked[] => ss.filter(s => s.staff.active).map(s => ({staff: s.id, score: score(p, now, s)})).sort((a, b) => b.score - a.score)
export const rotate: Engine['rotate'] = (p, w, now) => rankStaff(p, having(w, 'staff'), now)
/** Best-ranked server covering any of the sections, else the top server overall (fallback). */
export const pickIn = (ss: Staff[], rank: Ranked[], secs: Id[]): Pick => {
  const hit = rank.find(r => ss.find(s => s.id === r.staff)?.staff.sections.some(x => secs.includes(x)))
  return {staff: (hit ?? rank[0])?.staff ?? null, fallback: !hit}
}
export const serverFor: Engine['serverFor'] = (p, w, now, tables) => pickIn(having(w, 'staff'), rotate(p, w, now), secsOf(w, tables))
/** Simulated staff after seating `size` covers with server `id` at `at`: tally up, last seated, every skip cleared. */
export const bump = (ss: Staff[], id: Id | null, size: number, at: number): Staff[] =>
  ss.map(s => (id === null ? s : {...s, staff: {...s.staff, skip: 0, ...(s.id === id ? {tally: s.staff.tally + size, lastSeatedAt: at} : {})}}))
