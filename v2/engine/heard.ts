// Host service: `heard` events derived from an intake Decision's patches (Decision carries no events; the caller emits these beside the patches).
import type {HostEvent, Id, Patch, World} from '../contracts/index.ts'
import type {Components} from '../contracts/index.ts'
type Wants = Components['wants']
const fresh = (w: World, id: Id, next: Wants) => next.heard.filter(f => !(w.ents[id]?.wants?.heard ?? []).includes(f))
const events = (id: Id, next: Wants, feats: string[]): HostEvent[] => next.list.filter(x => feats.includes(x.feat) && !x.said).map(x => ({ev: 'heard', party: id, feat: x.feat, level: x.level}))
const of = (w: World) => (p: Patch): HostEvent[] => (p.op === 'set' && p.parts.wants ? events(p.id, p.parts.wants, fresh(w, p.id, p.parts.wants)) : [])
/** One `heard` per want newly recorded by these patches (volunteered wants were already known; a repeat intake yields none). Call with the world before the patches apply. */
export const heard = (w: World, ps: Patch[]): HostEvent[] => ps.flatMap(of(w))
