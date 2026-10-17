// Front-of-house desk (lane U14, E1): one row per BookCmd, composed from engine.act (join / reserve / mark mint, quote and mark parties) plus the `intake` record.
import {bookOf} from '../contracts/index.ts'
import type {BookCmd, BookPolicy, Booking, Draft, Entity, Intake, Outcome, Patch, Policy, Told, Want, World} from '../contracts/index.ts'
import {act} from './act.ts'
import {partyOf} from './ents.ts'
import type {Pty} from './ents.ts'
import {where} from './ask.ts'
import {add, del, set} from './patch.ts'
import {atDoor, intakeOf, order, wait} from './bookrank.ts'
import {avail, list} from './bookview.ts'
import {MIN} from './time.ts'
interface Ctx {p: Policy; w: World; now: number; b: BookPolicy}
type Of<K extends BookCmd['do']> = Extract<BookCmd, {do: K}>
type Row<K extends BookCmd['do']> = (c: Ctx, cmd: Of<K>) => Outcome
const fail = (err: string): Outcome => ({ok: false, err})
const done = (patches: Patch[], events: Told[], msg: string, tone: 'ok' | 'warn' | 'action' = 'action'): Outcome => ({ok: true, patches, events, msg, tone})
const why = (rules: [bad: boolean, err: string][]) => rules.find(([bad]) => bad)?.[1]
const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5)
type Asks = Pick<Draft, 'feats' | 'flags' | 'area'> & {size?: number}
/** Unknown features, flags or areas, and sizes, are refused before anything is written. */
const asksErr = (c: Ctx, d: Asks) => why([
  [d.size !== undefined && !(Number.isInteger(d.size) && d.size >= 1), `Party size must be a whole number of at least 1 (got ${d.size})`],
  ...(d.feats ?? []).map(f => [!c.p.host.feats[f], `Unknown feature ${f}`] as [boolean, string]),
  ...(d.flags ?? []).map(f => [!c.b.flags[f], `Unknown flag ${f}`] as [boolean, string]),
  [!!d.area && !c.p.service.areas[d.area], `Unknown area ${d.area}`],
])
/** Requested features (and the ones flags imply) become said wants, so the stand's ladder and match read them like any other qualifier. */
const featsOf = (c: Ctx, d: Asks) => [...new Set([...(d.feats ?? []), ...(d.flags ?? []).flatMap(f => c.b.flags[f]?.feat ?? [])])]
const wantsOf = (c: Ctx, d: Asks): Entity['wants'] => ({list: featsOf(c, d).map((feat): Want => ({feat, level: c.b.want.feats[feat]?.level ?? c.b.want.level, why: c.b.want.feats[feat]?.why ?? c.b.want.why, accord: 'all', said: true})), heard: []})
const fresh = (c: Ctx, via: Intake['via'], d: Asks & {phone?: string; notes?: string}, more: Partial<Intake> = {}): Intake =>
  ({via, flags: d.flags ?? [], feats: featsOf(c, d), area: d.area ?? null, phone: d.phone ?? '', notes: d.notes ?? '', bump: 0, bumps: [], ...more})
/** Reshape the entity an engine.act row minted (its one `add`), keep its events, say our own line. */
const minted = (o: Outcome, f: (e: Entity) => Entity, msg: string, tone?: 'ok' | 'warn' | 'action'): Outcome =>
  (o.ok ? {...o, patches: o.patches.map(x => (x.op === 'add' ? add(f(x.ent)) : x)), msg, tone: tone ?? o.tone} : o)
const strip = (e: Entity, ...ks: (keyof Entity)[]): Entity => Object.fromEntries(Object.entries(e).filter(([k]) => !ks.includes(k as keyof Entity))) as Entity

