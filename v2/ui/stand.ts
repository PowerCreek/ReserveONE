// Host stand (U4): greet the next party, record intake chips, voice ladder offers, seat a led party, reply to table-change requests. Free play: no scoring.
// Engine calls go through `ask` (optional: a missing function degrades to a note); writes go through the undoable `commit`.
import {defaultPolicy, having} from '../contracts/index.ts'
import type {App, Components, Decision, Ent, Entity, HostEvent, Id, Level, Patch, Rung, Want, World} from '../contracts/index.ts'
import {commit} from '../kernel/index.ts'
import {ask} from './ask.ts'
import {HKIND, explain, spotName} from './events.ts'
import {note, ping} from './log.ts'
import {arg, esc, panel} from './render.ts'
import {reqOf, seatNow} from './seat.ts'
import {uiOf} from './state.ts'
import {card, on} from './tone.ts'
const H = defaultPolicy.host
const tier = defaultPolicy.queue.tier
/** `party` = the party in focus at the stand; `greeted` = parties the host has greeted this session. */
export interface Stand {party: Id; greeted: Id[]}
declare module '../contracts/kernel.ts' {
  interface UiState {stand?: Stand}
}
type P = Ent<'party'> & Entity
const fresh = (): Stand => ({party: '', greeted: []})
const st = (app: App) => uiOf(app).stand
const world = (app: App) => app.store.state.world
const parties = (w: World) => having(w, 'party') as P[]
const tablesOf = (w: World, spot: Id) => w.ents[spot]?.link?.members ?? [spot]
/** Led, not seated (pinned convention): an accepted offer on a table with no slot there. */
const led = (w: World, e: Entity) => e.offer?.status === 'accepted' && !having(w, 'slot').some(s => s.slot.party === e.id && tablesOf(w, e.offer!.spot).includes(s.slot.table))
const since = (p: P) => p.queue?.since ?? p.reservation?.at ?? 0
/** Parties at the door, next first (policy.queue.tier, then arrival). */
const door = (w: World) => parties(w).filter(p => (p.queue?.status === 'WAITING' || p.reservation?.status === 'ARRIVED') && !led(w, p))
  .sort((a, b) => tier[a.party.kind] - tier[b.party.kind] || since(a) - since(b))
const focus = (app: App) => {
  const w = world(app), at = door(w)
  return (w.ents[st(app).party]?.party ? st(app).party : (at.find(p => !st(app).greeted.includes(p.id)) ?? at[0])?.id) ?? ''
}
const crew = (e?: Entity) => (e?.party ? `${e.party.name || e.party.label} party` : '')
const hostOf = (w: World) => having(w, 'body').find(b => b.body.role === 'host')?.id ?? 'host'
const feat = (f: string) => H.feats[f]?.label ?? f

// ---- narration + verdicts
const line = (app: App, kind: string, msg: string) => {
  note(app, kind, msg)
  const [top, ...rest] = uiOf(app).log
  HKIND[kind] && (uiOf(app).log = [{...top, cls: HKIND[kind]}, ...rest])
}
/** Log and ping host events as plain sentences. Call after the patches are applied (parties and tables are in their new place). */
export const narrate = (app: App, es: HostEvent[]) => es.map(e => explain(e, world(app))).forEach(x => (line(app, x.kind, x.msg), ping(app, {kind: x.kind, msg: x.msg, x: x.x, y: x.y, floor: x.floor})))
const verdict = (app: App, d: Decision | undefined, what: string) => {
  const r = d ?? {ok: false as const, err: `engine.${what} is not available`}
  r.ok ? (commit(app, r.patches), note(app, r.tone, r.msg)) : note(app, 'warn', r.err)
  return r.ok
}

// ---- views: one string per section, concatenated by `draw` (the panel caches the html, so clicks survive ticks)
const pill = 'rounded-full bg-slate-200 px-2 py-0.5 text-xs hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
const btn = 'rounded bg-slate-200 px-2 py-0.5 text-xs hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
const LV: Record<Level, string> = {need: 'bg-rose-600 text-white', strong: 'bg-amber-500 text-white', soft: 'bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-100'}
const part = (title: string, body: string) => `<section><h3 class="mb-1 text-xs font-semibold uppercase text-slate-500">${title}</h3>${body}</section>`
const muted = (s: string) => `<p class="text-xs text-slate-500">${s}</p>`
const act = (name: string, attrs: string, label: string, cls = btn) => `<button data-act="stand-${name}" ${attrs} class="${cls}">${esc(label)}</button>`
const ledRows = (w: World) => parties(w).filter(e => led(w, e)).map(e =>
  `<div class="mt-1 rounded border border-emerald-500 p-1 text-xs">${esc(crew(e))} led to ${esc(spotName(w, e.offer!.spot))}, not seated ${act('seatled', `data-id="${e.id}"`, 'Seat', on)}</div>`).join('')
