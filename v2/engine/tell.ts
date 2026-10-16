// Host action: tell a table's server about its seating (sets `slot.told`). `toldEvents` derives the `told` event from the patches (Decision carries no events; callers narrate beside the patches, like `heard`).
import {having} from '../contracts/index.ts'
import type {Decision, Entity, Id, Patch, Policy, ServiceEvent, World} from '../contracts/index.ts'
import {activeAt} from './knows.ts'
import {standing} from './holds.ts'
import {set} from './patch.ts'
import {areaOf} from './section.ts'
import type {Service} from '../contracts/index.ts'
type Slot = ReturnType<typeof activeAt>
interface C {p: Policy; w: World; table: Id; label: string; seen: boolean; slot: Slot; who: Id | null; name: string}
const hostOf = (w: World) => having(w, 'body').find(b => b.body.role === 'host')?.id ?? 'host'
/** The table's server: its waiter once seated, else the standing holder under the active mode. */
const holder = (p: Policy, w: World, now: number, table: Id): Id | null => w.ents[table]?.table?.waiter ?? standing(p, w, now).find(h => h.table === table)?.staff ?? null
const brief = (p: Policy, w: World, now: number, table: Id): C => {
  const slot = activeAt(w, table)
  const who = holder(p, w, now, slot?.slot.table ?? table)
  return {p, w, table, slot, who, label: w.ents[table]?.table?.label ?? table, seen: !!p.service.areas[areaOf(w.ents[table])]?.seen, name: w.ents[who ?? '']?.staff?.name ?? 'the server'}
}
/** First failing check wins; each row is data (C3). */
const refusals = (c: C): [bad: boolean, why: string][] => [
  [c.seen, `Servers see their own seatings at ${c.label}: nothing to tell`],
  [!c.slot, `Nobody is seated at ${c.label}`],
  [!c.who, `No server holds ${c.label}`],
  [!!c.slot?.slot.told, `${c.name} already knows about ${c.label}`],
]
const told = (c: C, now: number, by: Id): Patch => set(c.slot!.id, {slot: {...c.slot!.slot, told: {by, at: now}}})
export const tell: Service['tell'] = (p, w, now, table): Decision => {
  const c = brief(p, w, now, table)
  const err = refusals(c).find(([bad]) => bad)?.[1]
  return err ? {ok: false, err} : {ok: true, patches: [told(c, now, hostOf(w))], msg: `Told ${c.name} about ${c.label}`, tone: 'ok'}
}
const event = (w: World) => (p: Patch): ServiceEvent[] => {
  const s = p.op === 'set' ? p.parts.slot : undefined
  const fresh = p.op === 'set' && s?.told && !(w.ents[p.id] as Entity | undefined)?.slot?.told
  return fresh && s?.told ? [{ev: 'told', party: s.party, table: s.table, server: w.ents[s.table]?.table?.waiter ?? '', by: s.told.by}] : []
}
/** One `told` per slot these patches newly tell (a repeat yields none). Call with the world before the patches apply. */
export const toldEvents = (w: World, ps: Patch[]): ServiceEvent[] => ps.flatMap(event(w))
