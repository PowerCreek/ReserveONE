// Table card (U10a): clicking a table (2D or iso) opens one compact popover in the floor panel: who sits there, since when, turn time, server,
// and the one-click actions its state allows, each one Cmd through `run`. Escape or an outside click closes it; focus moves into it on open.
import {go} from './shell.ts'
import {having, partsOf} from '../contracts/index.ts'
import type {App, Cmd, Components, Ent, Id, SeatedRow, StandView, TStatus, World} from '../contracts/index.ts'
import {ref} from './links.ts'
import {run} from './act.ts'
import {ask} from './ask.ts'
import {holdsOf} from './assign.ts'
import {serverOf} from './draw.ts'
import {hms} from './geo.ts'
import {arg, esc} from './render.ts'
import {uiOf} from './state.ts'
/** `x`, `y` = px offset inside the floor panel (from the clicked table); none = the panel's top-right corner. */
export interface CardUi {table: Id; x?: number; y?: number}
declare module '../contracts/kernel.ts' {
  interface UiState {card?: CardUi}
}
const MIN = 60000
const WIDE = 288 // card width (w-72)
const TALL = 230 // room kept below the anchor
// ---- tone (local: tone.ts belongs to another lane)
const press = 'inline-flex min-h-8 items-center justify-center rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500'
const BTN: Record<'go' | 'ok' | 'quiet' | 'warn', string> = {
  go: `${press} bg-sky-600 text-white hover:bg-sky-700`, ok: `${press} bg-emerald-600 text-white hover:bg-emerald-700`,
  quiet: `${press} border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`,
  warn: `${press} border border-rose-300 bg-white font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-rose-950`,
}
const PILL: Record<TStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', leased: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  occupied: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', lapsed: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  blocked_private: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
}
const BOX = 'absolute z-20 w-72 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg outline-none dark:border-slate-600 dark:bg-slate-800'
const MUTED = 'text-xs text-slate-500 dark:text-slate-400'

// ---- reads: the party at the table (seated slot, else lease), its server, the stand's view (focus party, tell status)
type T = Ent<'table' | 'pos'>
interface Sitting {party: Id; name: string; size: number; how: 'seated' | 'leased'; since: number; until: number}
const group = (w: World, t: Id) => having(w, 'link').find(l => l.link.members.includes(t))?.link.members ?? [t]
const nameOf = (w: World, p: Id) => ((e = w.ents[p]?.party) => (e ? `${e.name || 'Guest'} (${e.label})` : p))()
const seatedAt = (w: World, t: Id): Sitting | undefined => ((s = having(w, 'slot').find(x => x.slot.status !== 'COMPLETED' && group(w, t).includes(x.slot.table))) =>
  s && {party: s.slot.party, name: nameOf(w, s.slot.party), size: w.ents[s.slot.party]?.party?.size ?? 0, how: 'seated' as const, since: s.slot.seatedAt, until: s.slot.turnAt})()
const leasedAt = (w: World, t: Id): Sitting | undefined => ((e = having(w, 'party', 'lease').find(x => x.lease.tables.includes(t))) =>
  e && {party: e.id, name: nameOf(w, e.id), size: e.party.size, how: 'leased' as const, since: e.lease.at, until: e.lease.until})()
export const sittingAt = (w: World, t: Id) => seatedAt(w, t) ?? leasedAt(w, t)
interface Ctx {app: App; w: World; t: T; now: number; who?: Sitting; v?: StandView}
const ctxOf = (app: App, id: Id): Ctx | undefined => ((w = app.store.state.world, t = w.ents[id]) =>
  (t?.table && t.pos ? {app, w, t: t as T, now: app.store.state.now, who: sittingAt(w, id), v: ask(app, 'stand', uiOf(app).stand?.party || undefined)} : undefined))()

