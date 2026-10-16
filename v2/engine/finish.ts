import {having} from '../contracts/index.ts'
import type {Components, Entity, Patch, Task, World} from '../contracts/index.ts'
import {add, del, set} from './patch.ts'
import {center, partyOf, phase} from './ents.ts'
import {bodyOf, emit, skip} from './simctx.ts'
import type {Stage} from './simctx.ts'
import {seat} from './seat.ts'
import {freeUp} from './free.ts'
type Of<K extends Task['do']> = Extract<Task, {do: K}>
const follow = (w: World, t: Of<'seat'>): Patch[] => {
  const gb = w.ents[t.party]?.body
  return gb ? [set(t.party, {body: {...gb, task: {do: 'move', ...center(w, t.table)}, backlog: [{do: 'serve', table: t.table}]}})] : []
}
const seated: Stage = (c, id, a) => {
  const t = a.done as Of<'seat'>
  const who = partyOf(a.w, t.party)
  const r = who ? seat(c.p, a.w, c.now, {size: who.party.size, kind: who.party.kind, party: t.party, tables: [t.table]}) : ({ok: false, err: 'party is gone'} as const)
  return r.ok ? emit(a, [...r.patches, ...follow(a.w, t)], [{ev: 'seated', party: t.party, table: t.table, by: id}]) : emit(a, [], [{ev: 'stuck', unit: id, task: t, why: r.err}])
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
const byPhase: Record<ReturnType<typeof phase>, Stage> = {door: arrived, seated: skip, gone: left}
const arrival: Record<Components['body']['role'], Stage> = {guest: (c, id, a) => byPhase[phase(a.w, id)](c, id, a), host: skip, server: skip, busser: skip}
const arrive: Stage = (c, id, a) => arrival[bodyOf(a, id)?.role ?? 'host'](c, id, a)
const fin: Record<Task['do'], Stage> = {move: arrive, wait: skip, seat: seated, serve: served, clear: cleared}
/** Turn the task that just finished into patches + events (seated, served, cleared, arrived, left, stuck). */
export const complete: Stage = (c, id, a) => (a.done ? fin[a.done.do] : skip)(c, id, a)
