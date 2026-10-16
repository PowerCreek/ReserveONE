// Dashboard read model (wave 5): the service at a glance, derived from world + policy only (E1, E2). Stages first, one fold in `board`.
import {having, partsOf} from '../contracts/index.ts'
import type {Activity, Bar, Board, BoardOpt, Desk, Ent, Entity, Gantt, Id, Kpi, Lane, LedgerChip, Move, Policy, Pref, PrefMark, PrefRow, SectionRow, ServerRow, SpotState, TStatus, Tick, World} from '../contracts/index.ts'
import {expand, spots} from './spots.ts'
import {turnover} from './turnover.ts'
import {bus} from './bus.ts'
import {eta} from './eta.ts'
import {rotate} from './rotate.ts'
import {sectionStats} from './section.ts'
import {outlook} from './plan.ts'
import {line} from './queue.ts'
import {slotOf} from './ents.ts'
import {selfSeated} from './seatcheck.ts'
import {MIN, midnight} from './time.ts'
import {stand} from './desk.ts'
import {insights} from './insight.ts'
import {readout} from './readout.ts'
import {bogged} from './prefs.ts'
type Slot = Ent<'slot'>
type Res = Ent<'party' | 'reservation'>
type Opt = Required<BoardOpt>
const DEF: Opt = {ivMin: 15, pastMin: 60, aheadMin: 180}
interface Ctx {p: Policy; w: World; now: number; o: Opt; iv: number; d0: number; d1: number; slots: Slot[]; res: Res[]}
const ctx = (p: Policy, w: World, now: number, opt: BoardOpt = {}): Ctx => {
  const o = {...DEF, ...opt}
  return {p, w, now, o, iv: o.ivMin * MIN, d0: midnight(now), d1: midnight(midnight(now) + 36 * 60 * MIN), slots: having(w, 'slot'), res: having(w, 'party', 'reservation')}
}

// ---- shared reads
const size = (w: World, id: Id | null) => w.ents[id ?? '']?.party?.size ?? 0
const who = (w: World, id: Id | null) => w.ents[id ?? '']?.party?.name || w.ents[id ?? '']?.party?.label || ''
const covers = (c: Ctx, ss: Slot[]) => ss.reduce((n, s) => n + size(c.w, s.slot.party), 0)
const sofar = (c: Ctx) => (at?: number) => at !== undefined && at >= c.d0 && at <= c.now // happened today, up to now
const active = (c: Ctx) => c.slots.filter(s => s.slot.status === 'ACTIVE')
const LIVE: Record<Res['reservation']['status'], boolean> = {BOOKED: true, ARRIVED: true, SEATED: false, NO_SHOW: false, QUEUED: false}
const late = (c: Ctx) => (r: Res) => r.reservation.status === 'BOOKED' && c.now - r.reservation.at > c.p.seat.lateGraceMin * MIN
const nat = (a: string, b: string) => a.localeCompare(b, undefined, {numeric: true})
/** Spot label of a table: a link group reads "T9+T10". */
const labeler = (w: World) => {
  const ss = spots(w)
  return (t: Id) => ss.find(s => s.spot.tables.includes(t))?.spot.label ?? w.ents[t]?.table?.label ?? t
}

// ---- ledger: every host-seated spot in one state
const STATE: Record<TStatus, SpotState> = {leased: 'leased', blocked_private: 'blocked', occupied: 'seated', lapsed: 'lapsed', available: 'open'}
const STATES: SpotState[] = ['open', 'reserved', 'leased', 'seated', 'lapsed', 'blocked']
/** The next live reservation holding any of these tables later today. */
const heldBy = (c: Ctx, ts: Id[]) => c.res
  .filter(r => LIVE[r.reservation.status] && !!r.reservation.table && partsOf(c.w, r.reservation.table).some(t => ts.includes(t)) && r.reservation.at < c.d1 && r.reservation.at + r.reservation.durationMin * MIN > c.now)
  .sort((a, b) => a.reservation.at - b.reservation.at)[0]
const EXTRA: Partial<Record<SpotState, (n: number, r?: Res) => Partial<LedgerChip>>> = {seated: n => ({covers: n}), reserved: (_, r) => ({at: r!.reservation.at})}
const chip = (c: Ctx) => (s: Ent<'spot'>): [SpotState, LedgerChip] => {
  const r = heldBy(c, s.spot.tables)
  const st = STATE[s.spot.status] === 'open' && r ? 'reserved' : STATE[s.spot.status]
  const n = covers(c, active(c).filter(x => s.spot.tables.includes(x.slot.table)))
  return [st, {spot: s.id, label: s.spot.label, ...EXTRA[st]?.(n, r)}]
}
const ledger = (c: Ctx): Board['ledger'] => {
  const rows = spots(c.w).filter(s => !s.spot.tables.some(t => selfSeated(c.p, c.w.ents[t] ?? {}))).map(chip(c)).sort((a, b) => nat(a[1].label, b[1].label))
  return Object.fromEntries(STATES.map(k => [k, rows.filter(r => r[0] === k).map(r => r[1])])) as Board['ledger']
}

