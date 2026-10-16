// Task readout (Gemini-era footer): the one thing the host does now, as said aloud. First step that applies wins: seat the head on a ready spot, tell a server, bus a table, quote the head a wait.
import type {BusItem, Id, Policy, PType, StandView, World} from '../contracts/index.ts'
import {spotOf} from './ask.ts'
export interface Ctx {p: Policy; w: World; view: StandView; bus: BusItem[]; name: (t: Id) => string}
const KIND: Record<PType, string> = {W: 'WALK-IN', R: 'RESERVATION', P: 'PRIORITY', V: 'VIP'}
const staffName = (w: World, id: Id | null) => w.ents[id ?? '']?.staff?.name
const head = (c: Ctx) => c.view.door[0] && `${KIND[c.view.door[0].kind]} (${c.view.door[0].size})`
const seatNext = (c: Ctx) => {
  const o = c.view.offers.find(x => x.spot && x.waitMin <= 0)
  const srv = staffName(c.w, o?.server ?? null)
  return o && head(c) ? [head(c), spotOf(c.p, c.w, o.spot!)?.spot.label ?? o.spot, ...(srv ? [srv] : [])].join(' → ') : undefined
}
const tellNext = (c: Ctx) => {
  const s = c.view.seated.find(r => r.aware === 'pending' && staffName(c.w, r.server))
  return s && `TELL ${staffName(c.w, s.server)} → ${c.name(s.table)}`
}
const busNext = (c: Ctx) => c.bus[0] && `BUS ${c.name(c.bus[0].table)}`
const waitNext = (c: Ctx) => {
  const r = c.view.offers[0]
  return head(c) && `${head(c)} → WAIT${r ? ` ${Math.round(r.waitMin)}m` : ''}`
}
const STEPS: ((c: Ctx) => string | undefined)[] = [seatNext, tellNext, busNext, waitNext]
/** One line for the host from the stand view: seat, tell, bus, wait, else "All clear". */
export const readout = (c: Ctx): string => STEPS.reduce<string | undefined>((s, f) => s || f(c), undefined) || 'All clear'
