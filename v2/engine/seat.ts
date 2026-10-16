import type {Engine, Heat, Id, Policy, SeatReq, SeqItem, World} from '../contracts/index.ts'
import {isTable, partyOf} from './ents.ts'
import type {Pty} from './ents.ts'
import {expand} from './spots.ts'
import {plan} from './fit.ts'
import {refuse} from './seatcheck.ts'
import {book} from './book.ts'
type Aim = {ids: Id[]} | {err: string}
const tell: Record<Heat, (n: number, it: SeqItem) => string> = {
  NO_TABLE: n => `No ${n}-top fits`,
  CAUTION_WAIT: (n, it) => `No ${n}-top ready now (wait ${Math.round(it.waitMin)}m)`,
  WARM_AMBER: (n, it) => `No ${n}-top ready now (wait ${Math.round(it.waitMin)}m)`,
  HOT_GREEN: n => `No ${n}-top fits`,
}
const auto = (p: Policy, w: World, now: number, req: SeatReq, who?: Pty): Aim => {
  const it = plan(p, w, now, [req.size], {floor: req.floor, skip: who?.id})[0]
  return it.ready ? {ids: it.tables} : {err: tell[it.code](req.size, it)}
}
/** Target tables: the given ones, else the party's held table, else the best ready spot (all expanded to whole link groups). */
const aim = (p: Policy, w: World, now: number, req: SeatReq, who?: Pty): Aim => {
  const held = who?.reservation?.table
  const given = [req.tables ?? [], held ? [held] : []].find(a => a.length) ?? []
  return given.length ? {ids: expand(w, given)} : auto(p, w, now, req, who)
}
/** Auto or manual seating -> patches (SPEC §3 seatParty); refusals carry the table-specific reason. */
export const seat: Engine['seat'] = (p, w, now, req) => {
  const who = partyOf(w, req.party ?? req.queue ?? req.reservation)
  const to = aim(p, w, now, req, who)
  const ts = 'ids' in to ? to.ids.map(i => w.ents[i]).filter(isTable) : []
  const err = 'err' in to ? to.err : refuse(p, ts, req.size)
  return err ? {ok: false, err} : book(p, w, now, req, who, ts)
}