// ---- pieces
const hm = (ms: number) => hms(ms).slice(0, 5)
const mins = (ms: number) => Math.round(ms / MIN)
const act = (name: string, label: string, cls: keyof typeof BTN, extra = '') => `<button type="button" data-act="card-${name}"${extra} class="${BTN[cls]}">${esc(label)}</button>`
const TURN: Record<Sitting['how'], (c: Ctx, s: Sitting) => string> = {
  seated: (c, s) => `seated ${hm(s.since)} (${mins(c.now - s.since)}m) · turn ${hm(s.until)}${s.until < c.now ? ` <b class="text-rose-600 dark:text-rose-400">over ${mins(c.now - s.until)}m</b>` : ` in ${mins(s.until - c.now)}m`}`,
  leased: (c, s) => `leased ${hm(s.since)} · settles ${hm(s.until)}${s.until > c.now ? ` in ${mins(s.until - c.now)}m` : ' now'}`,
}
const partyLine = (c: Ctx) => (c.who ? `<p data-card-party class="font-medium">${ref(c.who.party, c.who.name)} x${c.who.size}</p><p class="${MUTED}">${TURN[c.who.how](c, c.who)}</p>` : `<p class="${MUTED}">Nobody here.</p>`)
const server = (c: Ctx) => serverOf(c.w, holdsOf(c.app))(c.t)
const serverName = (c: Ctx) => ((s = server(c)?.staff) => s?.crew?.join(' + ') ?? s?.name ?? 'none')()
const serverRef = (c: Ctx) => ((e = server(c)) => (e?.staff ? ref(e.id, serverName(c)) : '<b class="font-medium text-slate-700 dark:text-slate-200">none</b>'))()
/** The other tables of its link group, each a link. */
const joined = (c: Ctx) => ((o = group(c.w, c.t.id).filter(m => m !== c.t.id)) => (o.length ? `<p data-card-joined class="${MUTED}">joined with ${o.map(m => ref(m, c.w.ents[m]?.table?.label ?? m)).join(' + ')}</p>` : ''))()
const pending = (c: Ctx) => c.v?.seated.find((r: SeatedRow) => group(c.w, c.t.id).includes(r.table) && r.aware === 'pending')
const pick = (c: Ctx) => having(c.w, 'staff').filter(s => s.staff.active && s.id !== c.t.table.waiter)
const reassign = (c: Ctx) => (pick(c).length
  ? `<label class="inline-flex items-center gap-1 ${MUTED}">Reassign<select data-on="change:card-reassign" aria-label="Reassign ${esc(c.t.table.label)} to" class="min-h-8 rounded-md border border-slate-300 bg-white px-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="">server…</option>${pick(c).map(s => `<option value="${esc(s.id)}">${esc(s.staff.name)}</option>`).join('')}</select></label>`
  : '')
/** The door party the stand has in focus, when it fits this table. */
const fits = (c: Ctx) => ((p = c.w.ents[c.v?.focus ?? '']?.party) => (p && p.size <= c.t.table.capacity && p.size >= (c.t.table.min ?? 1) ? {id: c.v!.focus!, size: p.size} : undefined))()
const leaseTo = (c: Ctx) => ((f = fits(c)) => (f ? act('lease', `Lease to ${nameOf(c.w, f.id)} x${f.size}`, 'go', ` data-party="${esc(f.id)}"`) : `<p class="${MUTED}">${c.v?.focus ? 'The party in focus does not fit here.' : 'Nobody at the door.'}</p>`))()
const SERVING = (c: Ctx) => act('extend', 'Extend +15', 'quiet') + act('clear', 'Force clear', 'warn') + (pending(c) ? act('tell', `Tell ${serverName(c)}`, 'go') : '') + reassign(c)
const ACTIONS: Record<TStatus, (c: Ctx) => string> = {
  leased: c => (c.who ? act('seat', 'Seat now', 'ok', ` data-party="${esc(c.who.party)}"`) + act('release', 'Release', 'quiet', ` data-party="${esc(c.who.party)}"`) : ''),
  occupied: SERVING, lapsed: SERVING, available: leaseTo,
  blocked_private: () => `<p class="${MUTED}">Blocked: not offered to guests.</p>`,
}
const where = (u: CardUi) => (u.x === undefined ? 'right-3 top-3' : '')
const at = (u: CardUi) => (u.x === undefined ? '' : ` style="left:${Math.round(u.x)}px;top:${Math.round(u.y ?? 8)}px"`)
const body = (c: Ctx, u: CardUi) =>
  `<div data-card="${esc(c.t.id)}" data-status="${c.t.table.status}" role="dialog" aria-label="Table ${esc(c.t.table.label)}" tabindex="-1" class="${BOX} ${where(u)}"${at(u)}>` +
  `<div class="mb-1 flex items-center gap-2">${ref(c.t.id, c.t.table.label, 'text-base font-bold')}<span class="${MUTED}">${c.t.table.capacity} seats</span><span class="rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL[c.t.table.status]}">${esc(c.t.table.status.replace('_', ' '))}</span>` +
  `<button type="button" data-act="card-close" aria-label="Close" class="ml-auto rounded px-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">✕</button></div>` +
  `<div class="space-y-0.5">${partyLine(c)}<p class="${MUTED}">server ${serverRef(c)}</p>${joined(c)}</div>` +
  `<div data-card-acts class="mt-2 flex flex-wrap items-center gap-1.5">${ACTIONS[c.t.table.status](c)}</div></div>`
/** The open card's HTML (empty when none, or when its table is gone). */
export const cardHtml = (app: App) => ((u = uiOf(app).card, c = u && ctxOf(app, u.table)) => (u && c ? body(c, u) : ''))()