// ---- activity: seat (+) and clear (-) today, per interval, newest first
type At = Move & {at: number}
const SIGN: Record<Move['kind'], number> = {in: 1, out: -1}
const key = (c: Ctx, at: number) => Math.floor((at - c.d0) / c.iv)
const movesOf = (c: Ctx, name: (t: Id) => string) => (s: Slot): At[] => ([['in', s.slot.seatedAt], ['out', s.slot.endedAt]] as const)
  .filter(([, at]) => sofar(c)(at)).map(([kind, at]) => ({at: at!, table: s.slot.table, label: name(s.slot.table), kind, covers: size(c.w, s.slot.party)}))
const interval = (c: Ctx, k: number, xs: At[]): Activity =>
  ({start: c.d0 + k * c.iv, end: c.d0 + (k + 1) * c.iv, net: xs.reduce((n, x) => n + SIGN[x.kind] * x.covers, 0), moves: xs.map(({at: _, ...m}) => m)})
const activity = (c: Ctx): Activity[] => {
  const ms = c.slots.flatMap(movesOf(c, labeler(c.w))).sort((a, b) => a.at - b.at)
  return [...new Set(ms.map(m => key(c, m.at)))].sort((a, b) => b - a).map(k => interval(c, k, ms.filter(m => key(c, m.at) === k)))
}

// ---- gantt: per table bars around now
type Pin = [table: Id, bar: Bar]
const bar = (kind: Bar['kind'], from: number, to: number, party: Id | null, label: string, size: number, x: Partial<Bar> = {}): Bar => ({kind, from, to, party, label, size, ...x})
const SLOT: Record<Slot['slot']['status'], {kind: Bar['kind']; to: (s: Slot['slot']) => number; on: (w: World, ids: Id[]) => Id[]}> = {
  ACTIVE: {kind: 'slot', to: s => s.turnAt, on: expand},
  LAPSED: {kind: 'slot', to: s => s.turnAt, on: expand},
  COMPLETED: {kind: 'done', to: s => s.endedAt ?? s.turnAt, on: (_w, ids) => ids},
}
const slotPins = (c: Ctx, s: Slot): Pin[] => {
  const k = SLOT[s.slot.status]
  const b = bar(k.kind, s.slot.seatedAt, k.to(s.slot), s.slot.party, who(c.w, s.slot.party), size(c.w, s.slot.party), k.kind === 'slot' ? {over: c.now > s.slot.turnAt} : {})
  return k.on(c.w, [s.slot.table]).map(t => [t, b])
}
const resBar = (c: Ctx, r: Res, kind: Bar['kind']) => bar(kind, r.reservation.at, r.reservation.at + r.reservation.durationMin * MIN, r.id, who(c.w, r.id), r.party.size, {late: late(c)(r)})
const resPins = (c: Ctx): Pin[] => c.res.filter(r => LIVE[r.reservation.status] && !!r.reservation.table).flatMap(r => partsOf(c.w, r.reservation.table!).map((t): Pin => [t, resBar(c, r, 'res')]))
const eventPins = (c: Ctx): Pin[] => having(c.w, 'event').filter(e => !e.event.reclaimed)
  .flatMap(e => e.event.tables.map((t): Pin => [t, bar('event', e.event.start - c.p.alerts.prepMin * MIN, e.event.end, null, e.event.name, 0)]))
const planPins = (c: Ctx, plan: ReturnType<typeof outlook>): Pin[] => plan.filter(x => x.spot).flatMap(x => x.tables.map((t): Pin => [t, resBar(c, c.w.ents[x.party] as Res, 'plan')]))
const level = (w: World, f: Id) => w.ents[f]?.floor?.level ?? 0
const order = (w: World) => (a: Lane, b: Lane) => level(w, a.floor) - level(w, b.floor) || nat(a.floor, b.floor) || nat(a.label, b.label)
const lane = (pins: Pin[]) => (t: Ent<'table'>): Lane =>
  ({table: t.id, label: t.table.label, floor: (t as Entity).pos?.floor ?? '', capacity: t.table.capacity, bars: pins.filter(x => x[0] === t.id).map(x => x[1]).sort((a, b) => a.from - b.from)})
