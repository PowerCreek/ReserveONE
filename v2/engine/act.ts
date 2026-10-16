// Desk writes (wave 4): every host/manager command as data, one dispatch row per `cmd.do`, each composed from existing engine functions (C3, E1).
import {having, partsOf} from '../contracts/index.ts'
import type {Carve, Cmd, Components, Decision, Desk, Entity, Id, Outcome, Patch, Policy, PType, Rung, SeatReq, Task, Told, World} from '../contracts/index.ts'
import {hostOf, nextNum, partyLabel, partyOf} from './ents.ts'
import type {Pty} from './ents.ts'
import {seat} from './seat.ts'
import {ladder} from './ladder.ts'
import {intake} from './match.ts'
import {heard} from './heard.ts'
import {tell, toldEvents} from './tell.ts'
import {respond} from './respond.ts'
import {options} from './options.ts'
import {eta} from './eta.ts'
import {assign} from './assign.ts'
import {spotOf, where} from './ask.ts'
import {confirm, hold, tablesOf, unhold} from './lease.ts'
import type {Leased} from './lease.ts'
import {refuse} from './seatcheck.ts'
import {add, set} from './patch.ts'
import {MIN} from './time.ts'
interface Ctx {p: Policy; w: World; now: number}
type Of<K extends Cmd['do']> = Extract<Cmd, {do: K}>
type Row<K extends Cmd['do']> = (c: Ctx, cmd: Of<K>) => Outcome
type Offer = Components['offer']
type Svc = Components['service']
const fail = (err: string): Outcome => ({ok: false, err})
const done = (patches: Patch[], events: Told[], msg: string, says?: string): Outcome => ({ok: true, patches, events, msg, tone: 'action', ...(says ? {says} : {})})
/** First failing check wins (C3: rules as rows). */
const why = (rules: [bad: boolean, err: string][]) => rules.find(([bad]) => bad)?.[1]
/** An engine Decision as an Outcome; `ev` derives the events from its patches (heard, told). */
const lift = (d: Decision, ev: (ps: Patch[]) => Told[] = () => []): Outcome => (d.ok ? {...d, events: ev(d.patches)} : d)

// ---- seat / decline: the ladder rung the host voiced, recorded as the party's offer
const rungOf = (c: Ctx, party: Id, step?: string, spot?: Id): Rung | undefined => (step ? ladder(c.p, c.w, c.now, party).find(r => r.step === step && (!spot || r.spot === spot)) : undefined)
const proposal = (now: number, spot: Id, step: string, r: Rung | undefined, status: Offer['status']): Offer =>
  ({spot, step, gives: r?.gives ?? [], lacks: r?.lacks.map(m => m.feat) ?? [], at: now, status})
