// Priority order (lane U14, E1): one ordered list of everyone waiting, each with the terms that put it there. The weights are policy data (`policy.book`).
import {bookOf, having} from '../contracts/index.ts'
import type {BookPolicy, CallRow, Entity, Intake, Policy, QRow, Term, Via, WaitView, World} from '../contracts/index.ts'
import type {Pty} from './ents.ts'
import {where} from './ask.ts'
import {MIN} from './time.ts'
export const viaOf = (e: Entity): Via => e.intake?.via ?? (e.reservation ? 'book' : 'walk')
/** The record every party has, filled for parties minted before intake existed (scenario guests, `join`/`reserve`). */
export const intakeOf = (e: Entity): Intake => ({via: viaOf(e), flags: [], feats: [], area: null, bump: 0, bumps: [], ...e.intake})
/** When its wait starts: a call-ahead's promise, a booking's time, a walk-in's arrival. */
const since = (e: Pty) => e.intake?.eta ?? e.reservation?.at ?? e.queue?.since ?? 0
export const atDoor = (e: Entity) => e.queue?.status === 'WAITING' || e.reservation?.status === 'ARRIVED'
/** A call-ahead past its ETA is on the list even before it checks in (checking in gives it a `queue`). */
const dueCall = (now: number) => (e: Pty) => !e.queue && e.intake?.via === 'call' && !e.intake.gone && (e.intake.eta ?? Infinity) <= now
const GRACE: Record<Via, (b: BookPolicy) => number> = {book: b => b.graceMin.book, call: b => b.graceMin.call, walk: () => Infinity}
/** Late = checked in (or still not here) past its promise plus grace; a walk-in is never late. */
const lateOf = (b: BookPolicy, e: Pty, now: number) => (e.intake?.here ?? now) > since(e) + GRACE[viaOf(e)](b) * MIN
const quoted = (e: Pty) => e.queue?.quotedMin ?? e.intake?.quote ?? null
interface Q {b: BookPolicy; e: Pty; i: Intake; waited: number; late: boolean; over: boolean; here: boolean}
const terms = (q: Q): Term[] => ([
  [true, {id: 'via', label: q.b.via[q.i.via].label, pts: q.b.via[q.i.via].pts}],
  [true, {id: 'kind', label: q.b.kind[q.e.party.kind]?.label ?? q.e.party.kind, pts: q.b.kind[q.e.party.kind]?.pts ?? 0}],
  ...q.i.flags.map(f => [true, {id: `flag:${f}`, label: q.b.flags[f]?.label ?? f, pts: q.b.flags[f]?.pts ?? 0}] as const),
  [q.waited > 0, {id: 'wait', label: `waited ${q.waited}m`, pts: q.waited * q.b.perMin}],
  [q.over, {id: 'over', label: 'past its quote', pts: q.b.overQuote}],
  [q.late, {id: 'late', label: q.here ? 'arrived late' : 'late, not here yet', pts: q.b.late}],
  ...q.i.bumps.map(x => [true, {id: 'bump', label: `bumped: ${q.b.bumpWhys[x.why] ?? x.why}`, pts: x.pts}] as const),
] as const).filter(([on, t]) => on && t.pts !== 0).map(([, t]) => t)
const row = (b: BookPolicy, now: number) => (e: Pty): Omit<QRow, 'rank'> => {
  const i = intakeOf(e)
  const q = {b, e, i, waited: Math.max(0, Math.floor((now - since(e)) / MIN)), late: lateOf(b, e, now), here: atDoor(e), over: false}
  const qm = quoted(e)
  const why = terms({...q, over: qm !== null && q.here && q.waited > qm})
  return {party: e.id, label: e.party.label, name: e.party.name, size: e.party.size, via: i.via, kind: e.party.kind, flags: i.flags, here: q.here, late: q.late, waitedMin: q.waited, quotedMin: qm, over: why.some(t => t.id === 'over'), pts: why.reduce((n, t) => n + t.pts, 0), why, texted: i.texted ?? null, noReply: !!i.texted && now - i.texted > b.replyMin * MIN}
}
const listed = (w: World, now: number) => (e: Pty) => (atDoor(e) && !where(w, e.id)) || dueCall(now)(e)
const byPts = (a: Omit<QRow, 'rank'>, b: Omit<QRow, 'rank'>) => b.pts - a.pts || b.waitedMin - a.waitedMin || (a.party < b.party ? -1 : 1)
/** Everyone waiting, first to seat first: parties at the door (not led or seated) and call-aheads past their ETA. */
export const order = (p: Policy, w: World, now: number): QRow[] =>
  (having(w, 'party') as Pty[]).filter(listed(w, now)).map(row(bookOf(p), now)).sort(byPts).map((r, i) => ({...r, rank: i + 1}))
const call = (now: number) => (e: Pty): CallRow => ({party: e.id, label: e.party.label, name: e.party.name, size: e.party.size, eta: e.intake!.eta!, inMin: Math.ceil((e.intake!.eta! - now) / MIN), phone: e.intake!.phone ?? '', flags: e.intake!.flags})
/** Call-aheads still on their way (before their ETA), soonest first. */
const calls = (w: World, now: number): CallRow[] =>
  (having(w, 'party', 'intake') as Pty[]).filter(e => e.intake!.via === 'call' && !e.intake!.gone && !e.queue && (e.intake!.eta ?? 0) > now).map(call(now)).sort((a, b) => a.eta - b.eta)
export const wait = (p: Policy, w: World, now: number): WaitView => ({rows: order(p, w, now), calls: calls(w, now)})