const greet = (app: App) => {
  const w = world(app), f = focus(app), at = door(w), seen = st(app).greeted
  const chips = at.map(p => act('focus', `data-id="${p.id}"`, `${p.party.label} x${p.party.size}${seen.includes(p.id) ? ' (greeted)' : ''}`, p.id === f ? on : pill)).join(' ')
  const go = seen.includes(f) ? muted(`Greeted ${esc(crew(w.ents[f]))}.`) : act('greet', '', `Greet ${crew(w.ents[f])}`, on)
  return part('At the door', (f ? `<div class="flex flex-wrap gap-1">${chips}</div><div class="mt-1">${go}</div>` : muted('Nobody at the door.')) + ledRows(w))
}
const recorded = (e: Entity) => (e.wants?.list ?? []).filter(x => x.said || e.wants?.heard.includes(x.feat))
const wantChip = (x: Want) => `<span class="rounded-full px-2 py-0.5 text-xs ${LV[x.level]}" title="${esc(x.accord)} of the party">${x.avoid ? 'avoid ' : ''}${esc(feat(x.feat))} | ${x.level} | ${esc(H.whys[x.why]?.label ?? x.why)}</span>`
const intake = (app: App) => {
  const e = world(app).ents[focus(app)]
  const heard = e?.wants?.heard ?? [], known = new Set([...recorded(e ?? {id: ''}).map(x => x.feat), ...heard])
  const none = heard.filter(f => !recorded(e!).some(x => x.feat === f))
  const asks = Object.keys(H.feats).filter(f => !known.has(f)).map(f => act('hear', `data-feat="${f}"`, feat(f), pill)).join(' ')
  return part('Intake', e?.party ? `<div class="flex flex-wrap gap-1">${recorded(e).map(wantChip).join('') || muted('Nothing recorded yet.')}${none.map(f => `<span class="text-xs text-slate-500">asked: no ${esc(feat(f))}</span>`).join(' ')}</div>
<div class="mt-1 flex flex-wrap items-center gap-1"><span class="text-xs text-slate-500">Ask about</span>${asks}</div>` : muted('Pick a party.'))
}
const rung = (r: Rung) => `<li class="py-1 text-xs"><b>${esc(r.step)}</b> ${esc(r.say)} ${r.gives.map(g => `<span class="${pill}">+${esc(feat(g))}</span>`).join(' ')} ${r.lacks.map(m => `<span class="${pill}">-${esc(feat(m.feat))} (${m.level})</span>`).join(' ')}
${r.spot ? act('offer', `data-step="${esc(r.step)}" data-spot="${esc(r.spot)}"`, 'Offer') : ''}</li>`
const open = (w: World, e: Entity) => e.offer?.status === 'open'
  ? `<div class="mb-1 rounded border border-violet-500 p-1 text-xs">Offered ${esc(spotName(w, e.offer.spot))} (${esc(e.offer.step)}) ${act('answer', `data-id="${e.id}" data-yes="1"`, 'Accept', on)} ${act('answer', `data-id="${e.id}" data-yes="0"`, 'Decline')}</div>`
  : ''
const ladder = (app: App) => {
  const w = world(app), f = focus(app), e = w.ents[f]
  const rs = ask(app, 'ladder', f)
  return part('Ladder offers', !e?.party ? muted('Pick a party.') : `${open(w, e)}${rs ? `<ul class="divide-y divide-slate-200 dark:divide-slate-700">${rs.map(rung).join('') || muted('No rungs: the party fits as asked.')}</ul>` : muted('Engine host service not available.')}`)
}
const options = (app: App) => (e: P) => {
  const r = e.request!
  const os = (ask(app, 'options', e.id) ?? []).map(o => act('reply', `data-id="${e.id}" data-r="${esc(o.response)}" title="${esc(o.say)}"`, o.label)).join(' ')
  return `<li class="py-1 text-xs"><b>${esc(crew(e))}</b> at ${esc(spotName(world(app), r.table))} (${esc(H.reasons[r.reason]?.label ?? r.reason)}, ${r.stage}): "${esc(H.reasons[r.reason]?.says ?? r.reason)}"<div class="mt-1 flex flex-wrap gap-1">${os}</div></li>`
}
const requests = (app: App) => {
  const rs = parties(world(app)).filter(e => e.request?.status === 'open')
  return part('Table-change requests', rs.length ? `<ul class="divide-y divide-slate-200 dark:divide-slate-700">${rs.map(options(app)).join('')}</ul>` : muted('No open requests.'))
}
const draw = (app: App) => [greet, intake, ladder, requests].map(f => f(app)).join('')
export const standPane = `<div data-stand="ui.rev" class="${card} space-y-3"></div>`