/** A queued or reserved party seats as itself: component keys present on the entity become the request's ids (ui/seat.ts reqOf). */
const reqOf = (e: Pty): SeatReq => ({size: e.party.size, kind: e.party.kind, party: e.id, ...Object.fromEntries((['queue', 'reservation'] as const).filter(k => k in e).map(k => [k, e.id]))})
const claims = (id: Id) => (t: Task | null) => t?.do === 'seat' && t.party === id
/** A sim host already walking this party to a table drops the trip, so the party is narrated as seated once. */
const unclaim = (w: World, id: Id): Patch[] => having(w, 'body').filter(b => b.body.role !== 'guest' && [b.body.task, ...b.body.backlog].some(claims(id))).map(b => set(b.id, {body: {...b.body, task: null, backlog: []}}))
const slotIn = (ps: Patch[]) => ps.flatMap(p => (p.op === 'add' && p.ent.slot ? [p.ent.slot] : []))[0]
interface Aim {who?: Pty; spot?: Id; rung?: Rung; req?: SeatReq}
const aimOf = (c: Ctx, cmd: Of<'seat'>): Aim => {
  const who = partyOf(c.w, cmd.party)
  const rung = who && rungOf(c, who.id, cmd.step, cmd.spot)
  const spot = cmd.spot ?? rung?.spot ?? undefined
  const base = who ? reqOf(who) : cmd.size ? {size: cmd.size, kind: 'W' as PType} : undefined
  return {who, spot, rung, req: base && {...base, ...(spot ? {tables: partsOf(c.w, spot)} : {})}}
}
const seatErr = (c: Ctx, cmd: Of<'seat'>, a: Aim) => why([[!!cmd.party && !a.who, `No party ${cmd.party}`], [!a.req, 'A walk-in needs a size of at least 1'], [!!a.spot && !spotOf(c.p, c.w, a.spot), `No spot ${a.spot}`]])
const accepted = (c: Ctx, cmd: Of<'seat'>, a: Aim, table: Id): Patch[] => (a.who && cmd.step ? [set(a.who.id, {offer: proposal(c.now, a.spot ?? table, cmd.step, a.rung, 'accepted')})] : [])
const seated = (c: Ctx, cmd: Of<'seat'>, a: Aim, d: Decision): Outcome => {
  const s = d.ok ? slotIn(d.patches) : undefined
  return d.ok && s ? {...d, patches: [...d.patches, ...accepted(c, cmd, a, s.table), ...unclaim(c.w, s.party)], events: [{ev: 'seated', party: s.party, table: s.table, by: hostOf(c.w)}]} : lift(d)
}
const direct = (c: Ctx, cmd: Of<'seat'>): Outcome => {
  const a = aimOf(c, cmd)
  const err = seatErr(c, cmd, a)
  return err ? fail(err) : seated(c, cmd, a, seat(c.p, c.w, c.now, a.req!))
}
/** Seat now on a leased party: the lease is confirmed on its own tables (whatever spot the command names). */
const confirmed = (c: Ctx, e: Leased): Outcome => {
  const d = confirm(c.p, c.w, c.now, e)
  return d.ok ? {...d, patches: [...d.patches, ...unclaim(c.w, e.id)], events: [{ev: 'seated', party: e.id, table: e.lease.tables[0], by: hostOf(c.w)}]} : lift(d)
}
/** A leased party confirms its lease; anyone else (queue and book quick seats, walk-ins) is seated directly. */
const seatRow: Row<'seat'> = (c, cmd) => {
  const e = partyOf(c.w, cmd.party)
  return e?.lease ? confirmed(c, e as Leased) : direct(c, cmd)
}
const nameOf = (c: Ctx, spot: Id) => spotOf(c.p, c.w, spot)?.spot.label ?? spot

// ---- lease / release: the one way the stand places a party (one click); a lease settles into a seat by itself
const keep = (o?: Offer) => (o?.declined ? {declined: o.declined} : {})
const leaseErr = (c: Ctx, cmd: Of<'lease'>, who?: Pty) =>
  why([[!who, `No party ${cmd.party}`], [!!where(c.w, cmd.party), `${who?.party.label} is already led or seated`], [!spotOf(c.p, c.w, cmd.spot), `No spot ${cmd.spot}`]]) ?? refuse(c.p, tablesOf(c.w, cmd.spot), who!.party.size)
const leased = (c: Ctx, cmd: Of<'lease'>, who: Pty): Outcome => {
  const offer = {...proposal(c.now, cmd.spot, cmd.step, rungOf(c, who.id, cmd.step, cmd.spot), 'accepted'), ...keep(who.offer)}
  const ps = [...hold(c.p, c.w, c.now, who, cmd.spot, cmd.step), set(who.id, {offer}), ...unclaim(c.w, who.id)]
  return done(ps, [{ev: 'leased', party: who.id, spot: cmd.spot, by: hostOf(c.w)}], `${who.party.label} leased ${nameOf(c, cmd.spot)}`)
}
const leaseRow: Row<'lease'> = (c, cmd) => {
  const who = partyOf(c.w, cmd.party)
  const err = leaseErr(c, cmd, who)
  return err ? fail(err) : leased(c, cmd, who!)
}
/** The spot handed back joins the party's declined spots: the ladder never proposes it again. */
const handBack = (c: Ctx, e: Leased): Offer => ({...proposal(c.now, e.lease.spot, e.lease.step, undefined, 'declined'), ...e.offer, status: 'declined', declined: [...(e.offer?.declined ?? []), e.lease.spot]})
const released = (c: Ctx, e: Leased): Outcome =>
  done([...unhold(c.p, c.w, e, {offer: handBack(c, e)}), ...unclaim(c.w, e.id)], [{ev: 'released', party: e.id, spot: e.lease.spot, by: hostOf(c.w)}], `${e.party.label} released ${nameOf(c, e.lease.spot)}`)