/** Header buckets across the window: ACTIVE seatings due to turn in each (v1 deluge / drought). */
const ticks = (c: Ctx, from: number, to: number): Tick[] => {
  const k0 = key(c, from)
  return Array.from({length: Math.ceil((to - c.d0) / c.iv) - k0}, (_, i) => c.d0 + (k0 + i) * c.iv)
    .map(start => ({start, end: start + c.iv, turns: active(c).filter(s => s.slot.turnAt >= start && s.slot.turnAt < start + c.iv).length}))
}
const gantt = (c: Ctx): Gantt => {
  const [from, to, plan] = [c.now - c.o.pastMin * MIN, c.now + c.o.aheadMin * MIN, outlook(c.p, c.w, c.now)]
  const pins = [...c.slots.flatMap(s => slotPins(c, s)), ...resPins(c), ...eventPins(c), ...planPins(c, plan)].filter(([, b]) => b.from < to && b.to > from)
  const lanes = having(c.w, 'table').filter(t => pins.some(x => x[0] === t.id)).map(lane(pins)).sort(order(c.w))
  return {from, to, now: c.now, lanes, ticks: ticks(c, from, to), unplaced: plan.filter(x => !x.spot).map(x => resBar(c, c.w.ents[x.party] as Res, 'res'))}
}

// ---- servers: rotation order, then units off duty (rank 0)
const section = (c: Ctx) => (s: Ent<'section'>): SectionRow => {
  const st = sectionStats(c.p, c.w, c.now, s)
  return {section: s.id, name: s.section.name, occ: st.occ, turns: st.turns, need: st.need, under: st.under}
}
/** Every pref mark recorded on a seating, with when. */
type Mk = {m: PrefMark; at: number}
const marksOf = (c: Ctx): Mk[] => c.slots.flatMap(s => (s.slot.prefs ?? []).map(m => ({m, at: s.slot.seatedAt})))
/** A pref's latest outcome since it was set, else 'set'. */
const prefRow = (ms: Mk[], id: Id) => (x: Pref): PrefRow => {
  const hit = ms.filter(k => k.m.staff === id && k.m.pref === x.id && k.at >= x.at).sort((a, b) => b.at - a.at)[0]
  return {pref: x, state: hit?.m.state ?? 'set', why: hit?.m.why ?? '', at: hit?.at ?? null}
}
interface Srv {rk: Id[]; ms: Mk[]; bog: Record<Id, boolean>}
const server = (c: Ctx, v: Srv) => (s: Ent<'staff'>): ServerRow => {
  const mine = active(c).filter(x => c.w.ents[x.slot.table]?.table?.waiter === s.id)
  return {staff: s.id, name: s.staff.name, rank: v.rk.indexOf(s.id) + 1, tally: s.staff.tally, seated: covers(c, mine), tables: new Set(mine.map(x => x.slot.table)).size,
    weight: s.staff.weight ?? 1, active: s.staff.active, sections: having(c.w, 'section').filter(x => s.staff.sections.includes(x.id)).map(section(c)), prefs: (s.staff.prefs ?? []).map(prefRow(v.ms, s.id)), bogged: !!v.bog[s.id]}
}
const servers = (c: Ctx): ServerRow[] => {
  const rk = rotate(c.p, c.w, c.now).map(r => r.staff)
  const pos = (id: Id) => (rk.includes(id) ? rk.indexOf(id) : rk.length)
  return having(c.w, 'staff').sort((a, b) => pos(a.id) - pos(b.id)).map(server(c, {rk, ms: marksOf(c), bog: bogged(c.p, c.w, c.now)}))
}

// ---- kpis: [id, label, measure, value, hint]; tone from the measure against one threshold table
type Raw = [id: string, label: string, n: number, value: string, hint: string]
type Parts = Omit<Board, 'kpis' | 'insights' | 'next'>
/** Tone from policy.board.limits by kpi id (>= crit, else >= warn, else ok); a kpi without a row is info. */
const tone = (c: Ctx, id: string, n: number): Kpi['tone'] => {
  const l = c.p.board.limits[id]
  return l ? ((['crit', 'warn'] as const).find(k => n >= l[k]) ?? 'ok') : 'info'
}
const mins = (x: number, pre = '') => (Number.isFinite(x) ? `${pre}${Math.round(x)}m` : '-')
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const floor = (c: Ctx) => having(c.w, 'table').filter(t => !selfSeated(c.p, t) && t.table.status !== 'blocked_private')
const waiting = (c: Ctx) => line(c.p, c.w)
const since = (e: Entity) => e.queue?.since ?? e.reservation?.at ?? 0
const longest = (c: Ctx) => Math.max(0, ...waiting(c).map(e => (c.now - since(e)) / MIN))
/** |seated - quoted| minutes for every list party seated today. */
const misses = (c: Ctx) => having(c.w, 'party', 'queue').map(e => [e, slotOf(c.w, e.id)] as const).filter(([, s]) => sofar(c)(s?.slot.seatedAt))
  .map(([e, s]) => Math.abs((s!.slot.seatedAt - e.queue.since) / MIN - e.queue.quotedMin))
