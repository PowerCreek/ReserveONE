// Host service: apply a response row to an open request, and settle what the guests decide on their own (offers, requests, patience).
import {having} from '../contracts/index.ts'
import type {Ask, Coach, Components, Decide, Ent, HostEvent, Id, Patch, Policy, Reply, SimEvent, World} from '../contracts/index.ts'
import {add, apply, del, set} from './patch.ts'
import {slotOf} from './ents.ts'
import type {Pty} from './ents.ts'
import {spotOf} from './ask.ts'
import {caseOf, likes, options, pick} from './options.ts'
import type {Case} from './options.ts'
import {MIN} from './time.ts'
type Spot = Ent<'spot'>
type Move = 'swap' | 'offer' | 'stay'
const round = (n: number) => Math.round(n * 100) / 100
const age = (now: number, at: number) => (now - at) / MIN
/** Sentiment at stake: the row's base delta times the reason's urgency times the stage multiplier (policy.host.reply). */
const scale = (p: Policy, c: Case, base: number) => round(base * c.def.urgency * p.host.reply.stage[c.req.stage])
const score = (w: World, c: Case, delta: number): Patch => set(c.party, {mood: {score: round((w.ents[c.party]?.mood?.score ?? 0) + delta)}})
const table = (w: World, id: Id, over: Partial<Components['table']>): Patch[] => (w.ents[id]?.table ? [set(id, {table: {...w.ents[id].table!, ...over}})] : [])
const hop = (w: World, c: Case, to: Spot): Patch[] => {
  const slot = slotOf(w, c.party)
  const from = c.cur?.spot.tables ?? []
  const waiter = w.ents[from[0] ?? '']?.table?.waiter ?? null
  return slot?.slot.status !== 'ACTIVE' ? [] : [...from.flatMap(t => table(w, t, {status: 'available', waiter: null})), ...to.spot.tables.flatMap(t => table(w, t, {status: 'occupied', waiter})), set(slot.id, {slot: {...slot.slot, table: to.spot.tables[0]}})]
}
const moveOffer = (w: World, c: Case, to: Spot): Partial<Components> => {
  const o = w.ents[c.party]?.offer
  return o?.status === 'accepted' ? {offer: {...o, spot: to.id}} : {}
}
const status: Record<Move, Ask> = {swap: 'granted', offer: 'offered', stay: 'declined'}
const request = (c: Case, move: Move, to?: Spot): Components['request'] => ({...c.req, status: status[move], table: move === 'swap' ? to?.id ?? c.req.table : c.req.table, spot: move === 'stay' ? null : to?.id ?? null})
/** Patches per outcome: a swap moves the slot and tables (seated) or the placement (arrived); an offer only records the proposal; a stay closes the request. */
const outcome: Record<Move, (w: World, c: Case, to?: Spot) => Patch[]> = {
  swap: (w, c, to) => (to ? [...hop(w, c, to), set(c.party, {request: request(c, 'swap', to), ...moveOffer(w, c, to)})] : []),
  offer: (_w, c, to) => [set(c.party, {request: request(c, 'offer', to)})],
  stay: (_w, c) => [set(c.party, {request: request(c, 'stay')})],
}
const events = (c: Case, response: string, move: Move, mood: number, to?: Spot): HostEvent[] => [
  {ev: 'replied', party: c.party, reason: c.req.reason, response, move, mood},
  ...(move === 'swap' && to ? [{ev: 'moved' as const, party: c.party, from: c.cur?.id ?? c.req.table, to: to.id}] : []),
  ...(mood ? [{ev: 'mood' as const, party: c.party, delta: mood, why: c.req.reason}] : []),
]
const blank: Reply = {patches: [], events: [], move: 'stay', mood: 0, says: ''}
const reply = (p: Policy, w: World, c: Case, response: string): Reply => {
  const to = pick(w, c, response)
  const out = p.host.responses[response].then[to ? 'spot' : 'none']
  const move = to ? out.move : 'stay'
  const mood = scale(p, c, out.mood)
  return {patches: [...outcome[move](w, c, to), score(w, c, mood)], events: events(c, response, move, mood, to), move, mood, says: out.says}
}
/** Apply a policy.host.responses row to the open request: the spot branch (`then.spot`) when the response finds a spot, else `then.none`; mood scaled by urgency and stage. A response not offered for this reason is ignored. */
export const respond: Coach['respond'] = (p, w, now, party, response) => {
  const c = caseOf(p, w, party)
  return c && options(p, w, now, party).some(o => o.response === response) ? reply(p, w, c, response) : blank
}

