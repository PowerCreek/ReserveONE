import {having} from '../contracts/index.ts'
import type {Alert, Engine, Policy, World} from '../contracts/index.ts'
import {eventState} from './evstate.ts'
import type {EvState} from './evstate.ts'
import {sectionStats} from './section.ts'
import {MIN} from './time.ts'
type Rule = (p: Policy, w: World, now: number) => Alert[]
const late: Rule = (p, w, now) => having(w, 'party', 'reservation')
  .filter(r => r.reservation.status === 'BOOKED' && now - r.reservation.at > p.seat.lateGraceMin * MIN)
  .map(r => ({kind: 'late', ref: r.id, level: 'warn', msg: `${r.party.name} is late`}))
const lapsed: Rule = (p, w, now) => having(w, 'slot')
  .filter(s => s.slot.status === 'LAPSED' && now - s.slot.turnAt >= p.seat.lapsedClearMin * MIN)
  .map(s => ({kind: 'lapsed', ref: s.slot.table, level: 'crit', msg: `${w.ents[s.slot.table]?.table?.label ?? 'Table'} lapsed ${Math.floor((now - s.slot.turnAt) / MIN)}m: clear it`}))
const note: Partial<Record<EvState, [Alert['level'], (n: string, p: Policy) => string]>> = {
  BLOCKED_PREP: ['info', n => `${n}: prep lock`],
  EXPIRING_WARNING: ['warn', (n, p) => `${n} ends in <= ${p.alerts.warnMin}m`],
}
const event: Rule = (p, w, now) => having(w, 'event').flatMap(e => {
  const [level, msg] = note[eventState(p, e.event, now)] ?? []
  return msg && level ? [{kind: 'event' as const, ref: e.id, level, msg: msg(e.event.name, p)}] : []
})
const section: Rule = (_p, w, now) => having(w, 'section').filter(s => sectionStats(w, now, s).under).map(s => ({kind: 'section', ref: s.id, level: 'warn', msg: `Section ${s.section.name}: underflow`}))
const rules: Rule[] = [late, lapsed, event, section]
/** Everything the host should look at right now, derived from data and time (edge-triggering is the UI's job). */
export const alerts: Engine['alerts'] = (p, w, now) => rules.flatMap(r => r(p, w, now))