// ---- book / edit: a reservation at an exact time, checked against availability (a full slot books with a warning: the host decides)
const draftErr = (c: Ctx, d: Partial<Draft>) => asksErr(c, d) ?? why([[d.at !== undefined && !(Number.isFinite(d.at) && d.at >= c.now - c.b.slotMin * MIN), 'That time has already passed'], [d.durationMin !== undefined && !(d.durationMin > 0), 'A booking needs a positive length']])
const fits = (c: Ctx, d: Draft, skip?: string) => avail(c.p, c.w, c.now, {size: d.size, at: d.at, durationMin: d.durationMin, feats: featsOf(c, d), area: d.area ?? null, skip})
const bookRow: Row<'book'> = (c, cmd) => {
  const err = draftErr(c, cmd) ?? why([[cmd.at === undefined, 'A booking needs a time']])
  const a = err ? undefined : fits(c, cmd)
  const o = err ? fail(err) : act(c.p, c.w, c.now, {do: 'reserve', size: cmd.size, name: cmd.name, inMin: (cmd.at - c.now) / MIN, phone: cmd.phone})
  const shape = (e: Entity): Entity => ({...e, reservation: {...e.reservation!, at: cmd.at, durationMin: cmd.durationMin ?? e.reservation!.durationMin, notes: cmd.notes ?? ''}, intake: fresh(c, 'book', cmd), wants: wantsOf(c, cmd)})
  return minted(o, shape, `Booked ${cmd.name || 'Guest'} x${cmd.size} at ${hhmm(cmd.at)}${a?.ok ? '' : ` (${a?.why}: booked anyway)`}`, a?.ok ? 'action' : 'warn')
}
const editErr = (c: Ctx, cmd: Of<'edit'>, e?: Pty) => why([[!e, `No party ${cmd.party}`], [!!e?.intake?.gone, `${e?.party.label} is no longer on the books`], [!!e && !!where(c.w, e.id), `${e?.party.label} is already led or seated`]]) ?? draftErr(c, cmd)
const edited = (c: Ctx, cmd: Of<'edit'>, e: Pty): Patch => {
  const i = intakeOf(e)
  const d = {flags: cmd.flags ?? i.flags, feats: cmd.feats ?? i.feats, area: cmd.area === undefined ? i.area : cmd.area}
  const r = e.reservation && {reservation: {...e.reservation, at: cmd.at ?? e.reservation.at, durationMin: cmd.durationMin ?? e.reservation.durationMin, phone: cmd.phone ?? e.reservation.phone, notes: cmd.notes ?? e.reservation.notes}}
  return set(e.id, {party: {...e.party, name: cmd.name ?? e.party.name, size: cmd.size ?? e.party.size}, ...r, intake: {...i, ...d, feats: featsOf(c, d), phone: cmd.phone ?? i.phone, notes: cmd.notes ?? i.notes, ...(cmd.eta !== undefined ? {eta: cmd.eta} : {})}, wants: {...wantsOf(c, d)!, heard: e.wants?.heard ?? []}})
}
const editRow: Row<'edit'> = (c, cmd) => {
  const e = partyOf(c.w, cmd.party)
  const err = editErr(c, cmd, e)
  const a = !err && e!.reservation ? fits(c, {size: cmd.size ?? e!.party.size, name: '', at: cmd.at ?? e!.reservation.at, durationMin: cmd.durationMin ?? e!.reservation.durationMin, feats: cmd.feats ?? intakeOf(e!).feats, area: cmd.area === undefined ? intakeOf(e!).area : cmd.area}, e!.id) : undefined
  return err ? fail(err) : done([edited(c, cmd, e!)], [], `${e!.party.label} ${cmd.name ?? e!.party.name} updated${a && !a.ok ? ` (${a.why})` : ''}`, a && !a.ok ? 'warn' : 'action')
}