// Guests deciding on their own: the tick calls `settle` and writes the patches/events (E1: pure, history stays as data).
export interface Settled {patches: Patch[]; events: (HostEvent | SimEvent)[]}
type Stage = (p: Policy, w: World, now: number) => Settled
const nil: Settled = {patches: [], events: []}
const join = (xs: Settled[]): Settled => ({patches: xs.flatMap(x => x.patches), events: xs.flatMap(x => x.events)})
const no = (party: Id, spot: Id): HostEvent => ({ev: 'answered', party, spot, yes: false})
/** A ladder offer unanswered past clock.answerMin lapses: the party declined. */
const lapse: Stage = (p, w, now) => {
  const old = having(w, 'offer').filter(e => e.offer.status === 'open' && age(now, e.offer.at) >= p.host.clock.answerMin)
  return {patches: old.map(e => set(e.id, {offer: {...e.offer, status: 'lapsed'}})), events: old.map(e => no(e.id, e.offer.spot))}
}
const shut = (c: Case): Patch => set(c.party, {request: request(c, 'stay')})
const ignore = (p: Policy, w: World, c: Case): Settled => {
  const delta = scale(p, c, p.host.responses.refuse?.then.none.mood ?? 0)
  return {patches: [shut(c), score(w, c, delta)], events: delta ? [{ev: 'mood', party: c.party, delta, why: c.req.reason}] : []}
}
const take = (w: World, c: Case, s: Spot): Settled => ({patches: outcome.swap(w, c, s), events: [{ev: 'answered', party: c.party, spot: s.id, yes: true}, {ev: 'moved', party: c.party, from: c.cur?.id ?? c.req.table, to: s.id}]})
const refuse = (c: Case): Settled => ({patches: [shut(c)], events: [no(c.party, c.req.spot ?? '')]})
const offered = (p: Policy, w: World, now: number, c: Case): Settled => {
  const s = spotOf(p, w, c.req.spot ?? '')
  const open = s?.spot.status === 'available' && s.spot.capacity >= c.size
  const late = age(now, c.req.at) >= p.host.clock.reseatWindowMin
  return s && open && likes(w, c, s) ? take(w, c, s) : open || late ? refuse(c) : nil
}
/** A request left unanswered past clock.reseatWindowMin counts as refused; an offered spot is taken when free and liked, refused when taken, disliked or past the window. */
const requests: Stage = (p, w, now) => join(having(w, 'request').flatMap(e => {
  const o = caseOf(p, w, e.id, ['offered'])
  const c = caseOf(p, w, e.id)
  return [o ? offered(p, w, now, o) : c && age(now, c.req.at) >= p.host.clock.reseatWindowMin ? ignore(p, w, c) : nil]
}))
const waiting = (e: Pty) => (e.queue?.status === 'WAITING' || e.reservation?.status === 'ARRIVED') && !e.request && e.offer?.status !== 'accepted'
const since = (e: Pty) => e.queue?.since ?? e.reservation?.at ?? 0
const declined = (e: Pty) => (e.offer?.status === 'lapsed' || e.offer?.status === 'declined' ? 1 : 0)
/** Patience: wait past clock.patienceMin[kind] and the party leaves; a party that declined an offer has one answer window less (it cannot sit through another). */
const spent = (p: Policy, e: Pty, now: number) => age(now, since(e)) + declined(e) * p.host.clock.answerMin >= p.host.clock.patienceMin[e.party.kind]
const gone = (e: Pty) => Object.fromEntries(Object.entries(e).flatMap(([k, v]) => (k === 'body' || k === 'queue' ? [] : [[k, k === 'reservation' ? {...e.reservation, status: 'NO_SHOW'} : k === 'offer' && e.offer?.status === 'open' ? {...e.offer, status: 'declined'} : v]])))
const leave = (e: Pty): Settled => ({patches: [del(e.id), add(gone(e) as Pty)], events: [...(e.offer?.status === 'open' ? [no(e.id, e.offer.spot)] : []), {ev: 'left', party: e.id}]})
const patience: Stage = (p, w, now) => join((having(w, 'party') as Pty[]).filter(e => waiting(e) && spent(p, e, now)).map(leave))
const stages: Stage[] = [lapse, requests, patience]
interface Acc {w: World; out: Settled}
/** Decide what guests do by themselves at `now`: lapsed offers are answered no, requests settle, parties past patience leave the list. Each stage sees the earlier stages' patches. */
export const settle: Decide<[], Settled> = (p, w, now) => stages.reduce<Acc>((a, s) => { const r = s(p, a.w, now); return {w: apply(a.w, r.patches), out: join([a.out, r])} }, {w, out: nil}).out
