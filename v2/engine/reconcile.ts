import {having} from '../contracts/index.ts'
import type {Ent, Engine, Id, Patch, Policy, TStatus, World} from '../contracts/index.ts'
import {eventState, mode} from './evstate.ts'
import {expand} from './spots.ts'
import {set} from './patch.ts'
const toStatus = (t: Ent<'table'>, status: TStatus): Patch => set(t.id, {table: {...t.table, status}})
const tablesIn = (w: World, ids: Id[], ok: TStatus[]) => having(w, 'table').filter(t => ids.includes(t.id) && ok.includes(t.table.status))
const lapse = (w: World, now: number): Patch[] => {
  const due = having(w, 'slot').filter(s => s.slot.status === 'ACTIVE' && s.slot.turnAt < now)
  return [...due.map(s => set(s.id, {slot: {...s.slot, status: 'LAPSED'}})), ...tablesIn(w, expand(w, due.map(s => s.slot.table)), ['occupied']).map(t => toStatus(t, 'lapsed'))]
}
type Act = (p: Policy, w: World, now: number, e: Ent<'event'>) => Patch[]
const lock: Act = (_p, w, _now, e) => {
  const open = tablesIn(w, e.event.tables, ['available', 'lapsed'])
  return open.length ? [...open.map(t => toStatus(t, 'blocked_private')), set(e.id, {event: {...e.event, locked: [...new Set([...e.event.locked, ...open.map(t => t.id)])]}})] : []
}
const claimed = (p: Policy, w: World, now: number, e: Ent<'event'>, id: Id) =>
  having(w, 'event').some(o => o.id !== e.id && !o.event.reclaimed && mode[eventState(p, o.event, now)] === 'lock' && o.event.tables.includes(id))
const free: Act = (p, w, now, e) => {
  const mine = tablesIn(w, e.event.locked, ['blocked_private']).filter(t => !claimed(p, w, now, e, t.id))
  return e.event.reclaimed ? [] : [...mine.map(t => toStatus(t, 'available')), set(e.id, {event: {...e.event, locked: [], reclaimed: true}})]
}
const acts: Record<'lock' | 'free' | 'none', Act> = {lock, free, none: () => []}
/** Idempotent housekeeping as patches: lapse overdue slots (and their tables), lock / give back private-event tables. Empty when nothing is due. */
export const reconcile: Engine['reconcile'] = (p, w, now) => [...lapse(w, now), ...having(w, 'event').flatMap(e => acts[mode[eventState(p, e.event, now)]](p, w, now, e))]