// ---- call / walk: minted and quoted by engine.act join; a call-ahead waits off the door list until it checks in
const callRow: Row<'call'> = (c, cmd) => {
  const err = asksErr(c, cmd) ?? why([[!(Number.isFinite(cmd.etaMin) && cmd.etaMin >= 0), `ETA must be minutes from now (got ${cmd.etaMin})`]])
  const o = err ? fail(err) : act(c.p, c.w, c.now, {do: 'join', size: cmd.size, name: cmd.name || 'call-ahead'})
  const eta = c.now + cmd.etaMin * MIN
  return minted(o, e => ({...strip(e, 'queue'), intake: fresh(c, 'call', cmd, {eta, quote: e.queue?.quotedMin}), wants: wantsOf(c, cmd)}), `Call-ahead ${cmd.name || 'call-ahead'} x${cmd.size} due ${hhmm(eta)}`)
}
const walkRow: Row<'walk'> = (c, cmd) => {
  const err = asksErr(c, cmd)
  const o = err ? fail(err) : act(c.p, c.w, c.now, {do: 'join', size: cmd.size, name: cmd.name || 'walk-in'})
  return minted(o, e => ({...e, intake: fresh(c, 'walk', cmd), wants: wantsOf(c, cmd)}), `Wait list: ${cmd.name || 'walk-in'} x${cmd.size}`)
}

// ---- arrive / noshow / leave: check in, close out, or take a party off the books (the record stays: `intake.gone`, `intake.was`)
const live = (c: Ctx, id: string, e?: Pty) => why([[!e, `No party ${id}`], [!!e?.intake?.gone, `${e?.party.label} is no longer on the books`], [!!e && !!where(c.w, e.id), `${e?.party.label} is already led or seated`]])
const ARRIVE: [(e: Pty) => boolean, (c: Ctx, e: Pty) => Outcome][] = [
  [e => atDoor(e), (_c, e) => fail(`${e.party.label} is already checked in`)],
  [e => e.reservation?.status === 'BOOKED', (c, e) => ((o = act(c.p, c.w, c.now, {do: 'mark', party: e.id, status: 'ARRIVED'})) => (o.ok ? {...o, patches: [...o.patches.map(x => (x.op === 'set' ? set(e.id, {...x.parts, intake: {...intakeOf(e), here: c.now}}) : x))], events: [{ev: 'arrived', party: e.id}]} : o))()],
  [e => e.intake?.via === 'call', (c, e) => done([set(e.id, {queue: {since: e.intake!.eta!, quotedMin: e.intake!.quote ?? 0, status: 'WAITING', from: null}, intake: {...intakeOf(e), here: c.now}})], [{ev: 'arrived', party: e.id}], `${e.party.label} ${e.party.name} checked in`)],
  [() => true, (_c, e) => fail(`${e.party.label} has nothing to check in`)],
]
const arriveRow: Row<'arrive'> = (c, cmd) => { const e = partyOf(c.w, cmd.party); const err = live(c, cmd.party, e); return err ? fail(err) : ARRIVE.find(([t]) => t(e!))![1](c, e!) }
const gone = (c: Ctx, e: Pty, why: NonNullable<Intake['gone']>['why'], note = ''): Patch[] => [del(e.id), add({...strip(e, 'queue', 'reservation', 'body'), intake: {...intakeOf(e), gone: {at: c.now, why, note}, ...(e.reservation ? {was: e.reservation} : {})}})]
const NOSHOW: [(e: Pty) => boolean, (c: Ctx, e: Pty) => Outcome][] = [
  [e => !!e.reservation && !atDoor(e), (c, e) => act(c.p, c.w, c.now, {do: 'mark', party: e.id, status: 'NO_SHOW'})],
  [e => e.intake?.via === 'call' && !e.queue, (c, e) => done(gone(c, e, 'noshow'), [], `${e.party.label} ${e.party.name}: no-show`)],
  [() => true, (_c, e) => fail(`${e.party.label} is here: remove it instead`)],
]
const noshowRow: Row<'noshow'> = (c, cmd) => { const e = partyOf(c.w, cmd.party); const err = live(c, cmd.party, e); return err ? fail(err) : NOSHOW.find(([t]) => t(e!))![1](c, e!) }
const SAY: Record<Of<'leave'>['why'], string> = {cancel: 'cancelled', left: 'left the list', removed: 'removed from the list'}
const leaveRow: Row<'leave'> = (c, cmd) => {
  const e = partyOf(c.w, cmd.party)
  const err = live(c, cmd.party, e) ?? why([[!SAY[cmd.why], `Unknown reason ${cmd.why}`]])
  const ev: Told[] = cmd.why === 'cancel' || !e || !atDoor(e) ? [] : [{ev: 'left', party: e.id}]
  return err ? fail(err) : done(gone(c, e!, cmd.why, cmd.note), ev, `${e!.party.label} ${e!.party.name} ${SAY[cmd.why]}${cmd.note ? `: ${cmd.note}` : ''}`)
}