const releaseRow: Row<'release'> = (c, cmd) => {
  const e = partyOf(c.w, cmd.party)
  return e?.lease ? released(c, e as Leased) : fail(e ? `${e.party.label} holds no lease` : `No party ${cmd.party}`)
}
const declineRow: Row<'decline'> = (c, cmd) => {
  const who = partyOf(c.w, cmd.party)
  const offer = {...proposal(c.now, cmd.spot, cmd.step, rungOf(c, cmd.party, cmd.step, cmd.spot), 'declined'), declined: [...(who?.offer?.declined ?? []), cmd.spot]}
  return who ? done([set(who.id, {offer})], [{ev: 'answered', party: who.id, spot: cmd.spot, yes: false}], `${who.party.label} declined ${nameOf(c, cmd.spot)}`) : fail(`No party ${cmd.party}`)
}

// ---- hear / tell / reply: engine decisions plus the events their patches imply
const hearRow: Row<'hear'> = (c, cmd) => lift(intake(c.p, c.w, c.now, cmd.party, [...(c.w.ents[cmd.party]?.wants?.heard ?? []), cmd.feat]), ps => heard(c.w, ps))
const tellRow: Row<'tell'> = (c, cmd) => lift(tell(c.p, c.w, c.now, cmd.table), ps => toldEvents(c.w, ps))
const replyRow: Row<'reply'> = (c, cmd) => {
  const o = options(c.p, c.w, c.now, cmd.party).find(x => x.response === cmd.response)
  const r = o && respond(c.p, c.w, c.now, cmd.party, cmd.response)
  return r ? done(r.patches, r.events, `Host: ${o.say}`, r.says) : fail(`No open request from ${cmd.party} takes ${cmd.response}`)
}

// ---- join / reserve / mark: new parties numbered by the engine (nextNum), never by the caller
const free = (w: World, n: number): number => (w.ents[`pty${n}`] ? free(w, n + 1) : n)
const fresh = (w: World, kind: PType, size: number, name: string, extra: Partial<Entity>): Entity => {
  const num = free(w, nextNum(w))
  return {id: `pty${num}`, party: {num, label: partyLabel('', kind, num), prefix: '', kind, name, size}, ...extra}
}
const sized = (size: number) => why([[!(Number.isInteger(size) && size >= 1), `Party size must be a whole number of at least 1 (got ${size})`]])
const queued = (c: Ctx, cmd: Of<'join'>): Outcome => {
  const q = eta(c.p, c.w, c.now, cmd.size)
  const e = fresh(c.w, 'W', cmd.size, cmd.name || 'walk-in', {queue: {since: c.now, quotedMin: q.waitMin, status: 'WAITING', from: null}})
  return done([add(e)], [{ev: 'quoted', party: e.id, min: q.waitMin}], `Queued a party of ${cmd.size} (quote ${q.waitMin}m)`)
}
const joinRow: Row<'join'> = (c, cmd) => { const err = sized(cmd.size); return err ? fail(err) : queued(c, cmd) }
const booking = (c: Ctx, cmd: Of<'reserve'>): Components['reservation'] => ({at: c.now + cmd.inMin * MIN, durationMin: c.p.seat.turnDefault, table: null, status: 'BOOKED', phone: cmd.phone ?? '', notes: ''})
const reserveRow: Row<'reserve'> = (c, cmd) => {
  const err = sized(cmd.size) ?? why([[!Number.isFinite(cmd.inMin), `Booking time must be a number of minutes (got ${cmd.inMin})`]])
  const name = cmd.name || 'Guest'
  return err ? fail(err) : done([add(fresh(c.w, 'R', cmd.size, name, {reservation: booking(c, cmd)}))], [], `Booked ${name} x${cmd.size} in ${cmd.inMin}m`)
}
const markRow: Row<'mark'> = (c, cmd) => {
  const e = partyOf(c.w, cmd.party)
  const r = e?.reservation
  return e && r ? done([set(e.id, {reservation: {...r, status: cmd.status}})], [], `${e.party.label} ${e.party.name}: ${cmd.status}`) : fail(`No reservation ${cmd.party}`)
}

