// Host stand (U4, wave 4): renders the engine's StandView only (`ask(app, 'stand', focus)`) and dispatches Cmds through `run`.
// Pick a party at the door, optionally ask about a qualifier, then one click seats it at an offer. Free play: no scoring.
import type {App, DoorRow, Id, Offer, Placed, Policy, ReqRow, SeatedRow, StandView, Want, World} from '../contracts/index.ts'
import {run} from './act.ts'
import {ask, policyOf} from './ask.ts'
import {crew, spotName} from './events.ts'
import {arg, esc, panel} from './render.ts'
import {uiOf} from './state.ts'
import {card, choice, cta, ctaSm, ghost} from './tone.ts'
/** `party` = the party the host picked at the door (the view falls back to the next one once it is seated or gone). */
export interface Stand {party: Id}
declare module '../contracts/kernel.ts' {
  interface UiState {stand?: Stand}
}
const st = (app: App) => uiOf(app).stand!
const world = (app: App) => app.store.state.world
interface Ctx {w: World; p: Policy; v: StandView}

// ---- pieces
const pill = 'rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700'
const askCls = 'rounded-full bg-slate-200 px-2 py-0.5 text-xs hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
const LV: Record<Want['level'], string> = {need: 'bg-rose-600 text-white', strong: 'bg-amber-500 text-white', soft: 'bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-100'}
const part = (title: string, body: string) => `<section><h3 class="mb-1 text-xs font-semibold uppercase text-slate-500">${title}</h3>${body}</section>`
const muted = (s: string) => `<p class="text-xs text-slate-500">${s}</p>`
const act = (name: string, attrs: string, label: string, cls: string, extra = '') => `<button type="button" data-act="stand-${name}" ${attrs} class="${cls}"${extra}>${esc(label)}</button>`
const ul = (rows: string[]) => `<ul class="divide-y divide-slate-200 dark:divide-slate-700">${rows.join('')}</ul>`
const feat = (c: Ctx, f: string) => c.p.host.feats[f]?.label ?? f
const staffName = (w: World, id?: Id | null) => (id ? (w.ents[id]?.staff?.crew?.join(' + ') ?? w.ents[id]?.staff?.name ?? id) : '')
const named = (l: string) => l.replaceAll('+', ' + ') // labels show as stored; a merge reads `T17 + T18`
const spot = spotName
const KIND: Record<string, string> = {W: 'Walk-in', P: 'Priority', R: 'Reservation', V: 'VIP'}

// ---- at the door: party cards as the radiogroup (selecting one focuses it; greeting is implicit)
const partyCard = (c: Ctx) => (r: DoorRow) =>
  `<button type="button" role="radio" aria-checked="${r.party === c.v.focus}" data-act="stand-focus" data-id="${esc(r.party)}" class="${choice(r.party === c.v.focus)}"><span class="font-semibold">${esc(r.label)} x${r.size} ${esc(r.name)}</span><span class="text-slate-500">${KIND[r.kind] ?? r.kind}, waiting ${r.waitedMin}m</span></button>`
const door = (c: Ctx) => part(`At the door <span class="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] normal-case dark:bg-slate-700">${c.v.door.length}</span>`,
  c.v.door.length ? `<div role="radiogroup" aria-label="Parties at the door" class="flex flex-wrap gap-2">${c.v.door.map(partyCard(c)).join('')}</div>` : muted('Nobody at the door.'))

// ---- intake: recorded wants, then an optional compact "Ask about" row
const want = (c: Ctx) => (x: Want) => `<span class="rounded-full px-2 py-0.5 text-xs ${LV[x.level]}" title="${esc(x.accord)} of the party">${x.avoid ? 'avoid ' : ''}${esc(feat(c, x.feat))} | ${x.level} | ${esc(c.p.host.whys[x.why]?.label ?? x.why)}</span>`
const known = (c: Ctx) => [...c.v.wants.map(want(c)), ...c.v.denied.map(f => `<span class="text-xs text-slate-500">asked: no ${esc(feat(c, f))}</span>`)].join(' ')
const asks = (c: Ctx) => c.v.unasked.map(f => act('hear', `data-feat="${esc(f)}"`, feat(c, f), askCls)).join(' ')
/** Recorded wants first (they shape the offers), then the optional "Ask about" row below the seat buttons. */
const intake = (c: Ctx) => (c.v.wants.length || c.v.denied.length ? `<div class="mb-2 flex flex-wrap items-center gap-1">${known(c)}</div>` : '')
const asking = (c: Ctx) => (c.v.unasked.length ? `<div class="mt-2 flex flex-wrap items-center gap-1"><span class="text-xs text-slate-500">Ask about</span>${asks(c)}</div>` : '')

