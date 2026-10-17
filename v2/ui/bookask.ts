// The door to the booking desk (contracts/booking.ts): reads with policy/world/now bound, writes committed, narrated and logged like `run` (ui/act.ts).
import type {App, AvailQ, BookCmd, Booking, Cmd, Components, Id, Outcome, Placed, World} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {policyOf} from './ask.ts'
import {narrate} from './act.ts'
import {note} from './log.ts'
import {ask} from './ask.ts'
import {ref} from './links.ts'
import {memo} from './memo.ts'
import {esc} from './render.ts'
import {uiOf} from './state.ts'
import {field, ghost} from './tone.ts'
type Rest<F> = F extends (p: never, w: never, n: never, ...a: infer A) => unknown ? A : never
const none: Outcome = {ok: false, err: 'The booking desk is not available'}
/** Undefined when no booking desk is provided (views degrade). */
export const bk = <K extends keyof Booking>(app: App, k: K, ...a: Rest<Booking[K]>): ReturnType<Booking[K]> | undefined => {
  const {world, now} = app.store.state
  return (app.services.booking?.[k] as ((...x: unknown[]) => ReturnType<Booking[K]>) | undefined)?.(policyOf(app), world, now, ...a)
}
const outcomes: Record<'true' | 'false', (app: App, o: Outcome) => unknown> = {
  true: (app, o) => o.ok && (commit(app, o.patches), (!o.events.length || o.tone === 'warn') && note(app, o.tone, o.msg), narrate(app, o.events)),
  false: (app, o) => o.ok || note(app, 'warn', o.err),
}
/** Run one front-of-house command; every panel repaints after. */
export const book = (app: App, cmd: BookCmd): Outcome => {
  const o = bk(app, 'act', cmd) ?? none
  outcomes[String(o.ok) as 'true'](app, o)
  uiOf(app).rev++
  return o
}
/** Local wall clock for the sim time. */
export const hm = (t: number) => new Date(t).toTimeString().slice(0, 5)
export const ymd = (t: number) => ((d = new Date(t)) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)()
export const at = (date: string, time: string) => new Date(`${date}T${time || '00:00'}`).getTime()

// ---- notes (free text on a booking, call-ahead or waiting party): a labelled textarea saved on change (blur) or Save, a one-line preview, and a repaint guard while typing
/** The note a party carries: its intake's, else its reservation's. */
export const noteOf = (app: App, id: string) => ((e = app.store.state.world.ents[id]) => e?.intake?.notes ?? e?.reservation?.notes ?? '')()
export const noteLine = (text: string) => (text.trim() ? `<p data-noteline class="w-full truncate text-xs italic text-slate-600 dark:text-slate-300" title="${esc(text)}">Note: ${esc(text)}</p>` : '')
export const noteBox = (id: string, text: string) =>
  `<div data-notebox="${esc(id)}" class="mt-1 grid gap-1"><label class="grid gap-0.5 text-xs"><span class="text-slate-600 dark:text-slate-300">Notes</span><textarea name="note" rows="2" data-on="change:note-save" placeholder="Allergies, occasion, prefers booth, running late (said 15 min)..." class="${field} w-full">${esc(text)}</textarea></label><div><button type="button" data-act="note-save" class="${ghost}">Save note</button></div></div>`
/** True while a notes textarea has focus: panels that hold one reuse their last paint, so a half-typed note is never morphed. */
const typing = () => !!(globalThis.document?.activeElement as Element | null)?.closest?.('[data-notebox]')
export const keep = (draw: (app: App) => string) => ((last = '') => (app: App) => (typing() ? last : (last = draw(app))))()
/** The `note-save` act: change (blur) on the textarea or the Save button; commits through the booking desk, then repaints once focus has moved on. */
export const saveNote = (app: App, ev: Event) => {
  const box = (ev.target as Element).closest('[data-notebox]')
  const id = box?.getAttribute('data-notebox') ?? ''
  const text = box?.querySelector('textarea')?.value ?? ''
  const same = text === noteOf(app, id)
  same || book(app, {do: 'note', party: id, notes: text})
  setTimeout(() => uiOf(app).rev++)
}
/** Selecting a party (queue row or stand card) points the stand at it and sets the fast-seat stepper to its size, so the host never counts. */
export const pick = (app: App, id: string) => ((n = app.store.state.world.ents[id]?.party?.size, u = uiOf(app)) => n && (u.size = Math.min(12, Math.max(1, n)), u.stand && (u.stand.party = id)))()