// ---- acts (each is followed by a `ui.rev` bump so the panel repaints)
const hear = (app: App, ev: Event) => {
  const id = focus(app), before = new Set(recorded(world(app).ents[id]).map(x => x.feat))
  verdict(app, ask(app, 'intake', id, [...(world(app).ents[id]?.wants?.heard ?? []), arg(ev, 'feat')]), 'intake')
  narrate(app, recorded(world(app).ents[id]).filter(x => !before.has(x.feat)).map(x => ({ev: 'heard', party: id, feat: x.feat, level: x.level})))
}
const proposal = (now: number, r: Rung): Components['offer'] => ({spot: r.spot!, step: r.step, gives: r.gives, lacks: r.lacks.map(m => m.feat), at: now, status: 'open'})
const offer = (app: App, ev: Event) => {
  const id = focus(app), r = (ask(app, 'ladder', id) ?? []).find(x => x.step === arg(ev, 'step') && x.spot === arg(ev, 'spot'))
  r?.spot && (commit(app, [{op: 'set', id, parts: {offer: proposal(app.store.state.now, r)}}]), narrate(app, [{ev: 'offered', party: id, spot: r.spot, step: r.step}]), note(app, 'action', `Host: ${r.say}`))
}
const mark = (id: Id, o: Components['offer'], status: Components['offer']['status']): Patch => ({op: 'set', id, parts: {offer: {...o, status}}})
/** Yes: the party is led to the table (accepted, no slot yet: `led` event). No: the offer is declined. */
const answers: Record<'1' | '0', (app: App, id: Id, o: Components['offer']) => HostEvent[]> = {
  1: (app, id, o) => (commit(app, [mark(id, o, 'accepted')]), [{ev: 'answered', party: id, spot: o.spot, yes: true}, {ev: 'led', party: id, table: tablesOf(world(app), o.spot)[0], by: hostOf(world(app))}]),
  0: (app, id, o) => (commit(app, [mark(id, o, 'declined')]), [{ev: 'answered', party: id, spot: o.spot, yes: false}]),
}
const answer = (app: App, ev: Event) => {
  const id = arg(ev, 'id'), o = world(app).ents[id]?.offer
  o && narrate(app, answers[arg(ev, 'yes') as '1'](app, id, o))
}
const seatled = (app: App, ev: Event) => {
  const e = world(app).ents[arg(ev, 'id')]
  e?.party && e.offer && seatNow(app, {...reqOf(e as P), tables: tablesOf(world(app), e.offer.spot)})
}
const reply = (app: App, ev: Event) => {
  const id = arg(ev, 'id'), r = ask(app, 'respond', id, arg(ev, 'r'))
  r ? (commit(app, r.patches), narrate(app, r.events), r.says && note(app, 'info', `${crew(world(app).ents[id])}: "${r.says}"`)) : note(app, 'warn', 'engine.respond is not available')
}
const acts: Record<string, (app: App, ev: Event) => unknown> = {
  'stand-focus': (a, ev) => (st(a).party = arg(ev, 'id')),
  'stand-greet': a => {
    const id = focus(a)
    st(a).party = id
    st(a).greeted = [...st(a).greeted, id]
    narrate(a, [{ev: 'greeted', party: id, by: hostOf(world(a))}])
  },
  'stand-hear': hear, 'stand-offer': offer, 'stand-answer': answer, 'stand-seatled': seatled, 'stand-reply': reply,
}
export const stand = (app: App) => {
  Object.assign(uiOf(app), {stand: uiOf(app).stand ?? fresh()})
  Object.entries(acts).forEach(([n, f]) => app.act(n, (a, ev) => (f(a, ev), uiOf(a).rev++)))
  app.binder(panel(app, 'data-stand', draw))
  app.store.watch('ui.scenario', () => (Object.assign(uiOf(app), {stand: fresh()}), uiOf(app).rev++))
}