// ---- offers: the top one is the CTA, each further one a row; one click seats, `No` drops that spot
const chips = (c: Ctx, o: Offer) => [...o.gives.map(g => `<span class="${pill}">+${esc(feat(c, g))}</span>`), ...o.lacks.map(m => `<span class="${pill}">-${esc(feat(c, m.feat))} (${m.level})</span>`)].join(' ')
const squeeze = (c: Ctx, o: Offer) => (o.squeezes?.length ? `<span class="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">squeezes ${esc(o.squeezes.map(id => crew(c.w, id)).join(', '))}</span>` : '')
const about = (c: Ctx, o: Offer) => `<p class="text-xs">${esc(o.say)} ${chips(c, o)} <span class="text-slate-500">server ${esc(staffName(c.w, o.server) || 'none yet')}</span> ${squeeze(c, o)}</p>`
const at = (o: Offer) => `data-spot="${esc(o.spot)}" data-step="${esc(o.step)}"`
const no = (o: Offer) => act('decline', at(o), 'No', ghost, ` aria-label="No to ${esc(o.step)}"`)
const top = (c: Ctx, o: Offer) => `<div data-offer="top" class="space-y-1 rounded-lg border border-sky-600 p-2">${about(c, o)}<div class="flex gap-2">${act('seat', at(o), `Seat ${crew(c.w, c.v.focus!)} at ${spot(c.w, o.spot!)}`, cta)}${no(o)}</div></div>`
const row = (c: Ctx) => (o: Offer) => `<li data-offer="${esc(o.spot)}" class="flex flex-wrap items-center gap-2 py-1"><b class="text-xs">${esc(spot(c.w, o.spot!))}</b><div class="grow">${about(c, o)}</div>${act('seat', at(o), 'Seat', ctaSm)}${no(o)}</li>`
const wait = (o: Offer) => `<li class="py-1 text-xs text-slate-500">${esc(o.say)}</li>`
const turns = (c: Ctx) => (c.v.rotation.length ? `<p class="mb-1 text-xs"><span class="text-slate-500">Rotation order, all servers and bartenders</span> <b>${esc(staffName(c.w, c.v.rotation[0]))}</b>${c.v.rotation.length > 1 ? `, then ${esc(c.v.rotation.slice(1, 5).map(id => staffName(c.w, id)).join(', '))}` : ''}</p>` : '')
const offers = (c: Ctx) => {
  const [first, ...more] = c.v.offers.filter(o => o.spot)
  const waits = c.v.offers.filter(o => !o.spot)
  const body = first ? top(c, first) + (more.length || waits.length ? ul([...more.map(row(c)), ...waits.map(wait)]) : '') : waits.length ? ul(waits.map(wait)) : muted('No table fits right now.')
  return turns(c) + body
}
const focus = (c: Ctx) => (c.v.focus ? part(`Seat ${esc(crew(c.w, c.v.focus))}`, intake(c) + offers(c) + asking(c)) : '')

// ---- coming up, requests, seated (tell)
const clock = (t: number) => new Date(t).toTimeString().slice(0, 5)
const plan = (c: Ctx) => (x: Placed) =>
  `<li class="py-1 text-xs"><b>${esc(c.w.ents[x.party]?.party?.name ?? x.party)}</b> x${x.size} at ${clock(x.at)}: ${x.spot ? `${esc(named(x.label))}${x.merge ? ' pushed together' : ''}, free by ${clock(x.free)}` : '<span class="text-rose-600">no table will be free in time</span>'}</li>`
