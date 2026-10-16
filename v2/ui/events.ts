// Every SimEvent and HostEvent becomes a narrated line (kind, msg) and a floor ping (where). A table of describers keyed by event name (C3).
import {isMerge, partsOf} from '../contracts/index.ts'
import type {HostEvent, Id, Level, Policy, ServiceEvent, SimEvent, World} from '../contracts/index.ts'
import {floorOf, locate} from './geo.ts'
type Ev = SimEvent | HostEvent | ServiceEvent
type Line = {msg: string; at: Id}
type Hp = Policy['host']
type Describe = {[K in Ev['ev']]: (e: Extract<Ev, {ev: K}>, w: World, H: Hp) => Line}
/** Ping ring per host event (literals so the build scanner sees them); log badges and sim kinds are in tone.ts. */
export const HRING: Record<string, string> = {
  greeted: 'stroke-sky-500', heard: 'stroke-indigo-500', quoted: 'stroke-slate-500', offered: 'stroke-violet-500', answered: 'stroke-emerald-500',
  led: 'stroke-teal-500', asked: 'stroke-orange-500', replied: 'stroke-fuchsia-500', moved: 'stroke-cyan-500', mood: 'stroke-pink-500', told: 'stroke-lime-500',
}
const who = (w: World, id: Id) => w.ents[id]?.party && `${w.ents[id]!.party!.label} x${w.ents[id]!.party!.size}`
/** Table label; a link group reads as its primary member, a merge as `5+6`. */
const label = (w: World, id: Id) => w.ents[id]?.table?.label ?? id
/** A spot as the host says it: bare table numbers read as T-numbers ("T5+T6"). */
const said = (l: string) => (/^\d+$/.test(l) ? `T${l}` : l)
export const spotName = (w: World, id: Id) => (isMerge(id) ? partsOf(w, id) : partsOf(w, id).slice(0, 1)).map(t => said(label(w, t))).join('+')
const nm = (w: World, id: Id) => w.ents[id]?.staff?.name ?? id
/** The host is "You" in the player's own log; any other teller is named. */
const teller = (w: World, id: Id) => ({host: 'You'} as Record<string, string>)[w.ents[id]?.body?.role ?? 'host'] ?? actor(w, id)
const ROLE = {host: 'The host', server: 'A server', busser: 'A busser', guest: 'A guest'}
const actor = (w: World, id: Id) => w.ents[id]?.staff?.name ?? ROLE[w.ents[id]?.body?.role ?? 'host']
export const crew = (w: World, id: Id) => (w.ents[id]?.party ? `${w.ents[id]!.party!.name || w.ents[id]!.party!.label} party` : id)
const feat = (H: Hp, f: string) => H.feats[f]?.label ?? f
/** What an offer gave: its best feature ("the banquette"), else the table it points at. */
const thing = (w: World, party: Id, spot: Id, H: Hp) => {
  const o = w.ents[party]?.offer
  const g = o?.spot === spot ? o.gives[0] : undefined
  return g ? `the ${feat(H, g)}` : spotName(w, spot)
}
const listed = (w: World, id: Id) => w.ents[id]?.queue?.status === 'WAITING' || ['BOOKED', 'ARRIVED', 'QUEUED'].includes(w.ents[id]?.reservation?.status ?? '')
const WANT: Record<Level, string> = {need: 'needs', strong: 'strongly wants', soft: 'would like'}
const MOVE = {swap: 'moving them', offer: 'offering a table', stay: 'staying put'}
const sign = (n: number) => (n > 0 ? `+${n}` : String(n))
const anchor = (w: World, spot: Id) => partsOf(w, spot)[0]
const reason = (H: Hp, r: string) => H.reasons[r]?.label ?? r
const heard = (e: Extract<HostEvent, {ev: 'heard'}>, w: World, H: Hp): Line => {
  const want = w.ents[e.party]?.wants?.list.find(x => x.feat === e.feat)
  const why = want && H.whys[want.why] ? ` (${H.whys[want.why].label})` : ''
  return {msg: `${crew(w, e.party)} ${WANT[e.level]}${want?.avoid ? ' to avoid' : ''} the ${feat(H, e.feat)}${why}`, at: e.party}
}
/** The server a seating went to (recorded on the table), as a log suffix. */
const waiter = (w: World, table: Id) => ((n?: string) => (n ? `, server ${n}` : ''))(w.ents[w.ents[table]?.table?.waiter ?? '']?.staff?.name)
const describe: Describe = {
  arrived: (e, w) => ({msg: `${who(w, e.party) ?? e.party} arrived at the door`, at: e.party}),
  seated: (e, w) => ({msg: `${who(w, e.party) ?? e.party} seated at ${spotName(w, e.table)} by ${teller(w, e.by)}${waiter(w, e.table)}`, at: e.table}),
  served: (e, w) => ({msg: `${nm(w, e.by)} served ${spotName(w, e.table)}`, at: e.table}),
  cleared: (e, w) => ({msg: `${nm(w, e.by)} cleared ${spotName(w, e.table)}`, at: e.table}),
  left: (e, w, H) => ({msg: `${who(w, e.party) ?? e.party} left${w.ents[e.party]?.offer?.status === 'declined' ? ` the list after declining ${thing(w, e.party, w.ents[e.party]!.offer!.spot, H)}` : ''}`, at: e.party}),
  stuck: (e, w) => ({msg: `${nm(w, e.unit)} stuck on ${e.task.do}: ${e.why}`, at: e.unit}),
  greeted: (e, w) => ({msg: `${actor(w, e.by)} greeted ${crew(w, e.party)} at the door`, at: e.party}),
  heard,
  quoted: (e, w) => ({msg: `${crew(w, e.party)} was quoted ${e.min} min`, at: e.party}),
  offered: (e, w, H) => ({msg: `The host offered ${crew(w, e.party)} ${thing(w, e.party, e.spot, H)} at ${spotName(w, e.spot)} (${e.step})`, at: anchor(w, e.spot)}),
  answered: (e, w, H) => ({msg: `${crew(w, e.party)} ${e.yes ? 'accepted' : 'declined'} ${thing(w, e.party, e.spot, H)}${e.yes || listed(w, e.party) ? '' : ' and left the list'}`, at: anchor(w, e.spot)}),
  led: (e, w) => ({msg: `${actor(w, e.by)} led ${crew(w, e.party)} to ${spotName(w, e.table)}`, at: anchor(w, e.table)}),
  asked: (e, w, H) => ({msg: `${crew(w, e.party)} asked for another table (${reason(H, e.reason)}${e.stage === 'seated' ? ', already seated' : ''}): "${H.reasons[e.reason]?.says ?? e.reason}"`, at: e.party}),
  replied: (e, w, H) => ({msg: `The host answered the ${reason(H, e.reason)} request of ${crew(w, e.party)} with "${H.responses[e.response]?.label ?? e.response}": ${MOVE[e.move]} (mood ${sign(e.mood)})`, at: e.party}),
  moved: (e, w) => ({msg: `${crew(w, e.party)} moved from ${spotName(w, e.from)} to ${spotName(w, e.to)}`, at: anchor(w, e.to)}),
  told: (e, w) => ({msg: `${teller(w, e.by)} told ${w.ents[e.server]?.staff?.name ?? 'the server'} the ${crew(w, e.party)} is at ${spotName(w, e.table)}`, at: e.table}),
  mood: (e, w, H) => ({msg: `${crew(w, e.party)} mood ${e.delta < 0 ? 'fell' : 'rose'} by ${Math.abs(e.delta)}: ${reason(H, e.why)}`, at: e.party}),
}
/** Call before the tick's patches are applied: departed parties and bodies are still in the world. Labels come from the policy (`policyOf(app)`). */
export const explain = (e: Ev, w: World, p: Policy) => {
  const line = (describe[e.ev] as (e: Ev, w: World, H: Hp) => Line)(e, w, p.host)
  return {kind: e.ev as string, msg: line.msg, ...locate(w, line.at), floor: floorOf(w, line.at)}
}
