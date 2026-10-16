import {having} from '../contracts/index.ts'
import type {Components, Decision, Entity, Task, World} from '../contracts/index.ts'
import {add, del, set} from './patch.ts'
import {partyOf, phase} from './ents.ts'
import type {Pty} from './ents.ts'
import {bodyOf, emit, skip} from './simctx.ts'
import type {Ctx, Stage} from './simctx.ts'
import {confirm} from './lease.ts'
import type {Leased} from './lease.ts'
import {seat} from './seat.ts'
import {freeUp} from './free.ts'
type Of<K extends Task['do']> = Extract<Task, {do: K}>
type Way = 'lease' | 'done' | 'seat' | 'gone'
const wayOf = (w: World, who?: Pty): Way => (!who ? 'gone' : who.lease ? 'lease' : phase(w, who.id) === 'seated' ? 'done' : 'seat')
/** A leased party confirms its lease; one already seated (its lease settled on the way) needs nothing; else the host seats it directly. */
const ways: Record<Way, (c: Ctx, w: World, t: Of<'seat'>, who: Pty) => Decision | null> = {
  lease: (c, w, _t, who) => confirm(c.p, w, c.now, who as Leased),
  done: () => null,
  seat: (c, w, t, who) => seat(c.p, w, c.now, {size: who.party.size, kind: who.party.kind, party: t.party, tables: [t.table]}),
  gone: () => ({ok: false, err: 'party is gone'}),
}
const seated: Stage = (c, id, a) => {
  const t = a.done as Of<'seat'>
  const who = partyOf(a.w, t.party)
  const r = ways[wayOf(a.w, who)](c, a.w, t, who!)
  return !r ? a : r.ok ? emit(a, r.patches, [{ev: 'seated', party: t.party, table: t.table, by: id}]) : emit(a, [], [{ev: 'stuck', unit: id, task: t, why: r.err}])
}
const served: Stage = (_c, id, a) => {
  const t = a.done as Of<'serve'>
  const gs = having(a.w, 'party', 'body').filter(g => g.body.task?.do === 'serve' && g.body.task.table === t.table)
  return emit(a, gs.map(g => set(g.id, {body: {...g.body, task: null, backlog: []}})), [{ev: 'served', table: t.table, by: id}])
}
const cleared: Stage = (c, id, a) => {
  const t = a.done as Of<'clear'>
  return emit(a, freeUp(a.w, [t.table], c.now), [{ev: 'cleared', table: t.table, by: id}])
}
const strip = (e: Entity): Entity => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'body')) as Entity // history stays as data (E2): the party outlives its body
const arrived: Stage = (_c, id, a) => emit(a, [], [{ev: 'arrived', party: id}])
const left: Stage = (_c, id, a) => emit(a, [del(id), add(strip(a.w.ents[id]))], [{ev: 'left', party: id}])
const byPhase: Record<ReturnType<typeof phase>, Stage> = {door: arrived, led: skip, seated: skip, gone: left}
const arrival: Record<Components['body']['role'], Stage> = {guest: (c, id, a) => byPhase[phase(a.w, id)](c, id, a), host: skip, server: skip, busser: skip}
const arrive: Stage = (c, id, a) => arrival[bodyOf(a, id)?.role ?? 'host'](c, id, a)
const fin: Record<Task['do'], Stage> = {move: arrive, wait: skip, seat: seated, serve: served, clear: cleared}
/** Turn the task that just finished into patches + events (seated, served, cleared, arrived, left, stuck). */
export const complete: Stage = (c, id, a) => (a.done ? fin[a.done.do] : skip)(c, id, a)