// ---- bump / text: move in the priority order (always with a reason), "your table is ready"
const TARGET: Record<Of<'bump'>['to'], (i: number) => [at: number, by: number]> = {up: i => [i - 1, 1], down: i => [i + 1, -1], top: () => [0, 1]}
const bumpRow: Row<'bump'> = (c, cmd) => {
  const rows = order(c.p, c.w, c.now)
  const i = rows.findIndex(r => r.party === cmd.party)
  const [at, by] = TARGET[cmd.to]?.(i) ?? [-1, 0]
  const err = why([[i < 0, `${cmd.party} is not waiting`], [!cmd.why?.trim(), 'A bump needs a reason'], [!TARGET[cmd.to], `Unknown bump ${cmd.to}`], [!rows[at] || at === i, `${rows[i]?.label} is already ${by > 0 ? 'first' : 'last'}`]])
  const e = partyOf(c.w, cmd.party)!
  const pts = err ? 0 : rows[at]!.pts - rows[i]!.pts + by
  const x = intakeOf(e)
  return err ? fail(err) : done([set(e.id, {intake: {...x, bump: x.bump + pts, bumps: [...x.bumps, {at: c.now, pts, why: cmd.why}]}})], [], `${e.party.label} ${e.party.name} bumped ${cmd.to}: ${c.b.bumpWhys[cmd.why] ?? cmd.why}`)
}
const textRow: Row<'text'> = (c, cmd) => {
  const r = order(c.p, c.w, c.now).find(x => x.party === cmd.party)
  const e = partyOf(c.w, cmd.party)
  return r && e ? done([set(e.id, {intake: {...intakeOf(e), texted: c.now}})], [], `Texted ${e.party.name || e.party.label}: your table is ready`) : fail(`${cmd.party} is not waiting`)
}
// ---- note: free text on a booked, called-ahead or waiting party (intake.notes; a reservation keeps its own copy in step)
const noteRow: Row<'note'> = (c, cmd) => {
  const e = partyOf(c.w, cmd.party)
  const err = live(c, cmd.party, e) ?? why([[typeof cmd.notes !== 'string', 'Notes must be text']])
  const r = e?.reservation && {reservation: {...e.reservation, notes: cmd.notes}}
  return err ? fail(err) : done([set(e!.id, {intake: {...intakeOf(e!), notes: cmd.notes}, ...r})], [], `${e!.party.label} ${e!.party.name}: ${cmd.notes.trim() ? `note "${cmd.notes.trim()}"` : 'note cleared'}`)
}
const rows: {[K in BookCmd['do']]: Row<K>} = {book: bookRow, edit: editRow, call: callRow, walk: walkRow, arrive: arriveRow, noshow: noshowRow, leave: leaveRow, bump: bumpRow, text: textRow, note: noteRow}
export const bookAct: Booking['act'] = (p, w, now, cmd) => {
  const row = rows[cmd?.do as BookCmd['do']] as Row<BookCmd['do']> | undefined
  return row ? row({p, w, now, b: bookOf(p)}, cmd) : fail(`Unknown booking command ${cmd?.do}`)
}
/** The booking desk service: writes (`act`) and reads (`avail`, `list`, `wait`). */
export const booking: Booking = {act: bookAct, avail, list, wait}