const seated = (c: Ctx): Raw => {
  const ts = floor(c)
  const seats = ts.reduce((n, t) => n + t.table.capacity, 0)
  const n = covers(c, active(c).filter(s => ts.some(t => t.id === s.slot.table)))
  return ['seated', 'Seated', n / seats, `${n}/${seats}`, 'covers / seats']
}
const occ = (c: Ctx): Raw => {
  const ts = floor(c)
  const used = ts.filter(t => t.table.status !== 'available').length
  return ['occ', 'Occupancy', used / ts.length, `${Math.round((used / ts.length || 0) * 100)}%`, `${used}/${ts.length} tables in use`]
}
const turnsDone = (c: Ctx) => c.slots.filter(s => s.slot.status === 'COMPLETED' && sofar(c)(s.slot.endedAt)).map(s => (s.slot.endedAt! - s.slot.seatedAt) / MIN)
const turningNext = (c: Ctx) => active(c).filter(s => s.slot.turnAt < c.now + c.iv)
const arrivingNext = (c: Ctx) => c.res.filter(r => r.reservation.status === 'BOOKED' && r.reservation.at >= c.now && r.reservation.at < c.now + c.iv)
const today = (c: Ctx) => c.slots.filter(s => sofar(c)(s.slot.seatedAt))
const noShows = (c: Ctx) => c.res.filter(r => r.reservation.status === 'NO_SHOW' && r.reservation.at >= c.d0 && r.reservation.at < c.d1)
const RULES: ((c: Ctx, b: Parts) => Raw)[] = [
  seated, occ,
  c => ['waiting', 'Waiting', waiting(c).length, `${waiting(c).length}`, `${waiting(c).reduce((n, e) => n + e.party.size, 0)} covers`],
  c => ['wait', 'Longest wait', longest(c), mins(Math.floor(longest(c))), 'at the door'],
  c => ['quote', 'Quote ±', mean(misses(c)), mins(mean(misses(c)), '±'), `${misses(c).length} seated from the list`],
  c => ['turn', 'Avg turn', mean(turnsDone(c)) / c.p.seat.turnDefault, mins(mean(turnsDone(c))), `target ${c.p.seat.turnDefault}m`],
  c => ['turning', `Turning ${c.o.ivMin}m`, turningNext(c).length, `${turningNext(c).length}`, `${covers(c, turningNext(c))} covers`],
  c => ['arriving', `Arriving ${c.o.ivMin}m`, arrivingNext(c).length, `${arrivingNext(c).length}`, `${arrivingNext(c).reduce((n, r) => n + r.party.size, 0)} covers`],
  (_c, b) => ['bus', 'To bus', b.bus.length, `${b.bus.length}`, 'lapsed tables to clear'],
  c => ['late', 'Late', c.res.filter(late(c)).length, `${c.res.filter(late(c)).length}`, `reservations past ${c.p.seat.lateGraceMin}m grace`],
  c => ['noshow', 'No-shows', noShows(c).length, `${noShows(c).length}`, 'today'],
  c => ['today', 'Covers today', covers(c, today(c)), `${covers(c, today(c))}`, `${today(c).length} parties`],
]
const kpis = (c: Ctx, b: Parts): Kpi[] => RULES.map(f => f(c, b)).map(([id, label, n, value, hint]) => ({id, label, value, tone: tone(c, id, n), hint}))

/** The dashboard: every panel's numbers in one read (`opt`: interval and gantt window, BoardOpt defaults). */
export const board: Desk['board'] = (p, w, now, opt) => {
  const c = ctx(p, w, now, opt)
  const b: Parts = {gantt: gantt(c), turnover: turnover(p, w, now, c.o.ivMin), ledger: ledger(c), activity: activity(c), servers: servers(c), bus: bus(p, w, now), quotes: p.look.sizes.map(n => eta(p, w, now, n))}
  const [view, name] = [stand(p, w, now), labeler(w)]
  return {kpis: kpis(c, b), ...b, insights: insights({p, w, now, ticks: b.gantt.ticks, view, servers: b.servers, name}), next: readout({p, w, view, bus: b.bus, name})}
}
