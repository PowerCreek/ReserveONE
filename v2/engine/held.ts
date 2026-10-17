// Table holds (E1): the host keeps tables clear for a party size until a time, once a gate opens (a table frees, or a clock minute). Saved holds are the `hold` component on each held table;
// this file is the one reader every placement path asks (fit, match/ladder, seat, lease) and the strategy reuses (`opens`, `mine`). Expiry is `until` against `now`: nothing to clean up.
import {having, partsOf} from '../contracts/index.ts'
import type {Ent, Entity, Id, Patch, Policy, World} from '../contracts/index.ts'
import type {Gate, StratHold} from '../contracts/strategy.ts'
import {tableFreeAt} from './avail.ts'
import {add} from './patch.ts'
import {minuteOfDay} from './time.ts'
type Free = (id: Id) => number
const GATE: Record<Gate['kind'], (free: Free, g: Gate) => number> = {free: (f, g) => f((g as Extract<Gate, {kind: 'free'}>).table), at: (_f, g) => (g as Extract<Gate, {kind: 'at'}>).at}
/** When a hold starts keeping its tables: its gate's time, else now. */
export const opens = (free: Free, now: number, h: {gate?: Gate}) => (h.gate ? GATE[h.gate.kind](free, h.gate) : now)
/** Each table's free time (tables only; anything else counts as free now). */
export const freeOf = (p: Policy, w: World, now: number): Free => { const at = tableFreeAt(p, w, now); return id => (w.ents[id]?.table ? at(w.ents[id] as Ent<'table'>) : now) }
/** Saved holds, one per id with all its tables. */
export const saved = (w: World): StratHold[] =>
  Object.values(having(w, 'hold').reduce<Record<string, StratHold>>((m, e) => ({...m, [e.hold.id]: {...e.hold, tables: [...(m[e.hold.id]?.tables ?? []), e.id]}}), {}))
const live = (free: Free, now: number) => (h: StratHold) => h.until > now && opens(free, now, h) <= now
const booked = (w: World, party?: Id) => (t => (t ? partsOf(w, t) : []))(w.ents[party ?? '']?.reservation?.table)
/** A hold is exclusive: only the party it names, or a reservation booked on its tables, may sit there (`size` is informational: planning and display). */
export const mine = (w: World, party?: Id) => (h: StratHold) => (!!party && h.party === party) || booked(w, party).some(t => h.tables.includes(t))
/** `on(tables, size, party)` = the live hold on any of these tables that this party may not take (built once per read; `size` kept for callers, not an entry rule). */
export const holdOn = (p: Policy, w: World, now: number) => {
  const hs = saved(w)
  const on = hs.length ? hs.filter(live(freeOf(p, w, now), now)) : []
  return (tables: Id[], _size: number, party?: Id): StratHold | undefined => on.find(h => !mine(w, party)(h) && h.tables.some(t => tables.includes(t)))
}
const clock = (ms: number) => ((m: number) => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}`)(minuteOfDay(ms))
const names = (w: World, h: StratHold, tables: Id[]) => h.tables.filter(t => tables.includes(t)).map(t => w.ents[t]?.table?.label ?? t).join('+')
/** Why these tables cannot take the party: 'T12 is held (for a 4) until 7:30: <why>', or undefined. */
export const heldWhy = (p: Policy, w: World, now: number, tables: Id[], size: number, party?: Id) =>
  ((h?: StratHold) => (h ? `${names(w, h, tables)} is held (for a ${h.size}) until ${clock(h.until)}: ${h.why}` : undefined))(holdOn(p, w, now)(tables, size, party))
const strip = (e: Entity): Entity => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'hold')) as Entity
const drop = (w: World, ids: string[]): Patch[] => having(w, 'hold').filter(e => ids.includes(e.hold.id)).map(e => add(strip(e)))
/** A seating on held tables releases every hold there that is not still waiting on its gate (put these patches first: they replace the table entities). */
export const released = (p: Policy, w: World, now: number, tables: Id[]): Patch[] => {
  const free = freeOf(p, w, now)
  return drop(w, saved(w).filter(h => h.tables.some(t => tables.includes(t)) && opens(free, now, h) <= now).map(h => h.id))
}
// ---- the host's commands (act.ts rows)
type HoldCmd = {tables: Id[]; size: number; until: number; gate?: Gate; why: string; party?: Id}
const nextId = (w: World) => `hd${having(w, 'hold').reduce((n, e) => Math.max(n, Number(e.hold.id.slice(2)) || 0), 0) + 1}`
/** First reason the hold cannot be set, or undefined. */
export const holdErr = (w: World, now: number, cmd: HoldCmd) =>
  ([[!cmd.tables.length, 'Pick a table to hold'], [cmd.tables.some(t => !w.ents[t]?.table), `No table ${cmd.tables.find(t => !w.ents[t]?.table)}`], [!(Number.isInteger(cmd.size) && cmd.size >= 1), 'A hold needs a party size of at least 1'], [!(cmd.until > now), 'A hold must end in the future']] as [boolean, string][]).find(([bad]) => bad)?.[1]
/** The `hold` component on each table (replacing any hold there). */
export const holdPatches = (w: World, cmd: HoldCmd): Patch[] =>
  ((id: string) => cmd.tables.map(t => add({...w.ents[t]!, hold: {id, size: cmd.size, until: cmd.until, why: cmd.why, ...(cmd.gate ? {gate: cmd.gate} : {}), ...(cmd.party ? {party: cmd.party} : {})}})))(nextId(w))
export const unholdPatches = (w: World, id: string): Patch[] => drop(w, [id])