const coming = (c: Ctx) => part('Coming up', c.v.outlook.length ? ul(c.v.outlook.map(plan(c))) : muted('No reservations to place soon.'))
const request = (c: Ctx) => (r: ReqRow) => {
  const os = r.options.map(o => act('reply', `data-id="${esc(r.party)}" data-r="${esc(o.response)}" title="${esc(o.say)}"`, o.label, ghost)).join(' ')
  return `<li class="py-1 text-xs"><b>${esc(crew(c.w, r.party))}</b> at ${esc(spot(c.w, r.table))} (${esc(c.p.host.reasons[r.reason]?.label ?? r.reason)}, ${r.stage}): "${esc(c.p.host.reasons[r.reason]?.says ?? r.reason)}"<div class="mt-1 flex flex-wrap gap-1">${os}</div></li>`
}
const requests = (c: Ctx) => part('Table-change requests', c.v.requests.length ? ul(c.v.requests.map(request(c))) : muted('No open requests.'))
const AWARE: Record<SeatedRow['aware'], (who: string, r: SeatedRow) => string> = {
  seen: who => `<span class="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">${esc(who || 'server')} sees it</span>`,
  told: who => `<span class="rounded-full bg-sky-600 px-2 py-0.5 text-xs text-white">Told ${esc(who || 'server')}</span>`,
  pending: (who, r) => `<span class="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">Not told yet</span> ${act('tell', `data-table="${esc(r.table)}"`, `Tell ${who || 'server'}`, ctaSm)}`,
}
const sat = (c: Ctx) => (r: SeatedRow) =>
  `<li class="flex flex-wrap items-center gap-1 py-1 text-xs"><b>${esc(crew(c.w, r.party))}</b> at ${esc(spot(c.w, r.table))} (${esc(c.p.service.areas[r.area]?.label ?? r.area)}) ${AWARE[r.aware](c.w.ents[r.server ?? '']?.staff?.name ?? '', r)}</li>`
const seated = (c: Ctx) => part('Seated: tell the server', c.v.seated.length ? `<div class="max-h-48 overflow-y-auto">${ul(c.v.seated.map(sat(c)))}</div>` : muted('Nobody seated.'))
const draw = (app: App) => {
  const v = ask(app, 'stand', st(app).party)
  const c = v && {w: world(app), p: policyOf(app), v}
  return c ? [door, focus, coming, requests, seated].map(f => f(c)).join('') : muted('Engine host service not available.')
}
export const standPane = `<div data-stand="ui.rev" class="${card} space-y-3"></div>`

// ---- acts: each one Cmd (the party in focus is the view's), then a `ui.rev` bump so the panel repaints
const focused = (app: App) => ask(app, 'stand', st(app).party)?.focus ?? ''
const acts: Record<string, (app: App, ev: Event) => unknown> = {
  'stand-focus': (a, ev) => (st(a).party = arg(ev, 'id')),
  'stand-hear': (a, ev) => run(a, {do: 'hear', party: focused(a), feat: arg(ev, 'feat')}),
  'stand-seat': (a, ev) => run(a, {do: 'seat', party: focused(a), spot: arg(ev, 'spot'), step: arg(ev, 'step')}),
  'stand-decline': (a, ev) => run(a, {do: 'decline', party: focused(a), spot: arg(ev, 'spot'), step: arg(ev, 'step')}),
  'stand-reply': (a, ev) => run(a, {do: 'reply', party: arg(ev, 'id'), response: arg(ev, 'r')}),
  'stand-tell': (a, ev) => run(a, {do: 'tell', table: arg(ev, 'table')}),
}
export const stand = (app: App) => {
  Object.assign(uiOf(app), {stand: uiOf(app).stand ?? {party: ''}})
  Object.entries(acts).forEach(([n, f]) => app.act(n, (a, ev) => (f(a, ev), uiOf(a).rev++)))
  app.binder(panel(app, 'data-stand', draw))
  app.store.watch('ui.scenario', () => ((uiOf(app).stand = {party: ''}), uiOf(app).rev++))
}