// ---- the planned table: what the plan will give a booking, read from booking.avail (the planner's own placement), shown wherever the host picks size, time or area
const planOf = (app: App, q: AvailQ) => (bk(app, 'avail', q) as ({plan?: Placed | null} | undefined))?.plan
const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5)
/** The planned table as short text (alternatives and chips): `T5`, `T17 + T18`, or `-`. */
export const planName = (app: App, q: AvailQ) => ((x = planOf(app, q)) => (x ? x.label.replaceAll('+', ' + ') : 'no table'))()
/** One line under a picker: the planned table (with pushed-together tables and when it is free), or that none will be free in time. `lead` words it for bookings, call-aheads and walk-ins. */
export const planLine = (app: App, q: AvailQ, lead = 'The plan will seat this booking at') => {
  const x = planOf(app, q)
  const where = x ? `${lead} <b data-tid="${esc(x.tables[0])}">${esc(x.label.replaceAll('+', ' + '))}</b>${x.merge ? ' (tables pushed together)' : ''}, free by ${hhmm(x.free)} for ${q.size}` : 'No table will be free in time for this party'
  return `<p data-plan="${x ? esc(x.label) : ''}" class="text-sm ${x ? '' : 'text-rose-700 dark:text-rose-300'}">${where}</p>`
}

// ---- where a fast seat goes: the real `act` run without committing, read by one function for the preview (buttons, door rows, stand cards) and for the confirmation, so they cannot differ
/** `where` = `T12 (Main, Ana)`; `tables` = the ones taken (several = pushed together); `text` = the confirmation line. */
export interface Dest {ok: boolean; who: string; where: string; tables: Id[]; text: string; err: string; held?: import('../contracts/index.ts').HeldRef}
type Part = 'table' | 'party' | 'staff'
const parts = (o: Extract<Outcome, {ok: true}>, k: Part) => o.patches.flatMap(p => ((x: Partial<Components> | undefined) => (x?.[k] ? [{id: p.op === 'set' ? p.id : p.op === 'add' ? p.ent.id : '', v: x[k] as never}] : []))(p.op === 'set' ? p.parts : p.op === 'add' ? p.ent : undefined))
const seatedAt = (o: Extract<Outcome, {ok: true}>) => parts(o, 'table').filter(t => (t.v as Components['table']).status === 'occupied')
const WHO = (o: Extract<Outcome, {ok: true}>) => ((x = parts(o, 'party')[0]?.v as Components['party'] | undefined) => (x ? `${x.label} x${x.size}` : 'Party'))()
const nameIn = (o: Extract<Outcome, {ok: true}>) => ((x = parts(o, 'staff')[0]?.v as Components['staff'] | undefined) => x?.crew?.join(' + ') ?? x?.name ?? '')()
const spotAt = (w: World, o: Extract<Outcome, {ok: true}>) => ((ts = seatedAt(o)) => {
  const names = ts.map(t => (t.v as Components['table']).label).join(' + ')
  const sec = w.ents[(ts[0]?.v as Components['table'] | undefined)?.section ?? '']?.section?.name
  return `${names}${ts.length > 1 ? ', tables pushed together' : ''}${sec || nameIn(o) ? ` (${[sec, nameIn(o)].filter(Boolean).join(', ')})` : ''}`
})()
export const describe = (w: World, o: Outcome): Dest => o.ok
  ? ((where = spotAt(w, o), who = WHO(o)) => ({ok: true, who, where, tables: seatedAt(o).map(t => t.id), text: `${who} -> ${where}`, err: ''}))()
  : {ok: false, who: '', where: '', tables: [], text: '', err: o.err, ...(o.held ? {held: o.held} : {})}
/** The dry run of `cmd`: engine.act on the plain world, remembered per world signature and minute. */
export const dest = (app: App, cmd: Cmd): Dest => describe(app.store.state.world, memo(app, policyOf(app), 'dry', [cmd], () => ask(app, 'act', cmd)) ?? {ok: false, err: 'The engine is not available'})
export interface Landed {text: string; tables: Id[]}
declare module '../contracts/kernel.ts' {
  interface UiState {landed?: Landed | null}
}
/** After a fast seat: where the party went (status region, kept until dismissed or replaced) with a button to that table's card. */
export const landed = (app: App) => ((l = uiOf(app).landed) => `<div role="status" aria-live="polite" data-landed>${l ? `<p class="flex flex-wrap items-center gap-2 rounded border border-emerald-600 bg-emerald-50 p-2 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50"><span>Seated ${esc(l.text)}</span>${l.tables.map(t => ref(t, `Show ${app.store.state.world.ents[t]?.table?.label ?? t}`)).join(' ')}<button type="button" data-act="landed-x" class="${ghost}">Dismiss</button></p>` : ''}</div>`)()
export const land = (app: App, o: Outcome) => o.ok && (uiOf(app).landed = {text: describe(app.store.state.world, o).text, tables: describe(app.store.state.world, o).tables})
/** The "would go to" line for one waiting party at the door. */
export const goes = (app: App, id: Id) => ((d = dest(app, {do: 'seat', party: id})) => `<span data-goes="${esc(d.tables.join(' '))}" class="text-xs ${d.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}">${d.ok ? `would go to ${esc(d.where)}` : `no table now: ${esc(d.err)}`}</span>`)()
