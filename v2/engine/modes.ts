// Service mode of the day (contracts/service.ts): the `service` entity's override, else the schedule row for the local minute.
import type {Service} from '../contracts/index.ts'
import {minuteOfDay} from './time.ts'
/** Active mode id. An override or schedule row naming a mode missing from `policy.service.modes` is ignored; before the first row the last row (yesterday's) still runs. */
export const modeAt: Service['modeAt'] = (p, w, now) => {
  const rows = [...p.service.schedule].sort((a, b) => a.from - b.from)
  const due = rows.filter(r => r.from <= minuteOfDay(now)).at(-1) ?? rows.at(-1)
  return [w.ents.service?.service?.override, due?.mode].find(m => !!m && m in p.service.modes) ?? Object.keys(p.service.modes)[0]
}
/** Does the active mode keep standing holds (sections, tops, levels)? */
export const holdsOn = (...a: Parameters<Service['modeAt']>) => a[0].service.modes[modeAt(...a)]?.holds ?? false
