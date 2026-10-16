import type {Coach, Id, Rung, StepDef} from '../contracts/index.ts'
import {env} from './match.ts'
import type {Env} from './match.ts'
import {build} from './rungs.ts'
const claimed = (rs: Rung[]): Id[] => rs.flatMap(r => r.spot ?? [])
const add = (e: Env, no: Id[]) => (rs: Rung[], d: StepDef): Rung[] => [...rs, ...[build(e, [...no, ...claimed(rs)], d)].flatMap(r => r ?? [])]
/** Fallback proposals in policy order; spots the party declined (`offer.declined`) are never proposed again, so the next best takes their rung. Fits already satisfy every need, so no rung can give one up; a ready exact match is the whole answer. */
export const ladder: Coach['ladder'] = (p, w, now, id) => {
  const e = env(p, w, now, id)
  const rs = e ? p.host.ladder.reduce(add(e, w.ents[id]?.offer?.declined ?? []), []) : []
  const ex = rs.find(r => r.step === 'exact')
  return ex ? [ex] : rs
}
