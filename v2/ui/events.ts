// Every SimEvent becomes a line (kind, msg) and a floor ping (where). A table of describers keyed by event name (C3).
import type {Id, SimEvent, World} from '../contracts/index.ts'
import {locate} from './geo.ts'
type Line = {msg: string; at: Id}
type Describe = {[K in SimEvent['ev']]: (e: Extract<SimEvent, {ev: K}>, w: World) => Line}
const who = (w: World, id: Id) => w.ents[id]?.party && `${w.ents[id]!.party!.label} x${w.ents[id]!.party!.size}`
const tbl = (w: World, id: Id) => w.ents[id]?.table?.label ?? id
const nm = (w: World, id: Id) => w.ents[id]?.staff?.name ?? id
const describe: Describe = {
  arrived: (e, w) => ({msg: `${who(w, e.party) ?? e.party} arrived at the door`, at: e.party}),
  seated: (e, w) => ({msg: `${who(w, e.party) ?? e.party} seated at ${tbl(w, e.table)} by ${nm(w, e.by)}`, at: e.table}),
  served: (e, w) => ({msg: `${nm(w, e.by)} served ${tbl(w, e.table)}`, at: e.table}),
  cleared: (e, w) => ({msg: `${nm(w, e.by)} cleared ${tbl(w, e.table)}`, at: e.table}),
  left: (e, w) => ({msg: `${who(w, e.party) ?? e.party} left`, at: e.party}),
  stuck: (e, w) => ({msg: `${nm(w, e.unit)} stuck on ${e.task.do}: ${e.why}`, at: e.unit}),
}
/** Call before the tick's patches are applied: departed parties and bodies are still in the world. */
export const explain = (e: SimEvent, w: World) => {
  const line = (describe[e.ev] as (e: SimEvent, w: World) => Line)(e, w)
  return {kind: e.ev as string, msg: line.msg, ...locate(w, line.at)}
}
