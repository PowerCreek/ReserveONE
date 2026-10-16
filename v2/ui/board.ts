// Dashboard (U8b): one engine.board read per repaint feeds every panel. Reads top-down by urgency: KPIs, the timeline, then Turnover | Ledger | Servers.
// Cross-highlight: a picked table (`ui.board.pick`) marks every reference to it (and its link group) across the dashboard; Escape or a second click clears it.
import {having} from '../contracts/index.ts'
import type {Activity, App, Bar, Board, Bucket, BusItem, Id, Kpi, Lane, LedgerChip, Quote, SectionRow, ServerRow, SpotState, Tick, World} from '../contracts/index.ts'
import {ask} from './ask.ts'
import {hms} from './geo.ts'
import {arg, esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {btn, card, on} from './tone.ts'
export interface BoardUi {pick: Id; iv: number; ahead: number}
declare module '../contracts/kernel.ts' {
  interface UiState {board?: BoardUi}
}
const MIN = 60000
const PAST = 30 // minutes of history on the timeline
const THROTTLE = 400 // ms of wall time between reads while the clock runs
const WINDOWS: [min: number, label: string][] = [[60, '1h'], [180, '3h'], [360, '6h']] // minutes ahead
const SPAN = 1260 // px the window is drawn across (fills a desktop card; scrolls inside it when narrower)
const IVS = [5, 10, 15, 30, 60]
const ROW = 24
const HEAD = 28
const bu = (app: App) => uiOf(app).board
const seen = (app: App, tab: string) => !!uiOf(app).on?.[tab]
const hm = (ms: number) => hms(ms).slice(0, 5)
const span = (a: number, b: number) => `${hm(a)}–${hm(b)}`
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
const help = (s: string) => `<p class="mb-2 text-xs text-slate-500 dark:text-slate-400">${s}</p>`
const head = (title: string, s: string) => `<h2 class="text-sm font-semibold">${title}</h2>${help(s)}`

// ---- one read per repaint: keyed by rev + options; while the clock runs, at most one read per THROTTLE ms
const optOf = (app: App) => ({ivMin: bu(app).iv, pastMin: PAST, aheadMin: bu(app).ahead})
export const reader = (app: App) => {
  const last = {rev: -1, opt: '', at: 0, b: undefined as Board | undefined}
  const hot = (app: App) => !uiOf(app).running || Date.now() - last.at >= THROTTLE
  const stale = (opt: string) => opt !== last.opt || (uiOf(app).rev !== last.rev && hot(app))
  const read = (opt: string) => Object.assign(last, {rev: uiOf(app).rev, opt, at: Date.now(), b: ask(app, 'board', optOf(app))})
  return () => (stale(JSON.stringify(optOf(app))) && read(JSON.stringify(optOf(app))), last.b)
}

// ---- picking: a table id, widened to its link group
interface Ctx {b: Board; w: World; pick: Set<Id>; ui: BoardUi}
const group = (w: World, t: Id) => having(w, 'link').find(l => l.link.members.includes(t))?.link.members ?? [t]
const ctxOf = (app: App, b: Board): Ctx => ({b, w: app.store.state.world, pick: new Set(bu(app).pick ? group(app.store.state.world, bu(app).pick) : []), ui: bu(app)})
const hit = (c: Ctx, ts: Id[]) => ts.some(t => c.pick.has(t))
const marked = (c: Ctx, ts: Id[]) => (hit(c, ts) ? ' data-picked' : '')
const PICKED = 'data-picked:ring-2 data-picked:ring-amber-500 data-picked:ring-offset-1 dark:data-picked:ring-offset-slate-800'
const tablesOf = (w: World, spot: Id) => w.ents[spot]?.link?.members ?? [spot]
const byLabel = (w: World, label: string) => having(w, 'table').find(t => t.table.label === label.split('+')[0])?.id ?? ''
const waiterOf = (w: World, t: Id) => w.ents[w.ents[t]?.table?.waiter ?? '']?.staff?.name ?? 'no server'
/** U9: the hover card of a table, as its title. */
const tcard = (w: World, t: Id) => esc([w.ents[t]?.table?.label ?? t, `${w.ents[t]?.table?.capacity ?? '?'} seats`, w.ents[t]?.table?.status ?? '', waiterOf(w, t)].join(' · '))
/** A clickable table reference: picks the table (a second click clears it). */
const tref = (c: Ctx, t: Id, inner: string, cls: string) =>
  `<button type="button" data-act="bpick" data-tid="${esc(t)}" title="${tcard(c.w, t)}"${marked(c, group(c.w, t))} class="${cls} ${PICKED} whitespace-nowrap">${inner}</button>`

// ---- toolbar: window + interval (one control for every panel), and what is picked
const choiceBtn = (act: string, v: number, label: string, picked: boolean) =>
  `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${picked}" class="${picked ? on : btn} whitespace-nowrap">${label}</button>`
const pickInfo = (app: App) => (bu(app).pick
  ? `<button type="button" data-act="bpick" data-tid="${esc(bu(app).pick)}" class="${btn} whitespace-nowrap">Tracing ${esc(app.store.state.world.ents[bu(app).pick]?.table?.label ?? bu(app).pick)} · clear (Esc)</button>`
  : '<span class="text-xs text-slate-500">Click any table or bar to trace it everywhere</span>')
const tool = (app: App) => `<div class="flex flex-wrap items-center gap-x-3 gap-y-2"><h2 class="font-semibold">Dashboard</h2>
<div class="flex flex-wrap items-center gap-1"><span class="text-xs text-slate-500">Ahead</span>${WINDOWS.map(([m, l]) => choiceBtn('bwin', m, l, bu(app).ahead === m)).join('')}</div>
<div class="flex flex-wrap items-center gap-1"><span class="text-xs text-slate-500">Interval</span>${IVS.map(v => choiceBtn('biv', v, `${v}m`, bu(app).iv === v)).join('')}</div>${pickInfo(app)}</div>`

// ---- KPI strip (full on the dashboard, compact on the Sim tab)
export const TONE: Record<Kpi['tone'], string> = {
  ok: 'border-l-emerald-500 bg-white dark:bg-slate-800', warn: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950', crit: 'border-l-rose-600 bg-rose-50 dark:bg-rose-950', info: 'border-l-slate-400 bg-white dark:bg-slate-800',
}
const VALUE: Record<Kpi['tone'], string> = {ok: 'text-emerald-700 dark:text-emerald-300', warn: 'text-amber-700 dark:text-amber-300', crit: 'text-rose-700 dark:text-rose-300', info: ''}
const kpiCard = (k: Kpi) => `<div data-kpi="${esc(k.id)}" data-tone="${k.tone}" title="${esc(k.hint)}" class="min-w-0 rounded-md border border-l-4 border-slate-200 px-2 py-1 dark:border-slate-700 ${TONE[k.tone]}">
<div class="truncate text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">${esc(k.label)}</div><div class="whitespace-nowrap text-lg font-semibold tabular-nums ${VALUE[k.tone]}">${esc(k.value)}</div><div class="truncate text-[11px] text-slate-500 dark:text-slate-400">${esc(k.hint)}</div></div>`
const kpiChip = (k: Kpi) => `<span data-kpi="${esc(k.id)}" data-tone="${k.tone}" title="${esc(k.hint)}" class="whitespace-nowrap rounded border border-l-4 border-slate-200 px-1.5 py-0.5 text-xs dark:border-slate-700 ${TONE[k.tone]}"><span class="text-slate-500 dark:text-slate-400">${esc(k.label)}</span> <b class="tabular-nums ${VALUE[k.tone]}">${esc(k.value)}</b></span>`
const strip = (b: Board) => b.kpis.map(kpiCard).join('')
const mini = (b: Board) => b.kpis.map(kpiChip).join('') + '<button type="button" data-act="tab" data-id="board" class="text-xs text-sky-700 underline dark:text-sky-300">Dashboard</button>'

// ---- timeline (gantt): an HTML label column beside a scrolling SVG track, rows of the same height
type Row = {floor: string} | {lane: Lane} | {unplaced: Bar[]}
const floorName = (w: World, f: Id) => w.ents[f]?.floor?.name ?? (f || 'Tables')
const byFloor = (ls: Lane[]) => ls.reduce<Map<Id, Lane[]>>((m, l) => m.set(l.floor, [...(m.get(l.floor) ?? []), l]), new Map())
const rowsOf = (c: Ctx): Row[] => [
  ...[...byFloor(c.b.gantt.lanes)].flatMap(([f, ls]): Row[] => [{floor: floorName(c.w, f)}, ...ls.map(lane => ({lane}))]),
  ...(c.b.gantt.unplaced.length ? [{unplaced: c.b.gantt.unplaced}] : []),
]
const LABEL: Record<string, (c: Ctx, r: Row) => string> = {
  floor: (_c, r) => `<div class="flex h-6 items-center truncate bg-slate-100 px-1 text-[11px] font-semibold uppercase text-slate-500 dark:bg-slate-900">${esc((r as {floor: string}).floor)}</div>`,
  lane: (c, r) => `<div class="flex h-6 items-center">${tref(c, (r as {lane: Lane}).lane.table, `${esc((r as {lane: Lane}).lane.label)} <span class="text-slate-500">(${(r as {lane: Lane}).lane.capacity})</span>`, 'rounded px-1 text-xs')}</div>`,
  unplaced: () => '<div class="flex h-6 items-center px-1 text-xs font-semibold text-amber-700 dark:text-amber-300" title="Reservations the plan cannot place yet">Unplaced</div>',
}
const kindOf = (r: Row) => Object.keys(r)[0]
const labels = (c: Ctx) => `<div class="h-7 px-1 text-[11px] text-slate-500">Table</div>${rowsOf(c).map(r => LABEL[kindOf(r)](c, r)).join('')}`
interface Geo {from: number; to: number; ppm: number; width: number}
const geoOf = (c: Ctx): Geo => ({from: c.b.gantt.from, to: c.b.gantt.to, ppm: SPAN / ((c.b.gantt.to - c.b.gantt.from) / MIN), width: SPAN})
const X = (g: Geo, at: number) => Math.max(0, Math.min(g.width, ((at - g.from) / MIN) * g.ppm))
const BAR: Record<string, string> = {
  slot: 'fill-rose-200 stroke-rose-600 dark:fill-rose-900 dark:stroke-rose-400', over: 'fill-rose-400 stroke-rose-800 dark:fill-rose-700 dark:stroke-rose-300',
  done: 'fill-slate-200 stroke-slate-400 dark:fill-slate-700 dark:stroke-slate-500', res: 'fill-sky-100 stroke-sky-600 dark:fill-sky-950 dark:stroke-sky-400',
  late: 'fill-amber-200 stroke-amber-600 dark:fill-amber-900 dark:stroke-amber-400', plan: 'fill-white stroke-sky-500 dark:fill-slate-900 dark:stroke-sky-400',
  event: 'fill-violet-100 stroke-violet-600 dark:fill-violet-950 dark:stroke-violet-400',
}
const NAME: Record<string, string> = {slot: 'Seated', over: 'Past turn time', done: 'Finished', res: 'Reservation', late: 'Late reservation', plan: 'Planned (no table yet)', event: 'Private event'}
const DASH: Record<string, string> = {plan: ' stroke-dasharray="4 3"'}
const flag = (b: Bar) => (b.over && 'over') || (b.late && 'late') || b.kind
const fit = (s: string, px: number) => (s.length * 6 <= px - 6 ? s : px < 24 ? '' : `${s.slice(0, Math.floor((px - 6) / 6) - 1)}…`)
const barSvg = (c: Ctx, g: Geo, y: number, t: Id | null) => (b: Bar) => {
  const [x0, x1] = [X(g, b.from), X(g, b.to)]
  const w = Math.max(3, x1 - x0)
  const tag = t ? ` data-act="bpick" data-tid="${esc(t)}"${marked(c, [t])}` : ''
  return `<g${tag} class="cursor-pointer"><title>${esc(`${NAME[flag(b)]}: ${b.label || '-'} x${b.size} ${span(b.from, b.to)}`)}</title><rect x="${x0}" y="${y + 3}" width="${w}" height="${ROW - 6}" rx="3" class="${BAR[flag(b)]} ${t && c.pick.has(t) ? 'stroke-2' : ''}"${DASH[b.kind] ?? ''}/>` +
    `<text x="${x0 + 3}" y="${y + 16}" class="pointer-events-none fill-slate-800 text-[10px] dark:fill-slate-100">${esc(fit(`${b.label} ${b.size}`, w))}</text></g>`
}
const band = (g: Geo, y: number, cls: string) => `<rect x="0" y="${y}" width="${g.width}" height="${ROW}" class="${cls}"/>`
const TRACK: Record<string, (c: Ctx, g: Geo, y: number, r: Row) => string> = {
  floor: (_c, g, y) => band(g, y, 'fill-slate-100 dark:fill-slate-900'),
  lane: (c, g, y, r) => (hit(c, [(r as {lane: Lane}).lane.table]) ? band(g, y, 'fill-amber-100 dark:fill-amber-950') : '') + (r as {lane: Lane}).lane.bars.map(barSvg(c, g, y, (r as {lane: Lane}).lane.table)).join(''),
  unplaced: (c, g, y, r) => (r as {unplaced: Bar[]}).unplaced.map(barSvg(c, g, y, null)).join(''),
}
/** Header bucket: time on top (every few ticks when narrow), seatings due to turn below; busy = 3+ (rose), quiet = 0 (grey). */
const HEAT = ['fill-slate-100 dark:fill-slate-900', 'fill-emerald-100 dark:fill-emerald-950', 'fill-amber-100 dark:fill-amber-950', 'fill-rose-200 dark:fill-rose-900']
const tick = (c: Ctx, g: Geo, every: number) => (t: Tick, i: number) => {
  const [x, w] = [X(g, t.start), X(g, t.end) - X(g, t.start)]
  const past = t.end <= c.b.gantt.now ? ' opacity-50' : ''
  return `<g class="${past}"><title>${esc(`${span(t.start, t.end)}: ${t.turns} due to turn`)}</title>${i % every || t.start < g.from ? '' : `<text x="${x + 2}" y="10" class="fill-slate-500 text-[10px]">${hm(t.start)}</text>`}` +
    `<rect x="${x}" y="13" width="${Math.max(0, w - 1)}" height="14" class="${HEAT[Math.min(3, t.turns)]}"/><text x="${x + w / 2}" y="24" text-anchor="middle" class="fill-slate-700 text-[10px] font-semibold dark:fill-slate-200">${w >= 12 ? t.turns : ''}</text>` +
    `<line x1="${x}" x2="${x}" y1="${HEAD}" y2="100%" class="stroke-slate-200 dark:stroke-slate-700"/></g>`
}
const track = (c: Ctx) => {
  const [g, rows] = [geoOf(c), rowsOf(c)]
  const [h, nx, every] = [HEAD + rows.length * ROW, X(g, c.b.gantt.now), Math.max(1, Math.ceil(40 / (c.ui.iv * g.ppm)))]
  return `<svg width="${g.width}" height="${h + 16}" class="block" role="img" aria-label="table timeline"><rect x="0" y="0" width="${nx}" height="${h}" class="fill-slate-400/15"/>` +
    c.b.gantt.ticks.map(tick(c, g, every)).join('') + rows.map((r, i) => TRACK[kindOf(r)](c, g, HEAD + i * ROW, r)).join('') +
    `<line x1="${nx}" x2="${nx}" y1="0" y2="${h + 4}" class="stroke-rose-500 stroke-2"/><text x="${nx + 3}" y="${h + 12}" class="fill-rose-600 text-[10px] font-semibold dark:fill-rose-400">now ${hm(c.b.gantt.now)}</text></svg>`
}
const LEGEND: [string, string][] = [['slot', 'seated'], ['over', 'past turn'], ['done', 'finished'], ['res', 'reserved'], ['late', 'late'], ['plan', 'planned'], ['event', 'event']]
const legend = `<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">${LEGEND.map(([k, l]) =>
  `<span class="inline-flex items-center gap-1 whitespace-nowrap"><svg width="14" height="10"><rect x="1" y="1" width="12" height="8" rx="2" class="${BAR[k]}"${DASH[k] ?? ''}/></svg>${l}</span>`).join('')}</div>`
const emptyGantt = '<p class="py-6 text-center text-sm text-slate-500">Nothing seated, booked or planned in this window.</p>'

// ---- turnover + what to tell a walk-in
const turnRow = (r: Bucket) => {
  const [cls, pre] = [`${r.now ? 'bg-sky-50 font-semibold dark:bg-sky-950' : ''} ${r.proj ? 'italic text-slate-500 dark:text-slate-400' : ''}`, r.proj ? '~' : '']
  return `<tr data-now="${r.now}" class="${cls}"><td class="whitespace-nowrap py-0.5 pr-2">${span(r.start, r.end)}${r.now ? ' <span class="rounded bg-sky-600 px-1 text-[10px] not-italic text-white">now</span>' : ''}</td>` +
    `<td class="whitespace-nowrap text-right">${pre}${signed(r.inCovers)}<span class="text-slate-400"> / ${r.inParties}</span></td><td class="whitespace-nowrap text-right">${pre}${r.outCovers ? `−${r.outCovers}` : '0'}<span class="text-slate-400"> / ${r.outParties}</span></td>` +
    `<td class="whitespace-nowrap text-right font-semibold ${r.net < 0 ? 'text-emerald-700 dark:text-emerald-300' : r.net > 0 ? 'text-rose-700 dark:text-rose-300' : ''}">${signed(r.net)}</td></tr>`
}
const turnTable = (b: Board) => `<table data-turnover class="w-full text-xs tabular-nums"><thead class="text-[11px] text-slate-500"><tr><th class="text-left font-normal">Interval</th><th class="text-right font-normal">In cov / pty</th><th class="text-right font-normal">Out</th><th class="text-right font-normal">Net</th></tr></thead><tbody>${b.turnover.map(turnRow).join('')}</tbody></table>`
const SAY: Record<'ready' | 'wait' | 'none', {cls: string; text: (q: Quote) => string; tell: (q: Quote) => string}> = {
  ready: {cls: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950', text: () => 'ready', tell: q => `Party of ${q.size}: we can seat you right away (${q.label}).`},
  wait: {cls: 'border-amber-500 bg-amber-50 dark:bg-amber-950', text: q => `${q.lo}–${q.hi}m`, tell: q => `Party of ${q.size}: about ${q.lo}–${q.hi} minutes, ${q.ahead} ahead (${q.label}).`},
  none: {cls: 'border-rose-500 bg-rose-50 dark:bg-rose-950', text: () => 'none', tell: q => `Party of ${q.size}: no table seats them; tables must be combined.`},
}
const sayOf = (q: Quote) => (q.none ? 'none' : q.ready ? 'ready' : 'wait')
const quote = (c: Ctx) => (q: Quote) => {
  const s = SAY[sayOf(q)]
  const t = q.none ? '' : byLabel(c.w, q.label)
  return `<button type="button" data-act="bpick" data-tid="${esc(t)}" data-quote="${q.size}" title="${esc(s.tell(q))}"${marked(c, t ? group(c.w, t) : [])} class="${PICKED} flex min-w-16 flex-col items-start whitespace-nowrap rounded-md border-l-4 px-2 py-1 text-left ${s.cls}"><span class="text-[11px] text-slate-500">party of</span><b class="text-base leading-tight">${q.size}</b><span class="text-xs font-semibold">${s.text(q)}</span></button>`
}
const turnPanel = (c: Ctx) => head('Turnover', `Covers in and out per ${c.ui.iv}m; now row marked, ~ italic rows are projected from turn times and bookings. Net + = filling, − = freeing.`) +
  turnTable(c.b) + `<h3 class="mt-3 text-sm font-semibold">What to tell a walk-in</h3>${help('Quote per party size; hover a chip for the line to say.')}<div data-quotes class="flex flex-wrap gap-1">${c.b.quotes.map(quote(c)).join('')}</div>`

// ---- ledger: every spot by state, then seat (+) and clear (−) per interval
const GROUPS: [SpotState, string, string][] = [
  ['seated', 'Seated', 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100'], ['leased', 'Leased', 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100'],
  ['lapsed', 'To bus', 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'], ['reserved', 'Reserved', 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100'],
  ['open', 'Open', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'], ['blocked', 'Blocked', 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'],
]
const sup = (ch: LedgerChip) => (ch.covers !== undefined ? `<sup>${ch.covers}</sup>` : ch.at !== undefined ? `<sup>${hm(ch.at)}</sup>` : '')
const spotChip = (c: Ctx, cls: string) => (ch: LedgerChip) => tref(c, tablesOf(c.w, ch.spot)[0], `${esc(ch.label)}${sup(ch)}`, `rounded px-1.5 py-0.5 text-xs ${cls}`)
const chipRow = (label: string, n: string, chips: string) =>
  `<div class="flex items-start gap-2 py-0.5"><span class="w-28 shrink-0 whitespace-nowrap pt-0.5 text-xs text-slate-500">${label} ${n}</span><div class="flex min-w-0 flex-wrap gap-1">${chips || '<span class="text-xs text-slate-400">—</span>'}</div></div>`
const states = (c: Ctx) => GROUPS.map(([k, l, cls]) => chipRow(l, `(${(c.b.ledger[k] ?? []).length})`, (c.b.ledger[k] ?? []).map(spotChip(c, cls)).join(''))).join('')
const MOVE = {in: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100', out: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'}
const moves = (c: Ctx) => (a: Activity) => chipRow(`${span(a.start, a.end)}`, `<b>${signed(a.net)}</b>`,
  a.moves.map(m => tref(c, m.table, `${esc(m.label)}<sup>${m.kind === 'in' ? '+' : '−'}${m.covers}</sup>`, `rounded px-1.5 py-0.5 text-xs ${MOVE[m.kind]}`)).join(''))
const ledgerPanel = (c: Ctx) => head('Ledger', 'Every spot by state (covers or next booking time). Activity: seated + and cleared − covers per interval, newest first.') +
  `<div data-ledger>${states(c)}</div><h3 class="mt-3 text-sm font-semibold">Activity today</h3><div data-activity>${c.b.activity.slice(0, 8).map(moves(c)).join('') || '<p class="text-xs text-slate-500">No seatings yet today.</p>'}</div>`

// ---- servers: rotation order, then the bus list
const secBadge = (s: SectionRow) => `<span title="${esc(`occupancy ${Math.round(s.occ * 100)}%, ${s.turns} of ${s.need} turns needed`)}" class="whitespace-nowrap rounded px-1 text-[11px] ${s.under ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'bg-slate-100 dark:bg-slate-700'}">${esc(s.name)} ${Math.round(s.occ * 100)}% · ${s.turns}/${s.need}${s.under ? ' · under' : ''}</span>`
const holds = (c: Ctx, s: ServerRow) => [...c.pick].some(t => c.w.ents[t]?.table?.waiter === s.staff)
const serverCard = (c: Ctx) => (s: ServerRow) => `<div data-server="${esc(s.staff)}"${holds(c, s) ? ' data-picked' : ''} class="${PICKED} rounded border border-slate-200 p-2 dark:border-slate-700 ${s.active ? '' : 'opacity-60'}">
<div class="flex items-baseline gap-2"><b class="whitespace-nowrap text-sm">${s.rank ? `#${s.rank}` : '—'}</b><b class="grow truncate text-sm">${esc(s.name)}${s.active ? '' : ' (off)'}</b><span class="whitespace-nowrap text-xs text-slate-500" title="covers seated today (rotation tally)">tally ${s.tally}</span></div>
<div class="flex flex-wrap gap-x-2 text-xs"><span class="whitespace-nowrap"><b>${s.seated}</b> covers now</span><span class="whitespace-nowrap">${s.tables} tables</span>${s.weight !== 1 ? `<span class="whitespace-nowrap">weight x${s.weight}</span>` : ''}</div>
<div class="mt-1 flex flex-wrap gap-1">${s.sections.map(secBadge).join('')}</div></div>`
const busRow = (c: Ctx) => (x: BusItem) => `<li class="flex flex-wrap items-center gap-2 py-0.5 text-xs">${tref(c, x.table, esc(c.w.ents[x.table]?.table?.label ?? x.table), 'rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-950')}<span class="whitespace-nowrap">priority ${x.priority}</span><span class="whitespace-nowrap text-slate-500">waited ${x.waitedMin}m</span><span class="whitespace-nowrap">${esc(c.w.ents[x.staff ?? '']?.staff?.name ?? 'unassigned')}</span></li>`
const serverPanel = (c: Ctx) => head('Servers', 'Rotation order: next up first. Covers now and tables at their tables; section badges show occupancy and turns (amber = underflow).') +
  `<div data-servers class="grid gap-2">${c.b.servers.map(serverCard(c)).join('') || '<p class="text-xs text-slate-500">No staff on the floor.</p>'}</div>` +
  `<h3 class="mt-3 text-sm font-semibold">Bus (${c.b.bus.length})</h3><ul data-buslist>${c.b.bus.map(busRow(c)).join('') || '<li class="text-xs text-slate-500">Nothing to bus.</li>'}</ul>`

// ---- panes and wiring
const none = '<p class="text-sm text-slate-500">Dashboard needs engine.board.</p>'
type Draw = (c: Ctx) => string
const PANELS: [attr: string, tab: string, draw: Draw][] = [
  ['data-bkpis', 'board', c => strip(c.b)], ['data-kpis', 'sim', c => mini(c.b)], ['data-glabels', 'board', c => (rowsOf(c).length ? labels(c) : '')],
  ['data-gtrack', 'board', c => (rowsOf(c).length ? track(c) + legend : emptyGantt)], ['data-bturn', 'board', turnPanel], ['data-bledger', 'board', ledgerPanel], ['data-bserv', 'board', serverPanel],
]
const painter = (read: () => Board | undefined, tab: string, draw: Draw) => (app: App) => {
  const b = seen(app, tab) ? read() : undefined
  return seen(app, tab) ? (b ? draw(ctxOf(app, b)) : tab === 'board' ? none : '') : ''
}
export const kpiPane = '<div data-kpis="ui" class="mb-3 flex flex-wrap items-center gap-1"></div>'
export const boardPane = `<div data-board class="space-y-3"><div data-btool="ui" class="${card}"></div>
<div data-bkpis="ui" class="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]"></div>
<div class="${card} min-w-0">${head('Timeline', 'Tables with anything in the window, grouped by floor; shaded = past. Header counts tables due to turn per interval (rose = busy, grey = quiet).')}
<div class="flex min-w-0"><div data-glabels="ui" class="w-20 shrink-0"></div><div class="min-w-0 grow overflow-x-auto"><div data-gtrack="ui"></div></div></div></div>
<div class="grid gap-3 lg:grid-cols-3"><div data-bturn="ui" class="${card} min-w-0"></div><div data-bledger="ui" class="${card} min-w-0"></div><div data-bserv="ui" class="${card} min-w-0"></div></div></div>`
const ACTS: Record<string, (app: App, ev: Event) => unknown> = {
  bwin: (app, ev) => (bu(app).ahead = Number(arg(ev, 'v'))),
  biv: (app, ev) => (bu(app).iv = Number(arg(ev, 'v'))),
  bpick: (app, ev) => (bu(app).pick = bu(app).pick === arg(ev, 'tid') ? '' : arg(ev, 'tid')),
}
const escape = (app: App) => (e: Event) => (e as KeyboardEvent).key === 'Escape' && (bu(app).pick = '')
export const board = (app: App) => {
  uiOf(app).board ??= {pick: '', iv: 15, ahead: 180}
  const read = reader(app)
  Object.entries(ACTS).forEach(([n, f]) => app.act(n, f))
  PANELS.forEach(([attr, tab, draw]) => app.binder(panel(app, attr, painter(read, tab, draw))))
  app.binder(panel(app, 'data-btool', a => (seen(a, 'board') ? tool(a) : ''))).view(el => el.ownerDocument.addEventListener('keydown', escape(app)))
}