// ---- open / close
const doc = (_app: App): Document | undefined => globalThis.document
const into = (app: App) => setTimeout(() => (doc(app)?.querySelector<HTMLElement>('[data-card] [data-card-acts] button, [data-card] [data-card-acts] select') ?? doc(app)?.querySelector<HTMLElement>('[data-card]'))?.focus())
/** Open the card of `table` (any panel can call it); `x`, `y` = where in the floor panel, else its corner. */
/** From another panel (no anchor): show the Sim floor on the table's floor first, so the card is in view. */
const reveal = (app: App, table: Id) => (go(app, 'sim'), Object.assign(uiOf(app), {floorId: app.store.state.world.ents[table]?.pos?.floor ?? uiOf(app).floorId}))
export const openCard = (app: App, table: Id, x?: number, y?: number) => {
  x === undefined && reveal(app, table)
  Object.assign(uiOf(app), {card: {table, ...(x === undefined ? {} : {x, y})}})
  uiOf(app).rev++
  into(app)
}
export const closeCard = (app: App) => (uiOf(app).card ? ((app.store.state.ui.card = undefined), uiOf(app).rev++, true) : false)
/** Beside the clicked table inside the floor panel: right of it when the card fits there, else left; kept inside the panel's height. */
const anchor = (ev: Event): [number, number] | [] => {
  const [t, p] = [(ev.target as Element).closest('[data-tid]')?.getBoundingClientRect(), (ev.target as Element).closest('[data-floor]')?.getBoundingClientRect()]
  const right = t && p && t.right - p.left + 8
  return t && p && p.width ? [right! + WIDE + 8 <= p.width ? right! : Math.max(8, t.left - p.left - WIDE - 8), Math.max(8, Math.min(t.top - p.top, p.height - TALL))] : []
}

// ---- acts: each one Cmd about the open card's table; the card stays open on the table's new state
const tid = (app: App) => uiOf(app).card?.table ?? ''
const val = (ev: Event) => (ev.target as HTMLSelectElement).value
const CMDS: Record<string, (app: App, ev: Event) => Cmd | undefined> = {
  seat: (_, ev) => ({do: 'seat', party: arg(ev, 'party')}),
  release: (_, ev) => ({do: 'release', party: arg(ev, 'party')}),
  extend: app => ({do: 'extend', table: tid(app), min: 15}),
  clear: app => ({do: 'clear', table: tid(app)}),
  tell: app => ({do: 'tell', table: pending(ctxOf(app, tid(app))!)?.table ?? tid(app)}),
  lease: (app, ev) => ({do: 'lease', party: arg(ev, 'party'), spot: tid(app), step: ask(app, 'stand', arg(ev, 'party'))?.offers.find(o => o.spot === tid(app))?.step ?? 'card'}),
  reassign: (app, ev) => (val(ev) ? {do: 'reassign', table: tid(app), staff: val(ev)} : undefined),
}
const send = (app: App, cmd?: Cmd) => cmd && (run(app, cmd), uiOf(app).rev++, into(app))
/** Escape closes; a click outside the card (and off any table) closes. */
const keys = (app: App) => (ev: KeyboardEvent) => ev.key === 'Escape' && closeCard(app) && doc(app)?.querySelector<HTMLElement>('[data-floor] svg[tabindex]')?.focus()
// ---- links: the `ent` act (ui/links.ts `ref`, the floor's party chip) opens the named entity's panel
/** The table a party sits at (or is leased), primary first. */
const tableOf = (w: World, p: Id) => ((s = having(w, 'slot').find(x => x.slot.party === p && x.slot.status !== 'COMPLETED')) => (s ? partsOf(w, s.slot.table)[0] : w.ents[p]?.lease?.tables[0]))()
/** Beside the clicked table, else where this table's card already is, else the corner. */
const keep = (app: App, t: Id): [number, number] | [] => ((u = uiOf(app).card) => (u?.table === t && u.x !== undefined ? [u.x, u.y ?? 8] : []))()
const show = (app: App, t: Id, ev: Event) => openCard(app, t, ...((a = anchor(ev)) => (a.length ? a : keep(app, t)))())
const atDoor = (app: App, p: Id) => (go(app, 'sim'), (uiOf(app).stand = {...uiOf(app).stand, party: p}), closeCard(app), uiOf(app).rev++)
const toStaff = (app: App, s: Id) => (go(app, 'staff'), (uiOf(app).prefs = {quick: uiOf(app).prefs?.quick ?? '', open: s}), uiOf(app).rev++)
const FOLLOW: [keyof Components, (app: App, id: Id, ev: Event) => unknown][] = [
  ['table', show], ['party', (app, id, ev) => ((t = tableOf(app.store.state.world, id)) => (t ? show(app, t, ev) : atDoor(app, id)))()], ['staff', toStaff],
]
/** Open entity `id`'s panel (the first route its components match). */
export const follow = (app: App, id: Id, ev: Event) => ((e = app.store.state.world.ents[id]) => e && FOLLOW.find(([k]) => k in e)?.[1](app, id, ev))()
const outside = (app: App) => (ev: Event) => ((t = ev.target as Element) => !t.closest?.('[data-card]') && !t.closest?.('[data-act="tcard"]') && !t.closest?.('[data-act="ent"]') && closeCard(app))()
export const tableCard = (app: App) => {
  app.act('tcard', (a, ev) => openCard(a, arg(ev, 'tid'), ...anchor(ev)))
  app.act('card-close', a => closeCard(a))
  app.act('ent', (a, ev) => follow(a, arg(ev, 'eid'), ev))
  Object.entries(CMDS).forEach(([n, f]) => app.act(`card-${n}`, (a, ev) => send(a, f(a, ev))))
  app.view(el => (el.ownerDocument.addEventListener('keydown', keys(app)), el.ownerDocument.addEventListener('click', outside(app))))
}