// ---- service: mode override, carve per area, dealt tops, deal (ui/assign.ts setSvc + acts)
const svcOf = (w: World): Svc => ({override: null, carve: {}, ...w.ents.service?.service})
const svc = (w: World, change: Partial<Svc>): Patch => (w.ents.service ? set('service', {service: {...svcOf(w), ...change}}) : add({id: 'service', service: {...svcOf(w), ...change}}))
const modeRow: Row<'mode'> = (c, cmd) => {
  const label = cmd.to && c.p.service.modes[cmd.to]?.label
  return cmd.to === null ? done([svc(c.w, {override: null})], [], 'Service mode follows the schedule') : label ? done([svc(c.w, {override: cmd.to})], [], `Service mode forced to ${label}`) : fail(`No service mode ${cmd.to}`)
}
const carveRow: Row<'carve'> = (c, cmd) => {
  const a = c.p.service.areas[cmd.area]
  const ok = a?.carve.includes(cmd.to as Carve)
  return ok ? done([svc(c.w, {carve: {...svcOf(c.w).carve, [cmd.area]: cmd.to}})], [], `${a.label}: ${cmd.to} (press Deal)`) : fail(a ? `${a.label} cannot be carved ${cmd.to}` : `No area ${cmd.area}`)
}
const topRow: Row<'top'> = (c, cmd) => {
  const [t, who] = [c.w.ents[cmd.table]?.table, c.w.ents[cmd.staff]?.staff]
  const err = why([[!t, `No table ${cmd.table}`], [!who, `No staff ${cmd.staff}`]])
  return err ? fail(err) : done([set(cmd.table, {assign: {staff: cmd.staff}})], [], `${t!.label} dealt to ${who!.name}`)
}
const dealRow: Row<'deal'> = c => {
  const ps = assign(c.p, c.w, c.now)
  return done(ps, [], ps.length ? `Dealt: ${ps.length} change(s)` : 'Already dealt')
}

type StaffC = Components['staff']
const duty: Record<Of<'staff'>['to'], (s: StaffC) => Partial<StaffC>> = {duty: s => ({active: !s.active}), skip: s => ({skip: s.skip + 1})}
const staffRow: Row<'staff'> = (c, cmd) => {
  const s = c.w.ents[cmd.id]?.staff
  const edit = duty[cmd.to]
  return s && edit ? done([set(cmd.id, {staff: {...s, ...edit(s)}})], [], `${s.name}: ${cmd.to}`) : fail(s ? `Unknown staff change ${cmd.to}` : `No staff ${cmd.id}`)
}
const rows: {[K in Cmd['do']]: Row<K>} = {seat: seatRow, decline: declineRow, hear: hearRow, tell: tellRow, reply: replyRow, join: joinRow, reserve: reserveRow, mark: markRow, mode: modeRow, carve: carveRow, top: topRow, deal: dealRow, staff: staffRow, lease: leaseRow, release: releaseRow}
/** Run one host/manager command: patches to commit, events to narrate, one log line; unknown or invalid input -> {ok: false, err}. */
export const act: Desk['act'] = (p, w, now, cmd) => {
  const row = rows[cmd?.do as Cmd['do']] as Row<Cmd['do']> | undefined
  return row ? row({p, w, now}, cmd) : fail(`Unknown command ${cmd?.do}`)
}
