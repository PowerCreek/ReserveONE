// Reservations (lane U14): a three-step booking wizard checked live against the booking desk's availability, and the day's bookings by time slot with filters;
// each row opens its details and the actions its state allows. Inputs are static (never repainted, so typing survives ticks); chips, availability and the list are panels.
import {bookOf} from '../contracts/index.ts'
import type {App, Avail, BookCmd, BookFilter, Draft, Policy, ResRow, ResSlot, ResState} from '../contracts/index.ts'
import {policyOf} from './ask.ts'
import {at, bk, book, hm, ymd} from './bookask.ts'
import {arg, esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {btn, card, ctaSm, field, ghost, help, ok, on} from './tone.ts'
const FIELDS = ['name', 'size', 'phone', 'date', 'time', 'dur', 'notes'] as const
type Field = (typeof FIELDS)[number]
export type BkDraft = Record<Field, string> & {feats: string[]; flags: string[]; area: string}
export interface Bk {cta: string; step: number; on: Record<string, boolean>; edit: string; draft: BkDraft; fill: number; rev: number; f: {state: string; size: string; area: string; day: number | null}; open: string}
declare module '../contracts/kernel.ts' {
  interface UiState {bk?: Bk}
}
const bkOf = (app: App) => uiOf(app).bk!
const Q = 15 * 60000
const blank = (now: number): BkDraft => ((t = Math.ceil((now + 30 * 60000) / Q) * Q) => ({name: '', size: '2', phone: '', date: ymd(t), time: hm(t), dur: '', notes: '', feats: [], flags: [], area: ''}))()
const steps = (n: number) => Object.fromEntries([1, 2, 3].map(i => [i, i === n]))
const fresh = (now: number): Bk => ({cta: 'Book', step: 1, on: steps(1), edit: '', draft: blank(now), fill: 0, rev: 0, f: {state: 'open', size: 'any', area: 'all', day: null}, open: ''})

// ---- the wizard: Who -> When and where -> Notes and confirm; Book is always one click away once the party has a size
const inp = (n: Field, label: string, type = 'text', extra = '') => `<label class="grid gap-0.5 text-xs"><span class="text-slate-600 dark:text-slate-300">${label}</span><input name="${n}" type="${type}" ${extra} data-on="input:bk-in change:bk-in" class="${field} w-full" /></label>`
const STEPS = [[1, 'Who'], [2, 'When and where'], [3, 'Notes and confirm']] as const
const stepTabs = (app: App) => `<div role="tablist" aria-label="Booking steps" class="flex flex-wrap gap-1">${STEPS.map(([n, l]) => `<button type="button" role="tab" aria-selected="${bkOf(app).step === n}" data-act="bk-step" data-n="${n}" class="${bkOf(app).step === n ? on : btn}">${n}. ${l}</button>`).join('')}</div>`
const chip = (act: string, id: string, label: string, picked: boolean) => `<button type="button" role="checkbox" aria-checked="${picked}" data-act="${act}" data-id="${esc(id)}" class="${picked ? on : ghost}">${esc(label)}</button>`
const flagChips = (app: App) => Object.entries(bookOf(policyOf(app)).flags).map(([id, f]) => chip('bk-flag', id, f.label, bkOf(app).draft.flags.includes(id))).join('')
const areaChips = (app: App) => [['', 'Any area'] as const, ...Object.entries(policyOf(app).service.areas).map(([id, a]) => [id, a.label] as const)].map(([id, l]) => chip('bk-area', id, l, bkOf(app).draft.area === id)).join('')
const featChips = (app: App) => Object.entries(policyOf(app).host.feats).map(([id, f]) => chip('bk-feat', id, f.label, bkOf(app).draft.feats.includes(id))).join('')
const chips = (draw: (app: App) => string) => (app: App) => `<div class="flex flex-wrap gap-1">${draw(app)}</div>`
const qOf = (app: App) => ((d = bkOf(app).draft) => ({size: Math.max(1, Number(d.size) || 1), at: at(d.date, d.time), durationMin: Number(d.dur) || undefined, feats: d.feats, area: d.area || null, skip: bkOf(app).edit || undefined}))()
const spotChip = (s: Avail['spots'][number]) => `<span data-tid="${esc(s.tables[0])}" class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">${esc(s.label)}</span>`
const alt = (t: number) => `<button type="button" data-act="bk-alt" data-at="${t}" class="${ghost}">${hm(t)}</button>`
const availDraw = (app: App) => {
  const a = bk(app, 'avail', qOf(app))
  const head = a?.ok ? `<p class="text-sm font-semibold text-emerald-700 dark:text-emerald-300"><span aria-hidden="true">✓</span> Available at ${hm(a.at)}</p>` : `<p class="text-sm font-semibold text-rose-700 dark:text-rose-300"><span aria-hidden="true">✕</span> Not available at ${hm(a?.at ?? 0)}</p>`
  return a ? `${head}<p class="${help}">${esc(a.why)}${a.taken ? ` · ${a.taken} taken by other bookings in that window` : ''}</p><div class="mt-1 flex flex-wrap gap-1">${a.spots.slice(0, 8).map(spotChip).join('')}</div>${a.alts.length ? `<p class="mt-1 text-xs">Nearby times that work: ${a.alts.map(alt).join(' ')}</p>` : ''}` : `<p class="${help}">Booking desk not available.</p>`
}
const summary = (app: App) => ((d = bkOf(app).draft, p = policyOf(app)) =>
  `<p class="text-sm">${esc(d.name || 'Guest')} x${esc(d.size)} on ${esc(d.date)} at ${esc(d.time)}${d.area ? `, ${esc(p.service.areas[d.area]?.label ?? d.area)}` : ''}${d.feats.length ? `, wants ${esc(d.feats.map(f => p.host.feats[f]?.label ?? f).join(', '))}` : ''}${d.flags.length ? ` · ${esc(d.flags.map(f => bookOf(p).flags[f]?.label ?? f).join(', '))}` : ''}</p>`)()
const wizard = `<div data-form="book" data-bkfill="ui.bk.fill" class="${card} space-y-2"><h2 class="text-sm font-semibold">Book a table</h2><p class="${help}">Three steps; availability updates as you type. Book saves at any step.</p>
<div data-bksteps="ui.bk.rev"></div>
<fieldset data-show="ui.bk.on.1" class="grid gap-2"><legend class="sr-only">Who</legend>${inp('name', 'Party name')}<div class="grid grid-cols-2 gap-2">${inp('size', 'Size', 'number', 'min="1" inputmode="numeric"')}${inp('phone', 'Phone', 'tel')}</div>
<p class="text-xs text-slate-600 dark:text-slate-300">Flags (they raise the party in the wait order)</p><div data-bkflags="ui.bk.rev"></div></fieldset>
<fieldset data-show="ui.bk.on.2" hidden class="grid gap-2"><legend class="sr-only">When and where</legend><div class="grid grid-cols-3 gap-2">${inp('date', 'Date', 'date')}${inp('time', 'Time', 'time', 'step="900"')}${inp('dur', 'Length (min)', 'number', 'min="15" placeholder="default"')}</div>
<p class="text-xs text-slate-600 dark:text-slate-300">Area</p><div data-bkareas="ui.bk.rev"></div><p class="text-xs text-slate-600 dark:text-slate-300">Seating wishes (recorded as the party's wants)</p><div data-bkfeats="ui.bk.rev"></div></fieldset>
<fieldset data-show="ui.bk.on.3" hidden class="grid gap-2"><legend class="sr-only">Notes and confirm</legend><label class="grid gap-0.5 text-xs"><span class="text-slate-600 dark:text-slate-300">Notes</span><textarea name="notes" rows="2" data-on="input:bk-in change:bk-in" class="${field} w-full"></textarea></label><div data-bksum="ui.bk.rev"></div></fieldset>
<div data-avail="ui.bk.rev" class="rounded border border-slate-200 p-2 dark:border-slate-700"></div>
<div class="flex flex-wrap items-center gap-2"><button type="button" data-act="bk-back" class="${ghost}">Back</button><button type="button" data-act="bk-next" class="${btn}">Next</button><span class="grow"></span><button type="button" data-act="bk-reset" data-show="ui.bk.edit" hidden class="${ghost}">Stop editing</button><button type="button" data-act="book" data-text="ui.bk.cta" class="${ctaSm}">Book</button></div></div>`

// ---- the list: the day's bookings by slot, filter chips with counts, a row per booking, details on demand
const STATES: [string, string][] = [['open', 'Open'], ['all', 'All'], ['BOOKED', 'Booked'], ['LATE', 'Late'], ['ARRIVED', 'Arrived'], ['SEATED', 'Seated'], ['NO_SHOW', 'No-show'], ['CANCELLED', 'Cancelled']]
const SIZES: Record<string, [number, number] | undefined> = {any: undefined, '1-2': [1, 2], '3-4': [3, 4], '5+': [5, 99]}
const PILL: Record<ResState, string> = {
  BOOKED: 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50', LATE: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50', ARRIVED: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  SEATED: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100', NO_SHOW: 'bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50', CANCELLED: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400',
}
const SAY: Record<ResState, string> = {BOOKED: 'booked', LATE: 'late', ARRIVED: 'arrived', SEATED: 'seated', NO_SHOW: 'no-show', CANCELLED: 'cancelled'}
const filterOf = (app: App): BookFilter => ((f = bkOf(app).f) => ({state: f.state as BookFilter['state'], size: SIZES[f.size], area: f.area, day: f.day ?? undefined}))()
const fchip = (kind: string, id: string, label: string, picked: boolean) => `<button type="button" role="radio" aria-checked="${picked}" data-act="bk-filter" data-kind="${kind}" data-id="${esc(id)}" class="${picked ? on : ghost}">${label}</button>`
const filters = (app: App, counts: Record<ResState, number>) => ((f = bkOf(app).f, p = policyOf(app)) =>
  `<div class="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Status">${STATES.map(([id, l]) => fchip('state', id, `${l}${counts[id as ResState] ? ` <b class="tabular-nums">${counts[id as ResState]}</b>` : ''}`, f.state === id)).join('')}</div>
<div class="mt-1 flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Size">${Object.keys(SIZES).map(id => fchip('size', id, id === 'any' ? 'Any size' : id, f.size === id)).join('')}<span class="mx-1"></span>${[['all', 'Any area'], ...Object.entries(p.service.areas).map(([id, a]) => [id, a.label])].map(([id, l]) => fchip('area', id, esc(l), f.area === id)).join('')}</div>`)()
const dayBar = (app: App) => ((d = bkOf(app).f.day ?? app.store.state.now) =>
  `<div class="flex flex-wrap items-center gap-1"><button type="button" data-act="bk-day" data-by="-1" aria-label="Previous day" class="${ghost}">‹</button><b class="text-sm tabular-nums">${ymd(d)}</b><button type="button" data-act="bk-day" data-by="1" aria-label="Next day" class="${ghost}">›</button><button type="button" data-act="bk-day" data-by="0" class="${ghost}">Today</button></div>`)()
const DO: Record<string, [label: string, cls: string]> = {arrive: ['Arrived', btn], noshow: ['No-show', ghost], edit: ['Edit', ghost], cancel: ['Cancel', ghost]}
const acts = (r: ResRow) => r.acts.map(a => (a === 'seat' ? `<button type="button" data-act="seat" data-id="${esc(r.party)}" class="${ok}">Seat</button>` : `<button type="button" data-act="bk-do" data-to="${a}" data-id="${esc(r.party)}" class="${DO[a][1]}">${DO[a][0]}</button>`)).join('')
const where = (r: ResRow) => (r.table ? `<span data-tid="${esc(r.table.tables[0])}" title="${r.table.planned ? 'Where the plan puts it' : 'Its own table'}" class="text-xs tabular-nums">${r.table.planned ? 'plan ' : ''}${esc(r.table.label)}</span>` : '<span class="text-xs text-slate-500">no table yet</span>')
const marks = (p: Policy, r: ResRow) => r.flags.map(f => `<span class="rounded bg-violet-100 px-1 text-xs text-violet-950 dark:bg-violet-950 dark:text-violet-50">${esc(bookOf(p).flags[f]?.label ?? f)}</span>`).join('')
const details = (p: Policy, r: ResRow) => `<dl data-bkdetail="${esc(r.party)}" class="mt-1 grid grid-cols-[6rem_1fr] gap-x-2 rounded bg-slate-50 p-2 text-xs dark:bg-slate-900">
<dt>When</dt><dd>${hm(r.at)} for ${r.durationMin}m${r.lateMin ? `, ${r.lateMin}m late` : ''}</dd><dt>Phone</dt><dd>${esc(r.phone || '-')}</dd><dt>Notes</dt><dd>${esc(r.notes || '-')}</dd>
<dt>Wishes</dt><dd>${esc(r.feats.map(f => p.host.feats[f]?.label ?? f).join(', ') || '-')}</dd><dt>Area</dt><dd>${esc(r.area ? (p.service.areas[r.area]?.label ?? r.area) : 'any')}</dd><dt>Table</dt><dd>${where(r)}</dd></dl>`
const resRow = (app: App, p: Policy) => (r: ResRow) =>
  `<li data-res="${esc(r.party)}" class="py-1"><div class="flex flex-wrap items-center gap-2 text-sm"><span class="w-12 font-mono tabular-nums">${hm(r.at)}</span><b class="w-14">${esc(r.label)}</b>
<button type="button" data-act="bk-open" data-id="${esc(r.party)}" aria-expanded="${bkOf(app).open === r.party}" class="grow text-left underline-offset-2 hover:underline">${esc(r.name)} x${r.size}</button>${marks(p, r)}${where(r)}
<span class="rounded-full px-2 py-0.5 text-xs ${PILL[r.state]}">${SAY[r.state]}${r.lateMin ? ` ${r.lateMin}m` : ''}</span>${acts(r)}</div>${bkOf(app).open === r.party ? details(p, r) : ''}</li>`
const BAR = ['w-1', 'w-2', 'w-4', 'w-8', 'w-12', 'w-16', 'w-20', 'w-24', 'w-28', 'w-32'] // literal widths (Tailwind builds only literal classes)
const slot = (app: App, p: Policy, max: number) => (s: ResSlot) =>
  `<li data-slot="${s.start}" class="py-1"><div class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><span class="w-12 tabular-nums">${hm(s.start)}</span><span class="h-1.5 rounded bg-sky-500 ${BAR[Math.round((s.covers / max) * (BAR.length - 1))]}" aria-hidden="true"></span><span class="tabular-nums">${s.covers} covers</span></div>
<ul class="divide-y divide-slate-200 pl-2 dark:divide-slate-700">${s.rows.map(resRow(app, p)).join('')}</ul></li>`
const listDraw = (app: App) => {
  const v = bk(app, 'list', filterOf(app))
  const p = policyOf(app)
  const max = Math.max(1, ...(v?.slots ?? []).map(s => s.covers))
  return v ? `${dayBar(app)}<div class="mt-1">${filters(app, v.counts)}</div><p class="mt-1 ${help}">${v.total} booking(s), ${v.covers} covers expected.</p>${v.slots.length ? `<ul class="mt-1">${v.slots.map(slot(app, p, max)).join('')}</ul>` : `<p class="mt-2 ${help}">No bookings match.</p>`}` : `<p class="${help}">Booking desk not available.</p>`
}
export const bookPane = `<div class="grid gap-3 lg:grid-cols-[24rem_1fr]">${wizard}
<div class="${card}"><h2 class="text-sm font-semibold">Reservations</h2><p class="mb-2 ${help}">The day by time slot; open a row for its details. Late = past its time plus grace.</p><div data-book="ui.rev"></div></div></div>`

// ---- acts
const formOf = (ev: Event) => (ev.target as Element).closest('[data-form="book"]') ?? (ev.target as Element).ownerDocument.querySelector('[data-form="book"]')!
const val = (f: Element, n: Field) => f.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name=${n}]`)?.value ?? ''
/** The typed value, else the draft's (the inputs take the draft asynchronously, so a click right after mount still books the draft). */
const pick = (app: App, f: Element) => (n: Field) => val(f, n) || bkOf(app).draft[n]
const draftOf = (app: App, f: Element): Draft => ((d = bkOf(app).draft, v = pick(app, f)) => ({size: Number(v('size')), name: v('name'), at: at(v('date'), v('time')), phone: v('phone'), notes: v('notes'), feats: d.feats, flags: d.flags, area: d.area || null, ...(Number(v('dur')) ? {durationMin: Number(v('dur'))} : {})}))()
const cmdOf = (app: App, d: Draft): BookCmd => (bkOf(app).edit ? {do: 'edit', party: bkOf(app).edit, ...d} : {do: 'book', ...d})
const reset = (app: App) => Object.assign(bkOf(app), {edit: '', cta: 'Book', draft: blank(app.store.state.now), step: 1, on: steps(1), fill: bkOf(app).fill + 1, rev: bkOf(app).rev + 1})
const submit = (app: App, ev: Event) => book(app, cmdOf(app, draftOf(app, formOf(ev)))).ok && reset(app)
const go = (app: App, n: number) => Object.assign(bkOf(app), {step: Math.min(3, Math.max(1, n)), on: steps(Math.min(3, Math.max(1, n))), rev: bkOf(app).rev + 1})
const toggle = (k: 'feats' | 'flags') => (app: App, ev: Event) => ((d = bkOf(app).draft, id = arg(ev, 'id')) => (d[k] = d[k].includes(id) ? d[k].filter(x => x !== id) : [...d[k], id]))()
/** Load a booking into the wizard to edit it. */
const edit = (app: App, id: string) => {
  const e = app.store.state.world.ents[id]
  const r = e?.reservation
  const t = r?.at ?? app.store.state.now
  e && Object.assign(bkOf(app), {edit: id, cta: `Save ${e.party?.label ?? ''}`, draft: {name: e.party?.name ?? '', size: String(e.party?.size ?? 2), phone: r?.phone ?? '', date: ymd(t), time: hm(t), dur: String(r?.durationMin ?? ''), notes: r?.notes ?? '', feats: e.intake?.feats ?? [], flags: e.intake?.flags ?? [], area: e.intake?.area ?? ''}, fill: bkOf(app).fill + 1}) && go(app, 1)
}
const ROW: Record<string, (app: App, id: string) => unknown> = {
  arrive: (a, id) => book(a, {do: 'arrive', party: id}), noshow: (a, id) => book(a, {do: 'noshow', party: id}), cancel: (a, id) => book(a, {do: 'leave', party: id, why: 'cancel'}), edit,
}
const FILTER: Record<string, (b: Bk, id: string) => unknown> = {state: (b, id) => (b.f.state = id), size: (b, id) => (b.f.size = id), area: (b, id) => (b.f.area = id)}
const DAY = 86400000
const bump = (f: (app: App, ev: Event) => unknown) => (app: App, ev: Event) => (f(app, ev), bkOf(app).rev++, uiOf(app).rev++)
const ACTS: Record<string, (app: App, ev: Event) => unknown> = {
  book: submit,
  'bk-in': (app, ev) => ((t = ev.target as HTMLInputElement) => FIELDS.includes(t.name as Field) && (bkOf(app).draft[t.name as Field] = t.value))(),
  'bk-step': (app, ev) => go(app, Number(arg(ev, 'n'))), 'bk-next': app => go(app, bkOf(app).step + 1), 'bk-back': app => go(app, bkOf(app).step - 1),
  'bk-flag': toggle('flags'), 'bk-feat': toggle('feats'), 'bk-area': (app, ev) => (bkOf(app).draft.area = arg(ev, 'id')),
  'bk-alt': (app, ev) => Object.assign(bkOf(app).draft, {time: hm(Number(arg(ev, 'at'))), date: ymd(Number(arg(ev, 'at')))}) && bkOf(app).fill++,
  'bk-reset': reset,
  'bk-do': (app, ev) => ROW[arg(ev, 'to')]?.(app, arg(ev, 'id')),
  'bk-open': (app, ev) => (bkOf(app).open = bkOf(app).open === arg(ev, 'id') ? '' : arg(ev, 'id')),
  'bk-filter': (app, ev) => FILTER[arg(ev, 'kind')]?.(bkOf(app), arg(ev, 'id')),
  'bk-day': (app, ev) => (bkOf(app).f.day = Number(arg(ev, 'by')) ? (bkOf(app).f.day ?? app.store.state.now) + Number(arg(ev, 'by')) * DAY : null),
}
/** The wizard's inputs take the draft whenever `ui.bk.fill` moves (mount, edit, reset, a nearby time picked). */
const fill = (app: App) => ({attr: 'data-bkfill', apply: (el: Element) => FIELDS.forEach(n => ((i = el.querySelector<HTMLInputElement>(`[name=${n}]`)) => i && (i.value = bkOf(app).draft[n]))())})
const PANELS: [string, (app: App) => string][] = [['data-bksteps', stepTabs], ['data-bkflags', chips(flagChips)], ['data-bkareas', chips(areaChips)], ['data-bkfeats', chips(featChips)], ['data-avail', availDraw], ['data-bksum', summary], ['data-book', listDraw]]
export const reserve = (app: App) => {
  Object.assign(uiOf(app), {bk: uiOf(app).bk ?? fresh(app.store.state.now)})
  Object.entries(ACTS).forEach(([n, f]) => app.act(n, n === 'bk-in' ? (a, ev) => (f(a, ev), bkOf(a).rev++) : bump(f)))
  app.binder(fill(app))
  PANELS.forEach(([attr, draw]) => app.binder(panel(app, attr, draw)))
  app.store.watch('ui.rev', () => bkOf(app).rev++)
  app.store.watch('ui.scenario', () => bkOf(app).edit || Object.assign(bkOf(app), {draft: blank(app.store.state.now), fill: bkOf(app).fill + 1}))
}
